import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { contentHash, ReferenceRecordSchema } from '@game-presentation/contracts';
import type { ExternalMasterReferenceSet } from './external-master.js';

/** Organization Teacher의 추상 구조만 local reference retrieval에 연결한다. */
export function externalOrganizationReferenceRecords(set: ExternalMasterReferenceSet, baseDir: string) {
  return set.references
    .filter((reference) => reference.grammar === 'Organization / Structure')
    .map((reference) => {
      const record = {
        schemaVersion: '0.1',
        referenceId: reference.referenceId,
        title: reference.grammar,
        source: {
          pageUrl: pathToFileURL(join(baseDir, set.sourceFiles.manifest)).href,
          author: reference.source.origin,
          discoveredAt: '2026-09-04T00:00:00.000Z',
        },
        provenance: { status: 'declared', checkedAt: '2026-09-04T00:00:00.000Z' },
        rights: { status: 'unknown' },
        allowedUse: {
          analyze: true,
          cacheThumbnail: false,
          deriveAbstractPattern: true,
          reuseAsset: false,
          redistributeAsset: false,
        },
        analysis: {
          intentTags: ['hierarchy'],
          semanticShapes: ['hierarchy'],
          relationshipShapes: ['part-of'],
          primaryArtifacts: ['hierarchy-map'],
          densityBand: 'dense',
          readingPaths: ['top-to-bottom'],
          graphicLanguages: ['explanation-and-hierarchy-map'],
          avoidCopying: reference.surfaceStyleExclusions,
        },
      } as const;
      return ReferenceRecordSchema.parse({
        ...record,
        hashes: {
          metadataSha256: contentHash(record),
          sourceSha256: reference.source.sha256,
        },
      });
    });
}
