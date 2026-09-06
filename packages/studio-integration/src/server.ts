import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseTransformersVisualCriticProvider, OpenAICompatibleVisualCriticProvider, OpenRouterAIProvider, PeftVisualCriticProvider } from '@game-presentation/renderer/studio';
import { activateTrainedModel, mergeTrainedModelsForRouting, ModelRegistryRouter, recordVisualCriticBenchmark, rollbackTrainedModel, runtimeModelRegistry } from '@game-presentation/authoring-harness';
import { assessTrainingEligibility, CriticDatasetManifestSchema, TrainingRunRecordSchema } from '@game-presentation/local-training';
import { TrainedModelRegistrySchema } from '@game-presentation/contracts';
import { recordStudioCandidatePreference, recordStudioUserDecision, runStudioDesignJob, runStudioVisualCritic } from './design-job.js';
import { LocalProjectStore } from './project-store.js';
import { trainingStartDecision } from './training-workflow.js';
import { runTrainedVisualCriticBenchmark } from './model-benchmark.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const port = Number(process.env.PPT_DESIGNER_PORT ?? '8766');
const origin = `http://127.0.0.1:${port}`;
const trainedRegistryPath = resolve(repositoryRoot, 'packages/local-training/artifacts/r9-model-registry.json');
const projectStore = new LocalProjectStore(resolve(repositoryRoot, 'workspace/projects'));
const trainingRunsRoot = resolve(repositoryRoot, 'workspace/training-runs');

async function readTrainedRegistry() {
  return TrainedModelRegistrySchema.parse(JSON.parse(await readFile(trainedRegistryPath, 'utf8')));
}

