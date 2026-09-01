import { describe, expect, it } from 'vitest';
import {
  EMPTY_PREFERENCE_STATE,
  PairwisePreferenceRecordSchema,
  SEED_PATTERN_FRAGMENTS,
  SEED_REFERENCE_CORPUS,
  applyPairwisePreference,
  buildReferenceRetrievalBrief,
  preferenceContextHash,
} from '@game-presentation/contracts';
import { MEC_01_SLIDE_IR } from '../../contracts/fixtures/mec-01.js';
import { createMec01InformationPlan } from '../../source-ingestion/src/mec-01-semantic.js';
import { buildReferenceIndex, searchReferenceIndex } from '@game-presentation/reference-engine';
import { generateCompositionCandidates } from '../src/candidates.js';
import { parseMechanismGrammar } from '../src/mechanism-grammar.js';

function inputs() {
  const informationPlan = createMec01InformationPlan(MEC_01_SLIDE_IR);
  const brief = buildReferenceRetrievalBrief({
    slide: MEC_01_SLIDE_IR,
    corpus: SEED_REFERENCE_CORPUS,
    semanticShape: 'causal-chain',
    primaryArtifact: 'mechanism-flow',
    densityBand: 'balanced',
    readingPathCandidates: ['guided-sequence', 'left-to-right', 'center-out'],
    audience: 'game-design-reviewer',
    outputProfile: 'pdf-presentation',
    avoidSignatures: ['card-dashboard'],
  });
  const rankedReferences = searchReferenceIndex({
    brief,
    corpus: SEED_REFERENCE_CORPUS,
    index: buildReferenceIndex(SEED_REFERENCE_CORPUS),
    limit: 4,
  });
  return { brief, rankedReferences, informationPlan };
}

describe('mechanism composition search', () => {
  it('preserves the authored mechanism order', () => {
    const grammar = parseMechanismGrammar(MEC_01_SLIDE_IR);
    expect(grammar.orderedBlocks.map((block) => block.id)).toEqual([
      'dodge-step',
      'fragment-resource',
      'freeze-step',
      'break-state',
      'damage-modifier',
    ]);
    expect(grammar.focusBlockId).toBe('break-state');
  });

  it('generates two structurally different hypotheses reproducibly', () => {
    const common = inputs();
    const first = generateCompositionCandidates({
      slide: MEC_01_SLIDE_IR,
      ...common,
      fragments: SEED_PATTERN_FRAGMENTS,
      preferenceState: EMPTY_PREFERENCE_STATE,
    });
    const second = generateCompositionCandidates({
      slide: MEC_01_SLIDE_IR,
      ...common,
      fragments: SEED_PATTERN_FRAGMENTS,
      preferenceState: EMPTY_PREFERENCE_STATE,
    });
    expect(second).toEqual(first);
    expect(first).toHaveLength(2);
    expect(new Set(first.map((candidate) => candidate.signature.topologyFamily)).size).toBe(2);
    expect(new Set(first.map((candidate) => candidate.signature.readingPath)).size).toBe(2);
    expect(
      first.every((candidate) => candidate.plan.bindings.length === MEC_01_SLIDE_IR.blocks.length),
    ).toBe(true);
  });

  it('uses a pairwise choice to rerank only the matching composition context', () => {
    const common = inputs();
    const initial = generateCompositionCandidates({
      slide: MEC_01_SLIDE_IR,
      ...common,
      fragments: SEED_PATTERN_FRAGMENTS,
      preferenceState: EMPTY_PREFERENCE_STATE,
    });
    const editorial = initial.find(
      (candidate) => candidate.signature.topologyFamily === 'editorial-causal-spine',
    );
    const threshold = initial.find(
      (candidate) => candidate.signature.topologyFamily === 'threshold-field',
    );
    if (editorial === undefined || threshold === undefined) throw new Error('candidate fixture error');
    const context = {
      intent: common.brief.intent,
      semanticShape: common.brief.semanticShape,
      relationshipShape: common.brief.relationshipShape,
      primaryArtifact: common.brief.primaryArtifact,
      audience: common.brief.audience,
      outputProfile: common.brief.outputProfile,
    };
    const state = applyPairwisePreference(
      EMPTY_PREFERENCE_STATE,
      PairwisePreferenceRecordSchema.parse({
        schemaVersion: '0.1',
        preferenceId: 'preference-editorial',
        contextHash: preferenceContextHash(context),
        context,
        candidateA: threshold.signature,
        candidateB: editorial.signature,
        winner: 'B',
        reasons: ['clearer-reading-path'],
        createdAt: '2026-08-29T00:00:00.000Z',
      }),
    );
    const reranked = generateCompositionCandidates({
      slide: MEC_01_SLIDE_IR,
      ...common,
      fragments: SEED_PATTERN_FRAGMENTS,
      preferenceState: state,
    });
    expect(reranked[0]?.signature.topologyFamily).toBe('editorial-causal-spine');
  });
});
