import { z } from 'zod';
import { SourceLedgerSchema, type SourceLedger } from './source-ledger.js';

const ExactTransformSchema = z.strictObject({ kind: z.literal('exact') });
const JoinTransformSchema = z.strictObject({
  kind: z.literal('join'),
  separator: z.string(),
});

export const ContentRefSchema = z.strictObject({
  text: z.string().min(1),
  sourceSpanIds: z.array(z.string().min(1)).min(1),
  locked: z.literal(true),
  transform: z.discriminatedUnion('kind', [ExactTransformSchema, JoinTransformSchema]),
});

export type ContentRef = z.infer<typeof ContentRefSchema>;

export const SlideIntentSchema = z.enum([
  'mechanism',
  'comparison',
  'state-transition',
  'timeline',
  'boss-phase',
  'loop',
  'resource-flow',
  'hierarchy',
  'data-highlight',
  'table-summary',
  'ui-annotation',
]);

export const GameDesignFacetSchema = z.enum([
  'combat',
  'controls',
  'progression',
  'economy',
  'balance',
  'content',
  'ui-ux',
  'live-operations',
  'validation',
]);

export const SemanticRoleSchema = z.enum([
  'primary',
  'trigger',
  'input',
  'process',
  'state',
  'result',
  'modifier',
  'evidence',
  'constraint',
  'exception',
  'context',
]);

const BlockBaseShape = {
  id: z.string().min(1),
  role: SemanticRoleSchema,
  importance: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  sourceSpanIds: z.array(z.string().min(1)).min(1),
  order: z.number().int().nonnegative(),
  parentId: z.string().min(1).optional(),
  keepTogether: z.boolean().optional(),
};

const HeadingBlockSchema = z.strictObject({
  ...BlockBaseShape,
  kind: z.literal('heading'),
  text: ContentRefSchema,
});

const ParagraphBlockSchema = z.strictObject({
  ...BlockBaseShape,
  kind: z.literal('paragraph'),
  text: ContentRefSchema,
});

const BulletGroupBlockSchema = z.strictObject({
  ...BlockBaseShape,
  kind: z.literal('bullet-group'),
  items: z.array(ContentRefSchema).min(1),
});

const MetricBlockSchema = z.strictObject({
  ...BlockBaseShape,
  kind: z.literal('metric'),
  label: ContentRefSchema,
  value: ContentRefSchema,
  unit: ContentRefSchema.optional(),
});

const KeyValueBlockSchema = z.strictObject({
  ...BlockBaseShape,
  kind: z.literal('key-value'),
  key: ContentRefSchema,
  value: ContentRefSchema,
});

const TableBlockSchema = z.strictObject({
  ...BlockBaseShape,
  kind: z.literal('table'),
  columns: z.array(ContentRefSchema).min(1),
  rows: z.array(z.array(ContentRefSchema).min(1)).min(1),
});

const MechanicStepBlockSchema = z.strictObject({
  ...BlockBaseShape,
  kind: z.literal('mechanic-step'),
  label: ContentRefSchema,
  detail: ContentRefSchema.optional(),
});

const StateBlockSchema = z.strictObject({
  ...BlockBaseShape,
  kind: z.literal('state'),
  name: ContentRefSchema,
  description: ContentRefSchema.optional(),
});

const TimelineEventBlockSchema = z.strictObject({
  ...BlockBaseShape,
  kind: z.literal('timeline-event'),
  label: ContentRefSchema,
  time: ContentRefSchema.optional(),
});

const BossPhaseBlockSchema = z.strictObject({
  ...BlockBaseShape,
  kind: z.literal('boss-phase'),
  label: ContentRefSchema,
  threshold: ContentRefSchema,
  behaviors: z.array(ContentRefSchema).min(1),
});

const ResourceNodeBlockSchema = z.strictObject({
  ...BlockBaseShape,
  kind: z.literal('resource-node'),
  label: ContentRefSchema,
  amount: ContentRefSchema.optional(),
});

const HierarchyNodeBlockSchema = z.strictObject({
  ...BlockBaseShape,
  kind: z.literal('hierarchy-node'),
  label: ContentRefSchema,
});

const UiRegionBlockSchema = z.strictObject({
  ...BlockBaseShape,
  kind: z.literal('ui-region'),
  assetId: z.string().min(1),
  regionLabel: ContentRefSchema,
  explanation: ContentRefSchema,
});

const ExceptionBlockSchema = z.strictObject({
  ...BlockBaseShape,
  kind: z.literal('exception'),
  condition: ContentRefSchema,
  outcome: ContentRefSchema,
});

