import { z } from 'zod';
import { contentHash } from './hash.js';
import { ReadingPathSchema } from './reference.js';

export const PreferenceContextSchema = z.strictObject({
  intent: z.string().min(1),
  semanticShape: z.string().min(1),
  relationshipShape: z.array(z.string().min(1)),
  primaryArtifact: z.string().min(1),
  audience: z.string().min(1),
  outputProfile: z.enum(['pdf-document', 'pdf-presentation', 'html-presentation']),
});

export type PreferenceContext = z.infer<typeof PreferenceContextSchema>;

export const CandidateSignatureSchema = z.strictObject({
  candidateId: z.string().min(1),
  referenceClusterIds: z.array(z.string().min(1)).min(1),
  topologyFamily: z.string().min(1),
  readingPath: ReadingPathSchema,
  featureTags: z.array(z.string().min(1)).min(1),
});

export type CandidateSignature = z.infer<typeof CandidateSignatureSchema>;

export const PairwisePreferenceRecordSchema = z
  .strictObject({
    schemaVersion: z.literal('0.1'),
    preferenceId: z.string().min(1),
    contextHash: z.string().regex(/^[a-f0-9]{64}$/),
    context: PreferenceContextSchema,
    candidateA: CandidateSignatureSchema,
    candidateB: CandidateSignatureSchema,
    winner: z.enum(['A', 'B', 'tie', 'reject-both']),
    relativePreference: z.enum(['A', 'B', 'none']).optional(),
    reasons: z.array(z.string().min(1)),
    createdAt: z.iso.datetime(),
  })
  .superRefine((record, context) => {
    if (preferenceContextHash(record.context) !== record.contextHash) {
      context.addIssue({ code: 'custom', path: ['contextHash'], message: '선택 기록의 작업 맥락이 일치하지 않습니다.' });
    }
    if (record.candidateA.candidateId === record.candidateB.candidateId) {
      context.addIssue({ code: 'custom', path: ['candidateB'], message: '서로 다른 후보를 비교해야 합니다.' });
    }
    if (
      (record.winner === 'A' || record.winner === 'B') &&
      record.relativePreference !== undefined &&
      record.relativePreference !== record.winner
    ) {
      context.addIssue({
        code: 'custom',
        path: ['relativePreference'],
        message: '선택 후보와 상대적으로 더 나은 후보가 다를 수 없습니다.',
      });
    }
    if (record.winner === 'tie' && record.relativePreference !== undefined && record.relativePreference !== 'none') {
      context.addIssue({
        code: 'custom',
        path: ['relativePreference'],
        message: '동점 기록에는 상대 우위를 함께 기록할 수 없습니다.',
      });
    }
  });

export type PairwisePreferenceRecord = z.infer<typeof PairwisePreferenceRecordSchema>;

export type PreferenceState = {
  schemaVersion: '0.1';
  contextualWeights: Record<string, Record<string, number>>;
  contextualExposure: Record<string, Record<string, number>>;
  observationCount: number;
};

export const PreferenceStateSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  contextualWeights: z.record(z.string(), z.record(z.string(), z.number().finite())),
  contextualExposure: z.record(z.string(), z.record(z.string(), z.number().nonnegative())),
  observationCount: z.number().int().nonnegative(),
});

export const EMPTY_PREFERENCE_STATE: PreferenceState = PreferenceStateSchema.parse({
  schemaVersion: '0.1',
  contextualWeights: {},
  contextualExposure: {},
  observationCount: 0,
});

export function preferenceContextHash(context: PreferenceContext): string {
  return contentHash(PreferenceContextSchema.parse(context));
}

function signatureFeatures(signature: CandidateSignature): string[] {
  return [
    'topology:' + signature.topologyFamily,
    'reading-path:' + signature.readingPath,
    ...signature.referenceClusterIds.map((id) => 'reference-cluster:' + id),
    ...signature.featureTags.map((tag) => 'feature:' + tag),
  ];
}

function bump(target: Record<string, number>, keys: string[], amount: number): void {
  for (const key of keys) {
    target[key] = Math.round(((target[key] ?? 0) + amount) * 1000) / 1000;
  }
}

export function applyPairwisePreference(
  current: PreferenceState,
  rawRecord: PairwisePreferenceRecord,
): PreferenceState {
  const record = PairwisePreferenceRecordSchema.parse(rawRecord);
  const contextWeights = { ...(current.contextualWeights[record.contextHash] ?? {}) };
  const contextExposure = { ...(current.contextualExposure[record.contextHash] ?? {}) };
  const aFeatures = signatureFeatures(record.candidateA);
  const bFeatures = signatureFeatures(record.candidateB);

  bump(contextExposure, aFeatures, 1);
  bump(contextExposure, bFeatures, 1);

  if (record.winner === 'A') {
    bump(contextWeights, aFeatures, 1);
    bump(contextWeights, bFeatures, -0.25);
  } else if (record.winner === 'B') {
    bump(contextWeights, bFeatures, 1);
    bump(contextWeights, aFeatures, -0.25);
  } else if (record.winner === 'reject-both') {
    bump(contextWeights, aFeatures, -1);
    bump(contextWeights, bFeatures, -1);
    if (record.relativePreference === 'A') bump(contextWeights, aFeatures, 0.35);
    if (record.relativePreference === 'B') bump(contextWeights, bFeatures, 0.35);
  }

  return {
    schemaVersion: '0.1',
    contextualWeights: {
      ...current.contextualWeights,
      [record.contextHash]: contextWeights,
    },
    contextualExposure: {
      ...current.contextualExposure,
      [record.contextHash]: contextExposure,
    },
    observationCount: current.observationCount + 1,
  };
}

export function scoreCandidateForContext(input: {
  state: PreferenceState;
  context: PreferenceContext;
  candidate: CandidateSignature;
  baseScore: number;
  explorationAllowance?: number;
}): number {
  const hash = preferenceContextHash(input.context);
  const weights = input.state.contextualWeights[hash] ?? {};
  const exposure = input.state.contextualExposure[hash] ?? {};
  const features = signatureFeatures(input.candidate);
  const preferenceScore = features.reduce((sum, feature) => sum + (weights[feature] ?? 0), 0);
  const averageExposure =
    features.reduce((sum, feature) => sum + (exposure[feature] ?? 0), 0) / Math.max(features.length, 1);
  const explorationAllowance = input.explorationAllowance ?? 0.15;
  const explorationBonus = explorationAllowance / (1 + averageExposure);
  return Math.round((input.baseScore + preferenceScore + explorationBonus) * 1000) / 1000;
}
