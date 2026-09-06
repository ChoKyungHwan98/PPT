import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProductionCriticDatasetManifestSchema, type TrainingEligibility } from '@game-presentation/local-training';
import { assessQualityRuntimeEnvironment, prepareQualityTrainingRun, requireProductionDatasetId, trainingStartDecision } from '../src/training-workflow.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

const insufficient: TrainingEligibility = {
  smokeTraining: true,
  qualityTraining: false,
  benchmark: false,
  humanLabelCount: 4,
  readyPositiveCount: 0,
  rejectCount: 4,
  pairwiseCount: 0,
  trainCount: 3,
  validationCount: 1,
  reasons: ['quality training requires more human-labelled examples'],
};

describe('training product guard', () => {
  it('rejects meaningful training when labelled and Ready evidence are insufficient', () => {
    expect(trainingStartDecision({ mode: 'quality', eligibility: insufficient, smokeEnabled: true })).toMatchObject({ allowed: false, mode: 'quality' });
  });

  it('keeps smoke mode separate and requires the developer switch', () => {
    expect(trainingStartDecision({ mode: 'smoke', eligibility: insufficient, smokeEnabled: false })).toMatchObject({ allowed: false, mode: 'smoke' });
    expect(trainingStartDecision({ mode: 'smoke', eligibility: insufficient, smokeEnabled: true })).toEqual({ allowed: true, mode: 'smoke' });
  });

  it('rejects a quality request without an immutable production dataset ID', () => {
    expect(() => requireProductionDatasetId(undefined)).toThrow(/datasetId/u);
    expect(() => requireProductionDatasetId('unknown')).toThrow(/datasetId/u);
    expect(requireProductionDatasetId(`critic-production-${'a'.repeat(16)}`)).toBe(`critic-production-${'a'.repeat(16)}`);
  });

  it('reports the current 8GB Windows model setup as blocked instead of forcing training', () => {
    const result = assessQualityRuntimeEnvironment({ platform: 'win32', gpuName: 'RTX 4060 Ti', gpuMemoryMb: 8188, diskFreeGb: 24.2, runtimeVerified: false });
    expect(result.supported).toBe(false);
    expect(result.baseModel).toBe('afx-team/UI-UX');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('creates a persisted quality job only for a known eligible immutable dataset and supported runtime', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'r8-quality-job-'));
    try {
      const trainingDataRoot = resolve(root, 'workspace/training-data');
      const datasetId = `critic-production-${'a'.repeat(16)}`;
      const examples = Array.from({ length: 20 }, (_, index) => ({ exampleId: `x${index}`, sourceEventId: `e${index}`, sourceEventHash: hash(`e${index}`), artifactId: `a${index}`, artifactGroupId: `g${index}`, imagePath: 'image.png', imageSha256: hash('image'), prompt: 'prompt', response: 'response', readiness: index < 3 ? 'ready' as const : 'not-ready' as const, issueTypes: [], semanticShape: 'hierarchy', mode: 'document' as const, humanLabel: true as const, explicitHumanDecision: true as const }));
      const manifest = ProductionCriticDatasetManifestSchema.parse({ schemaVersion: '0.1', purpose: 'visual-critic-production', datasetId, datasetSha256: hash('dataset'), createdAt: '2026-09-07T00:00:00.000Z', split: { seed: 42, validationRatio: 0.2, groupBy: 'authoredContentHash' }, sourceEventIds: examples.map((item) => item.sourceEventId), sourceEventHashes: examples.map((item) => ({ eventId: item.sourceEventId, sha256: item.sourceEventHash })), humanLabelCount: 20, readyPositiveCount: 3, rejectCount: 17, preferenceEventCount: 0, pairwiseCount: 0, trainIds: examples.slice(2).map((item) => item.exampleId), validationIds: examples.slice(0, 2).map((item) => item.exampleId), examples, preferences: [], distributions: { semanticShape: { hierarchy: 20 }, mode: { document: 20 }, reasonTag: {} }, imageHashes: examples.map((item) => ({ exampleId: item.exampleId, sha256: item.imageSha256 })), files: { train: 'train.jsonl', validation: 'validation.jsonl', preference: 'preference.jsonl' } });
      const directory = resolve(trainingDataRoot, 'datasets', datasetId); await mkdir(directory, { recursive: true }); await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest));
      const runtime = { supported: true, baseModel: 'test/model', gpuName: 'test', gpuMemoryMb: 24000, diskFreeGb: 100, quantization: 'bnb-4bit' as const, reasons: [] };
      await expect(prepareQualityTrainingRun({ repositoryRoot: root, trainingDataRoot, datasetId: 'unknown', runId: 'training-unknown', startedAt: '2026-09-07T00:00:00.000Z', runtime: { supported: true, baseModel: 'test/model', gpuName: 'test', gpuMemoryMb: 24000, diskFreeGb: 100, quantization: 'bnb-4bit', reasons: [] } })).rejects.toThrow(/datasetId/u);
      await expect(prepareQualityTrainingRun({ repositoryRoot: root, trainingDataRoot, datasetId: `critic-production-${'c'.repeat(16)}`, runId: 'training-missing', startedAt: '2026-09-07T00:00:00.000Z', runtime })).rejects.toMatchObject({ code: 'ENOENT' });
      const insufficientId = `critic-production-${'b'.repeat(16)}`;
      const insufficientExamples = examples.slice(0, 4);
      const insufficientManifest = ProductionCriticDatasetManifestSchema.parse({ ...manifest, datasetId: insufficientId, datasetSha256: hash('insufficient'), sourceEventIds: insufficientExamples.map((item) => item.sourceEventId), sourceEventHashes: insufficientExamples.map((item) => ({ eventId: item.sourceEventId, sha256: item.sourceEventHash })), humanLabelCount: 4, readyPositiveCount: 3, rejectCount: 1, trainIds: insufficientExamples.slice(0, 3).map((item) => item.exampleId), validationIds: insufficientExamples.slice(3).map((item) => item.exampleId), examples: insufficientExamples, distributions: { semanticShape: { hierarchy: 4 }, mode: { document: 4 }, reasonTag: {} }, imageHashes: insufficientExamples.map((item) => ({ exampleId: item.exampleId, sha256: item.imageSha256 })) });
      const insufficientDirectory = resolve(trainingDataRoot, 'datasets', insufficientId); await mkdir(insufficientDirectory, { recursive: true }); await writeFile(resolve(insufficientDirectory, 'manifest.json'), JSON.stringify(insufficientManifest));
      await expect(prepareQualityTrainingRun({ repositoryRoot: root, trainingDataRoot, datasetId: insufficientId, runId: 'training-insufficient', startedAt: '2026-09-07T00:00:00.000Z', runtime })).rejects.toThrow(/품질 학습/u);
      const prepared = await prepareQualityTrainingRun({ repositoryRoot: root, trainingDataRoot, datasetId, runId: 'training-eligible', startedAt: '2026-09-07T00:00:00.000Z', runtime });
      expect(prepared.status).toMatchObject({ status: 'running', modelStatus: 'training', datasetId });
      expect(prepared.command.args).toContain('quality');
      expect(JSON.parse(await readFile(prepared.statusPath, 'utf8'))).toMatchObject({ datasetId, status: 'running' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
