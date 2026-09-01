import {
  CompositionPlanSchema,
  PAGE_PROFILES,
  contentHash,
  validateInformationPlan,
  type CompositionPlan,
  type InformationPlan,
  type PatternFragment,
  type ReferenceRetrievalBrief,
  type SlideIR,
} from '@game-presentation/contracts';
import type { ReferenceSearchResult } from '@game-presentation/reference-engine';
import { styleIntentForPattern } from './design-intent.js';

function pageProfileFor(outputProfile: ReferenceRetrievalBrief['outputProfile']) {
  switch (outputProfile) {
    case 'pdf-document':
      return PAGE_PROFILES.pdfA4Landscape;
    case 'pdf-presentation':
      return PAGE_PROFILES.pdfPresentation;
    case 'html-presentation':
      return PAGE_PROFILES.htmlPresentation;
  }
}

function roleForGroup(group: InformationPlan['groups'][number], informationPlan: InformationPlan) {
  if (group.blockIds.includes(informationPlan.primaryArtifactBlockId)) return 'primary-artifact' as const;
  if (group.role === 'consequence' || group.role === 'evidence') return 'evidence' as const;
  if (group.role === 'context') return 'annotation' as const;
  return 'support' as const;
}

function flowForGroup(group: InformationPlan['groups'][number], informationPlan: InformationPlan) {
  if (group.blockIds.includes(informationPlan.primaryArtifactBlockId)) return 'overlay' as const;
  return group.blockIds.length > 1 ? 'row' as const : 'column' as const;
}

function regionDesignForGroup(input: {
  group: InformationPlan['groups'][number];
  informationPlan: InformationPlan;
  fragment: PatternFragment;
}) {
  const isPrimary = input.group.blockIds.includes(input.informationPlan.primaryArtifactBlockId);
  const isConsequence = input.group.role === 'consequence' || input.group.role === 'evidence';
  const isThreshold = input.fragment.topology.family === 'threshold-field';
  const isSpine = input.fragment.topology.family === 'editorial-causal-spine';
  return {
    flow: flowForGroup(input.group, input.informationPlan),
    weight: isPrimary
      ? isThreshold ? 0.82 : isSpine ? 0.8 : 1.1
      : isConsequence
        ? isThreshold ? 1.05 : isSpine ? 1.15 : 0.9
        : isThreshold ? Math.max(1.8, input.group.blockIds.length * 0.72) : Math.max(2, input.group.blockIds.length * 0.78),
    gapToken: input.group.blockIds.length > 1 ? 'open' as const : 'tight' as const,
    paddingToken: isPrimary ? 'tight' as const : isConsequence ? 'open' as const : 'normal' as const,
  };
}

function matchingFragment(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  retrieval: { brief: ReferenceRetrievalBrief; results: ReferenceSearchResult[] };
  fragments: PatternFragment[];
}): { fragment: PatternFragment; referenceIds: string[] } {
  const resultScores = new Map(input.retrieval.results.map((result) => [result.referenceId, result.score]));
  const candidates = input.fragments
    .filter((fragment) =>
      fragment.compatibleIntents.includes(input.slide.intent.kind) &&
      fragment.semanticShape === input.informationPlan.semanticShape &&
      fragment.sourceReferenceIds.some((id) => resultScores.has(id)),
    )
    .map((fragment) => {
      const referenceIds = fragment.sourceReferenceIds.filter((id) => resultScores.has(id));
      const score = referenceIds.reduce((sum, id) => sum + (resultScores.get(id) ?? 0), 0);
      return { fragment, referenceIds, score };
    })
    .sort((left, right) => right.score - left.score || left.fragment.fragmentId.localeCompare(right.fragment.fragmentId));
  const selected = candidates[0];
  if (selected === undefined) {
    throw new Error('현재 SlideIR과 InformationPlan에 맞는 허용된 pattern fragment를 찾지 못했습니다.');
  }
  return selected;
}

/**
 * 범용 InformationPlan을 실제 배치 의도로 바꾼다.
 * MEC-01의 fixture ID, 블록 개수, 특정 게임 용어에는 의존하지 않는다.
 */
export function createCompositionPlanFromInformationPlan(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  retrieval: { brief: ReferenceRetrievalBrief; results: ReferenceSearchResult[] };
  fragments: PatternFragment[];
}): CompositionPlan {
  const informationIssues = validateInformationPlan(input.informationPlan, input.slide);
  if (informationIssues.length > 0) {
    throw new Error(`유효하지 않은 InformationPlan으로는 Composition을 만들 수 없습니다: ${informationIssues[0]!.message}`);
  }
  if (input.retrieval.brief.slideId !== input.slide.slideId) {
    throw new Error('Retrieval 결과가 다른 SlideIR을 가리킵니다.');
  }
  if (input.retrieval.brief.semanticShape !== input.informationPlan.semanticShape) {
    throw new Error('Retrieval 결과의 설명 구조가 InformationPlan과 다릅니다.');
  }

  const selected = matchingFragment(input);
  const stableInput = {
    slideId: input.slide.slideId,
    informationPlanId: input.informationPlan.informationPlanId,
    retrievalBriefId: input.retrieval.brief.briefId,
    fragmentId: selected.fragment.fragmentId,
  };
  const fingerprint = contentHash(stableInput).slice(0, 16);
  const groupByBlockId = new Map(
    input.informationPlan.groups.flatMap((group) => group.blockIds.map((blockId) => [blockId, group] as const)),
  );

  return CompositionPlanSchema.parse({
    schemaVersion: '0.1',
    planId: `composition-${fingerprint}`,
    slideId: input.slide.slideId,
    informationPlanId: input.informationPlan.informationPlanId,
    seed: Number.parseInt(contentHash(stableInput).slice(0, 8), 16),
    pageProfile: pageProfileFor(input.retrieval.brief.outputProfile),
    retrievalBriefId: input.retrieval.brief.briefId,
    referenceIds: selected.referenceIds,
    patternFragmentIds: [selected.fragment.fragmentId],
    layout: {
      layoutFamily: selected.fragment.topology.family,
      readingPath: selected.fragment.readingPath,
      rationale: selected.fragment.topology.emphasisRule,
    },
    regions: [
      {
        regionId: 'message-context',
        role: 'message',
        flow: 'column',
        order: 0,
        weight: 0.12,
        gapToken: 'tight',
        paddingToken: 'open',
      },
      ...input.informationPlan.groups
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((group) => ({
          regionId: `group-${group.groupId}`,
          role: roleForGroup(group, input.informationPlan),
          order: group.order + 1,
          ...regionDesignForGroup({ group, informationPlan: input.informationPlan, fragment: selected.fragment }),
        })),
    ],
    bindings: input.informationPlan.readingOrder.map((blockId, readingOrder) => {
      const block = input.slide.blocks.find((candidate) => candidate.id === blockId);
      const group = groupByBlockId.get(blockId);
      if (block === undefined || group === undefined) throw new Error(`InformationPlan의 block을 찾을 수 없습니다: ${blockId}`);
      return {
        blockId,
        regionId: `group-${group.groupId}`,
        fragmentRole: block.role,
        prominence: block.importance,
        readingOrder,
      };
    }),
    styleIntent: styleIntentForPattern(selected.fragment),
    qualityFloor: {
      requireAllBlocks: true,
      requireAllRelations: true,
      maximumSevereFindings: 0,
      allowCandidateOmission: true,
    },
  });
}