async function saveTrainedRegistry(registry: ReturnType<typeof TrainedModelRegistrySchema.parse>) {
  await writeFile(trainedRegistryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}

async function modelRegistryView() {
  const trained = await readTrainedRegistry();
  const router = new ModelRegistryRouter(mergeTrainedModelsForRouting(runtimeModelRegistry(process.env), trained));
  let routerVisualCriticModelId: string | null = null;
  try {
    routerVisualCriticModelId = router.route({ role: 'visual-critic', capabilities: { vision: true, structuredOutput: true }, policy: 'local-first' }).modelId;
  } catch { routerVisualCriticModelId = null; }
  return { ...trained, routerVisualCriticModelId };
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
        eligibility: { meaningfulTraining: assessTrainingEligibility(manifest).qualityTraining, smokeTraining: assessTrainingEligibility(manifest).smokeTraining, reason: assessTrainingEligibility(manifest).reasons.join(' ') },
        latestRun: run,
      });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/designer/training/dataset/build') {
      const manifest = CriticDatasetManifestSchema.parse(JSON.parse(await readFile(resolve(repositoryRoot, 'packages/local-training/data/critic-smoke-v1.manifest.json'), 'utf8')));
      json(response, 200, { datasetId: manifest.datasetId, datasetSha256: manifest.datasetSha256, trainCount: manifest.trainIds.length, validationCount: manifest.validationIds.length, eligibility: assessTrainingEligibility(manifest) }); return;
    }
    if (request.method === 'POST' && url.pathname === '/api/designer/training/start') {
      const requestBody = await body(request) as { mode?: 'quality' | 'smoke' };
      const manifest = CriticDatasetManifestSchema.parse(JSON.parse(await readFile(resolve(repositoryRoot, 'packages/local-training/data/critic-smoke-v1.manifest.json'), 'utf8')));
      const eligibility = assessTrainingEligibility(manifest);
      const mode = requestBody.mode === 'smoke' ? 'smoke' : 'quality';
      const decision = trainingStartDecision({ mode, eligibility, smokeEnabled: process.env.PPT_ALLOW_SMOKE_TRAINING === 'true' });
      if (!decision.allowed) { json(response, 409, { error: decision.reason, eligibility }); return; }
      if (mode === 'quality') { json(response, 409, { error: '의미 있는 품질 학습은 충분한 데이터와 별도 승인된 학습 설정이 모두 준비된 뒤 실행합니다.', eligibility }); return; }
      const runId = `training-${Date.now()}-${randomUUID().slice(0, 8)}`; const runDirectory = resolve(trainingRunsRoot, runId); await mkdir(runDirectory, { recursive: true });
      const statusPath = resolve(runDirectory, 'status.json'); await writeFile(statusPath, JSON.stringify({ runId, mode, status: 'running', startedAt: new Date().toISOString() }, null, 2));
      const python = process.env.LOCAL_TRAINING_PYTHON ?? 'python';
      const child = spawn(python, [resolve(repositoryRoot, 'packages/local-training/scripts/train_visual_critic.py'), '--root', repositoryRoot, '--manifest', 'packages/local-training/data/critic-smoke-v1.manifest.json', '--output', `workspace/training-runs/${runId}/artifact`], { windowsHide: true, detached: false, stdio: 'ignore' });
      child.on('close', (code) => { void writeFile(statusPath, JSON.stringify({ runId, mode, status: code === 0 ? 'completed-smoke' : 'failed', exitCode: code, finishedAt: new Date().toISOString() }, null, 2)); });
      json(response, 202, { runId, mode, status: 'running' }); return;
    }
    const trainingRunMatch = url.pathname.match(/^\/api\/designer\/training\/runs\/([^/]+)$/u);
    if (request.method === 'GET' && trainingRunMatch) {
      const runId = decodeURIComponent(trainingRunMatch[1]!); if (!/^training-[a-z0-9-]+$/iu.test(runId)) throw new Error('잘못된 training run ID입니다.');
      json(response, 200, JSON.parse(await readFile(resolve(trainingRunsRoot, runId, 'status.json'), 'utf8'))); return;
    }
    if (request.method === 'GET' && url.pathname === '/api/designer/models') {
      json(response, 200, await modelRegistryView());
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/designer/projects') {
      json(response, 200, { projects: await projectStore.list(url.searchParams.get('query') ?? '') }); return;
    }
    if (request.method === 'POST' && url.pathname === '/api/designer/projects') {
      const value = await body(request) as { name?: string };
      json(response, 201, await projectStore.create(value.name ?? '')); return;
    }
    const projectMatch = url.pathname.match(/^\/api\/designer\/projects\/([^/]+)$/u);
    if (request.method === 'GET' && projectMatch) { json(response, 200, await projectStore.get(decodeURIComponent(projectMatch[1]!))); return; }
    const activateModelMatch = url.pathname.match(/^\/api\/designer\/models\/([^/]+)\/activate$/u);
    if (request.method === 'POST' && activateModelMatch) {
      const registry = activateTrainedModel(await readTrainedRegistry(), decodeURIComponent(activateModelMatch[1]!), new Date().toISOString());
      await saveTrainedRegistry(registry); json(response, 200, await modelRegistryView()); return;
    }
    if (request.method === 'POST' && url.pathname === '/api/designer/models/rollback') {
      const registry = rollbackTrainedModel(await readTrainedRegistry(), new Date().toISOString());
      await saveTrainedRegistry(registry); json(response, 200, await modelRegistryView()); return;
    }
    const benchmarkModelMatch = url.pathname.match(/^\/api\/designer\/models\/([^/]+)\/benchmark$/u);
    if (request.method === 'POST' && benchmarkModelMatch) {
      const manifest = CriticDatasetManifestSchema.parse(JSON.parse(await readFile(resolve(repositoryRoot, 'packages/local-training/data/critic-smoke-v1.manifest.json'), 'utf8')));
      const eligibility = assessTrainingEligibility(manifest);
      const modelId = decodeURIComponent(benchmarkModelMatch[1]!); const registry = await readTrainedRegistry(); const model = registry.models.find((entry) => entry.modelId === modelId);
      if (model === undefined) throw new Error('등록되지 않은 학습 모델입니다.');
      if (!eligibility.benchmark) { json(response, 409, { error: '현재 자료로는 신뢰할 수 있는 모델 평가를 실행할 수 없습니다.', eligibility, modelId }); return; }
      const pythonExecutable = process.env.LOCAL_TRAINING_PYTHON ?? 'python'; const launcherPath = resolve(repositoryRoot, 'packages/local-training/scripts/infer_visual_critic.py');
      const benchmark = await runTrainedVisualCriticBenchmark({ manifest, repositoryRoot,
        modelProvider: new PeftVisualCriticProvider({ pythonExecutable, launcherPath, baseModel: model.baseModel, adapterPath: resolve(repositoryRoot, model.adapterPath), modelId }),
        baselineProvider: new BaseTransformersVisualCriticProvider({ pythonExecutable, launcherPath, baseModel: model.baseModel, modelId: `${model.baseModel}:baseline` }),
      });
      const updated = recordVisualCriticBenchmark(registry, modelId, benchmark); await saveTrainedRegistry(updated); json(response, 200, await modelRegistryView()); return;
    }
    if (request.method === 'POST' && url.pathname === '/api/designer/jobs') {
      const designInput = await body(request) as { projectId: string; documentId: string; mode: 'document' | 'presentation'; authoredContent: string };
      await projectStore.get(designInput.projectId);
      const job = await runStudioDesignJob(designInput as never, { repositoryRoot, publicBaseUrl: origin });
      await projectStore.recordArtifact({ projectId: designInput.projectId, artifactId: job.output.artifactId, documentId: designInput.documentId, mode: designInput.mode, title: designInput.authoredContent.split(/\r?\n/u)[0]?.replace(/^제목:\s*/u, '') || '제목 없음', previewPngUrl: job.output.previewPngUrl });
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
      const trainedRegistry = await readTrainedRegistry();
      const router = new ModelRegistryRouter(mergeTrainedModelsForRouting(runtimeModelRegistry(process.env), trainedRegistry));
      const model = router.route(requestBody.provider === 'openrouter'
        ? { role: 'visual-critic', capabilities: { vision: true, structuredOutput: true }, policy: 'explicit-remote', approvedRemoteModelId: process.env.OPENROUTER_CRITIC_MODEL_ID ?? 'openrouter-critic' }
        : { role: 'visual-critic', capabilities: { vision: true, structuredOutput: true }, policy: 'explicit-local' });
      const provider = model.adapter
        ? new PeftVisualCriticProvider({ pythonExecutable: process.env.LOCAL_TRAINING_PYTHON ?? 'python', launcherPath: resolve(repositoryRoot, 'packages/local-training/scripts/infer_visual_critic.py'), baseModel: model.baseModel, adapterPath: resolve(repositoryRoot, model.adapterPath!), modelId: model.modelId })
        : model.provider === 'openrouter'
        ? new OpenRouterAIProvider({ apiKey: process.env.OPENROUTER_API_KEY ?? '', model: model.baseModel, reasoningEffort: 'medium' })
        : new OpenAICompatibleVisualCriticProvider({ endpoint: process.env.LOCAL_CRITIC_ENDPOINT ?? 'http://127.0.0.1:8000/v1/chat/completions', model: model.baseModel, localExecution: true });
      const result = await runStudioVisualCritic({ metadataPath, provider });
      json(response, 200, { output: result.output, run: result.run, aiActivity: result.aiActivity, aiUsage: result.aiUsage }); return;
    }
    const decisionMatch = url.pathname.match(/^\/api\/designer\/jobs\/([^/]+)\/decision$/u);
    if (request.method === 'POST' && decisionMatch) {
      const artifactId = decodeURIComponent(decisionMatch[1]!);
      if (!/^slide-[0-9]+-[a-z0-9]+$/iu.test(artifactId)) throw new Error('잘못된 작업 번호입니다.');
      const metadataPath = resolve(repositoryRoot, 'output/studio-jobs', artifactId, 'job.json');
      const result = await recordStudioUserDecision({ metadataPath, event: await body(request) as never });
      json(response, 200, { output: result.output, eventId: result.event.eventId }); return;
    }
    const preferenceMatch = url.pathname.match(/^\/api\/designer\/jobs\/([^/]+)\/preference$/u);
    if (request.method === 'POST' && preferenceMatch) {
      const artifactId = decodeURIComponent(preferenceMatch[1]!);
      if (!/^slide-[0-9]+-[a-z0-9]+$/iu.test(artifactId)) throw new Error('잘못된 작업 번호입니다.');
      const metadataPath = resolve(repositoryRoot, 'output/studio-jobs', artifactId, 'job.json');
      const result = await recordStudioCandidatePreference({ metadataPath, event: await body(request) as never, preferenceRoot: resolve(repositoryRoot, 'workspace/preference-memory') });
      json(response, 200, { output: result.output, event: result.event, patterns: result.patterns, profile: result.profile }); return;
    }
    json(response, 404, { error: 'Not found' });
  } catch (error) { json(response, 400, { error: error instanceof Error ? error.message : String(error) }); }
});

server.listen(port, '127.0.0.1', () => process.stdout.write(`Game PPT Designer service: ${origin}\n`));
