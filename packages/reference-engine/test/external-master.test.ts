import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SEED_PATTERN_FRAGMENTS, SEED_REFERENCE_CORPUS } from '@game-presentation/contracts';
import { loadExternalMasterReferenceSet } from '../src/external-master.js';

const referenceDir = fileURLToPath(new URL('../references/external-master-2025-v1/', import.meta.url));

describe('2025 External Master Reference corpus', () => {
  it('preserves six source-verified references without promoting them', async () => {
    const set = await loadExternalMasterReferenceSet(referenceDir);

    expect(set.references).toHaveLength(6);
    expect(set.readyGolden).toBe(false);
    expect(set.references.every((reference) => reference.readyGolden === false)).toBe(true);
    expect(set.references.every((reference) => reference.patternAssessment.promotionStatus === 'candidate-only')).toBe(true);
    expect(set.rights).toEqual({
      status: 'unknown',
      allowedUse: {
        analyze: true,
        deriveAbstractPrinciple: true,
        reuseAsset: false,
        redistributeAsset: false,
      },
    });
    expect(set.stageState).toEqual({
      stage0: 'partial',
      stage6: 'incomplete',
      readyPositiveFixture: 'none',
      stage7: 'not-started',
      criticCalled: false,
    });
  });

  it('keeps source assets reference-only while recording the user-approved abstract V1 Pattern', async () => {
    const set = await loadExternalMasterReferenceSet(referenceDir);
    expect(set.v1Assessment.rankedReferenceGrammars.map((item) => item.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(set.v1Assessment.rankedReferenceGrammars[0]?.referenceId).toBe('ext-2025-pokemon-problem-task-leak');
    expect(set.v1Assessment.recommendedPatternCandidate).toMatchObject({
      name: 'pattern-accumulation-threshold-consequence',
      status: 'implemented-v1-pattern',
    });
    const externalIds = new Set(set.references.map((reference) => reference.referenceId));
    expect(SEED_REFERENCE_CORPUS.some((reference) => externalIds.has(reference.referenceId))).toBe(false);
    const promoted = SEED_PATTERN_FRAGMENTS.find(
      (fragment) => fragment.fragmentId === 'pattern-accumulation-threshold-consequence',
    );
    expect(promoted?.sourceReferenceIds.every((referenceId) => externalIds.has(referenceId))).toBe(true);
    expect(promoted?.phaseContract?.provenance.excludedMeanings).toEqual([
      'hidden omission',
      'diagnosis',
      'before-after comparison',
      'two-alternative comparison',
    ]);
  });
});
