import { describe, expect, it } from 'vitest';
import type { TrainingEligibility } from '@game-presentation/local-training';
import { trainingStartDecision } from '../src/training-workflow.js';

const insufficient: TrainingEligibility = {
  smokeTraining: true,
  qualityTraining: false,
  benchmark: false,
  humanLabelCount: 4,
  readyPositiveCount: 0,
  reasons: ['quality training requires more human-labelled examples'],
};

describe('training product guard', () => {
  it('rejects meaningful training when labelled and Ready evidence are insufficient', () => {
    expect(trainingStartDecision({ mode: 'quality', eligibility: insufficient, smokeEnabled: true })).toMatchObject({ allowed: false, mode: 'quality' });
  });

  it('keeps smoke mode separate and requires the developer switch', () => {
    expect(trainingStartDecision({ mode: 'smoke', eligibility: insufficient, smokeEnabled: false })).toMatchObject({ allowed: false, mode: 'smoke' });
    expect(trainingStartDecision({ mode: 'smoke', eligibility: insufficient, smokeEnabled: true })).toEqual({ allowed: true, mode: 'smoke' });
  });
});
