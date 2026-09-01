import { describe, expect, it } from 'vitest';
import {
  EMPTY_PREFERENCE_STATE,
  PairwisePreferenceRecordSchema,
  applyPairwisePreference,
  preferenceContextHash,
  scoreCandidateForContext,
  type CandidateSignature,
  type PreferenceContext,
} from '../src/preference.js';

const mechanismContext: PreferenceContext = {
  intent: 'mechanism',
  semanticShape: 'causal-chain',
  relationshipShape: ['produces', 'enables', 'transitions-to', 'causes'],
  primaryArtifact: 'mechanism-flow',
  audience: 'game-design-reviewer',
  outputProfile: 'pdf-document',
};

const comparisonContext: PreferenceContext = {
  ...mechanismContext,
  intent: 'comparison',
  semanticShape: 'before-after',
};

const candidateA: CandidateSignature = {
  candidateId: 'candidate-a',
  referenceClusterIds: ['cluster-editorial-flow'],
  topologyFamily: 'single-arc',
  readingPath: 'guided-sequence',
  featureTags: ['quiet-field', 'break-focus'],
};

const candidateB: CandidateSignature = {
  candidateId: 'candidate-b',
  referenceClusterIds: ['cluster-system-map'],
  topologyFamily: 'state-field',
  readingPath: 'center-out',
  featureTags: ['dense-annotation', 'distributed-focus'],
};

function record(winner: 'A' | 'B' | 'tie' | 'reject-both') {
  return PairwisePreferenceRecordSchema.parse({
    schemaVersion: '0.1',
    preferenceId: 'pref-' + winner,
    contextHash: preferenceContextHash(mechanismContext),
    context: mechanismContext,
    candidateA,
    candidateB,
    winner,
    reasons: [],
    createdAt: '2026-08-29T00:00:00.000Z',
  });
}

describe('contextual pairwise preference', () => {
  it('raises the selected candidate only in the matching context', () => {
    const state = applyPairwisePreference(EMPTY_PREFERENCE_STATE, record('A'));
    const aScore = scoreCandidateForContext({ state, context: mechanismContext, candidate: candidateA, baseScore: 10 });
    const bScore = scoreCandidateForContext({ state, context: mechanismContext, candidate: candidateB, baseScore: 10 });
    const unrelatedScore = scoreCandidateForContext({
      state,
      context: comparisonContext,
      candidate: candidateA,
      baseScore: 10,
    });
    expect(aScore).toBeGreaterThan(bScore);
    expect(unrelatedScore).toBe(10.15);
  });

  it('records a tie without changing preference weights', () => {
    const state = applyPairwisePreference(EMPTY_PREFERENCE_STATE, record('tie'));
    expect(state.contextualWeights[preferenceContextHash(mechanismContext)]).toEqual({});
    expect(state.observationCount).toBe(1);
  });

  it('penalizes both candidates when both are rejected', () => {
    const state = applyPairwisePreference(EMPTY_PREFERENCE_STATE, record('reject-both'));
    const aScore = scoreCandidateForContext({ state, context: mechanismContext, candidate: candidateA, baseScore: 10 });
    const bScore = scoreCandidateForContext({ state, context: mechanismContext, candidate: candidateB, baseScore: 10 });
    expect(aScore).toBeLessThan(10);
    expect(bScore).toBeLessThan(10);
  });

  it('can remember which rejected candidate was less bad without treating it as accepted', () => {
    const rejected = record('reject-both');
    rejected.relativePreference = 'A';
    const state = applyPairwisePreference(EMPTY_PREFERENCE_STATE, rejected);
    const aScore = scoreCandidateForContext({ state, context: mechanismContext, candidate: candidateA, baseScore: 10 });
    const bScore = scoreCandidateForContext({ state, context: mechanismContext, candidate: candidateB, baseScore: 10 });
    expect(aScore).toBeGreaterThan(bScore);
    expect(aScore).toBeLessThan(10);
    expect(bScore).toBeLessThan(10);
  });

  it('always retains a positive exploration allowance', () => {
    const score = scoreCandidateForContext({
      state: EMPTY_PREFERENCE_STATE,
      context: mechanismContext,
      candidate: candidateA,
      baseScore: 0,
    });
    expect(score).toBeGreaterThan(0);
  });
});
