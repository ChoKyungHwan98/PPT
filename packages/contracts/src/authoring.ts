import { z } from 'zod';

const ParagraphBlockSchema = z.strictObject({
  id: z.string().min(1),
  kind: z.literal('paragraph'),
  order: z.number().int().nonnegative(),
  text: z.string().min(1),
  styleId: z.string(),
  styleName: z.string(),
  headingLevel: z.number().int().min(1).max(9).optional(),
});

const DocumentTableBlockSchema = z.strictObject({
  id: z.string().min(1),
  kind: z.literal('table'),
  order: z.number().int().nonnegative(),
  rows: z.array(z.array(z.string())).min(1),
});

export const AuthoredBlockSchema = z.discriminatedUnion('kind', [
  ParagraphBlockSchema,
  DocumentTableBlockSchema,
]);
export type AuthoredBlock = z.infer<typeof AuthoredBlockSchema>;

export const AuthoredSectionSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  level: z.number().int().min(1).max(9),
  headingBlockId: z.string().min(1),
  parentSectionId: z.string().min(1).optional(),
  blockIds: z.array(z.string().min(1)).min(1),
});
export type AuthoredSection = z.infer<typeof AuthoredSectionSchema>;

export const AuthoredDocumentSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  documentId: z.string().min(1),
  locale: z.literal('ko-KR'),
  source: z.strictObject({
    kind: z.literal('docx'),
    path: z.string().min(1),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  blocks: z.array(AuthoredBlockSchema).min(1),
  sections: z.array(AuthoredSectionSchema),
});
export type AuthoredDocument = z.infer<typeof AuthoredDocumentSchema>;

export const ContentInventoryItemSchema = z.strictObject({
  id: z.string().min(1),
  sourceBlockId: z.string().min(1),
  sourceLocation: z.string().min(1),
  type: z.enum(['heading', 'paragraph', 'table-cell']),
  sourceText: z.string().min(1),
  numericTokens: z.array(z.string()),
});
export type ContentInventoryItem = z.infer<typeof ContentInventoryItemSchema>;

export const ContentInventorySchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  inventoryId: z.string().min(1),
  documentId: z.string().min(1),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  selectedSectionIds: z.array(z.string().min(1)).min(1),
  items: z.array(ContentInventoryItemSchema).min(1),
  createdAt: z.iso.datetime(),
});
export type ContentInventory = z.infer<typeof ContentInventorySchema>;

const GoalSlideSchema = z.strictObject({
  id: z.string().min(1),
  role: z.literal('goal-definition'),
  title: z.string().min(1),
  message: z.string().min(1),
  layoutFamily: z.literal('editorial-goal-columns'),
  sourceBlockIds: z.array(z.string().min(1)).min(1),
  goals: z.array(
    z.strictObject({
      axis: z.string().min(1),
      target: z.string().min(1),
      evidence: z.string().min(1),
      sourceBlockIds: z.array(z.string().min(1)).min(1),
    }),
  ).min(2),
});

const TuningSlideSchema = z.strictObject({
  id: z.string().min(1),
  role: z.literal('tuning-ledger'),
  title: z.string().min(1),
  message: z.string().min(1),
  layoutFamily: z.literal('editorial-tuning-ledger'),
  sourceBlockIds: z.array(z.string().min(1)).min(1),
  versions: z.array(z.string().min(1)).min(2),
  rows: z.array(
    z.strictObject({
      parameter: z.string().min(1),
      values: z.array(z.string().min(1)).min(2),
      reason: z.string().min(1),
      outcomeLabel: z.string().min(1),
      outcomeValue: z.string().min(1),
      sourceBlockIds: z.array(z.string().min(1)).min(1),
    }),
  ).min(1),
});

const ValidationSlideSchema = z.strictObject({
  id: z.string().min(1),
  role: z.literal('validation-summary'),
  title: z.string().min(1),
  message: z.string().min(1),
  layoutFamily: z.literal('editorial-validation-field'),
  sourceBlockIds: z.array(z.string().min(1)).min(1),
  checks: z.array(
    z.strictObject({
      label: z.string().min(1),
      criterion: z.string().min(1),
      result: z.string().min(1),
      status: z.string().min(1),
      sourceBlockIds: z.array(z.string().min(1)).min(1),
    }),
  ).min(1),
  monteCarlo: z.strictObject({
    runs: z.string().min(1),
    passRate: z.string().min(1),
    sampling: z.string().min(1),
    sourceBlockIds: z.array(z.string().min(1)).min(1),
  }),
});

export const PlannedSlideSchema = z.discriminatedUnion('role', [
  GoalSlideSchema,
  TuningSlideSchema,
  ValidationSlideSchema,
]);
export type PlannedSlide = z.infer<typeof PlannedSlideSchema>;

export const PresentationPlanSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  planId: z.string().min(1),
  documentId: z.string().min(1),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  projectTitle: z.string().min(1),
  sectionTitle: z.string().min(1),
  slideProfile: z.literal('screen-16:9'),
  author: z.literal('deterministic-planner'),
  slides: z.array(PlannedSlideSchema).min(1),
});
export type PresentationPlan = z.infer<typeof PresentationPlanSchema>;
