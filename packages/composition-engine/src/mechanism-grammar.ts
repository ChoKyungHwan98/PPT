import type { SemanticBlock, SemanticRelation, SlideIR } from '@game-presentation/contracts';

export type MechanismGrammarResult = {
  semanticShape: 'causal-chain';
  orderedBlocks: SemanticBlock[];
  orderedRelations: SemanticRelation[];
  focusBlockId: string;
  triggerBlockIds: string[];
  transitionBlockIds: string[];
  consequenceBlockIds: string[];
};

export function parseMechanismGrammar(slide: SlideIR): MechanismGrammarResult {
  if (slide.intent.kind !== 'mechanism') {
    throw new Error('mechanism grammar에는 mechanism SlideIR이 필요합니다.');
  }
  const orderedBlocks = [...slide.blocks].sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id),
  );
  const orderById = new Map(orderedBlocks.map((block, index) => [block.id, index]));
  const orderedRelations = [...slide.relations].sort((left, right) => {
    const leftOrder = orderById.get(left.fromBlockId) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = orderById.get(right.fromBlockId) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.id.localeCompare(right.id);
  });
  if (slide.constraints.preserveOrder) {
    for (const relation of orderedRelations) {
      const from = orderById.get(relation.fromBlockId);
      const to = orderById.get(relation.toBlockId);
      if (from === undefined || to === undefined || from >= to) {
        throw new Error('원문의 진행 순서를 거스르는 mechanism relation입니다: ' + relation.id);
      }
    }
  }
  const focusBlockId =
    slide.intent.primaryFocusBlockId ??
    orderedBlocks.find((block) => block.role === 'primary')?.id ??
    orderedBlocks[0]!.id;
  const focusIndex = orderById.get(focusBlockId);
  if (focusIndex === undefined) throw new Error('mechanism focus block이 존재하지 않습니다.');
  return {
    semanticShape: 'causal-chain',
    orderedBlocks,
    orderedRelations,
    focusBlockId,
    triggerBlockIds: orderedBlocks
      .filter((block, index) => index < focusIndex)
      .map((block) => block.id),
    transitionBlockIds: [focusBlockId],
    consequenceBlockIds: orderedBlocks
      .filter((block, index) => index > focusIndex)
      .map((block) => block.id),
  };
}
