import { describe, expect, it } from 'vitest';
import { type CandidateEvidence, type PreferenceContext } from '@game-presentation/contracts';
import { buildCandidateComparison } from '../src/comparison.js';

const context: PreferenceContext = {
  intent: 'mechanism',
  semanticShape: 'causal-chain',
  relationshipShape: ['produces', 'enables', 'transitions-to', 'causes'],
  primaryArtifact: 'mechanism-flow',
  audience: 'game-design-reviewer',
  outputProfile: 'pdf-presentation',
};

function evidence(id: string, topologyFamily: string, readingPath: 'left-to-right' | 'center-out'): CandidateEvidence {
  return {
    candidateId: id,
    signature: {
      candidateId: id,
      referenceClusterIds: ['cluster-' + id],
      topologyFamily,
      readingPath,
      featureTags: ['fixture'],
    },
    compositionPlanHash: 'a'.repeat(64),
    renderTreeHash: 'b'.repeat(64),
    pngHash: 'c'.repeat(64),
    hardGate: 'passed',
    nonSevereFindingCount: 0,
  };
}

describe('candidate comparison package', () => {
  it('exposes tie and reject-both only for two independently valid candidates', () => {
    const comparison = buildCandidateComparison({
      slideId: 'slide-1',
      sourceContentHash: 'd'.repeat(64),
      context,
      candidates: [
        evidence('candidate-a', 'editorial-spine', 'left-to-right'),
        evidence('candidate-b', 'threshold-field', 'center-out'),
      ],
      presentationSeed: 2,
      createdAt: '2026-08-29T02:00:00.000Z',
    });
    expect(comparison.mode).toBe('pairwise');
    if (comparison.mode !== 'pairwise') throw new Error('fixture error');
    expect(comparison.selectionOptions).toEqual(['A', 'B', 'tie', 'reject-both']);
  });

  it('returns a single-candidate decision instead of filling the second slot', () => {
    const comparison = buildCandidateComparison({
      slideId: 'slide-1',
      sourceContentHash: 'd'.repeat(64),
      context,
      candidates: [evidence('candidate-a', 'editorial-spine', 'left-to-right')],
      presentationSeed: 2,
      createdAt: '2026-08-29T02:00:00.000Z',
    });
    expect(comparison.mode).toBe('single');
    expect(comparison.selectionOptions).toEqual(['accept', 'reject']);
  });

  it('can reverse presentation order without changing candidate identities', () => {
    const candidates = [
      evidence('candidate-a', 'editorial-spine', 'left-to-right'),
      evidence('candidate-b', 'threshold-field', 'center-out'),
    ];
    const even = buildCandidateComparison({
      slideId: 'slide-1', sourceContentHash: 'd'.repeat(64), context, candidates,
      presentationSeed: 2, createdAt: '2026-08-29T02:00:00.000Z',
    });
    const odd = buildCandidateComparison({
      slideId: 'slide-1', sourceContentHash: 'd'.repeat(64), context, candidates,
      presentationSeed: 3, createdAt: '2026-08-29T02:00:00.000Z',
    });
    if (even.mode !== 'pairwise' || odd.mode !== 'pairwise') throw new Error('fixture error');
    expect(even.slots.A.candidateId).toBe('candidate-a');
    expect(odd.slots.A.candidateId).toBe('candidate-b');
  });
});
