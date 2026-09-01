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

export const VisualCriticFixtureSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  fixtureId: z.string().min(1),
  title: z.string().min(1),
  artifactId: z.string().min(1),
  labelCoverage: z.enum(['core-only', 'exhaustive']),
  expectedFindings: z.array(HumanExpectedFindingSchema),
  expectedSubmissionReadiness: z.enum(['ready', 'needs-review', 'not-ready']),
});

export type VisualCriticFixture = z.infer<typeof VisualCriticFixtureSchema>;
