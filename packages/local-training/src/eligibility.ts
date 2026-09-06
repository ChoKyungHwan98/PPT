import type { CriticDatasetManifest } from './training-contract.js';

export type TrainingEligibility = { qualityTraining: boolean; smokeTraining: boolean; benchmark: boolean; humanLabelCount: number; readyPositiveCount: number; reasons: string[] };

export function assessTrainingEligibility(manifest: CriticDatasetManifest): TrainingEligibility {
  const humanLabelCount = manifest.examples.filter((example) => example.humanLabel).length;
  const readyPositiveCount = manifest.examples.filter((example) => example.readiness === 'ready').length;
  const reasons: string[] = [];
  if (humanLabelCount < 20) reasons.push('품질 학습에는 사람 평가 20건 이상이 필요합니다.');
  if (readyPositiveCount < 3) reasons.push('품질 기준을 잡을 Ready Positive 3건 이상이 필요합니다.');
  if (manifest.validationIds.length < 2) reasons.push('독립 검증 자료가 2건 이상 필요합니다.');
  return { qualityTraining: reasons.length === 0, smokeTraining: humanLabelCount >= 2 && manifest.trainIds.length > 0 && manifest.validationIds.length > 0, benchmark: humanLabelCount >= 8 && readyPositiveCount >= 2, humanLabelCount, readyPositiveCount, reasons };
}
