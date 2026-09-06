import {
  TrainedModelRegistrySchema,
  VisualCriticBenchmarkSchema,
  type ModelRegistry,
  type TrainedModelEntry,
  type TrainedModelRegistry,
  type VisualCriticBenchmark,
} from '@game-presentation/contracts';

export function registerCompletedAdapter(input: {
  modelId: string; displayName: string; baseModel: string; adapterPath: string; version: string; createdAt: string; trainingRunId: string; trainingDatasetId: string;
}): TrainedModelEntry {
  return {
    ...input,
    role: 'visual-critic',
    sharedGlobalRegistry: true,
    benchmarkStatus: 'unbenchmarked',
    benchmark: null,
    active: false,
    activatedAt: null,
  };
}

export function recordVisualCriticBenchmark(registry: TrainedModelRegistry, modelId: string, rawBenchmark: VisualCriticBenchmark): TrainedModelRegistry {
  const benchmark = VisualCriticBenchmarkSchema.parse(rawBenchmark);
  const model = registry.models.find((entry) => entry.modelId === modelId);
  if (model === undefined) throw new Error('등록되지 않은 학습 모델입니다.');
  const regressionPassed = benchmark.complete
    && benchmark.sourceFidelityViolations === 0
    && benchmark.hallucinatedContentModifications === 0
    && benchmark.falsePositiveRate <= benchmark.baselineFalsePositiveRate + 0.15;
  const models = registry.models.map((entry) => entry.modelId === modelId ? { ...entry, benchmark, benchmarkStatus: regressionPassed ? 'qualified' as const : 'rejected' as const, active: false, activatedAt: null } : entry);
  return TrainedModelRegistrySchema.parse({ ...registry, activeVisualCriticModelId: registry.activeVisualCriticModelId === modelId ? null : registry.activeVisualCriticModelId, models });
}

export function activateTrainedModel(registry: TrainedModelRegistry, modelId: string, activatedAt: string): TrainedModelRegistry {
  const selected = registry.models.find((model) => model.modelId === modelId);
  if (selected?.benchmarkStatus !== 'qualified') throw new Error('benchmark를 통과한 모델만 사용자가 활성화할 수 있습니다.');
  const rollbackStack = registry.activeVisualCriticModelId === null ? registry.rollbackStack : [...registry.rollbackStack, registry.activeVisualCriticModelId];
  const models = registry.models.map((model) => ({ ...model, active: model.modelId === modelId, activatedAt: model.modelId === modelId ? activatedAt : null }));
  return TrainedModelRegistrySchema.parse({ ...registry, activeVisualCriticModelId: modelId, rollbackStack, models });
}

export function disableTrainedModel(registry: TrainedModelRegistry, modelId: string): TrainedModelRegistry {
  const models = registry.models.map((model) => model.modelId === modelId ? { ...model, active: false, activatedAt: null, benchmarkStatus: 'disabled' as const } : model);
  return TrainedModelRegistrySchema.parse({ ...registry, activeVisualCriticModelId: registry.activeVisualCriticModelId === modelId ? null : registry.activeVisualCriticModelId, models });
}

export function rollbackTrainedModel(registry: TrainedModelRegistry, activatedAt: string): TrainedModelRegistry {
  const previousId = registry.rollbackStack.at(-1);
  if (previousId === undefined) throw new Error('되돌릴 이전 모델이 없습니다.');
  const previous = registry.models.find((model) => model.modelId === previousId);
  if (previous?.benchmarkStatus !== 'qualified') throw new Error('이전 모델이 더 이상 qualified 상태가 아닙니다.');
  const models = registry.models.map((model) => ({ ...model, active: model.modelId === previousId, activatedAt: model.modelId === previousId ? activatedAt : null }));
  return TrainedModelRegistrySchema.parse({ ...registry, activeVisualCriticModelId: previousId, rollbackStack: registry.rollbackStack.slice(0, -1), models });
}

export function mergeTrainedModelsForRouting(base: ModelRegistry, trained: TrainedModelRegistry): ModelRegistry {
  return {
    ...base,
    models: [...base.models, ...trained.models.map((model) => ({
      modelId: model.modelId, displayName: model.displayName, provider: 'local' as const, endpointProfile: 'local-peft-adapter', localExecution: true,
      baseModel: model.baseModel, adapter: true, adapterPath: model.adapterPath, capabilities: { text: true, vision: true, structuredOutput: true }, supportedRoles: ['visual-critic' as const],
      maxContext: 8192, preferredOutputTokens: 1200, estimatedVRAMGb: null, quantization: null, benchmarkStatus: model.benchmarkStatus, benchmarkScores: model.benchmark === null ? {} : {
        findingRecall: model.benchmark.findingRecall, falsePositiveRate: model.benchmark.falsePositiveRate, readinessAccuracy: model.benchmark.readinessAccuracy,
      }, latencyMs: model.benchmark?.latencyMs ?? null, estimatedCostUsdPerMillionTokens: 0, active: model.active, version: model.version, createdAt: model.createdAt, trainingDatasetId: model.trainingDatasetId,
    }))],
  };
}
