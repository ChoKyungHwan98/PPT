import { z } from 'zod';

export const VisualIssueTypeSchema = z.enum([
  'hierarchy',
  'first-fixation',
  'reading-order',
  'grouping',
  'space-use',
  'density',
  'typography-hierarchy',
  'relation-clarity',
  'decorative-interference',
  'submission-readiness',
]);

export type VisualIssueType = z.infer<typeof VisualIssueTypeSchema>;

export const VisualCriticSeveritySchema = z.enum(['info', 'warning', 'error']);
export type VisualCriticSeverity = z.infer<typeof VisualCriticSeveritySchema>;

export const VisualCriticTargetSchema = z.strictObject({
  kind: z.enum(['page', 'region', 'node']),
  ids: z.array(z.string().min(1)).min(1),
});

export const VisualCriticFindingSchema = z.strictObject({
  findingId: z.string().min(1),
  issueType: VisualIssueTypeSchema,
  severity: VisualCriticSeveritySchema,
  target: VisualCriticTargetSchema,
  problem: z.string().min(1),
  reason: z.string().min(1),
  revisionDirection: z.string().min(1),
});

export type VisualCriticFinding = z.infer<typeof VisualCriticFindingSchema>;

export const VisualCritiqueReportSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  artifactId: z.string().min(1),
  firstFixation: z.strictObject({
    target: z.string().min(1),
    assessment: z.string().min(1),
  }),
  readingPathAssessment: z.string().min(1),
  submissionReadiness: z.enum(['ready', 'needs-review', 'not-ready']),
  findings: z.array(VisualCriticFindingSchema).max(8),
  sourceChangeSuggested: z.literal(false),
  hardGateStatus: z.literal('passed'),
});

export type VisualCritiqueReport = z.infer<typeof VisualCritiqueReportSchema>;

export const HumanExpectedFindingSchema = z.strictObject({
  issueType: VisualIssueTypeSchema,
  acceptableIssueTypes: z.array(VisualIssueTypeSchema),
  severity: VisualCriticSeveritySchema,
  target: VisualCriticTargetSchema,
  humanReason: z.string().min(1),
});

export type HumanExpectedFinding = z.infer<typeof HumanExpectedFindingSchema>;

export const UserPositiveApprovalSchema = z.strictObject({
  approvalId: z.string().min(1),
  approvedBy: z.literal('user'),
  approvedArtifactId: z.string().min(1),
  approvedAt: z.iso.datetime(),
  approvalStatement: z.string().min(1),
});

export type UserPositiveApproval = z.infer<typeof UserPositiveApprovalSchema>;

/**
 * 한 artifact가 제출 가능한 Ready Positive인지에 대한 사용자의 명시적 판단.
 * Teacher 품질 및 취향 학습 이벤트와 분리해 저장한다.
 */
export const ArtifactReadinessJudgementSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  judgementId: z.string().min(1),
  artifactId: z.string().min(1),
  evaluatedPng: z.strictObject({
    path: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  decidedBy: z.literal('user'),
  decision: z.enum(['approved-as-ready', 'rejected-as-ready']),
  decidedAt: z.iso.datetime(),
  readyPositiveFixture: z.boolean(),
  reason: z.string().min(1),
  separation: z.strictObject({
    teacherQualityAffected: z.literal(false),
    preferenceEventRecorded: z.literal(false),
  }),
}).superRefine((judgement, context) => {
  const expectedReady = judgement.decision === 'approved-as-ready';
  if (judgement.readyPositiveFixture !== expectedReady) {
    context.addIssue({
      code: 'custom',
      path: ['readyPositiveFixture'],
      message: 'Ready Positive 상태는 사용자의 명시적 승인/거절 판단과 일치해야 합니다.',
    });
  }
});

export type ArtifactReadinessJudgement = z.infer<typeof ArtifactReadinessJudgementSchema>;

export const PositiveFixtureAuditSchema = z.strictObject({
  hierarchyClear: z.literal(true),
  readingOrderClear: z.literal(true),
  spaceUseAppropriate: z.literal(true),
  groupingClear: z.literal(true),
  typographyHierarchyAppropriate: z.literal(true),
  relationClear: z.literal(true),
  decorationNonInterfering: z.literal(true),
  notPrototypeLike: z.literal(true),
  humanReason: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).min(1),
  userApproval: UserPositiveApprovalSchema,
});

export type PositiveFixtureAudit = z.infer<typeof PositiveFixtureAuditSchema>;

export const VisualCriticFixtureSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  fixtureId: z.string().min(1),
  title: z.string().min(1),
  artifactId: z.string().min(1),
  labelCoverage: z.enum(['core-only', 'exhaustive']),
  expectedFindings: z.array(HumanExpectedFindingSchema),
  expectedSubmissionReadiness: z.enum(['ready', 'needs-review', 'not-ready']),
  positiveAudit: PositiveFixtureAuditSchema.optional(),
}).superRefine((fixture, context) => {
  if (fixture.expectedSubmissionReadiness === 'ready' && fixture.positiveAudit === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['positiveAudit'],
      message: 'ready fixture에는 사람의 제출 승인 audit가 필요합니다.',
    });
  }
  if (fixture.expectedSubmissionReadiness !== 'ready' && fixture.positiveAudit !== undefined) {
    context.addIssue({
      code: 'custom',
      path: ['positiveAudit'],
      message: 'positiveAudit는 ready fixture에만 사용할 수 있습니다.',
    });
  }
  if (fixture.positiveAudit !== undefined
    && fixture.positiveAudit.userApproval.approvedArtifactId !== fixture.artifactId) {
    context.addIssue({
      code: 'custom',
      path: ['positiveAudit', 'userApproval', 'approvedArtifactId'],
      message: '사용자 승인 기록은 현재 fixture artifact와 정확히 일치해야 합니다.',
    });
  }
});

export type VisualCriticFixture = z.infer<typeof VisualCriticFixtureSchema>;
