import {
  buildSourceLedger,
  InformationPlanSchema,
  SlideIRSchema,
  validateInformationPlan,
  type ContentRef,
  type SemanticBlock,
  type SlideIR,
  type SourceSegment,
} from '@game-presentation/contracts';

export type AuthoredHierarchy = {
  fixtureId: string;
  rawText: string;
  segments: SourceSegment[];
  titleSegmentId: string;
  messageSegmentId: string;
  facets: SlideIR['domain']['facets'];
  nodes: Array<{
    segmentId: string;
    parentSegmentId?: string;
  }>;
};

/**
 * 사용자가 명시한 부모/자식 관계를 hierarchy SlideIR과 InformationPlan으로 옮긴다.
 * 텍스트, node ID 또는 게임 분야 단어로 부모를 추론하지 않는다.
 */
export function interpretAuthoredHierarchy(input: AuthoredHierarchy) {
  const source = buildSourceLedger({
    ledgerId: `ledger-${input.fixtureId}`,
    rawText: input.rawText,
    segments: input.segments,
    createdAt: '2026-09-04T00:00:00.000Z',
  });
  const ref = (id: string): ContentRef => {
    const span = source.spans.find((entry) => entry.id === id);
    if (span === undefined) throw new Error(`Missing authored segment: ${id}`);
    return {
      text: span.text,
      sourceSpanIds: [id],
      locked: true,
      transform: { kind: 'exact' },
    };
  };
  const blockId = (segmentId: string) => `block-${segmentId}`;
  const nodeSegmentIds = new Set(input.nodes.map((node) => node.segmentId));
  if (nodeSegmentIds.size !== input.nodes.length) throw new Error('Hierarchy node segment가 중복됩니다.');
  for (const node of input.nodes) {
    if (node.parentSegmentId !== undefined && !nodeSegmentIds.has(node.parentSegmentId)) {
      throw new Error(`Hierarchy parent가 node 목록에 없습니다: ${node.parentSegmentId}`);
    }
  }
  const roots = input.nodes.filter((node) => node.parentSegmentId === undefined);
  if (roots.length === 0) throw new Error('Hierarchy에는 최소 한 개의 root가 필요합니다.');

  const blocks: SemanticBlock[] = [
    {
      id: blockId(input.titleSegmentId),
      kind: 'heading',
      role: 'primary',
      importance: 5,
      order: 0,
      sourceSpanIds: [input.titleSegmentId],
      keepTogether: true,
      text: ref(input.titleSegmentId),
    },
    {
      id: blockId(input.messageSegmentId),
      kind: 'paragraph',
      role: 'context',
      importance: 4,
      order: 1,
      sourceSpanIds: [input.messageSegmentId],
      keepTogether: true,
      text: ref(input.messageSegmentId),
    },
    ...input.nodes.map((node, index): SemanticBlock => ({
      id: blockId(node.segmentId),
      kind: 'hierarchy-node',
      role: node.parentSegmentId === undefined ? 'primary' : 'evidence',
      importance: node.parentSegmentId === undefined ? 5 : 3,
      order: index + 2,
      sourceSpanIds: [node.segmentId],
      ...(node.parentSegmentId === undefined ? {} : { parentId: blockId(node.parentSegmentId) }),
      keepTogether: true,
      label: ref(node.segmentId),
    })),
  ];
  const relations = input.nodes.flatMap((node, index) => node.parentSegmentId === undefined ? [] : [{
    id: `part-of-${index}`,
    fromBlockId: blockId(node.segmentId),
    toBlockId: blockId(node.parentSegmentId),
    type: 'part-of' as const,
    sourceSpanIds: [node.segmentId, node.parentSegmentId],
  }]);
  const rootBlockId = blockId(roots[0]!.segmentId);
  const slide = SlideIRSchema.parse({
    schemaVersion: '0.1',
    slideId: input.fixtureId,
    locale: 'ko-KR',
    source,
    pagePreference: { mode: 'auto' },
    intent: {
      kind: 'hierarchy',
      communicationGoal: ref(input.messageSegmentId),
      primaryMessage: ref(input.messageSegmentId),
      primaryFocusBlockId: rootBlockId,
    },
    domain: { topic: ref(input.titleSegmentId).text, facets: input.facets },
    blocks,
    relations,
    assetNeeds: [],
    constraints: {
      maxSlideCount: 1,
      primaryOutput: 'pdf',
      selectableTextRequired: true,
      editablePptxRequired: false,
      contentPolicy: 'verbatim',
      numberPolicy: 'source-only',
      preserveOrder: true,
      lockedSpanIds: input.segments.map((segment) => segment.id),
    },
    interpretation: { author: 'user', confidence: 1, ambiguities: [] },
  });
  const titleBlockId = blockId(input.titleSegmentId);
  const messageBlockId = blockId(input.messageSegmentId);
  const hierarchyBlockIds = input.nodes.map((node) => blockId(node.segmentId));
  const informationPlan = InformationPlanSchema.parse({
    schemaVersion: '0.1',
    informationPlanId: `information-${slide.slideId}`,
    slideId: slide.slideId,
    semanticShape: 'hierarchy',
    grammarId: 'organization-structure',
    message: ref(input.messageSegmentId),
    primaryArtifactBlockId: rootBlockId,
    readingOrder: [titleBlockId, messageBlockId, ...hierarchyBlockIds],
    groups: [
      { groupId: 'authored-explanation', role: 'context', order: 0, blockIds: [titleBlockId, messageBlockId] },
      { groupId: 'authored-hierarchy', role: 'evidence', order: 1, blockIds: hierarchyBlockIds },
    ],
    relationIds: relations.map((relation) => relation.id),
    interpretation: { author: 'user', confidence: 1, ambiguityIds: [] },
  });
  const issues = validateInformationPlan(informationPlan, slide);
  if (issues.length > 0) throw new Error(`Invalid authored hierarchy contract: ${JSON.stringify(issues)}`);
  return { slide, informationPlan };
}
