import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AIProvider, ProviderRequest } from '@game-presentation/contracts';
import { ProductionCriticDatasetManifestSchema, type ProductionCriticDatasetManifest } from '@game-presentation/local-training';
import type { z } from 'zod';
import { resolveBenchmarkDatasetForModel, runTrainedVisualCriticBenchmark } from '../src/model-benchmark.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function productionManifest(input: { datasetId: string; count?: number; ready?: number; validationIds?: string[] }): ProductionCriticDatasetManifest {
  const count = input.count ?? 8;
  const ready = input.ready ?? 2;
  const validationIds = input.validationIds ?? ['x0', 'x2'];
  const examples = Array.from({ length: count }, (_, index) => {
    const isReady = index < ready;
    return {
      exampleId: `x${index}`,
      sourceEventId: `e${index}`,
      sourceEventHash: hash(`e${index}`),
      artifactId: `a${index}`,
      artifactGroupId: `g${index}`,
      imagePath: 'image.png',
      imageSha256: hash('image'),
      prompt: '실제 장표의 제출 가능성을 평가하세요.',
      response: JSON.stringify({
        humanDecision: isReady ? 'ready' : 'reject',
        submissionReadiness: isReady ? 'ready' : 'not-ready',
        humanReasonTags: isReady ? [] : ['hierarchy'],
        criticContext: isReady ? null : { findings: [{ findingId: `f${index}`, issueType: 'hierarchy', severity: 'error', target: { kind: 'page', ids: [`a${index}`] }, problem: '정보 위계가 불명확합니다.', reason: '핵심과 보조 정보의 강도가 같습니다.', revisionDirection: '핵심과 보조 정보의 크기와 굵기를 분리합니다.' }] },
      }),
      readiness: isReady ? 'ready' as const : 'not-ready' as const,
      issueTypes: isReady ? [] : ['hierarchy'],
      semanticShape: 'hierarchy',
      mode: 'document' as const,
      humanLabel: true as const,
      explicitHumanDecision: true as const,
    };
  });
  const validation = new Set(validationIds);
  return ProductionCriticDatasetManifestSchema.parse({
    schemaVersion: '0.1', purpose: 'visual-critic-production', datasetId: input.datasetId, datasetSha256: hash(input.datasetId), createdAt: '2026-09-07T00:00:00.000Z',
    split: { seed: 42, validationRatio: 0.25, groupBy: 'authoredContentHash' },
    sourceEventIds: examples.map((example) => example.sourceEventId), sourceEventHashes: examples.map((example) => ({ eventId: example.sourceEventId, sha256: example.sourceEventHash })),
    humanLabelCount: count, readyPositiveCount: ready, rejectCount: count - ready, preferenceEventCount: 0, pairwiseCount: 0,
    trainIds: examples.filter((example) => !validation.has(example.exampleId)).map((example) => example.exampleId), validationIds,
    examples, preferences: [], distributions: { semanticShape: { hierarchy: count }, mode: { document: count }, reasonTag: { hierarchy: count - ready } },
    imageHashes: examples.map((example) => ({ exampleId: example.exampleId, sha256: example.imageSha256 })),
    files: { train: 'train.jsonl', validation: 'validation.jsonl', preference: 'preference.jsonl' },
  });
}

async function writeManifest(root: string, directoryId: string, manifest: ProductionCriticDatasetManifest): Promise<void> {
  const directory = resolve(root, 'datasets', directoryId);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest));
}

