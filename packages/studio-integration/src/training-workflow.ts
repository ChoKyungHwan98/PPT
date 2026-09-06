import type { TrainingEligibility } from '@game-presentation/local-training';

export type TrainingMode = 'quality' | 'smoke';

export function trainingStartDecision(input: {
  mode: TrainingMode;
  eligibility: TrainingEligibility;
  smokeEnabled: boolean;
}): { allowed: true; mode: TrainingMode } | { allowed: false; mode: TrainingMode; reason: string } {
  if (input.mode === 'quality') {
    return input.eligibility.qualityTraining
      ? { allowed: true, mode: input.mode }
      : { allowed: false, mode: input.mode, reason: '현재 데이터로는 품질 학습을 시작할 수 없습니다.' };
  }
  return input.eligibility.smokeTraining && input.smokeEnabled
    ? { allowed: true, mode: input.mode }
    : { allowed: false, mode: input.mode, reason: '개발자 smoke 실행이 허용되지 않았습니다.' };
}
