import { z } from 'zod';
import { VisualCritiqueReportSchema } from './visual-critique.js';

export const StudioDesignInputSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  projectId: z.string().min(1),
  documentId: z.string().min(1),
  mode: z.enum(['document', 'presentation']),
  authoredContent: z.string().min(1),
  authoredStructure: z.enum(['aligned-before-after-spec', 'hierarchy']),
  outputProfile: z.enum(['screen-16:9', 'document-16:9']),
  preferenceContext: z.record(z.string(), z.unknown()).optional(),
});
export type StudioDesignInput = z.infer<typeof StudioDesignInputSchema>;

export const ExportHandleSchema = z.strictObject({
  kind: z.enum(['png', 'html', 'pdf', 'pptx']),
  url: z.string().min(1),
  editable: z.boolean(),
});
export type ExportHandle = z.infer<typeof ExportHandleSchema>;

export const StudioDesignOutputSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  artifactId: z.string().min(1),
  projectId: z.string().min(1),
  documentId: z.string().min(1),
  previewPngUrl: z.string().min(1),
  exports: z.array(ExportHandleSchema).min(4),
  validation: z.strictObject({
    hardGatePassed: z.boolean(),
    programFindingCount: z.number().int().nonnegative(),
    sourceFidelityFindingCount: z.number().int().nonnegative(),
  }),
  critic: VisualCritiqueReportSchema.nullable(),
  readiness: z.enum(['not-reviewed', 'ready', 'needs-review', 'not-ready']),
  trace: z.strictObject({
    semanticShape: z.string().min(1),
    selectedTeacherIds: z.array(z.string()),
    appliedGuidanceIds: z.array(z.string()),
    renderTreeFingerprint: z.string().min(1),
    authoredContentHash: z.string().regex(/^[a-f0-9]{64}$/),
    pngSha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
});
export type StudioDesignOutput = z.infer<typeof StudioDesignOutputSchema>;

export const EvaluationReasonTagSchema = z.enum([
  'hierarchy', 'space-use', 'grouping', 'relation-clarity', 'readability',
  'density', 'alignment', 'emphasis', 'cohesion', 'aesthetics',
]);

export const DesignEvaluationEventSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  eventId: z.string().min(1),
  artifactId: z.string().min(1),
  png: z.strictObject({ path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/) }),
  authoredContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  semanticShape: z.string().min(1),
  selectedTeacherIds: z.array(z.string()),
  appliedGuidanceIds: z.array(z.string()),
  critic: z.strictObject({
    provider: z.string().min(1),
    model: z.string().min(1),
    findings: VisualCritiqueReportSchema.shape.findings,
  }).nullable(),
  userDecision: z.enum(['ready', 'reject', 'prefer-A', 'prefer-B']),
  reasonTags: z.array(EvaluationReasonTagSchema),
  decidedAt: z.iso.datetime(),
  separation: z.strictObject({
    teacherQualityChanged: z.literal(false),
    readyQualityRecorded: z.literal(true),
    preferenceRecorded: z.boolean(),
  }),
});
export type DesignEvaluationEvent = z.infer<typeof DesignEvaluationEventSchema>;
