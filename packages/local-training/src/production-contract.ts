import { z } from 'zod';
import { CandidateSignatureSchema, DesignEvaluationEventSchema, PreferenceEvidenceEventSchema } from '@game-presentation/contracts';

const RelativePathSchema = z.string().min(1).refine(
  (value) => !value.startsWith('/') && !/^[A-Za-z]:[\\/]/u.test(value) && !/(?:^|[\\/])\.\.(?:[\\/]|$)/u.test(value),
  '저장소 내부 상대 경로여야 합니다.',
);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

/**
 * 학습 evidence가 참조하는 artifact의 최소 영속 계약이다.
 * 과거 job.json은 현재 StudioDesignOutput 전체 schema보다 오래될 수 있으므로,
 * 학습에 필요한 식별/trace/candidate 필드만 엄격히 읽고 나머지는 보존한다.
 */
export const TrainingArtifactEnvelopeSchema = z.object({
  input: z.object({ mode: z.enum(['document', 'presentation']) }).passthrough().optional(),
  output: z.object({
    artifactId: z.string().min(1),
    comparisonId: z.string().min(1).optional(),
    candidates: z.array(z.object({
      candidateId: z.string().min(1),
      pngSha256: Sha256Schema,
    }).passthrough()).default([]),
    trace: z.object({
      authoredContentHash: Sha256Schema,
      pngSha256: Sha256Schema,
      semanticShape: z.string().min(1),
      renderTreeFingerprint: z.string().min(1),
    }).passthrough(),
  }).passthrough(),
  candidates: z.array(z.object({
    candidateId: z.string().min(1),
    pngPath: z.string().min(1),
    pngHash: Sha256Schema,
  }).passthrough()).optional(),
}).passthrough();
export type TrainingArtifactEnvelope = z.infer<typeof TrainingArtifactEnvelopeSchema>;

export const HumanEvaluationEvidenceSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  eventKind: z.literal('evaluation'),
  sourceEvent: DesignEvaluationEventSchema.refine(
    (event) => event.userDecision === 'ready' || event.userDecision === 'reject',
    '학습용 품질 평가는 명시적인 ready/reject 판단이어야 합니다.',
  ),
  sourceEventHash: Sha256Schema,
  explicitHumanDecision: z.literal(true),
  artifact: z.strictObject({
    metadataPath: RelativePathSchema,
    artifactIdentitySha256: Sha256Schema,
    pngPath: RelativePathSchema,
    pngSha256: Sha256Schema,
    authoredContentHash: Sha256Schema,
    semanticShape: z.string().min(1),
    mode: z.enum(['document', 'presentation']),
    renderTreeFingerprint: z.string().min(1),
  }),
});
export type HumanEvaluationEvidence = z.infer<typeof HumanEvaluationEvidenceSchema>;

export const HumanPreferenceEvidenceSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  eventKind: z.literal('preference'),
  sourceEvent: PreferenceEvidenceEventSchema,
  sourceEventHash: Sha256Schema,
  artifact: z.strictObject({
    metadataPath: RelativePathSchema,
    artifactIdentitySha256: Sha256Schema,
    authoredContentHash: Sha256Schema,
    candidates: z.array(z.strictObject({
      candidateId: z.string().min(1),
      pngPath: RelativePathSchema,
      pngSha256: Sha256Schema,
    })).min(1).max(3),
  }),
});
export type HumanPreferenceEvidence = z.infer<typeof HumanPreferenceEvidenceSchema>;

export const ProductionCriticTrainingExampleSchema = z.strictObject({
  exampleId: z.string().min(1),
  sourceEventId: z.string().min(1),
  sourceEventHash: Sha256Schema,
  artifactId: z.string().min(1),
  artifactGroupId: z.string().min(1),
  imagePath: RelativePathSchema,
  imageSha256: Sha256Schema,
  prompt: z.string().min(1),
  response: z.string().min(1),
  readiness: z.enum(['ready', 'not-ready']),
  issueTypes: z.array(z.string().min(1)),
  semanticShape: z.string().min(1),
  mode: z.enum(['document', 'presentation']),
  humanLabel: z.literal(true),
  explicitHumanDecision: z.literal(true),
});
export type ProductionCriticTrainingExample = z.infer<typeof ProductionCriticTrainingExampleSchema>;