class RecordingBenchmarkProvider implements AIProvider {
  readonly kind = 'fake' as const;
  readonly seenExampleIds: string[] = [];
  constructor(readonly model: string) {}
  async capabilities() { return { structuredOutput: true, vision: true, localExecution: true, promptCaching: false }; }
  async generateStructured<T>(request: ProviderRequest, schema: z.ZodType<T>) {
    const contextArtifactIds = request.contextArtifactIds ?? [];
    const exampleId = contextArtifactIds[1]!;
    this.seenExampleIds.push(exampleId);
    const value = schema.parse(exampleId === 'x0'
      ? { submissionReadiness: 'ready', findings: [] }
      : { submissionReadiness: 'not-ready', findings: [{ issueType: 'hierarchy', severity: 'error', reason: '정보 위계가 없어 핵심을 찾기 어렵습니다.', revisionDirection: '핵심과 보조 정보의 크기와 굵기를 분리합니다.' }] });
    const now = new Date().toISOString();
    return { value, run: { requestId: request.requestId, provider: this.kind, model: this.model, cacheHit: false, inputBytes: 1, outputBytes: 1, estimatedCostUsd: 0, contextArtifactIds, startedAt: now, completedAt: now } };
  }
}

describe('production-trained model benchmark dataset resolution', () => {
  it('follows model.trainingDatasetId and benchmarks only that immutable production validation split', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'r9-production-benchmark-'));
    try {
      const datasetId = `critic-production-${'a'.repeat(16)}`;
      const manifest = productionManifest({ datasetId });
      await writeManifest(root, datasetId, manifest);
      await writeFile(resolve(root, 'image.png'), 'image');
      const resolved = await resolveBenchmarkDatasetForModel({ trainingDataRoot: root, model: { trainingDatasetId: datasetId } });
      expect(resolved.manifest.datasetId).toBe(datasetId);
      expect(resolved.manifestPath).toBe(resolve(root, 'datasets', datasetId, 'manifest.json'));
      expect(resolved.eligibility.benchmark).toBe(true);
      const modelProvider = new RecordingBenchmarkProvider('adapter');
      const baselineProvider = new RecordingBenchmarkProvider('base');
      const result = await runTrainedVisualCriticBenchmark({ manifest: resolved.manifest, repositoryRoot: root, modelProvider, baselineProvider, now: '2026-09-07T01:00:00.000Z' });
      expect(result).toMatchObject({ fixtureCount: 2, readyPositiveCount: 1, findingRecall: 1, readinessAccuracy: 1, complete: true });
      expect(modelProvider.seenExampleIds.sort()).toEqual(['x0', 'x2']);
      expect(baselineProvider.seenExampleIds.sort()).toEqual(['x0', 'x2']);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('rejects missing, malformed, mismatched, smoke, and benchmark-ineligible dataset references', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'r9-production-benchmark-guard-'));
    try {
      await expect(resolveBenchmarkDatasetForModel({ trainingDataRoot: root, model: {} })).rejects.toThrow(/trainingDatasetId/u);
      await expect(resolveBenchmarkDatasetForModel({ trainingDataRoot: root, model: { trainingDatasetId: 'visual-critic-human-smoke-v1' } })).rejects.toThrow(/production trainingDatasetId/u);
      await expect(resolveBenchmarkDatasetForModel({ trainingDataRoot: root, model: { trainingDatasetId: `critic-production-${'b'.repeat(16)}` } })).rejects.toThrow(/찾을 수 없습니다/u);

      const requestedId = `critic-production-${'c'.repeat(16)}`;
      const differentId = `critic-production-${'d'.repeat(16)}`;
      await writeManifest(root, requestedId, productionManifest({ datasetId: differentId }));
      await expect(resolveBenchmarkDatasetForModel({ trainingDataRoot: root, model: { trainingDatasetId: requestedId } })).rejects.toThrow(/ID가 일치하지 않습니다/u);

      const insufficientId = `critic-production-${'e'.repeat(16)}`;
      await writeManifest(root, insufficientId, productionManifest({ datasetId: insufficientId, count: 7, ready: 2, validationIds: ['x0', 'x2'] }));
      await expect(resolveBenchmarkDatasetForModel({ trainingDataRoot: root, model: { trainingDatasetId: insufficientId } })).rejects.toThrow(/benchmark 기준/u);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
