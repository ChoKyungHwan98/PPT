import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AIProvider, ProviderRequest } from '@game-presentation/contracts';
import type { z } from 'zod';
import { CriticDatasetManifestSchema } from '@game-presentation/local-training';
import { runTrainedVisualCriticBenchmark } from '../src/model-benchmark.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
class BenchmarkProvider implements AIProvider {
  readonly kind = 'fake' as const;
  constructor(readonly model: string, private readonly good: boolean) {}
  async capabilities() { return { structuredOutput: true, vision: true, localExecution: true, promptCaching: false }; }
  async generateStructured<T>(_request: ProviderRequest, schema: z.ZodType<T>) {
    const value = schema.parse(this.good
      ? { submissionReadiness: 'not-ready', findings: [{ issueType: 'hierarchy', severity: 'error', reason: '정보 위계가 없어 핵심을 찾기 어렵습니다.', revisionDirection: '핵심과 보조 정보의 크기와 굵기를 분리합니다.' }] }
      : { submissionReadiness: 'ready', findings: [] });
    const now = new Date().toISOString();
    return { value, run: { requestId: 'benchmark', provider: this.kind, model: this.model, cacheHit: false, inputBytes: 1, outputBytes: 1, estimatedCostUsd: 0, contextArtifactIds: [], startedAt: now, completedAt: now } };
  }
}

describe('trained visual critic benchmark service', () => {
  it('runs model and baseline image inference results into registry-compatible metrics', async () => {
    const imagePath = 'packages/local-training/fixtures/hierarchy-problem.png';
    const manifest = CriticDatasetManifestSchema.parse({ schemaVersion: '0.1', datasetId: 'benchmark-fixture', datasetSha256: 'a'.repeat(64), createdAt: '2026-09-06T00:00:00.000Z', purpose: 'visual-critic-sft-smoke', splitSeed: 1,
      examples: [
        { exampleId: 'one', imagePath, imageSha256: 'b'.repeat(64), prompt: '검토', response: JSON.stringify({ submissionReadiness: 'not-ready', findings: [{ issueType: 'hierarchy', severity: 'error', reason: '위계 문제' }] }), readiness: 'not-ready', issueTypes: ['hierarchy'], humanLabel: true },
        { exampleId: 'two', imagePath, imageSha256: 'c'.repeat(64), prompt: '검토', response: JSON.stringify({ submissionReadiness: 'not-ready', findings: [{ issueType: 'hierarchy', severity: 'error', reason: '위계 문제' }] }), readiness: 'not-ready', issueTypes: ['hierarchy'], humanLabel: true },
      ], trainIds: ['one'], validationIds: ['two'] });
    const result = await runTrainedVisualCriticBenchmark({ modelProvider: new BenchmarkProvider('adapter', true), baselineProvider: new BenchmarkProvider('base', false), manifest, repositoryRoot, now: '2026-09-06T01:00:00.000Z' });
    expect(result).toMatchObject({ fixtureCount: 2, findingRecall: 1, readinessAccuracy: 1, severityAppropriateness: 1, complete: true, sourceFidelityViolations: 0 });
  });
});