const TestCriterionBlockSchema = z.strictObject({
  ...BlockBaseShape,
  kind: z.literal('test-criterion'),
  criterion: ContentRefSchema,
  target: ContentRefSchema.optional(),
});

export const SemanticBlockSchema = z.discriminatedUnion('kind', [
  HeadingBlockSchema,
  ParagraphBlockSchema,
  BulletGroupBlockSchema,
  MetricBlockSchema,
  KeyValueBlockSchema,
  TableBlockSchema,
  MechanicStepBlockSchema,
  StateBlockSchema,
  TimelineEventBlockSchema,
  BossPhaseBlockSchema,
  ResourceNodeBlockSchema,
  HierarchyNodeBlockSchema,
  UiRegionBlockSchema,
  ExceptionBlockSchema,
  TestCriterionBlockSchema,
]);

export type SemanticBlock = z.infer<typeof SemanticBlockSchema>;

export const RelationTypeSchema = z.enum([
  'sequence',
  'causes',
  'enables',
  'consumes',
  'produces',
  'transitions-to',
  'depends-on',
  'compares-with',
  'part-of',
  'exception-of',
  'annotates',
]);

export const SemanticRelationSchema = z.strictObject({
  id: z.string().min(1),
  fromBlockId: z.string().min(1),
  toBlockId: z.string().min(1),
  type: RelationTypeSchema,
  label: ContentRefSchema.optional(),
  sourceSpanIds: z.array(z.string().min(1)).min(1),
});

export type SemanticRelation = z.infer<typeof SemanticRelationSchema>;

