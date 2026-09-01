import { z } from 'zod';
import { contentHash } from './hash.js';
import type { SlideIR } from './slide-ir.js';

export const DensityBandSchema = z.enum(['sparse', 'balanced', 'dense']);
export const ReadingPathSchema = z.enum([
  'left-to-right',
  'top-to-bottom',
  'center-out',
  'radial',
  'before-after',
  'guided-sequence',
]);

export const ReferenceRecordSchema = z
  .strictObject({
    schemaVersion: z.literal('0.1'),
    referenceId: z.string().min(1),
    title: z.string().min(1),
    source: z.strictObject({
      pageUrl: z.url(),
      assetUrl: z.url().optional(),
      author: z.string().min(1).optional(),
      discoveredAt: z.iso.datetime(),
      inspectedRevision: z.string().min(1).optional(),
    }),
    provenance: z.strictObject({
      status: z.enum(['verified', 'declared', 'unknown']),
      evidenceUrl: z.url().optional(),
      checkedAt: z.iso.datetime(),
    }),
    rights: z.strictObject({
      status: z.enum(['known-license', 'public-domain', 'user-owned', 'unknown']),
      licenseId: z.string().min(1).optional(),
      licenseUrl: z.url().optional(),
    }),
    allowedUse: z.strictObject({
      analyze: z.boolean(),
      cacheThumbnail: z.boolean(),
      deriveAbstractPattern: z.boolean(),
      reuseAsset: z.boolean(),
      redistributeAsset: z.boolean(),
    }),
    hashes: z.strictObject({
      metadataSha256: z.string().regex(/^[a-f0-9]{64}$/),
      sourceSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
      perceptualHash: z.string().min(8).optional(),
    }),
    analysis: z.strictObject({
      intentTags: z.array(z.string().min(1)).min(1),
      semanticShapes: z.array(z.string().min(1)).min(1),
      relationshipShapes: z.array(z.string().min(1)),
      primaryArtifacts: z.array(z.string().min(1)).min(1),
      densityBand: DensityBandSchema,
      readingPaths: z.array(ReadingPathSchema).min(1),
      graphicLanguages: z.array(z.string().min(1)).min(1),
      avoidCopying: z.array(z.string().min(1)),
    }),
  })
  .superRefine((record, context) => {
    if (record.rights.status === 'unknown') {
      if (record.allowedUse.reuseAsset || record.allowedUse.redistributeAsset) {
        context.addIssue({
          code: 'custom',
          path: ['allowedUse'],
          message: '권리가 확인되지 않은 자료의 원본 재사용·재배포는 금지됩니다.',
        });
      }
    }
    if (record.allowedUse.redistributeAsset && !record.allowedUse.reuseAsset) {
      context.addIssue({
        code: 'custom',
        path: ['allowedUse', 'redistributeAsset'],
        message: '재사용이 금지된 자료는 재배포할 수 없습니다.',
      });
    }
    if (record.rights.status === 'known-license' && record.rights.licenseId === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['rights', 'licenseId'],
        message: '확인된 라이선스 식별자가 필요합니다.',
      });
    }
  });

export type ReferenceRecord = z.infer<typeof ReferenceRecordSchema>;

export const ReferenceRetrievalBriefSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  briefId: z.string().min(1),
  slideId: z.string().min(1),
  sourceContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  corpusSnapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  intent: z.string().min(1),
  semanticShape: z.string().min(1),
  relationshipShape: z.array(z.string().min(1)),
  primaryArtifact: z.string().min(1),
  densityBand: DensityBandSchema,
  readingPathCandidates: z.array(ReadingPathSchema).min(1),
  audience: z.string().min(1),
  outputProfile: z.enum(['pdf-document', 'pdf-presentation', 'html-presentation']),
  avoidSignatures: z.array(z.string().min(1)),
});

export type ReferenceRetrievalBrief = z.infer<typeof ReferenceRetrievalBriefSchema>;

