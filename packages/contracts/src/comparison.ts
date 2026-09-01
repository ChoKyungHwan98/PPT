import { z } from 'zod';
import { CandidateSignatureSchema, PreferenceContextSchema } from './preference.js';

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const CandidateEvidenceSchema = z.strictObject({
  candidateId: z.string().min(1),
  signature: CandidateSignatureSchema,
  compositionPlanHash: HashSchema,
  renderTreeHash: HashSchema,
  pngHash: HashSchema,
  hardGate: z.literal('passed'),
  nonSevereFindingCount: z.number().int().nonnegative(),
});

export type CandidateEvidence = z.infer<typeof CandidateEvidenceSchema>;

const ComparisonBaseShape = {
  schemaVersion: z.literal('0.1'),
  comparisonId: z.string().min(1),
  slideId: z.string().min(1),
  sourceContentHash: HashSchema,
  contextHash: HashSchema,
  context: PreferenceContextSchema,
  createdAt: z.iso.datetime(),
};

const NoCandidateComparisonSchema = z.strictObject({
  ...ComparisonBaseShape,
  mode: z.literal('none'),
  slots: z.strictObject({}),
  selectionOptions: z.tuple([z.literal('retry')]),
});

const SingleCandidateComparisonSchema = z.strictObject({
  ...ComparisonBaseShape,
  mode: z.literal('single'),
  slots: z.strictObject({ A: CandidateEvidenceSchema }),
  selectionOptions: z.tuple([z.literal('accept'), z.literal('reject')]),
});

const PairwiseCandidateComparisonSchema = z
  .strictObject({
    ...ComparisonBaseShape,
    mode: z.literal('pairwise'),
    slots: z.strictObject({ A: CandidateEvidenceSchema, B: CandidateEvidenceSchema }),
    selectionOptions: z.tuple([
      z.literal('A'),
      z.literal('B'),
      z.literal('tie'),
      z.literal('reject-both'),
    ]),
  })
  .superRefine((comparison, context) => {
    if (comparison.slots.A.candidateId === comparison.slots.B.candidateId) {
      context.addIssue({ code: 'custom', path: ['slots', 'B'], message: '서로 다른 후보만 비교할 수 있습니다.' });
    }
    if (
      comparison.slots.A.signature.topologyFamily === comparison.slots.B.signature.topologyFamily &&
      comparison.slots.A.signature.readingPath === comparison.slots.B.signature.readingPath
    ) {
      context.addIssue({ code: 'custom', path: ['slots'], message: '구조와 읽기 경로가 같은 후보는 A/B로 묶을 수 없습니다.' });
    }
  });

export const CandidateComparisonSchema = z.discriminatedUnion('mode', [
  NoCandidateComparisonSchema,
  SingleCandidateComparisonSchema,
  PairwiseCandidateComparisonSchema,
]);

export type CandidateComparison = z.infer<typeof CandidateComparisonSchema>;
