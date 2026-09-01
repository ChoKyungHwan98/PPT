import {
  CandidateComparisonSchema,
  PairwisePreferenceRecordSchema,
  type CandidateEvidence,
  type CandidateComparison,
  type PairwisePreferenceRecord,
} from '@game-presentation/contracts';

export type SelectionResolution =
  | { status: 'selected'; slot: 'A' | 'B'; candidate: CandidateEvidence }
  | { status: 'tie' }
  | { status: 'rejected' };

export function resolvePairwiseSelection(input: {
  comparison: CandidateComparison;
  preference: PairwisePreferenceRecord;
}): SelectionResolution {
  const comparison = CandidateComparisonSchema.parse(input.comparison);
  const preference = PairwisePreferenceRecordSchema.parse(input.preference);
  if (comparison.mode !== 'pairwise') throw new Error('pairwise 비교 결과만 선택할 수 있습니다.');
  if (comparison.contextHash !== preference.contextHash) {
    throw new Error('선택 기록의 작업 맥락이 현재 비교와 다릅니다.');
  }
  if (
    comparison.slots.A.candidateId !== preference.candidateA.candidateId ||
    comparison.slots.B.candidateId !== preference.candidateB.candidateId
  ) {
    throw new Error('선택 기록의 A/B 후보가 현재 비교와 다릅니다.');
  }
  if (preference.winner === 'tie') return { status: 'tie' };
  if (preference.winner === 'reject-both') return { status: 'rejected' };
  return {
    status: 'selected',
    slot: preference.winner,
    candidate: comparison.slots[preference.winner],
  };
}
