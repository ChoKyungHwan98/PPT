import type { CriticDatasetManifest } from './training-contract.js';
import type { ProductionCriticDatasetManifest } from './production-contract.js';

export type TrainingEligibility = { qualityTraining: boolean; smokeTraining: boolean; benchmark: boolean; humanLabelCount: number; readyPositiveCount: number; rejectCount: number; pairwiseCount: number; trainCount: number; validationCount: number; reasons: string[] };

export function assessTrainingEligibility(manifest: CriticDatasetManifest | ProductionCriticDatasetManifest): TrainingEligibility {
  const production = manifest.purpose === 'visual-critic-production';
  const humanLabelCount = production ? manifest.humanLabelCount : manifest.examples.filter((example) => example.humanLabel).length;
  const readyPositiveCount = production ? manifest.readyPositiveCount : manifest.examples.filter((example) => example.readiness === 'ready').length;
  const rejectCount = production ? manifest.rejectCount : manifest.examples.filter((example) => example.readiness === 'not-ready').length;
  const pairwiseCount = production ? manifest.pairwiseCount : 0;
  const trainCount = manifest.trainIds.length;
  const validationCount = manifest.validationIds.length;
  const reasons: string[] = [];
  if (humanLabelCount < 20) reasons.push('품질 학습에는 사람 평가 20건 이상이 필요합니다.');
  if (readyPositiveCount < 3) reasons.push('품질 기준을 잡을 Ready Positive 3건 이상이 필요합니다.');
  if (validationCount < 2) reasons.push('독립 검증 자료가 2건 이상 필요합니다.');
  return { qualityTraining: production && reasons.length === 0, smokeTraining: !production && humanLabelCount >= 2 && trainCount > 0 && validationCount > 0, benchmark: production && humanLabelCount >= 8 && readyPositiveCount >= 2, humanLabelCount, readyPositiveCount, rejectCount, pairwiseCount, trainCount, validationCount, reasons };
}
