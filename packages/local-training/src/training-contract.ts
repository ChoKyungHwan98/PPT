import { z } from 'zod';

export const CriticTrainingExampleSchema = z.strictObject({
  exampleId: z.string().min(1),
  imagePath: z.string().min(1),
  imageSha256: z.string().regex(/^[a-f0-9]{64}$/),
  prompt: z.string().min(1),
  response: z.string().min(1),
  readiness: z.enum(['ready', 'needs-review', 'not-ready']),
  issueTypes: z.array(z.string().min(1)),
  humanLabel: z.boolean(),
});
export type CriticTrainingExample = z.infer<typeof CriticTrainingExampleSchema>;

export const CriticDatasetManifestSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  datasetId: z.string().min(1),
  datasetSha256: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.iso.datetime(),
  purpose: z.literal('visual-critic-sft-smoke'),
  splitSeed: z.number().int(),
  examples: z.array(CriticTrainingExampleSchema).min(2),
  trainIds: z.array(z.string().min(1)).min(1),
  validationIds: z.array(z.string().min(1)).min(1),
}).superRefine((manifest, context) => {
  const ids = new Set(manifest.examples.map((example) => example.exampleId));
  const splitIds = [...manifest.trainIds, ...manifest.validationIds];
  if (new Set(splitIds).size !== splitIds.length) context.addIssue({ code: 'custom', path: ['trainIds'], message: 'train/validation split은 겹칠 수 없습니다.' });
  for (const id of splitIds) if (!ids.has(id)) context.addIssue({ code: 'custom', path: ['trainIds'], message: `존재하지 않는 exampleId: ${id}` });
  if (splitIds.length !== ids.size) context.addIssue({ code: 'custom', path: ['examples'], message: '모든 example은 정확히 한 split에 속해야 합니다.' });
  if (manifest.examples.some((example) => !example.humanLabel)) context.addIssue({ code: 'custom', path: ['examples'], message: 'R8 smoke dataset은 human-labelled example만 허용합니다.' });
});
export type CriticDatasetManifest = z.infer<typeof CriticDatasetManifestSchema>;

export const TrainingRunRecordSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  trainingRunId: z.string().min(1),
  status: z.enum(['completed-smoke', 'failed']),
  claim: z.literal('adapter-pipeline-smoke-only'),
  baseModel: z.string().min(1),
  baseModelRevision: z.string().min(1),
  datasetId: z.string().min(1),
  datasetSha256: z.string().regex(/^[a-f0-9]{64}$/),
  trainCount: z.number().int().positive(),
  validationCount: z.number().int().positive(),
  lora: z.strictObject({ r: z.number().int().positive(), alpha: z.number().int().positive(), dropout: z.number().nonnegative(), targetModules: z.array(z.string().min(1)).min(1) }),
  quantization: z.literal('none-cpu-smoke'),
  epochs: z.number().positive(),
  optimizerSteps: z.number().int().positive(),
  learningRate: z.number().positive(),
  batchSize: z.number().int().positive(),
  seed: z.number().int(),
  device: z.string().min(1),
  gpu: z.string().nullable(),
  peakVramMb: z.number().nonnegative().nullable(),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  finalLoss: z.number().finite(),
  adapterPath: z.string().min(1),
  adapterSha256: z.string().regex(/^[a-f0-9]{64}$/),
  adapterReloaded: z.boolean(),
  inferenceSmoke: z.strictObject({ passed: z.boolean(), generatedText: z.string(), latencyMs: z.number().nonnegative() }),
  evaluation: z.strictObject({ meaningfulQualityClaim: z.literal(false), reason: z.string().min(1) }),
  codeGitCommit: z.string().min(7),
});
export type TrainingRunRecord = z.infer<typeof TrainingRunRecordSchema>;
