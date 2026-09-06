import { z } from 'zod';

export const ModelRoleSchema = z.enum(['interpreter', 'information-designer', 'visual-designer', 'visual-critic']);
export type ModelRole = z.infer<typeof ModelRoleSchema>;

export const ModelBenchmarkStatusSchema = z.enum(['installed', 'unbenchmarked', 'qualified', 'rejected', 'disabled']);
export type ModelBenchmarkStatus = z.infer<typeof ModelBenchmarkStatusSchema>;

export const ModelRegistryEntrySchema = z.strictObject({
  modelId: z.string().min(1),
  displayName: z.string().min(1),
  provider: z.enum(['local', 'openrouter', 'openai', 'anthropic']),
  endpointProfile: z.string().min(1),
  localExecution: z.boolean(),
  baseModel: z.string().min(1),
  adapter: z.boolean(),
  adapterPath: z.string().min(1).nullable(),
  capabilities: z.strictObject({ text: z.boolean(), vision: z.boolean(), structuredOutput: z.boolean() }),
  supportedRoles: z.array(ModelRoleSchema).min(1),
  maxContext: z.number().int().positive(),
  preferredOutputTokens: z.number().int().positive(),
  estimatedVRAMGb: z.number().nonnegative().nullable(),
  quantization: z.string().min(1).nullable(),
  benchmarkStatus: ModelBenchmarkStatusSchema,
  benchmarkScores: z.record(z.string(), z.number()).default({}),
  latencyMs: z.number().nonnegative().nullable(),
  estimatedCostUsdPerMillionTokens: z.number().nonnegative(),
  active: z.boolean(),
  version: z.string().min(1),
  createdAt: z.iso.datetime(),
  trainingDatasetId: z.string().min(1).optional(),
}).superRefine((entry, context) => {
  if (entry.localExecution !== (entry.provider === 'local')) {
    context.addIssue({ code: 'custom', path: ['localExecution'], message: 'provider와 localExecution이 일치해야 합니다.' });
  }
  if (entry.adapter && entry.adapterPath === null) {
    context.addIssue({ code: 'custom', path: ['adapterPath'], message: 'adapter 모델은 adapterPath가 필요합니다.' });
  }
  if (!entry.adapter && entry.adapterPath !== null) {
    context.addIssue({ code: 'custom', path: ['adapterPath'], message: 'base 모델은 adapterPath를 가질 수 없습니다.' });
  }
  if (entry.benchmarkStatus === 'disabled' && entry.active) {
    context.addIssue({ code: 'custom', path: ['active'], message: 'disabled 모델은 active일 수 없습니다.' });
  }
});
export type ModelRegistryEntry = z.infer<typeof ModelRegistryEntrySchema>;

export const ModelRegistrySchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  models: z.array(ModelRegistryEntrySchema),
});
export type ModelRegistry = z.infer<typeof ModelRegistrySchema>;

export type ModelRouteRequest = {
  role: ModelRole;
  capabilities: { text?: boolean; vision?: boolean; structuredOutput?: boolean };
  policy: 'local-first' | 'explicit-local' | 'explicit-remote';
  approvedRemoteModelId?: string;
};

export const VisualCriticBenchmarkSchema = z.strictObject({
  benchmarkId: z.string().min(1),
  completedAt: z.iso.datetime(),
  fixtureCount: z.number().int().nonnegative(),
  readyPositiveCount: z.number().int().nonnegative(),
  findingRecall: z.number().min(0).max(1),
  falsePositiveRate: z.number().min(0).max(1),
  readinessAccuracy: z.number().min(0).max(1),
  severityAppropriateness: z.number().min(0).max(1),
  suggestionSpecificity: z.number().min(0).max(1),
  latencyMs: z.number().nonnegative(),
  peakVramMb: z.number().nonnegative().nullable(),
  estimatedCostUsd: z.number().nonnegative(),
  sourceFidelityViolations: z.number().int().nonnegative(),
  hallucinatedContentModifications: z.number().int().nonnegative(),
  baselineFalsePositiveRate: z.number().min(0).max(1),
  complete: z.boolean(),
});
export type VisualCriticBenchmark = z.infer<typeof VisualCriticBenchmarkSchema>;

export const TrainedModelEntrySchema = z.strictObject({
  modelId: z.string().min(1),
  displayName: z.string().min(1),
  role: z.literal('visual-critic'),
  baseModel: z.string().min(1),
  adapterPath: z.string().min(1),
  version: z.string().min(1),
  createdAt: z.iso.datetime(),
  trainingRunId: z.string().min(1),
  trainingDatasetId: z.string().min(1),
  sharedGlobalRegistry: z.literal(true),
  benchmarkStatus: ModelBenchmarkStatusSchema,
  benchmark: VisualCriticBenchmarkSchema.nullable(),
  active: z.boolean(),
  activatedAt: z.iso.datetime().nullable(),
}).superRefine((entry, context) => {
  if (entry.active && entry.benchmarkStatus !== 'qualified') context.addIssue({ code: 'custom', path: ['active'], message: 'qualified가 아닌 학습 모델은 활성화할 수 없습니다.' });
  if (entry.benchmarkStatus === 'qualified' && (entry.benchmark === null || !entry.benchmark.complete)) context.addIssue({ code: 'custom', path: ['benchmark'], message: 'qualified 모델은 완료된 benchmark가 필요합니다.' });
});
export type TrainedModelEntry = z.infer<typeof TrainedModelEntrySchema>;

export const TrainedModelRegistrySchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  activeVisualCriticModelId: z.string().min(1).nullable(),
  rollbackStack: z.array(z.string().min(1)),
  models: z.array(TrainedModelEntrySchema),
}).superRefine((registry, context) => {
  const active = registry.models.filter((model) => model.active);
  if (active.length > 1) context.addIssue({ code: 'custom', path: ['models'], message: '동시에 하나의 학습 Visual Critic만 활성화할 수 있습니다.' });
  if ((active[0]?.modelId ?? null) !== registry.activeVisualCriticModelId) context.addIssue({ code: 'custom', path: ['activeVisualCriticModelId'], message: 'active model pointer와 entry 상태가 일치해야 합니다.' });
});
export type TrainedModelRegistry = z.infer<typeof TrainedModelRegistrySchema>;
