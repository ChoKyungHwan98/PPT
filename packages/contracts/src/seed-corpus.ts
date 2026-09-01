import { contentHash } from './hash.js';
import { ReferenceRecordSchema, type ReferenceRecord } from './reference.js';

const checkedAt = '2026-08-29T00:00:00.000Z';

function record(input: Omit<ReferenceRecord, 'schemaVersion' | 'hashes'>): ReferenceRecord {
  const metadata = {
    referenceId: input.referenceId,
    title: input.title,
    source: input.source,
    provenance: input.provenance,
    rights: input.rights,
    allowedUse: input.allowedUse,
    analysis: input.analysis,
  };
  return ReferenceRecordSchema.parse({
    schemaVersion: '0.1',
    ...metadata,
    hashes: { metadataSha256: contentHash(metadata) },
  });
}

const analysisOnly = {
  analyze: true,
  cacheThumbnail: false,
  deriveAbstractPattern: true,
  reuseAsset: false,
  redistributeAsset: false,
} as const;

export const SEED_REFERENCE_CORPUS: ReferenceRecord[] = [
  record({
    referenceId: 'ref-oh-my-ppt-layout',
    title: 'Oh My PPT layout reasoning',
    source: {
      pageUrl: 'https://github.com/arcsin1/oh-my-ppt',
      author: 'arcsin1',
      discoveredAt: checkedAt,
      inspectedRevision: '73b9720',
    },
    provenance: {
      status: 'verified',
      evidenceUrl: 'https://github.com/arcsin1/oh-my-ppt',
      checkedAt,
    },
    rights: {
      status: 'known-license',
      licenseId: 'Apache-2.0',
      licenseUrl: 'https://github.com/arcsin1/oh-my-ppt/blob/main/LICENSE',
    },
    allowedUse: analysisOnly,
    analysis: {
      intentTags: ['mechanism', 'comparison', 'timeline'],
      semanticShapes: ['causal-chain', 'process-chain'],
      relationshipShapes: ['sequence', 'causes', 'enables', 'produces', 'transitions-to'],
      primaryArtifacts: ['mechanism-flow', 'timeline'],
      densityBand: 'balanced',
      readingPaths: ['left-to-right', 'guided-sequence'],
      graphicLanguages: ['content-shaped-layout'],
      avoidCopying: ['source HTML', 'source wording', 'identifying graphic assets'],
    },
  }),
  record({
    referenceId: 'ref-ppt-agent-functional',
    title: 'PPTAgent functional slide retrieval',
    source: {
      pageUrl: 'https://github.com/icip-cas/PPTAgent',
      author: 'icip-cas',
      discoveredAt: checkedAt,
    },
    provenance: {
      status: 'verified',
      evidenceUrl: 'https://github.com/icip-cas/PPTAgent',
      checkedAt,
    },
    rights: {
      status: 'known-license',
      licenseId: 'MIT',
      licenseUrl: 'https://github.com/icip-cas/PPTAgent/blob/main/LICENSE',
    },
    allowedUse: analysisOnly,
    analysis: {
      intentTags: ['mechanism', 'comparison', 'state-transition'],
      semanticShapes: ['causal-chain', 'state-machine'],
      relationshipShapes: ['causes', 'enables', 'transitions-to'],
      primaryArtifacts: ['mechanism-flow', 'state-map'],
      densityBand: 'dense',
      readingPaths: ['guided-sequence', 'center-out'],
      graphicLanguages: ['functional-reference-retrieval'],
      avoidCopying: ['reference slide text', 'reference slide artwork', 'reference deck identity'],
    },
  }),
  record({
    referenceId: 'ref-marp-reproducible',
    title: 'Marp reproducible page rendering',
    source: {
      pageUrl: 'https://github.com/marp-team/marp',
      author: 'Marp team',
      discoveredAt: checkedAt,
      inspectedRevision: 'aaac234',
    },
    provenance: {
      status: 'verified',
      evidenceUrl: 'https://github.com/marp-team/marp',
      checkedAt,
    },
    rights: {
      status: 'known-license',
      licenseId: 'MIT',
      licenseUrl: 'https://github.com/marp-team/marp/blob/main/LICENSE',
    },
    allowedUse: analysisOnly,
    analysis: {
      intentTags: ['mechanism', 'table-summary', 'data-highlight'],
      semanticShapes: ['causal-chain', 'single-message'],
      relationshipShapes: ['sequence', 'causes'],
      primaryArtifacts: ['mechanism-flow', 'annotated-text'],
      densityBand: 'sparse',
      readingPaths: ['top-to-bottom', 'left-to-right'],
      graphicLanguages: ['source-first-restraint'],
      avoidCopying: ['theme CSS', 'sample deck content', 'project branding'],
    },
  }),
  record({
    referenceId: 'ref-reveal-runtime',
    title: 'reveal.js browser presentation runtime',
    source: {
      pageUrl: 'https://github.com/hakimel/reveal.js',
      author: 'Hakim El Hattab and contributors',
      discoveredAt: checkedAt,
      inspectedRevision: '807b430',
    },
    provenance: {
      status: 'verified',
      evidenceUrl: 'https://github.com/hakimel/reveal.js',
      checkedAt,
    },
    rights: {
      status: 'known-license',
      licenseId: 'MIT',
      licenseUrl: 'https://github.com/hakimel/reveal.js/blob/master/LICENSE',
    },
    allowedUse: analysisOnly,
    analysis: {
      intentTags: ['mechanism', 'timeline', 'state-transition'],
      semanticShapes: ['causal-chain', 'process-chain'],
      relationshipShapes: ['sequence', 'transitions-to'],
      primaryArtifacts: ['mechanism-flow', 'progressive-reveal'],
      densityBand: 'balanced',
      readingPaths: ['guided-sequence', 'center-out'],
      graphicLanguages: ['stage-first-presentation'],
      avoidCopying: ['theme CSS', 'demo slide content', 'project branding'],
    },
  }),
];
