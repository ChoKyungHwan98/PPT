import {
  CompositionPlanSchema,
  PAGE_PROFILES,
  contentHash,
  preferenceContextHash,
  scoreCandidateForContext,
  type CandidateSignature,
  type CompositionPlan,
  type InformationPlan,
  type PairwisePreferenceRecord,
  type PatternFragment,
  type PreferenceContext,
  type PreferenceState,
  type ReferenceRetrievalBrief,
  type SlideIR,
} from '@game-presentation/contracts';
import type { ReferenceSearchResult } from '@game-presentation/reference-engine';
import { parseMechanismGrammar } from './mechanism-grammar.js';

export type CompositionCandidate = {
  plan: CompositionPlan;
  signature: CandidateSignature;
  rankingScore: number;
};

function seedFrom(value: unknown): number {
  return Number.parseInt(contentHash(value).slice(0, 8), 16);
}

function planRegions(fragment: PatternFragment): CompositionPlan['regions'] {
  if (fragment.topology.family === 'editorial-causal-spine') {
    return [
      { regionId: 'message', role: 'message', flow: 'column', order: 0, weight: 0.15, gapToken: 'tight', paddingToken: 'open' },
      { regionId: 'buildup', role: 'primary-artifact', flow: 'free-composition', order: 1, weight: 0.5, gapToken: 'normal', paddingToken: 'open' },
      { regionId: 'threshold', role: 'primary-artifact', flow: 'overlay', order: 2, weight: 0.2, gapToken: 'none', paddingToken: 'normal' },
      { regionId: 'consequence', role: 'evidence', flow: 'column', order: 3, weight: 0.3, gapToken: 'tight', paddingToken: 'open' },
    ];
  }
  return [
    { regionId: 'message', role: 'message', flow: 'column', order: 0, weight: 0.12, gapToken: 'tight', paddingToken: 'open' },
    { regionId: 'lead-in', role: 'support', flow: 'row', order: 1, weight: 0.35, gapToken: 'normal', paddingToken: 'open' },
    { regionId: 'threshold', role: 'primary-artifact', flow: 'overlay', order: 2, weight: 0.35, gapToken: 'none', paddingToken: 'normal' },
    { regionId: 'result-field', role: 'evidence', flow: 'overlay', order: 3, weight: 0.3, gapToken: 'none', paddingToken: 'open' },
  ];
}

function regionForBlock(
  fragment: PatternFragment,
  blockId: string,
  grammar: ReturnType<typeof parseMechanismGrammar>,
): string {
  if (blockId === grammar.focusBlockId) return 'threshold';
  if (grammar.consequenceBlockIds.includes(blockId)) {
    return fragment.topology.family === 'editorial-causal-spine' ? 'consequence' : 'result-field';
  }
  return fragment.topology.family === 'editorial-causal-spine' ? 'buildup' : 'lead-in';
}

function styleIntent(fragment: PatternFragment): CompositionPlan['styleIntent'] {
  if (fragment.topology.family === 'editorial-causal-spine') {
    return {
      tone: 'warm editorial game-design proof',
      contrastModel: 'editorial-hierarchy',
      accentPurpose: 'mark the BREAK threshold and consequence only',
      motif: 'asymmetric evidence columns crossing one threshold rule',
    };
  }
  return {
    tone: 'focused temporal mechanism stage',
    contrastModel: 'high-contrast-stage',
    accentPurpose: 'separate accumulated cause from BREAK state',
    motif: 'time field interrupted by one fracture',
  };
}

function signatureFor(fragment: PatternFragment, planId: string): CandidateSignature {
  return {
    candidateId: planId,
    referenceClusterIds: [...fragment.sourceReferenceIds],
    topologyFamily: fragment.topology.family,
    readingPath: fragment.readingPath,
    featureTags: [
      fragment.densityBand,
      fragment.primaryArtifactRole,
      fragment.topology.emphasisRule,
    ],
  };
}