export const PatternFragmentSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  fragmentId: z.string().min(1),
  sourceReferenceIds: z.array(z.string().min(1)).min(1),
  abstractionLevel: z.literal('structural'),
  compatibleIntents: z.array(z.string().min(1)).min(1),
  semanticShape: z.string().min(1),
  relationshipShape: z.array(z.string().min(1)),
  readingPath: ReadingPathSchema,
  densityBand: DensityBandSchema,
  primaryArtifactRole: z.string().min(1),
  topology: z.strictObject({
    family: z.string().min(1),
    orderedRoles: z.array(z.string().min(1)).min(1),
    emphasisRule: z.string().min(1),
    groupingRule: z.string().min(1),
  }),
  constraints: z.array(z.string().min(1)),
  prohibitedCopy: z.array(z.string().min(1)).min(1),
});

export type PatternFragment = z.infer<typeof PatternFragmentSchema>;

export function corpusSnapshotHash(records: ReferenceRecord[]): string {
  return contentHash(
    [...records]
      .sort((left, right) => left.referenceId.localeCompare(right.referenceId))
      .map((record) => ({
        referenceId: record.referenceId,
        metadataSha256: record.hashes.metadataSha256,
        sourceSha256: record.hashes.sourceSha256,
        provenance: record.provenance.status,
        rights: record.rights.status,
        allowedUse: record.allowedUse,
      })),
  );
}

export function buildReferenceRetrievalBrief(input: {
  slide: SlideIR;
  corpus: ReferenceRecord[];
  semanticShape: string;
  primaryArtifact: string;
  densityBand: z.infer<typeof DensityBandSchema>;
  readingPathCandidates: z.infer<typeof ReadingPathSchema>[];
  audience: string;
  outputProfile: z.infer<typeof ReferenceRetrievalBriefSchema>['outputProfile'];
  avoidSignatures?: string[];
}): ReferenceRetrievalBrief {
  const relationshipShape = [...new Set(input.slide.relations.map((relation) => relation.type))];
  const snapshotHash = corpusSnapshotHash(input.corpus);
  const stableFields = {
    slideId: input.slide.slideId,
    sourceContentHash: input.slide.source.contentHash,
    corpusSnapshotHash: snapshotHash,
    intent: input.slide.intent.kind,
    semanticShape: input.semanticShape,
    relationshipShape,
    primaryArtifact: input.primaryArtifact,
    densityBand: input.densityBand,
    readingPathCandidates: input.readingPathCandidates,
    audience: input.audience,
    outputProfile: input.outputProfile,
    avoidSignatures: input.avoidSignatures ?? [],
  };

  return ReferenceRetrievalBriefSchema.parse({
    schemaVersion: '0.1',
    briefId: 'brief-' + contentHash(stableFields).slice(0, 16),
    ...stableFields,
  });
}

export type RankedReference = {
  referenceId: string;
  score: number;
  matched: string[];
};

export function retrieveReferences(
  brief: ReferenceRetrievalBrief,
  corpus: ReferenceRecord[],
): RankedReference[] {
  return corpus
    .filter((record) => record.allowedUse.analyze && record.allowedUse.deriveAbstractPattern)
    .map((record) => {
      const matched: string[] = [];
      let score = 0;
      if (record.analysis.intentTags.includes(brief.intent)) {
        score += 5;
        matched.push('intent');
      }
      if (record.analysis.semanticShapes.includes(brief.semanticShape)) {
        score += 5;
        matched.push('semantic-shape');
      }
      const relationMatches = brief.relationshipShape.filter((shape) =>
        record.analysis.relationshipShapes.includes(shape),
      ).length;
      score += relationMatches * 2;
      if (relationMatches > 0) matched.push('relationship-shape');
      if (record.analysis.primaryArtifacts.includes(brief.primaryArtifact)) {
        score += 3;
        matched.push('primary-artifact');
      }
      if (record.analysis.densityBand === brief.densityBand) {
        score += 1;
        matched.push('density');
      }
      if (record.analysis.readingPaths.some((path) => brief.readingPathCandidates.includes(path))) {
        score += 1;
        matched.push('reading-path');
      }
      if (record.analysis.graphicLanguages.some((signature) => brief.avoidSignatures.includes(signature))) {
        score -= 10;
        matched.push('avoid-penalty');
      }
      return { referenceId: record.referenceId, score, matched };
    })
    .filter((ranked) => ranked.score > 0)
    .sort((left, right) => right.score - left.score || left.referenceId.localeCompare(right.referenceId));
}
