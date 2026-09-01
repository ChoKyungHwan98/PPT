import { describe, expect, it } from 'vitest';
import {
  PairwisePreferenceRecordSchema,
  preferenceContextHash,
  type CandidateEvidence,
  type PreferenceContext,
} from '@game-presentation/contracts';
import { buildCandidateComparison } from '../src/comparison.js';
import { resolvePairwiseSelection } from '../src/selection.js';

const context: PreferenceContext = {
  intent: 'mechanism', semanticShape: 'causal-chain', relationshipShape: ['causes'],
  primaryArtifact: 'mechanism-flow', audience: 'reviewer', outputProfile: 'pdf-presentation',
};

function evidence(id: string, family: string, readingPath: 'left-to-right' | 'center-out'): CandidateEvidence {
  return {
    candidateId: id,
    signature: { candidateId: id, referenceClusterIds: ['ref-' + id], topologyFamily: family, readingPath, featureTags: ['tag'] },
    compositionPlanHash: 'a'.repeat(64), renderTreeHash: 'b'.repeat(64), pngHash: 'c'.repeat(64),
    hardGate: 'passed', nonSevereFindingCount: 0,
  };
}

function setup(winner: 'A' | 'B' | 'tie' | 'reject-both') {
  const comparison = buildCandidateComparison({
    slideId: 'slide', sourceContentHash: 'd'.repeat(64), context,
    candidates: [evidence('candidate-a', 'editorial', 'left-to-right'), evidence('candidate-b', 'field', 'center-out')],
    presentationSeed: 0, createdAt: '2026-08-29T00:00:00.000Z',
  });
  if (comparison.mode !== 'pairwise') throw new Error('fixture error');
  const preference = PairwisePreferenceRecordSchema.parse({
    schemaVersion: '0.1', preferenceId: 'preference-' + winner,
    contextHash: preferenceContextHash(context), context,
    candidateA: comparison.slots.A.signature, candidateB: comparison.slots.B.signature,
    winner, reasons: [], createdAt: '2026-08-29T01:00:00.000Z',
  });
  return { comparison, preference };
}

describe('selection resolution', () => {
  it('resolves the selected slot without changing candidate identity', () => {
    const input = setup('B');
    const resolution = resolvePairwiseSelection(input);
    expect(resolution.status).toBe('selected');
    if (resolution.status !== 'selected') throw new Error('fixture error');
    expect(resolution.slot).toBe('B');
    expect(resolution.candidate.candidateId).toBe(input.comparison.slots.B.candidateId);
  });

  it('does not export a winner for tie or reject-both', () => {
    expect(resolvePairwiseSelection(setup('tie')).status).toBe('tie');
    expect(resolvePairwiseSelection(setup('reject-both')).status).toBe('rejected');
  });
});