export const ProductionPreferenceExampleSchema = z.strictObject({
  sourceEventId: z.string().min(1),
  sourceEventHash: Sha256Schema,
  artifactId: z.string().min(1),
  comparisonId: z.string().min(1),
  decision: z.enum(['choose-A', 'choose-B', 'choose-C', 'reject-all']),
  selectedCandidateId: z.string().min(1).nullable(),
  selectedCandidateHash: Sha256Schema.nullable(),
  candidateIds: z.array(z.string().min(1)).min(1).max(3),
  candidateArtifacts: z.array(z.strictObject({
    candidateId: z.string().min(1),
    imagePath: RelativePathSchema,
    imageSha256: Sha256Schema,
  })).min(1).max(3),
  semanticShape: z.string().min(1),
  mode: z.enum(['document', 'presentation']),
  chosenPatternId: z.string().min(1).nullable(),
  density: z.enum(['sparse', 'balanced', 'dense']),
  designSignature: CandidateSignatureSchema.nullable(),
  reasonTags: z.array(z.string()),
});
export type ProductionPreferenceExample = z.infer<typeof ProductionPreferenceExampleSchema>;

export const ProductionCriticDatasetManifestSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  purpose: z.literal('visual-critic-production'),
  datasetId: z.string().min(1),
  datasetSha256: Sha256Schema,
  createdAt: z.iso.datetime(),
  split: z.strictObject({
    seed: z.number().int(),
    validationRatio: z.number().min(0).max(0.5),
    groupBy: z.literal('authoredContentHash'),
  }),
  sourceEventIds: z.array(z.string().min(1)),
  sourceEventHashes: z.array(z.strictObject({ eventId: z.string().min(1), sha256: Sha256Schema })),
  humanLabelCount: z.number().int().nonnegative(),
  readyPositiveCount: z.number().int().nonnegative(),
  rejectCount: z.number().int().nonnegative(),
  preferenceEventCount: z.number().int().nonnegative(),
  pairwiseCount: z.number().int().nonnegative(),
  trainIds: z.array(z.string().min(1)),
  validationIds: z.array(z.string().min(1)),
  examples: z.array(ProductionCriticTrainingExampleSchema),
  preferences: z.array(ProductionPreferenceExampleSchema),
  distributions: z.strictObject({
    semanticShape: z.record(z.string(), z.number().int().nonnegative()),
    mode: z.record(z.string(), z.number().int().nonnegative()),
    reasonTag: z.record(z.string(), z.number().int().nonnegative()),
  }),
  imageHashes: z.array(z.strictObject({ exampleId: z.string().min(1), sha256: Sha256Schema })),
  files: z.strictObject({
    train: z.literal('train.jsonl'),
    validation: z.literal('validation.jsonl'),
    preference: z.literal('preference.jsonl'),
  }),
}).superRefine((manifest, context) => {
  const exampleIds = manifest.examples.map((example) => example.exampleId);
  if (new Set(exampleIds).size !== exampleIds.length) context.addIssue({ code: 'custom', path: ['examples'], message: 'exampleId가 중복됩니다.' });
  const eventIds = [...manifest.sourceEventIds];
  if (new Set(eventIds).size !== eventIds.length) context.addIssue({ code: 'custom', path: ['sourceEventIds'], message: 'source event가 중복됩니다.' });
  if (manifest.sourceEventHashes.length !== eventIds.length || manifest.sourceEventHashes.some((item) => !eventIds.includes(item.eventId))) context.addIssue({ code: 'custom', path: ['sourceEventHashes'], message: 'source event hash 목록이 event 목록과 다릅니다.' });
  const splitIds = [...manifest.trainIds, ...manifest.validationIds];
  if (new Set(splitIds).size !== splitIds.length) context.addIssue({ code: 'custom', path: ['trainIds'], message: 'train/validation example이 겹칩니다.' });
  if (splitIds.length !== exampleIds.length || splitIds.some((id) => !exampleIds.includes(id))) context.addIssue({ code: 'custom', path: ['trainIds'], message: '모든 critic example은 정확히 한 split에 속해야 합니다.' });
  const splitById = new Map<string, string>([
    ...manifest.trainIds.map((id) => [id, 'train'] as const),
    ...manifest.validationIds.map((id) => [id, 'validation'] as const),
  ]);
  const groupSplit = new Map<string, string>();
  for (const example of manifest.examples) {
    const split = splitById.get(example.exampleId);
    if (split === undefined) continue;
    const previous = groupSplit.get(example.artifactGroupId);
    if (previous !== undefined && previous !== split) context.addIssue({ code: 'custom', path: ['split'], message: `동일 원문 그룹이 train/validation에 누출됐습니다: ${example.artifactGroupId}` });
    groupSplit.set(example.artifactGroupId, split);
  }
  if (manifest.humanLabelCount !== manifest.examples.length) context.addIssue({ code: 'custom', path: ['humanLabelCount'], message: 'human label 집계가 examples와 다릅니다.' });
  if (manifest.readyPositiveCount !== manifest.examples.filter((example) => example.readiness === 'ready').length) context.addIssue({ code: 'custom', path: ['readyPositiveCount'], message: 'Ready Positive 집계가 명시적 ready 판단과 다릅니다.' });
  if (manifest.rejectCount !== manifest.examples.filter((example) => example.readiness === 'not-ready').length) context.addIssue({ code: 'custom', path: ['rejectCount'], message: 'Reject 집계가 examples와 다릅니다.' });
  if (manifest.preferenceEventCount !== manifest.preferences.length) context.addIssue({ code: 'custom', path: ['preferenceEventCount'], message: 'Preference 집계가 events와 다릅니다.' });
  const expectedPairwise = manifest.preferences.reduce((total, preference) => total + (preference.selectedCandidateId === null ? 0 : Math.max(0, preference.candidateIds.length - 1)), 0);
  if (manifest.pairwiseCount !== expectedPairwise) context.addIssue({ code: 'custom', path: ['pairwiseCount'], message: 'Pairwise 집계가 Preference와 다릅니다.' });
  for (const preference of manifest.preferences) {
    const artifactIds = preference.candidateArtifacts.map((candidate) => candidate.candidateId).sort();
    if (JSON.stringify(artifactIds) !== JSON.stringify([...preference.candidateIds].sort())) context.addIssue({ code: 'custom', path: ['preferences'], message: `Preference candidate artifact가 누락됐습니다: ${preference.sourceEventId}` });
    if (preference.selectedCandidateId !== null) {
      const selected = preference.candidateArtifacts.find((candidate) => candidate.candidateId === preference.selectedCandidateId);
      if (selected?.imageSha256 !== preference.selectedCandidateHash) context.addIssue({ code: 'custom', path: ['preferences'], message: `선택 candidate hash가 일치하지 않습니다: ${preference.sourceEventId}` });
    }
  }
});
export type ProductionCriticDatasetManifest = z.infer<typeof ProductionCriticDatasetManifestSchema>;

