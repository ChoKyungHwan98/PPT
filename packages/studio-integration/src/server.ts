import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { mkdir, readFile, readdir, statfs, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { BaseTransformersVisualCriticProvider, OpenAICompatibleVisualCriticProvider, OpenRouterAIProvider, PeftVisualCriticProvider } from '@game-presentation/renderer/studio';
import { activateTrainedModel, mergeTrainedModelsForRouting, ModelRegistryRouter, recordVisualCriticBenchmark, registerCompletedAdapter, rollbackTrainedModel, runtimeModelRegistry } from '@game-presentation/authoring-harness';
import { assessTrainingEligibility, CriticDatasetManifestSchema, HumanTrainingEventStore, ProductionTrainingRunStatusSchema, QualityTrainingRunRecordSchema } from '@game-presentation/local-training';
import { TrainedModelRegistrySchema } from '@game-presentation/contracts';
import { recordStudioCandidatePreference, recordStudioUserDecision, runStudioDesignJob, runStudioVisualCritic } from './design-job.js';
import { LocalProjectStore } from './project-store.js';
import { trainingStartDecision } from './training-workflow.js';
import { assessQualityRuntimeEnvironment, prepareQualityTrainingRun, requireProductionDatasetId } from './training-workflow.js';
import { buildCurrentProductionDataset, productionTrainingSummary } from './training-data.js';
import { resolveBenchmarkDatasetForModel, runTrainedVisualCriticBenchmark } from './model-benchmark.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const port = Number(process.env.PPT_DESIGNER_PORT ?? '8766');
const origin = `http://127.0.0.1:${port}`;
const trainedRegistryPath = resolve(repositoryRoot, 'packages/local-training/artifacts/r9-model-registry.json');
const projectStore = new LocalProjectStore(resolve(repositoryRoot, 'workspace/projects'));
const trainingDataRoot = resolve(repositoryRoot, 'workspace/training-data');
const trainingRunsRoot = resolve(trainingDataRoot, 'runs');
const humanTrainingStore = new HumanTrainingEventStore(trainingDataRoot, repositoryRoot);
const execFileAsync = promisify(execFile);

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

async function latestTrainingRun() {
  let entries: string[] = [];
  try { entries = await readdir(trainingRunsRoot); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const statuses = await Promise.all(entries.map(async (entry) => {
    try { return ProductionTrainingRunStatusSchema.parse(JSON.parse(await readFile(resolve(trainingRunsRoot, entry, 'status.json'), 'utf8'))); } catch { return null; }
  }));
  return statuses.filter((value): value is NonNullable<typeof value> => value !== null).sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0] ?? null;
}

async function qualityRuntimeAssessment() {
  const disk = await statfs(repositoryRoot);
  let gpuName: string | null = null;
  let gpuMemoryMb: number | null = null;
  try {
    const { stdout } = await execFileAsync('nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'], { windowsHide: true });
    const [name, memory] = stdout.trim().split(',').map((value) => value.trim());
    gpuName = name || null; gpuMemoryMb = Number.isFinite(Number(memory)) ? Number(memory) : null;
  } catch { /* A missing NVIDIA runtime is reported by the assessment. */ }
  return assessQualityRuntimeEnvironment({
    baseModel: process.env.PPT_QUALITY_BASE_MODEL ?? 'afx-team/UI-UX', platform: process.platform,
    gpuName, gpuMemoryMb, diskFreeGb: disk.bavail * disk.bsize / 1024 / 1024 / 1024,
    runtimeVerified: process.env.PPT_QUALITY_RUNTIME_VERIFIED === 'true',
  });
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
      const summary = await productionTrainingSummary({ repositoryRoot, trainingDataRoot });
      const runtime = await qualityRuntimeAssessment();
      const reasonTags = Object.entries(summary.dataset?.distributions.reasonTag ?? {}).sort((left, right) => right[1] - left[1]);
      json(response, 200, {
        evaluationCount: summary.evaluations.length,
        readyCount: summary.evaluations.filter((item) => item.sourceEvent.userDecision === 'ready').length,
        rejectCount: summary.evaluations.filter((item) => item.sourceEvent.userDecision === 'reject').length,
        preferenceCount: summary.preferences.length,
        pairwiseCount: summary.eligibility.pairwiseCount,
        reasonTags,
        dataset: summary.dataset === null ? null : { datasetId: summary.dataset.datasetId, sha256: summary.dataset.datasetSha256, trainCount: summary.dataset.trainIds.length, validationCount: summary.dataset.validationIds.length },
        eligibility: { meaningfulTraining: summary.eligibility.qualityTraining && runtime.supported, dataEligible: summary.eligibility.qualityTraining, runtimeEligible: runtime.supported, smokeTraining: false, reasons: [...summary.eligibility.reasons, ...runtime.reasons], reason: [...summary.eligibility.reasons, ...runtime.reasons].join(' ') },
        runtime,
        latestRun: await latestTrainingRun(),
        developerSmoke: { manifest: 'packages/local-training/data/critic-smoke-v1.manifest.json', includedInProductionCounts: false },
      });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/designer/training/dataset/build') {
      const built = await buildCurrentProductionDataset({ repositoryRoot, trainingDataRoot });
      const eligibility = assessTrainingEligibility(built.manifest);
      json(response, 200, { datasetId: built.manifest.datasetId, datasetSha256: built.manifest.datasetSha256, humanLabelCount: built.manifest.humanLabelCount, readyPositiveCount: built.manifest.readyPositiveCount, rejectCount: built.manifest.rejectCount, preferenceCount: built.manifest.preferenceEventCount, pairwiseCount: built.manifest.pairwiseCount, trainCount: built.manifest.trainIds.length, validationCount: built.manifest.validationIds.length, eligibility, reused: built.reused }); return;
    }
    if (request.method === 'POST' && url.pathname === '/api/designer/training/start') {
      const requestBody = await body(request) as { mode?: 'quality' | 'smoke'; datasetId?: string };
      const mode = requestBody.mode === 'smoke' ? 'smoke' : 'quality';
      const runId = `training-${Date.now()}-${randomUUID().slice(0, 8)}`; const runDirectory = resolve(trainingRunsRoot, runId);
      const python = process.env.LOCAL_TRAINING_PYTHON ?? 'python';
      if (mode === 'smoke') {
        const smokeManifest = CriticDatasetManifestSchema.parse(JSON.parse(await readFile(resolve(repositoryRoot, 'packages/local-training/data/critic-smoke-v1.manifest.json'), 'utf8')));
        const eligibility = assessTrainingEligibility(smokeManifest);
        const decision = trainingStartDecision({ mode, eligibility, smokeEnabled: process.env.PPT_ALLOW_SMOKE_TRAINING === 'true' });
        if (!decision.allowed) { json(response, 409, { error: decision.reason, eligibility }); return; }
        await mkdir(runDirectory, { recursive: true });
        const statusPath = resolve(runDirectory, 'status.json'); await writeFile(statusPath, JSON.stringify({ runId, mode, status: 'running', startedAt: new Date().toISOString() }, null, 2));
        const child = spawn(python, [resolve(repositoryRoot, 'packages/local-training/scripts/train_visual_critic.py'), '--mode', 'smoke', '--root', repositoryRoot, '--manifest', 'packages/local-training/data/critic-smoke-v1.manifest.json', '--output', `workspace/training-data/runs/${runId}/artifact`], { windowsHide: true, detached: false, stdio: 'ignore' });
        child.on('close', (code) => { void writeFile(statusPath, JSON.stringify({ runId, mode, status: code === 0 ? 'completed-smoke' : 'failed', exitCode: code, finishedAt: new Date().toISOString() }, null, 2)); });
        json(response, 202, { runId, mode, status: 'running' }); return;
      }
      let requestedDatasetId: string;
      try { requestedDatasetId = requireProductionDatasetId(requestBody.datasetId); }
      catch (error) { json(response, 409, { error: error instanceof Error ? error.message : String(error) }); return; }
      const runtime = await qualityRuntimeAssessment();
      let prepared;
      try { prepared = await prepareQualityTrainingRun({ repositoryRoot, trainingDataRoot, datasetId: requestedDatasetId, runId, startedAt: new Date().toISOString(), runtime }); }
      catch (error) { json(response, 409, { error: error instanceof Error ? error.message : String(error), runtime }); return; }
      const child = spawn(python, [prepared.command.script, ...prepared.command.args], { windowsHide: true, detached: false, stdio: 'ignore' });
      child.on('close', (code) => { void (async () => {
        const finishedAt = new Date().toISOString();
        if (code !== 0) { await writeFile(prepared.statusPath, `${JSON.stringify({ ...prepared.status, status: 'failed', modelStatus: 'failed', exitCode: code, finishedAt }, null, 2)}\n`); return; }
        try {
          const record = QualityTrainingRunRecordSchema.parse(JSON.parse(await readFile(resolve(repositoryRoot, prepared.status.outputPath, 'run-record.json'), 'utf8')));
          await writeFile(prepared.statusPath, `${JSON.stringify({ ...prepared.status, status: 'completed', modelStatus: 'trained-unbenchmarked', exitCode: 0, finishedAt }, null, 2)}\n`);
          const registry = await readTrainedRegistry();
          const model = registerCompletedAdapter({ modelId: `quality-critic-${record.trainingRunId}`, displayName: '사용자 평가 기반 Visual Critic', baseModel: record.baseModel, adapterPath: record.adapterPath, version: record.datasetId, createdAt: record.finishedAt, trainingRunId: record.trainingRunId, trainingDatasetId: record.datasetId });
          if (!registry.models.some((entry) => entry.modelId === model.modelId)) await saveTrainedRegistry(TrainedModelRegistrySchema.parse({ ...registry, models: [...registry.models, model] }));
        } catch (error) { await writeFile(prepared.statusPath, `${JSON.stringify({ ...prepared.status, status: 'failed', modelStatus: 'failed', exitCode: code, finishedAt, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`); }
      })(); });
      json(response, 202, prepared.status); return;
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
      const modelId = decodeURIComponent(benchmarkModelMatch[1]!); const registry = await readTrainedRegistry(); const model = registry.models.find((entry) => entry.modelId === modelId);
      if (model === undefined) throw new Error('등록되지 않은 학습 모델입니다.');
      let benchmarkDataset;
      try { benchmarkDataset = await resolveBenchmarkDatasetForModel({ trainingDataRoot, model }); }
      catch (error) { json(response, 409, { error: error instanceof Error ? error.message : String(error), modelId, trainingDatasetId: model.trainingDatasetId }); return; }
      const pythonExecutable = process.env.LOCAL_TRAINING_PYTHON ?? 'python'; const launcherPath = resolve(repositoryRoot, 'packages/local-training/scripts/infer_visual_critic.py');
      const benchmark = await runTrainedVisualCriticBenchmark({ manifest: benchmarkDataset.manifest, repositoryRoot,
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
      await humanTrainingStore.appendEvaluation(result.event, metadataPath);
      json(response, 200, { output: result.output, eventId: result.event.eventId }); return;
    }
    const preferenceMatch = url.pathname.match(/^\/api\/designer\/jobs\/([^/]+)\/preference$/u);
    if (request.method === 'POST' && preferenceMatch) {
      const artifactId = decodeURIComponent(preferenceMatch[1]!);
      if (!/^slide-[0-9]+-[a-z0-9]+$/iu.test(artifactId)) throw new Error('잘못된 작업 번호입니다.');
      const metadataPath = resolve(repositoryRoot, 'output/studio-jobs', artifactId, 'job.json');
      const result = await recordStudioCandidatePreference({ metadataPath, event: await body(request) as never, preferenceRoot: resolve(repositoryRoot, 'workspace/preference-memory') });
      await humanTrainingStore.appendPreference(result.event, metadataPath);
      json(response, 200, { output: result.output, event: result.event, patterns: result.patterns, profile: result.profile }); return;
    }
    json(response, 404, { error: 'Not found' });
  } catch (error) { json(response, 400, { error: error instanceof Error ? error.message : String(error) }); }
});

server.listen(port, '127.0.0.1', () => process.stdout.write(`Game PPT Designer service: ${origin}\n`));
