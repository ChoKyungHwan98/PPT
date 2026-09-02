import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { contentHash, ReferenceRecordSchema } from '@game-presentation/contracts';
import type { ExternalMasterReferenceSet } from './external-master.js';

/** Analysis-only index adapter; image pixels and branding never enter the composition. */
export function externalComparisonReferenceRecords(set: ExternalMasterReferenceSet, baseDir: string) {
  return set.references.filter((reference) => reference.grammar === 'Before-After / Feature Spec').map((reference) => {
    const record = {
      schemaVersion: '0.1',
      referenceId: reference.referenceId, title: reference.grammar,
      source: { pageUrl: pathToFileURL(join(baseDir, set.sourceFiles.manifest)).href,
        author: reference.source.origin, discoveredAt: '2026-09-03T00:00:00.000Z' },
      provenance: { status: 'declared', checkedAt: '2026-09-03T00:00:00.000Z' },
      rights: { status: 'unknown' },
      allowedUse: { analyze: true, cacheThumbnail: false, deriveAbstractPattern: true, reuseAsset: false, redistributeAsset: false },
      analysis: { intentTags: ['comparison'], semanticShapes: ['comparison'], relationshipShapes: ['compares-with'],
        primaryArtifacts: ['comparison-field'], densityBand: 'balanced', readingPaths: ['before-after'],
        graphicLanguages: ['aligned-feature-spec'], avoidCopying: reference.surfaceStyleExclusions },
    };
    return ReferenceRecordSchema.parse({ ...record, hashes: { metadataSha256: contentHash(record), sourceSha256: reference.source.sha256 } });
  });
}
