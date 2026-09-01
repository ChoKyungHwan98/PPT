import { describe, expect, it } from 'vitest';
import {
  SEED_REFERENCE_CORPUS,
  buildReferenceRetrievalBrief,
} from '@game-presentation/contracts';
import { MEC_01_SLIDE_IR } from '../../contracts/fixtures/mec-01.js';
import { buildReferenceIndex, searchReferenceIndex } from '../src/index.js';

describe('local reference index', () => {
  it('retrieves by mechanism shape instead of palette alone', () => {
    const brief = buildReferenceRetrievalBrief({
      slide: MEC_01_SLIDE_IR,
      corpus: SEED_REFERENCE_CORPUS,
      semanticShape: 'causal-chain',
      primaryArtifact: 'mechanism-flow',
      densityBand: 'balanced',
      readingPathCandidates: ['guided-sequence', 'left-to-right'],
      audience: 'game-design-reviewer',
      outputProfile: 'pdf-document',
      avoidSignatures: ['card-dashboard'],
    });
    const index = buildReferenceIndex(SEED_REFERENCE_CORPUS);
    const results = searchReferenceIndex({
      brief,
      corpus: SEED_REFERENCE_CORPUS,
      index,
      limit: 3,
    });
    expect(results[0]?.referenceId).toBe('ref-oh-my-ppt-layout');
    expect(results.every((result) => result.matched.includes('intent'))).toBe(true);
  });

  it('fails when the brief and index use different corpus snapshots', () => {
    const brief = buildReferenceRetrievalBrief({
      slide: MEC_01_SLIDE_IR,
      corpus: SEED_REFERENCE_CORPUS,
      semanticShape: 'causal-chain',
      primaryArtifact: 'mechanism-flow',
      densityBand: 'balanced',
      readingPathCandidates: ['guided-sequence'],
      audience: 'game-design-reviewer',
      outputProfile: 'pdf-document',
    });
    const index = { ...buildReferenceIndex(SEED_REFERENCE_CORPUS), corpusSnapshotHash: '0'.repeat(64) };
    expect(() =>
      searchReferenceIndex({ brief, corpus: SEED_REFERENCE_CORPUS, index, limit: 3 }),
    ).toThrow(/snapshot/);
  });
});
