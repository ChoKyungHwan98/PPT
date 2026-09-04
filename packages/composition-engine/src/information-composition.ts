import {
  CompositionPlanSchema,
  PAGE_PROFILES,
  contentHash,
  validateInformationPlan,
  resolveAlignedFeatureSpec,
  type CompositionPlan,
  type InformationPlan,
  type PatternFragment,
  type ReferenceRetrievalBrief,
  type SlideIR,
} from '@game-presentation/contracts';
import type { ReferenceSearchResult, TeacherDesignGuidance } from '@game-presentation/reference-engine';
import { styleIntentForPattern } from './design-intent.js';
import { alignedFeatureComposition } from './aligned-feature-composition.js';
import { organizationComposition } from './organization-composition.js';

type PhaseName = 'accumulation' | 'threshold' | 'consequence';
type PhaseContract = NonNullable<PatternFragment['phaseContract']>;

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

function relationExists(input: {
  slide: SlideIR;
  fromBlockIds: string[];
  toBlockIds: string[];
}): boolean {
  const from = new Set(input.fromBlockIds);
  const to = new Set(input.toBlockIds);
  return input.slide.relations.some(
    (relation) => from.has(relation.fromBlockId) && to.has(relation.toBlockId),
  );
}

function phaseGroups(input: {
  informationPlan: InformationPlan;
  contract: PhaseContract;
}): Map<PhaseName, InformationPlan['groups']> | undefined {
  const result = new Map<PhaseName, InformationPlan['groups']>();
  const assignedGroupIds = new Set<string>();
  for (const region of input.contract.regions) {
    const groups = input.informationPlan.groups
      .filter((group) => region.sourceGroupRoles.some((role) => role === group.role))
      .sort((left, right) => left.order - right.order);
    if (groups.length === 0) return undefined;
    for (const group of groups) {
      if (assignedGroupIds.has(group.groupId)) return undefined;
      assignedGroupIds.add(group.groupId);
    }
    result.set(region.phase, groups);
  }
  if (assignedGroupIds.size !== input.informationPlan.groups.length) return undefined;
  return result;
}

function phaseBlockIds(input: {
  informationPlan: InformationPlan;
  groups: InformationPlan['groups'];
}): string[] {
  const accepted = new Set(input.groups.flatMap((group) => group.blockIds));
  return input.informationPlan.readingOrder.filter((blockId) => accepted.has(blockId));
}

function matchesPhaseContract(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  contract: PhaseContract;
}): boolean {
  if (input.informationPlan.semanticShape !== input.contract.requiredSemanticShape) return false;
  const groups = phaseGroups(input);
  if (groups === undefined) return false;
  const accumulation = phaseBlockIds({ informationPlan: input.informationPlan, groups: groups.get('accumulation') ?? [] });
  const threshold = phaseBlockIds({ informationPlan: input.informationPlan, groups: groups.get('threshold') ?? [] });
  const consequence = phaseBlockIds({ informationPlan: input.informationPlan, groups: groups.get('consequence') ?? [] });
  if (accumulation.length === 0 || threshold.length === 0 || consequence.length === 0) return false;
  if (!threshold.includes(input.informationPlan.primaryArtifactBlockId)) return false;

  const readingPosition = new Map(input.informationPlan.readingOrder.map((blockId, index) => [blockId, index]));
  const lastAccumulation = Math.max(...accumulation.map((blockId) => readingPosition.get(blockId) ?? -1));
  const firstThreshold = Math.min(...threshold.map((blockId) => readingPosition.get(blockId) ?? Number.MAX_SAFE_INTEGER));
  const lastThreshold = Math.max(...threshold.map((blockId) => readingPosition.get(blockId) ?? -1));
  const firstConsequence = Math.min(...consequence.map((blockId) => readingPosition.get(blockId) ?? Number.MAX_SAFE_INTEGER));
  if (!(lastAccumulation < firstThreshold && lastThreshold < firstConsequence)) return false;

  const accumulationRegion = input.contract.regions.find((region) => region.phase === 'accumulation');
  if (accumulationRegion?.localSequenceRequired) {
    for (let index = 0; index < accumulation.length - 1; index += 1) {
      if (!relationExists({
        slide: input.slide,
        fromBlockIds: [accumulation[index]!],
        toBlockIds: [accumulation[index + 1]!],
      })) return false;
    }
  }
  const blocksByPhase = { accumulation, threshold, consequence };
  return input.contract.interPhaseRelations.every((relation) => relationExists({
    slide: input.slide,
    fromBlockIds: blocksByPhase[relation.from],
    toBlockIds: blocksByPhase[relation.to],
  }));
}