export const AssetRequirementSchema = z.strictObject({
  id: z.string().min(1),
  role: z.enum(['source-image', 'screenshot', 'icon', 'reference-only']),
  purpose: z.string().min(1),
  required: z.boolean(),
  sourceUri: z.url().optional(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  provenance: z
    .strictObject({
      author: z.string().min(1).optional(),
      license: z.string().min(1).optional(),
      sourceUrl: z.url().optional(),
    })
    .optional(),
});

export const AmbiguitySchema = z.strictObject({
  id: z.string().min(1),
  sourceSpanIds: z.array(z.string().min(1)).min(1),
  question: z.string().min(1),
  candidates: z.array(z.string().min(1)).min(1),
  blocking: z.boolean(),
});

function contentRefs(value: unknown): ContentRef[] {
  const refs: ContentRef[] = [];
  const visit = (entry: unknown): void => {
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (entry === null || typeof entry !== 'object') return;
    const record = entry as Record<string, unknown>;
    if (
      typeof record.text === 'string' &&
      Array.isArray(record.sourceSpanIds) &&
      record.locked === true &&
      typeof record.transform === 'object'
    ) {
      const parsed = ContentRefSchema.safeParse(record);
      if (parsed.success) refs.push(parsed.data);
      return;
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return refs;
}

function hasCycle(blockIds: string[], relations: SemanticRelation[]): boolean {
  const outgoing = new Map<string, string[]>();
  blockIds.forEach((id) => outgoing.set(id, []));
  relations.forEach((relation) => outgoing.get(relation.fromBlockId)?.push(relation.toBlockId));
  const state = new Map<string, 'visiting' | 'done'>();

  const visit = (id: string): boolean => {
    if (state.get(id) === 'visiting') return true;
    if (state.get(id) === 'done') return false;
    state.set(id, 'visiting');
    for (const next of outgoing.get(id) ?? []) {
      if (visit(next)) return true;
    }
    state.set(id, 'done');
    return false;
  };

  return blockIds.some(visit);
}

export const SlideIRSchema = z
  .strictObject({
    schemaVersion: z.literal('0.1'),
    slideId: z.string().min(1),
    locale: z.literal('ko-KR'),
    pagePreference: z.strictObject({
      mode: z.enum(['document', 'presentation', 'auto']),
      preferredProfile: z.enum(['a4-portrait', 'a4-landscape', 'screen-16:9']).optional(),
    }),
    source: SourceLedgerSchema,
    intent: z.strictObject({
      kind: SlideIntentSchema,
      communicationGoal: ContentRefSchema,
      primaryMessage: ContentRefSchema,
      primaryFocusBlockId: z.string().min(1).optional(),
    }),
    domain: z.strictObject({
      topic: z.string().min(1),
      facets: z.array(GameDesignFacetSchema).min(1),
    }),
    blocks: z.array(SemanticBlockSchema).min(1),
    relations: z.array(SemanticRelationSchema),
    assetNeeds: z.array(AssetRequirementSchema),
    constraints: z.strictObject({
      maxSlideCount: z.literal(1),
      primaryOutput: z.literal('pdf'),
      selectableTextRequired: z.literal(true),
      editablePptxRequired: z.literal(false),
      contentPolicy: z.literal('verbatim'),
      numberPolicy: z.literal('source-only'),
      preserveOrder: z.boolean(),
      lockedSpanIds: z.array(z.string().min(1)).min(1),
    }),
    interpretation: z.strictObject({
      author: z.enum(['deterministic-parser', 'ai-proposal', 'user']),
      modelRunId: z.string().min(1).optional(),
      confidence: z.number().min(0).max(1).optional(),
      ambiguities: z.array(AmbiguitySchema),
    }),
  })
  .superRefine((slide, context) => {
    const spanMap = new Map(slide.source.spans.map((span) => [span.id, span]));
    const blockIds = new Set<string>();
    const relationIds = new Set<string>();

    for (const [index, block] of slide.blocks.entries()) {
      if (blockIds.has(block.id)) {
        context.addIssue({ code: 'custom', path: ['blocks', index, 'id'], message: 'block id가 중복됩니다.' });
      }
      blockIds.add(block.id);
      for (const spanId of block.sourceSpanIds) {
        if (!spanMap.has(spanId)) {
          context.addIssue({ code: 'custom', path: ['blocks', index, 'sourceSpanIds'], message: '존재하지 않는 원문 span입니다.' });
        }
      }
      if (block.parentId !== undefined && !slide.blocks.some((candidate) => candidate.id === block.parentId)) {
        context.addIssue({ code: 'custom', path: ['blocks', index, 'parentId'], message: '존재하지 않는 부모 block입니다.' });
      }
    }

    for (const [index, relation] of slide.relations.entries()) {
      if (relationIds.has(relation.id)) {
        context.addIssue({ code: 'custom', path: ['relations', index, 'id'], message: 'relation id가 중복됩니다.' });
      }
      relationIds.add(relation.id);
      if (!blockIds.has(relation.fromBlockId) || !blockIds.has(relation.toBlockId)) {
        context.addIssue({ code: 'custom', path: ['relations', index], message: 'relation endpoint가 존재하지 않습니다.' });
      }
      for (const spanId of relation.sourceSpanIds) {
        if (!spanMap.has(spanId)) {
          context.addIssue({ code: 'custom', path: ['relations', index, 'sourceSpanIds'], message: '존재하지 않는 원문 span입니다.' });
        }
      }
    }

    if (slide.intent.primaryFocusBlockId !== undefined && !blockIds.has(slide.intent.primaryFocusBlockId)) {
      context.addIssue({ code: 'custom', path: ['intent', 'primaryFocusBlockId'], message: '주요 대상 block이 존재하지 않습니다.' });
    }

    for (const spanId of slide.constraints.lockedSpanIds) {
      if (!spanMap.has(spanId)) {
        context.addIssue({ code: 'custom', path: ['constraints', 'lockedSpanIds'], message: '잠근 원문 span이 존재하지 않습니다.' });
      }
    }

    for (const ref of contentRefs(slide)) {
      const spans = ref.sourceSpanIds.map((id) => spanMap.get(id));
      if (spans.some((span) => span === undefined)) {
        context.addIssue({ code: 'custom', message: '표시 문장이 존재하지 않는 원문 span을 참조합니다.' });
        continue;
      }
      const expected =
        ref.transform.kind === 'exact'
          ? spans[0]?.text
          : spans.map((span) => span?.text ?? '').join(ref.transform.separator);
      if (ref.text !== expected) {
        context.addIssue({ code: 'custom', message: '표시 문장이 원문과 일치하지 않습니다: ' + ref.text });
      }
    }

    if (slide.intent.kind !== 'loop' && hasCycle([...blockIds], slide.relations)) {
      context.addIssue({ code: 'custom', path: ['relations'], message: 'loop이 아닌 구조에는 순환 관계를 둘 수 없습니다.' });
    }
  });

export type SlideIR = z.infer<typeof SlideIRSchema>;

export function parseSlideIR(input: unknown): SlideIR {
  return SlideIRSchema.parse(input);
}

export function sourceSpanMap(ledger: SourceLedger): ReadonlyMap<string, string> {
  return new Map(ledger.spans.map((span) => [span.id, span.text]));
}