export const QualityTrainingConfigSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  mode: z.literal('quality'),
  datasetId: z.string().min(1),
  datasetSha256: Sha256Schema,
  baseModel: z.string().min(1),
  baseRevision: z.string().min(1),
  lora: z.strictObject({ r: z.number().int().positive(), alpha: z.number().int().positive(), dropout: z.number().min(0).max(1), targetModules: z.array(z.string().min(1)).min(1) }),
  epochs: z.number().int().positive(),
  learningRate: z.number().positive(),
  batchSize: z.number().int().positive(),
  gradientAccumulation: z.number().int().positive(),
  seed: z.number().int(),
  device: z.enum(['cuda', 'cpu']),
  quantization: z.enum(['bnb-4bit', 'none']),
  maxSamples: z.number().int().positive().nullable(),
  validation: z.strictObject({ maxSamples: z.number().int().positive().nullable(), maxNewTokens: z.number().int().positive() }),
});
export type QualityTrainingConfig = z.infer<typeof QualityTrainingConfigSchema>;

export const ProductionTrainingRunStatusSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  trainingRunId: z.string().min(1),
  mode: z.literal('quality'),
  status: z.enum(['running', 'completed', 'failed']),
  modelStatus: z.enum(['training', 'trained-unbenchmarked', 'failed']),
  datasetId: z.string().min(1),
  datasetSha256: Sha256Schema,
  configPath: RelativePathSchema,
  outputPath: RelativePathSchema,
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().optional(),
  exitCode: z.number().int().nullable().optional(),
  error: z.string().optional(),
});
export type ProductionTrainingRunStatus = z.infer<typeof ProductionTrainingRunStatusSchema>;

export const QualityTrainingRunRecordSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  trainingRunId: z.string().min(1),
  mode: z.literal('quality'),
  status: z.literal('completed'),
  modelStatus: z.literal('trained-unbenchmarked'),
  qualityClaim: z.literal(false),
  datasetId: z.string().min(1),
  datasetSha256: Sha256Schema,
  sourceEventCount: z.number().int().nonnegative(),
  humanLabelCount: z.number().int().nonnegative(),
  readyPositiveCount: z.number().int().nonnegative(),
  baseModel: z.string().min(1),
  baseRevision: z.string().min(1),
  lora: QualityTrainingConfigSchema.shape.lora,
  quantization: QualityTrainingConfigSchema.shape.quantization,
  epochs: z.number().int().positive(),
  optimizerSteps: z.number().int().positive(),
  learningRate: z.number().positive(),
  batchSize: z.number().int().positive(),
  gradientAccumulation: z.number().int().positive(),
  seed: z.number().int(),
  device: z.string().min(1),
  gpu: z.string().nullable(),
  peakVramMb: z.number().nonnegative().nullable(),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  finalTrainLoss: z.number().finite(),
  validationLoss: z.number().finite().nullable(),
  adapterPath: RelativePathSchema,
  adapterSha256: Sha256Schema,
  adapterReloaded: z.boolean(),
  inferenceSmoke: z.strictObject({ passed: z.boolean(), generatedText: z.string(), latencyMs: z.number().nonnegative() }),
  codeGitCommit: z.string().min(7),
});
export type QualityTrainingRunRecord = z.infer<typeof QualityTrainingRunRecordSchema>;
