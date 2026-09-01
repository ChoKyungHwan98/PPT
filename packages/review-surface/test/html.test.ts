import { describe, expect, it } from 'vitest';
import { buildCandidateComparison } from '@game-presentation/composition-engine';
import type { CandidateEvidence, PreferenceContext } from '@game-presentation/contracts';
import { buildReviewHtml } from '../src/html.js';

const context: PreferenceContext = {
  intent: 'mechanism', semanticShape: 'causal-chain', relationshipShape: ['causes'],
  primaryArtifact: 'mechanism-flow', audience: 'reviewer', outputProfile: 'pdf-presentation',
};

function evidence(id: string, topologyFamily: string, readingPath: 'left-to-right' | 'center-out'): CandidateEvidence {
  return {
    candidateId: id,
    signature: { candidateId: id, referenceClusterIds: ['reference-' + id], topologyFamily, readingPath, featureTags: ['tag'] },
    compositionPlanHash: 'a'.repeat(64), renderTreeHash: 'b'.repeat(64), pngHash: 'c'.repeat(64),
    hardGate: 'passed', nonSevereFindingCount: 0,
  };
}

describe('minimal review surface', () => {
  it('renders equal blind slots and all four pairwise decisions', () => {
    const comparison = buildCandidateComparison({
      slideId: 'slide', sourceContentHash: 'd'.repeat(64), context,
      candidates: [evidence('private-a', 'editorial', 'left-to-right'), evidence('private-b', 'field', 'center-out')],
      presentationSeed: 0, createdAt: '2026-08-29T00:00:00.000Z',
    });
    const html = buildReviewHtml({
      title: '비교', sourceText: '사용자 원문', comparison,
      candidates: [
        { candidateId: 'private-a', imageDataUrl: 'data:image/png;base64,AA==' },
        { candidateId: 'private-b', imageDataUrl: 'data:image/png;base64,AA==' },
      ],
    });
    expect(html).toContain('A 선택');
    expect(html).toContain('B 선택');
    expect(html).toContain('비슷함');
    expect(html).toContain('둘 다 탈락');
    expect(html).not.toContain('editorial</');
    expect(html).not.toContain('field</');
  });
});
