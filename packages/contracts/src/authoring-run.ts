import { z } from 'zod';
import { StudioDesignInputSchema } from './studio.js';

export const AuthoringHarnessStateSchema = z.enum([
  'INGEST',
  'INTERPRET',
  'SEMANTIC_VALIDATE',
  'MODE_RESOLVE',
  'INFORMATION_DESIGN',
  'REFERENCE_RETRIEVAL',
  'TEACHER_SELECTION',
  'COMPOSITION',
  'RENDER',
  'HARD_GATE',
  'CRITIC_OPTIONAL',
  'REVISION_OPTIONAL',
  'USER_DECISION',
  'EXPORT',
  'EVALUATION',
]);

export type AuthoringHarnessState = z.infer<typeof AuthoringHarnessStateSchema>;

export const AUTHORING_HARNESS_STATES = AuthoringHarnessStateSchema.options;

export const AuthoringStageRecordSchema = z.strictObject({
  state: AuthoringHarnessStateSchema,
  status: z.enum(['completed', 'skipped', 'awaiting-external-input', 'failed']),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().optional(),
  reason: z.string().min(1).optional(),
});

const ArtifactIdentitySchema = z.strictObject({
  id: z.string().min(1),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
});

const ExportArtifactTraceSchema = z.strictObject({
  kind: z.enum(['png', 'html', 'pdf', 'pptx']),
  path: z.string().min(1),
  hash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  editable: z.boolean(),
});

export const AuthoringRunTraceSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  runId: z.string().min(1),
  projectId: z.string().min(1),
  documentId: z.string().min(1),
  mode: StudioDesignInputSchema.shape.mode,
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  slideIR: ArtifactIdentitySchema.optional(),
  informationPlan: ArtifactIdentitySchema.optional(),
  selectedTeacherIds: z.array(z.string().min(1)),
  compositionPlan: ArtifactIdentitySchema.optional(),
  renderTree: z.strictObject({
    id: z.string().min(1),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    deterministicFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  }).optional(),
  renderedPng: z.strictObject({
    path: z.string().min(1),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
  }).optional(),
  hardGate: z.strictObject({
    passed: z.boolean(),
    programFindingCount: z.number().int().nonnegative(),
    sourceFidelityFindingCount: z.number().int().nonnegative(),
  }).optional(),
  criticRunReference: z.strictObject({
    requestId: z.string().min(1),
    provider: z.string().min(1),
    model: z.string().min(1),
  }).optional(),
  revisionCount: z.number().int().min(0).max(1),
  revisionReference: z.string().min(1).optional(),
  userDecision: z.enum(['ready', 'reject', 'prefer-A', 'prefer-B']).optional(),
  exportArtifacts: z.array(ExportArtifactTraceSchema),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().optional(),
  currentState: AuthoringHarnessStateSchema,
  stages: z.array(AuthoringStageRecordSchema),
  failure: z.strictObject({
    state: AuthoringHarnessStateSchema,
    reason: z.string().min(1),
  }).optional(),
}).superRefine((trace, context) => {
  const positions = trace.stages.map((stage) => AUTHORING_HARNESS_STATES.indexOf(stage.state));
  if (positions.some((position, index) => index > 0 && position <= positions[index - 1]!)) {
    context.addIssue({ code: 'custom', path: ['stages'], message: 'Authoring stage는 canonical 순서로 한 번씩만 기록해야 합니다.' });
  }
  if (trace.failure !== undefined && trace.failure.state !== trace.currentState) {
    context.addIssue({ code: 'custom', path: ['failure', 'state'], message: '실패 상태는 currentState와 일치해야 합니다.' });
  }
  if (trace.revisionCount === 0 && trace.revisionReference !== undefined) {
    context.addIssue({ code: 'custom', path: ['revisionReference'], message: '수정 기록은 revisionCount와 일치해야 합니다.' });
  }
  if (trace.revisionCount === 1 && trace.revisionReference === undefined) {
    context.addIssue({ code: 'custom', path: ['revisionReference'], message: '한 번의 수정에는 추적 가능한 reference가 필요합니다.' });
  }
});

export type AuthoringRunTrace = z.infer<typeof AuthoringRunTraceSchema>;
