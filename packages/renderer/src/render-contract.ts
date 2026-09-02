import type {
  CompositionPlan,
  ContentRef,
  MessagePresentationRecord,
  RelationVisualRole,
  SlideIR,
  SourceUsage,
} from '@game-presentation/contracts';

export type MessagePresentation =
  | {
      presentationKind: 'headline' | 'context';
      text: string;
      sourceSpanIds: string[];
      sourceTransform: ContentRef['transform'];
      sourceUsage: SourceUsage;
    }
  | {
      presentationKind: 'suppressed-duplicate';
      sourceSpanIds: string[];
      sourceTransform: ContentRef['transform'];
      suppressionReason: 'all-message-content-is-already-presented-by-blocks';
    };

export function messagePresentationRecord(
  presentation: MessagePresentation,
): MessagePresentationRecord {
  return presentation.presentationKind === 'suppressed-duplicate'
    ? {
        presentationKind: presentation.presentationKind,
        sourceSpanIds: [...presentation.sourceSpanIds],
        sourceTransform: presentation.sourceTransform,
        suppressionReason: presentation.suppressionReason,
      }
    : {
        presentationKind: presentation.presentationKind,
        sourceSpanIds: [...presentation.sourceSpanIds],
        sourceTransform: presentation.sourceTransform,
      };
}

function offsetsForSpanIds(slide: SlideIR, spanIds: string[]): Set<number> {
  const spanMap = new Map(slide.source.spans.map((span) => [span.id, span]));
  const offsets = new Set<number>();
  for (const spanId of spanIds) {
    const span = spanMap.get(spanId);
    if (span === undefined) throw new Error(`message resolver가 존재하지 않는 source span을 받았습니다: ${spanId}`);
    for (let offset = span.start; offset < span.end; offset += 1) offsets.add(offset);
  }
  return offsets;
}

function isStructuralSeparator(character: string): boolean {
  return /[\s→↔⇒⇢➜⟶⟹|/\\:·,;–—-]/u.test(character);
}

/**
 * InformationPlan.message를 원문 offset과 block source offset만으로 분류한다.
 * 문구, block ID, 게임 용어, 모델 추론은 사용하지 않는다.
 */
export function resolveMessagePresentation(input: {
  message: ContentRef;
  slide: SlideIR;
}): MessagePresentation {
  const messageOffsets = offsetsForSpanIds(input.slide, input.message.sourceSpanIds);
  const blockOffsets = offsetsForSpanIds(
    input.slide,
    [...new Set(input.slide.blocks.flatMap((block) => block.sourceSpanIds))],
  );
  const overlappingOffsets = [...messageOffsets].filter((offset) => blockOffsets.has(offset));
  if (overlappingOffsets.length === 0) {
    return {
      presentationKind: 'headline',
      text: input.message.text,
      sourceSpanIds: [...input.message.sourceSpanIds],
      sourceTransform: input.message.transform,
      sourceUsage: 'content',
    };
  }

  const coversEveryBlockOffset = [...blockOffsets].every((offset) => messageOffsets.has(offset));
  const novelSemanticCharacters = [...messageOffsets]
    .filter((offset) => !blockOffsets.has(offset))
    .map((offset) => input.slide.source.rawText[offset] ?? '')
    .filter((character) => !isStructuralSeparator(character));
  if (coversEveryBlockOffset && novelSemanticCharacters.length === 0) {
    return {
      presentationKind: 'suppressed-duplicate',
      sourceSpanIds: [...input.message.sourceSpanIds],
      sourceTransform: input.message.transform,
      suppressionReason: 'all-message-content-is-already-presented-by-blocks',
    };
  }

  return {
    presentationKind: 'context',
    text: input.message.text,
    sourceSpanIds: [...input.message.sourceSpanIds],
    sourceTransform: input.message.transform,
    sourceUsage: 'context-repeat',
  };
}

export type ClassifiedRelationVisualRole = {
  relationId: string;
  visualRole: RelationVisualRole;
  fromRegionId: string;
  toRegionId: string;
};

/** Relation endpoint의 Composition region만 사용한다. connector geometry는 만들지 않는다. */
export function classifyRelationVisualRole(input: {
  relation: SlideIR['relations'][number];
  plan: CompositionPlan;
}): ClassifiedRelationVisualRole | undefined {
  const regionByBlockId = new Map(
    input.plan.bindings.map((binding) => [binding.blockId, binding.regionId]),
  );
  const fromRegionId = regionByBlockId.get(input.relation.fromBlockId);
  const toRegionId = regionByBlockId.get(input.relation.toBlockId);
  if (fromRegionId === undefined || toRegionId === undefined) {
    throw new Error(`Composition binding이 없는 relation endpoint입니다: ${input.relation.id}`);
  }

  let visualRole: RelationVisualRole | undefined;
  if (fromRegionId === 'phase-accumulation' && toRegionId === 'phase-accumulation') {
    visualRole = 'accumulation-local';
  } else if (fromRegionId === 'phase-accumulation' && toRegionId === 'phase-threshold') {
    visualRole = 'threshold-entry';
  } else if (fromRegionId === 'phase-threshold' && toRegionId === 'phase-consequence') {
    visualRole = 'consequence-activation';
  } else if (fromRegionId === 'phase-consequence' && toRegionId === 'phase-consequence') {
    visualRole = 'consequence-local';
  }
  return visualRole === undefined
    ? undefined
    : { relationId: input.relation.id, visualRole, fromRegionId, toRegionId };
}
