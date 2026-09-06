import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OpenAICompatibleVisualCriticProvider, OpenRouterAIProvider } from '@game-presentation/renderer/studio';
import { activateTrainedModel, ModelRegistryRouter, rollbackTrainedModel, runtimeModelRegistry } from '@game-presentation/authoring-harness';
import { CriticDatasetManifestSchema, TrainingRunRecordSchema } from '@game-presentation/local-training';
import { TrainedModelRegistrySchema } from '@game-presentation/contracts';
import { recordStudioUserDecision, runStudioDesignJob, runStudioVisualCritic } from './design-job.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const port = Number(process.env.PPT_DESIGNER_PORT ?? '8766');
const origin = `http://127.0.0.1:${port}`;
const trainedRegistryPath = resolve(repositoryRoot, 'packages/local-training/artifacts/r9-model-registry.json');

async function readTrainedRegistry() {
  return TrainedModelRegistrySchema.parse(JSON.parse(await readFile(trainedRegistryPath, 'utf8')));
}

async function saveTrainedRegistry(registry: ReturnType<typeof TrainedModelRegistrySchema.parse>) {
  await writeFile(trainedRegistryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}

function json(response: ServerResponse, status: number, value: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(value));
}

function cors(response: ServerResponse) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > 2 * 1024 * 1024) throw new Error('요청이 너무 큽니다.');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = createServer(async (request, response) => {
  cors(response);
  if (request.method === 'OPTIONS') { response.statusCode = 204; response.end(); return; }
  const url = new URL(request.url ?? '/', origin);
  try {
    if (request.method === 'GET' && url.pathname === '/api/designer/health') {
      json(response, 200, { ok: true, service: 'game-ppt-designer-v1', localCriticEndpoint: process.env.LOCAL_CRITIC_ENDPOINT ?? 'http://127.0.0.1:8000/v1/chat/completions', localCriticModel: process.env.LOCAL_CRITIC_MODEL ?? 'afx-team/UI-UX', openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY) });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/designer/training/status') {
      const manifest = CriticDatasetManifestSchema.parse(JSON.parse(await readFile(resolve(repositoryRoot, 'packages/local-training/data/critic-smoke-v1.manifest.json'), 'utf8')));
      const run = TrainingRunRecordSchema.parse(JSON.parse(await readFile(resolve(repositoryRoot, 'packages/local-training/artifacts/r8-smoke/run-record.json'), 'utf8')));
      const reasonTags = Object.entries(manifest.examples.flatMap((example) => example.issueTypes).reduce<Record<string, number>>((counts, tag) => ({ ...counts, [tag]: (counts[tag] ?? 0) + 1 }), {})).sort((left, right) => right[1] - left[1]);
      json(response, 200, {
        evaluationCount: manifest.examples.length,
        readyCount: manifest.examples.filter((example) => example.readiness === 'ready').length,
        rejectCount: manifest.examples.filter((example) => example.readiness === 'not-ready').length,
        pairwiseCount: 0,
        reasonTags,
        dataset: { datasetId: manifest.datasetId, sha256: manifest.datasetSha256, trainCount: manifest.trainIds.length, validationCount: manifest.validationIds.length },
        eligibility: { meaningfulTraining: false, smokeTraining: true, reason: '사람 평가 4건, Ready 사례 0건으로 품질 학습 기준에는 부족합니다.' },
        latestRun: run,
      });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/designer/models') {
      const registry = await readTrainedRegistry();
      json(response, 200, registry);
      return;
    }
    const activateModelMatch = url.pathname.match(/^\/api\/designer\/models\/([^/]+)\/activate$/u);
    if (request.method === 'POST' && activateModelMatch) {
      const registry = activateTrainedModel(await readTrainedRegistry(), decodeURIComponent(activateModelMatch[1]!), new Date().toISOString());
      await saveTrainedRegistry(registry); json(response, 200, registry); return;
    }
    if (request.method === 'POST' && url.pathname === '/api/designer/models/rollback') {
      const registry = rollbackTrainedModel(await readTrainedRegistry(), new Date().toISOString());
      await saveTrainedRegistry(registry); json(response, 200, registry); return;
    }
    if (request.method === 'POST' && url.pathname === '/api/designer/jobs') {
      const job = await runStudioDesignJob(await body(request) as never, { repositoryRoot, publicBaseUrl: origin });
      json(response, 200, job.output);
      return;
    }
    const fileMatch = url.pathname.match(/^\/api\/designer\/jobs\/([^/]+)\/([^/]+)$/u);
    if (request.method === 'GET' && fileMatch) {
      const artifactId = decodeURIComponent(fileMatch[1]!);
      const filename = decodeURIComponent(fileMatch[2]!);
      if (!/^slide-[0-9]+-[a-z0-9]+$/iu.test(artifactId) || basename(filename) !== filename) throw new Error('잘못된 파일 경로입니다.');
      const path = resolve(repositoryRoot, 'output/studio-jobs', artifactId, filename);
      const bytes = await readFile(path);
      const extension = filename.split('.').at(-1)?.toLowerCase();
      const types: Record<string, string> = { png: 'image/png', html: 'text/html; charset=utf-8', pdf: 'application/pdf', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
      response.statusCode = 200; response.setHeader('Content-Type', types[extension ?? ''] ?? 'application/octet-stream'); response.end(bytes); return;
    }
    const criticMatch = url.pathname.match(/^\/api\/designer\/jobs\/([^/]+)\/critic$/u);
    if (request.method === 'POST' && criticMatch) {
      const artifactId = decodeURIComponent(criticMatch[1]!);
      if (!/^slide-[0-9]+-[a-z0-9]+$/iu.test(artifactId)) throw new Error('잘못된 작업 번호입니다.');
      const directory = resolve(repositoryRoot, 'output/studio-jobs', artifactId);
      const metadataPath = resolve(directory, 'job.json');
      const requestBody = await body(request) as { provider?: 'local' | 'openrouter' };
      const router = new ModelRegistryRouter(runtimeModelRegistry(process.env));
      const model = router.route(requestBody.provider === 'openrouter'
        ? { role: 'visual-critic', capabilities: { vision: true, structuredOutput: true }, policy: 'explicit-remote', approvedRemoteModelId: process.env.OPENROUTER_CRITIC_MODEL_ID ?? 'openrouter-critic' }
        : { role: 'visual-critic', capabilities: { vision: true, structuredOutput: true }, policy: 'explicit-local' });
      const provider = model.provider === 'openrouter'
        ? new OpenRouterAIProvider({ apiKey: process.env.OPENROUTER_API_KEY ?? '', model: model.baseModel, reasoningEffort: 'medium' })
        : new OpenAICompatibleVisualCriticProvider({ endpoint: process.env.LOCAL_CRITIC_ENDPOINT ?? 'http://127.0.0.1:8000/v1/chat/completions', model: model.baseModel, localExecution: true });
      const result = await runStudioVisualCritic({ metadataPath, provider });
      json(response, 200, { output: result.output, run: result.run }); return;
    }
    const decisionMatch = url.pathname.match(/^\/api\/designer\/jobs\/([^/]+)\/decision$/u);
    if (request.method === 'POST' && decisionMatch) {
      const artifactId = decodeURIComponent(decisionMatch[1]!);
      if (!/^slide-[0-9]+-[a-z0-9]+$/iu.test(artifactId)) throw new Error('잘못된 작업 번호입니다.');
      const metadataPath = resolve(repositoryRoot, 'output/studio-jobs', artifactId, 'job.json');
      const result = await recordStudioUserDecision({ metadataPath, event: await body(request) as never });
      json(response, 200, { output: result.output, eventId: result.event.eventId }); return;
    }
    json(response, 404, { error: 'Not found' });
  } catch (error) { json(response, 400, { error: error instanceof Error ? error.message : String(error) }); }
});

server.listen(port, '127.0.0.1', () => process.stdout.write(`Game PPT Designer service: ${origin}\n`));
