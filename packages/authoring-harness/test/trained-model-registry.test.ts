import { describe, expect, it } from 'vitest';
import { ModelRegistryRouter } from '../src/model-router.js';
import { activateTrainedModel, mergeTrainedModelsForRouting, recordVisualCriticBenchmark, registerCompletedAdapter, rollbackTrainedModel } from '../src/trained-model-registry.js';
import type { TrainedModelRegistry, VisualCriticBenchmark } from '@game-presentation/contracts';

const adapter = (id: string) => registerCompletedAdapter({ modelId: id, displayName: id, baseModel: 'base', adapterPath: `adapters/${id}`, version: '1', createdAt: '2026-09-06T00:00:00.000Z', trainingRunId: `run-${id}`, trainingDatasetId: 'dataset-1' });
const benchmark = (overrides: Partial<VisualCriticBenchmark> = {}): VisualCriticBenchmark => ({ benchmarkId: 'bench-1', completedAt: '2026-09-06T01:00:00.000Z', fixtureCount: 12, readyPositiveCount: 3, findingRecall: .8, falsePositiveRate: .1, readinessAccuracy: .75, severityAppropriateness: .8, suggestionSpecificity: .8, latencyMs: 900, peakVramMb: 3000, estimatedCostUsd: 0, sourceFidelityViolations: 0, hallucinatedContentModifications: 0, baselineFalsePositiveRate: .12, complete: true, ...overrides });

describe('R9 trained model deployment', () => {
  it('registers a completed adapter as unbenchmarked and refuses activation', () => {
    const registry: TrainedModelRegistry = { schemaVersion: '0.1', activeVisualCriticModelId: null, rollbackStack: [], models: [adapter('one')] };
    expect(registry.models[0]?.benchmarkStatus).toBe('unbenchmarked');
    expect(() => activateTrainedModel(registry, 'one', '2026-09-06T02:00:00.000Z')).toThrow(/benchmark/);
  });

  it('rejects regression and activates only a qualified model', () => {
    const initial: TrainedModelRegistry = { schemaVersion: '0.1', activeVisualCriticModelId: null, rollbackStack: [], models: [adapter('one')] };
    const rejected = recordVisualCriticBenchmark(initial, 'one', benchmark({ sourceFidelityViolations: 1 }));
    expect(rejected.models[0]?.benchmarkStatus).toBe('rejected');
    const qualified = recordVisualCriticBenchmark(initial, 'one', benchmark());
    const active = activateTrainedModel(qualified, 'one', '2026-09-06T02:00:00.000Z');
    expect(active.activeVisualCriticModelId).toBe('one');
  });

  it('rolls back and exposes only active qualified adapters to the existing router', () => {
    let registry: TrainedModelRegistry = { schemaVersion: '0.1', activeVisualCriticModelId: null, rollbackStack: [], models: [adapter('one'), adapter('two')] };
    registry = recordVisualCriticBenchmark(registry, 'one', benchmark()); registry = activateTrainedModel(registry, 'one', '2026-09-06T02:00:00.000Z');
    registry = recordVisualCriticBenchmark(registry, 'two', benchmark({ benchmarkId: 'bench-2' })); registry = activateTrainedModel(registry, 'two', '2026-09-06T03:00:00.000Z');
    expect(registry.activeVisualCriticModelId).toBe('two');
    registry = rollbackTrainedModel(registry, '2026-09-06T04:00:00.000Z');
    expect(registry.activeVisualCriticModelId).toBe('one');
    const router = new ModelRegistryRouter(mergeTrainedModelsForRouting({ schemaVersion: '0.1', models: [] }, registry));
    expect(router.route({ role: 'visual-critic', capabilities: { vision: true }, policy: 'local-first' }).modelId).toBe('one');
  });
});