function selectionReferenceIds(fragment: PatternFragment): string[] {
  return [...fragment.sourceReferenceIds, ...(fragment.retrievalSupportReferenceIds ?? [])];
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
      (fragment.comparisonContract === undefined || resolveAlignedFeatureSpec(input.slide, input.informationPlan) !== undefined) &&
      selectionReferenceIds(fragment).some((id) => resultScores.has(id)) &&
      (fragment.phaseContract === undefined || matchesPhaseContract({
        slide: input.slide,
        informationPlan: input.informationPlan,
        contract: fragment.phaseContract,
      })),
    )
    .map((fragment) => {
      const referenceIds = selectionReferenceIds(fragment).filter((id) => resultScores.has(id));
      const structuralPriority = fragment.phaseContract === undefined && fragment.comparisonContract === undefined ? 0 : 100;
      const score = structuralPriority + referenceIds.reduce((sum, id) => sum + (resultScores.get(id) ?? 0), 0);
      return { fragment, referenceIds, score };
    })
    .sort((left, right) => right.score - left.score || left.fragment.fragmentId.localeCompare(right.fragment.fragmentId));
  const selected = candidates[0];
  if (selected === undefined) {
    throw new Error('현재 SlideIR과 InformationPlan에 맞는 허용된 pattern fragment를 찾지 못했습니다.');
  }
  return selected;
}

function phaseComposition(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  fragment: PatternFragment;
}): Pick<CompositionPlan, 'regions' | 'bindings'> | undefined {
  const contract = input.fragment.phaseContract;
  if (contract === undefined) return undefined;
  const groups = phaseGroups({ informationPlan: input.informationPlan, contract });
  if (groups === undefined) throw new Error('선택된 phase Pattern과 InformationPlan group 구조가 다릅니다.');
  const phaseByBlockId = new Map<string, PhaseName>();
  for (const phase of contract.regionReadingOrder) {
    for (const group of groups.get(phase) ?? []) {
      for (const blockId of group.blockIds) phaseByBlockId.set(blockId, phase);
    }
  }
  return {
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
      ...contract.regions
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((region) => ({
          regionId: `phase-${region.phase}`,
          role: region.regionRole,
          flow: region.flow,
          order: region.order,
          weight: region.weight,
          gapToken: region.gapToken,
          paddingToken: region.paddingToken,
        })),
    ],
    bindings: input.informationPlan.readingOrder.map((blockId, readingOrder) => {
      const block = input.slide.blocks.find((candidate) => candidate.id === blockId);
      const phase = phaseByBlockId.get(blockId);
      if (block === undefined || phase === undefined) {
        throw new Error(`phase Pattern에 배치할 InformationPlan block을 찾을 수 없습니다: ${blockId}`);
      }
      return {
        blockId,
        regionId: `phase-${phase}`,
        fragmentRole: `${phase}.${block.role}`,
        prominence: block.importance,
        readingOrder,
      };
    }),
  };
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
  teacherGuidance?: TeacherDesignGuidance;
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
  if (input.teacherGuidance !== undefined
    && (input.teacherGuidance.slideId !== input.slide.slideId
      || input.teacherGuidance.informationPlanId !== input.informationPlan.informationPlanId)) {
    throw new Error('Teacher Guidance가 다른 SlideIR 또는 InformationPlan을 가리킵니다.');
  }

  const selected = matchingFragment(input);
  const alignedTeacherGuidance = selected.fragment.comparisonContract !== undefined
    && input.teacherGuidance?.structureLock.semanticShape === 'aligned-before-after-spec'
    ? input.teacherGuidance
    : undefined;
  const organizationTeacherGuidance = selected.fragment.semanticShape === 'hierarchy'
    && input.teacherGuidance?.structureLock.semanticShape === 'hierarchy'
    ? input.teacherGuidance
    : undefined;
  const activeTeacherGuidance = alignedTeacherGuidance ?? organizationTeacherGuidance;
  const stableInput = {
    slideId: input.slide.slideId,
    informationPlanId: input.informationPlan.informationPlanId,
    retrievalBriefId: input.retrieval.brief.briefId,
    fragmentId: selected.fragment.fragmentId,
    teacherStructureLock: activeTeacherGuidance === undefined
      ? undefined
      : {
          authority: activeTeacherGuidance.structureLock.authority,
          semanticShape: activeTeacherGuidance.structureLock.semanticShape,
          application: alignedTeacherGuidance === undefined
            ? 'explanation-and-authored-hierarchy'
            : 'shared-basis-paired-axis',
        },
  };
  const fingerprint = contentHash(stableInput).slice(0, 16);
  const groupByBlockId = new Map(
    input.informationPlan.groups.flatMap((group) => group.blockIds.map((blockId) => [blockId, group] as const)),
  );
  const phasePlan = organizationTeacherGuidance !== undefined
    ? organizationComposition(input.slide, input.informationPlan, organizationTeacherGuidance)
    : selected.fragment.comparisonContract !== undefined
    ? alignedFeatureComposition(input.slide, input.informationPlan, alignedTeacherGuidance)
    : phaseComposition({
    slide: input.slide,
    informationPlan: input.informationPlan,
    fragment: selected.fragment,
  });

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
      rationale: organizationTeacherGuidance !== undefined
        ? 'Primary Teacher Guidance에 따라 운영 원문과 authored 책임·소속 hierarchy를 서로 다른 역할로 병치한다.'
        : alignedTeacherGuidance === undefined
          ? selected.fragment.topology.emphasisRule
          : 'Primary Teacher Guidance에 따라 공통 기준 아래 Before/After 대응쌍을 같은 축에 정렬한다.',
    },
    regions: phasePlan?.regions ?? [
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
    bindings: phasePlan?.bindings ?? input.informationPlan.readingOrder.map((blockId, readingOrder) => {
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
