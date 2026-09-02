import {
  buildSourceLedger, SlideIRSchema, InformationPlanSchema, validateInformationPlan,
  resolveAlignedFeatureSpec, type ContentRef, type SemanticBlock, type SourceSegment,
} from '@game-presentation/contracts';

export type AuthoredFeatureComparison = {
  fixtureId: string;
  rawText: string;
  segments: SourceSegment[];
  titleSegmentId: string;
  messageSegmentId: string;
  messageLabelSegmentId?: string;
  before: { labelSegmentId: string; itemSegmentIds: string[] };
  after: { labelSegmentId: string; itemSegmentIds: string[] };
  pairs: { beforeSegmentId: string; afterSegmentId: string }[];
};

/** Explicit authored fields/edges are input; this is not a free-text semantic guesser. */
export function interpretAuthoredFeatureComparison(input: AuthoredFeatureComparison) {
  const source = buildSourceLedger({
    ledgerId: `ledger-${input.fixtureId}`, rawText: input.rawText, segments: input.segments,
    createdAt: '2026-09-03T00:00:00.000Z',
  });
  const ref = (id: string): ContentRef => {
    const span = source.spans.find((entry) => entry.id === id);
    if (!span) throw new Error(`Missing authored segment: ${id}`);
    return { text: span.text, sourceSpanIds: [id], locked: true, transform: { kind: 'exact' } };
  };
  const blockId = (id: string) => `block-${id}`;
  const entries: { id: string; kind: 'heading' | 'paragraph'; role: 'primary' | 'context' | 'evidence'; importance: 2 | 3 | 4 | 5 }[] = [
    { id: input.titleSegmentId, kind: 'heading', role: 'primary', importance: 5 },
    { id: input.before.labelSegmentId, kind: 'heading', role: 'context', importance: 3 },
    ...input.before.itemSegmentIds.map((id) => ({ id, kind: 'paragraph' as const, role: 'evidence' as const, importance: 3 as const })),
    { id: input.after.labelSegmentId, kind: 'heading', role: 'context', importance: 4 },
    ...input.after.itemSegmentIds.map((id) => ({ id, kind: 'paragraph' as const, role: 'evidence' as const, importance: 4 as const })),
    ...(input.messageLabelSegmentId ? [{ id: input.messageLabelSegmentId, kind: 'heading' as const, role: 'context' as const, importance: 2 as const }] : []),
    { id: input.messageSegmentId, kind: 'paragraph', role: 'context', importance: 4 },
  ];
  const blocks: SemanticBlock[] = entries.map((entry, order) => ({
    id: blockId(entry.id), kind: entry.kind, role: entry.role, importance: entry.importance,
    order, sourceSpanIds: [entry.id], keepTogether: true, text: ref(entry.id),
  }));
  const relations = input.pairs.map((pair, index) => ({
    id: `change-${index + 1}`,
    fromBlockId: blockId(pair.beforeSegmentId), toBlockId: blockId(pair.afterSegmentId),
    type: 'compares-with' as const,
    sourceSpanIds: [pair.beforeSegmentId, pair.afterSegmentId],
  }));
  const slide = SlideIRSchema.parse({
    schemaVersion: '0.1', slideId: input.fixtureId, locale: 'ko-KR',
    source, pagePreference: { mode: 'auto' },
    intent: { kind: 'comparison', communicationGoal: ref(input.messageSegmentId),
      primaryMessage: ref(input.messageSegmentId), primaryFocusBlockId: blockId(input.titleSegmentId) },
    domain: { topic: ref(input.titleSegmentId).text, facets: ['controls'] },
    blocks, relations, assetNeeds: [],
    constraints: { maxSlideCount: 1, primaryOutput: 'pdf', selectableTextRequired: true,
      editablePptxRequired: false, contentPolicy: 'verbatim', numberPolicy: 'source-only',
      preserveOrder: false, lockedSpanIds: input.segments.map((segment) => segment.id) },
    interpretation: { author: 'user', confidence: 1, ambiguities: [] },
  });
  const contextIds = [
    blockId(input.titleSegmentId),
    ...(input.messageLabelSegmentId ? [blockId(input.messageLabelSegmentId)] : []),
    blockId(input.messageSegmentId),
  ];
  const informationPlan = InformationPlanSchema.parse({
    schemaVersion: '0.1', informationPlanId: `information-${slide.slideId}`, slideId: slide.slideId,
    semanticShape: 'comparison', grammarId: 'before-after-feature-spec',
    message: ref(input.messageSegmentId), primaryArtifactBlockId: blockId(input.titleSegmentId),
    readingOrder: [...contextIds, blockId(input.before.labelSegmentId), blockId(input.after.labelSegmentId),
      ...relations.flatMap((relation) => [relation.fromBlockId, relation.toBlockId])],
    groups: [
      { groupId: 'authored-context', role: 'context', order: 0, blockIds: contextIds },
      { groupId: 'authored-before', role: 'before', order: 1, blockIds: [input.before.labelSegmentId, ...input.before.itemSegmentIds].map(blockId) },
      { groupId: 'authored-after', role: 'after', order: 2, blockIds: [input.after.labelSegmentId, ...input.after.itemSegmentIds].map(blockId) },
    ],
    relationIds: relations.map((relation) => relation.id),
    interpretation: { author: 'user', confidence: 1, ambiguityIds: [] },
  });
  const issues = validateInformationPlan(informationPlan, slide);
  if (issues.length || !resolveAlignedFeatureSpec(slide, informationPlan)) {
    throw new Error(`Invalid authored comparison contract: ${JSON.stringify(issues)}`);
  }
  return { slide, informationPlan };
}
