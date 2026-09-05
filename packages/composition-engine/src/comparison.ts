import {
  CandidateComparisonSchema,
  CandidateEvidenceSchema,
  contentHash,
  preferenceContextHash,
  type CandidateComparison,
  type CandidateEvidence,
  type PreferenceContext,
} from '@game-presentation/contracts';

export function buildCandidateComparison(input: {
  slideId: string;
  sourceContentHash: string;
  context: PreferenceContext;
  candidates: CandidateEvidence[];
  presentationSeed: number;
  createdAt: string;
}): CandidateComparison {
  if (input.candidates.length > 3) {
    throw new Error('통과 후보는 최대 3개만 비교합니다.');
  }
  const candidates = input.candidates.map((candidate) => CandidateEvidenceSchema.parse(candidate));
  if (candidates.length === 2 && input.presentationSeed % 2 !== 0) candidates.reverse();
  const contextHash = preferenceContextHash(input.context);
  const comparisonId = 'comparison-' + contentHash({
    slideId: input.slideId,
    sourceContentHash: input.sourceContentHash,
    contextHash,
    candidateIds: candidates.map((candidate) => candidate.candidateId),
    presentationSeed: input.presentationSeed,
  }).slice(0, 16);
  const base = {
    schemaVersion: '0.1' as const,
    comparisonId,
    slideId: input.slideId,
    sourceContentHash: input.sourceContentHash,
    contextHash,
    context: input.context,
    createdAt: input.createdAt,
  };
  if (candidates.length === 0) {
    return CandidateComparisonSchema.parse({
      ...base,
      mode: 'none',
      slots: {},
      selectionOptions: ['retry'],
    });
  }
  if (candidates.length === 1) {
    return CandidateComparisonSchema.parse({
      ...base,
      mode: 'single',
      slots: { A: candidates[0] },
      selectionOptions: ['accept', 'reject'],
    });
  }
  if (candidates.length === 3) {
    return CandidateComparisonSchema.parse({
      ...base,
      mode: 'triple',
      slots: { A: candidates[0], B: candidates[1], C: candidates[2] },
      selectionOptions: ['A', 'B', 'C', 'reject-all'],
    });
  }
  return CandidateComparisonSchema.parse({
    ...base,
    mode: 'pairwise',
    slots: { A: candidates[0], B: candidates[1] },
    selectionOptions: ['A', 'B', 'tie', 'reject-both'],
  });
}
