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
