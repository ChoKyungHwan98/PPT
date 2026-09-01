import { describe, expect, it } from 'vitest';
import { SEED_REFERENCE_CORPUS } from '@game-presentation/contracts';
import {
  MAX_REFERENCE_RETRIEVAL_RESULTS,
  retrieveReferencesForInformationPlan,
} from '../src/index.js';
import { createMec01InformationPlan, interpretMec01Source } from '../../source-ingestion/src/mec-01-semantic.js';

const rawText = '회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%';

function input() {
  const slide = interpretMec01Source({ rawText, createdAt: '2026-08-29T00:00:00.000Z' });
  return {
    slide,
    informationPlan: createMec01InformationPlan(slide),
    corpus: SEED_REFERENCE_CORPUS,
    audience: 'game-design-reviewer',
    outputProfile: 'pdf-presentation' as const,
    avoidSignatures: ['card-dashboard'],
    limit: 3,
  };
}

describe('InformationPlan reference retrieval', () => {
  it('retrieves deterministic, bounded references from generic SlideIR and InformationPlan', () => {
    const first = retrieveReferencesForInformationPlan(input());
    const second = retrieveReferencesForInformationPlan(input());

    expect(second).toEqual(first);
    expect(first.brief.semanticShape).toBe('causal-chain');
    expect(first.brief.primaryArtifact).toBe('mechanism-flow');
    expect(first.brief.densityBand).toBe('balanced');
    expect(first.results).toHaveLength(3);
    expect(first.results[0]?.referenceId).toBe('ref-oh-my-ppt-layout');
  });

  it('does not use SlideIR legacy output preferences to choose the retrieval output profile', () => {
    const request = input();
    request.slide.pagePreference = { mode: 'document', preferredProfile: 'a4-portrait' };
    const result = retrieveReferencesForInformationPlan(request);

    expect(result.brief.outputProfile).toBe('pdf-presentation');
  });

  it('fails closed for invalid information structure and an unbounded retrieval request', () => {
    const invalidPlanRequest = input();
    invalidPlanRequest.informationPlan.relationIds = invalidPlanRequest.informationPlan.relationIds.slice(0, -1);
    expect(() => retrieveReferencesForInformationPlan(invalidPlanRequest)).toThrow(/InformationPlan/);

    const excessiveRequest = input();
    excessiveRequest.limit = MAX_REFERENCE_RETRIEVAL_RESULTS + 1;
    expect(() => retrieveReferencesForInformationPlan(excessiveRequest)).toThrow(/1~5/);
  });
});