export function generateCompositionCandidates(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  brief: ReferenceRetrievalBrief;
  rankedReferences: ReferenceSearchResult[];
  fragments: PatternFragment[];
  preferenceState: PreferenceState;
  maximumCandidates?: number;
}): CompositionCandidate[] {
  const grammar = parseMechanismGrammar(input.slide);
  const allowedReferenceIds = new Set(input.rankedReferences.map((reference) => reference.referenceId));
  const preferenceContext: PreferenceContext = {
    intent: input.brief.intent,
    semanticShape: input.brief.semanticShape,
    relationshipShape: input.brief.relationshipShape,
    primaryArtifact: input.brief.primaryArtifact,
    audience: input.brief.audience,
    outputProfile: input.brief.outputProfile,
  };
  const candidates = input.fragments
    .filter(
      (fragment) =>
        fragment.compatibleIntents.includes(input.slide.intent.kind) &&
        fragment.semanticShape === grammar.semanticShape &&
        fragment.sourceReferenceIds.some((referenceId) => allowedReferenceIds.has(referenceId)),
    )
    .map((fragment) => {
      const seed = seedFrom({
        slide: input.slide.source.contentHash,
        brief: input.brief.briefId,
        fragment: fragment.fragmentId,
      });
      const stableId = contentHash({
        slideId: input.slide.slideId,
        fragmentId: fragment.fragmentId,
        seed,
      }).slice(0, 16);
      const planId = 'plan-' + stableId;
      const regions = planRegions(fragment);
      const plan = CompositionPlanSchema.parse({
        schemaVersion: '0.1',
        planId,
        slideId: input.slide.slideId,
        informationPlanId: input.informationPlan.informationPlanId,
        seed,
        pageProfile:
          input.brief.outputProfile === 'html-presentation'
            ? PAGE_PROFILES.htmlPresentation
            : PAGE_PROFILES.pdfPresentation,
        retrievalBriefId: input.brief.briefId,
        referenceIds: fragment.sourceReferenceIds.filter((referenceId) =>
          allowedReferenceIds.has(referenceId),
        ),
        patternFragmentIds: [fragment.fragmentId],
        layout: {
          layoutFamily: fragment.topology.family,
          readingPath: fragment.readingPath,
          rationale: fragment.topology.emphasisRule + ' ' + fragment.topology.groupingRule,
        },
        regions,
        bindings: grammar.orderedBlocks.map((block, index) => ({
          blockId: block.id,
          regionId: regionForBlock(fragment, block.id, grammar),
          fragmentRole: block.role,
          prominence: block.importance,
          readingOrder: index,
        })),
        styleIntent: styleIntent(fragment),
        qualityFloor: {
          requireAllBlocks: true,
          requireAllRelations: true,
          maximumSevereFindings: 0,
          allowCandidateOmission: true,
        },
      });
      const signature = signatureFor(fragment, planId);
      const retrievalScore = Math.max(
        ...plan.referenceIds.map(
          (referenceId) =>
            input.rankedReferences.find((result) => result.referenceId === referenceId)?.score ?? 0,
        ),
      );
      return {
        plan,
        signature,
        rankingScore: scoreCandidateForContext({
          state: input.preferenceState,
          context: preferenceContext,
          candidate: signature,
          baseScore: retrievalScore,
        }),
      };
    })
    .sort(
      (left, right) =>
        right.rankingScore - left.rankingScore || left.plan.planId.localeCompare(right.plan.planId),
    );

  const distinct: CompositionCandidate[] = [];
  for (const candidate of candidates) {
    if (
      distinct.some(
        (existing) =>
          existing.signature.topologyFamily === candidate.signature.topologyFamily &&
          existing.signature.readingPath === candidate.signature.readingPath,
      )
    ) {
      continue;
    }
    distinct.push(candidate);
    if (distinct.length >= (input.maximumCandidates ?? 2)) break;
  }
  return distinct;
}

export function preferenceRecordContextMatches(
  record: PairwisePreferenceRecord,
  brief: ReferenceRetrievalBrief,
): boolean {
  return (
    record.contextHash ===
    preferenceContextHash({
      intent: brief.intent,
      semanticShape: brief.semanticShape,
      relationshipShape: brief.relationshipShape,
      primaryArtifact: brief.primaryArtifact,
      audience: brief.audience,
      outputProfile: brief.outputProfile,
    })
  );
}
