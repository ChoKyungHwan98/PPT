import type { ReferenceImageAnalysis } from './image-analysis.js';
import { perceptualHashDistance } from './image-analysis.js';

export type AnalyzedReferenceCandidate = {
  referenceId: string;
  provenanceRank: number;
  analysis: ReferenceImageAnalysis;
};

export type DuplicateDecision = {
  keptReferenceId: string;
  removedReferenceId: string;
  reason: 'exact-hash' | 'near-duplicate';
  perceptualDistance: number;
};

export function deduplicateReferences(
  candidates: AnalyzedReferenceCandidate[],
  maximumPerceptualDistance = 5,
): {
  kept: AnalyzedReferenceCandidate[];
  duplicates: DuplicateDecision[];
} {
  const sorted = [...candidates].sort(
    (left, right) =>
      right.provenanceRank - left.provenanceRank ||
      right.analysis.width * right.analysis.height - left.analysis.width * left.analysis.height ||
      left.referenceId.localeCompare(right.referenceId),
  );
  const kept: AnalyzedReferenceCandidate[] = [];
  const duplicates: DuplicateDecision[] = [];
  for (const candidate of sorted) {
    const duplicateOf = kept.find((existing) => {
      if (existing.analysis.sourceSha256 === candidate.analysis.sourceSha256) return true;
      return (
        perceptualHashDistance(
          existing.analysis.perceptualHash,
          candidate.analysis.perceptualHash,
        ) <= maximumPerceptualDistance
      );
    });
    if (duplicateOf === undefined) {
      kept.push(candidate);
      continue;
    }
    const distance = perceptualHashDistance(
      duplicateOf.analysis.perceptualHash,
      candidate.analysis.perceptualHash,
    );
    duplicates.push({
      keptReferenceId: duplicateOf.referenceId,
      removedReferenceId: candidate.referenceId,
      reason:
        duplicateOf.analysis.sourceSha256 === candidate.analysis.sourceSha256
          ? 'exact-hash'
          : 'near-duplicate',
      perceptualDistance: distance,
    });
  }
  return {
    kept: kept.sort((left, right) => left.referenceId.localeCompare(right.referenceId)),
    duplicates: duplicates.sort((left, right) =>
      left.removedReferenceId.localeCompare(right.removedReferenceId),
    ),
  };
}
