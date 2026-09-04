import { z } from 'zod';
import { DensityBandSchema, ReferenceRightsStatusSchema } from './reference.js';

/**
 * Master Teacher Corpus V1 controlled vocabulary.
 * Descriptions may be localized, but these enum values are stable contracts.
 */
export const TeacherStatusSchema = z.enum(['seed-evidence', 'curated-teacher', 'retired']);
export const TeacherSemanticShapeSchema = z.enum([
  'process-diagnosis',
  'artifact-annotation',
  'hierarchy',
  'tradeoff',
  'aligned-before-after-spec',
  'layered-countermeasure',
]);
export const TeacherDominantAxisSchema = z.enum([
  'horizontal',
  'vertical',
  'radial',
  'diagonal',
  'mixed',
  'none',
]);
export const TeacherRelationDirectionSchema = z.enum(['directed', 'undirected', 'bidirectional']);
export const TeacherRelationScopeSchema = z.enum(['local', 'group', 'page']);
export const TeacherCurationReviewerSchema = z.enum(['human', 'human-assisted']);
export const TeacherCurationConfidenceSchema = z.enum(['unassessed', 'low', 'medium', 'high']);

// Reuse the existing controlled vocabularies instead of declaring duplicate enums.
export const TeacherDensitySchema = DensityBandSchema;
export const TeacherRightsStatusSchema = ReferenceRightsStatusSchema;

const TeacherRightsSchema = z.strictObject({
  status: TeacherRightsStatusSchema,
  licenseId: z.string().min(1).optional(),
  licenseUrl: z.url().optional(),
  analyzeAllowed: z.boolean(),
  deriveAbstractPrincipleAllowed: z.boolean(),
  reuseAssetAllowed: z.boolean(),
  redistributeAssetAllowed: z.boolean(),
});

const TeacherCompatibilitySchema = z.strictObject({
  /** Legacy manifest audit value only. It is never a quality or promotion signal. */
  legacyReadyGolden: z.boolean(),
});

export const TeacherPageRecordSchema = z.strictObject({
  schemaVersion: z.literal('1.0'),
  provenance: z.strictObject({
    referenceId: z.string().min(1),
    source: z.strictObject({
      origin: z.string().min(1),
      sourceUrl: z.url().optional(),
      authorOrOrganization: z.string().min(1).optional(),
    }),
    year: z.union([z.number().int().min(1900).max(2100), z.literal('unknown')]),
    pageArtifact: z.strictObject({
      kind: z.enum(['slide-image', 'pdf-page', 'html-page', 'other']),
      pageLabel: z.string().min(1).optional(),
      localAssetPath: z.string().min(1),
      sourceSha256: z.string().regex(/^[a-f0-9]{64}$/u).optional(),
    }),
    rights: TeacherRightsSchema,
    teacherStatus: TeacherStatusSchema,
    compatibility: TeacherCompatibilitySchema,
    curation: z.strictObject({
      analysisVersion: z.string().min(1),
      reviewedBy: TeacherCurationReviewerSchema,
      reviewedAt: z.iso.date().optional(),
      confidence: TeacherCurationConfidenceSchema,
    }),
  }),
  informationStructure: z.strictObject({
    pageGoal: z.string().min(1),
    primaryClaim: z.string().min(1),
    semanticShape: TeacherSemanticShapeSchema,
    informationGroups: z.array(z.strictObject({
      groupId: z.string().min(1),
      groupRole: z.string().min(1),
      description: z.string().min(1),
      order: z.number().int().nonnegative(),
      itemCount: z.number().int().positive(),
      required: z.boolean(),
    })).min(2),
    relationStructure: z.array(z.strictObject({
      fromGroupId: z.string().min(1),
      toGroupId: z.string().min(1),
      relationType: z.string().min(1),
      direction: TeacherRelationDirectionSchema,
      scope: TeacherRelationScopeSchema,
      explanation: z.string().min(1),
    })).min(1),
    readingPath: z.strictObject({
      primary: z.string().min(1),
      secondary: z.string().min(1).optional(),
      startRole: z.string().min(1),
      endRole: z.string().min(1),
    }),
    primaryArtifact: z.string().min(1),
  }),
  visualGrammar: z.strictObject({
    pageOccupancy: z.strictObject({
      band: TeacherDensitySchema,
      occupiedZones: z.array(z.string().min(1)).min(1),
      measuredRatio: z.number().min(0).max(1).optional(),
    }),
    dominantAxis: TeacherDominantAxisSchema,
    titleMessagePlacement: z.strictObject({
      titleZone: z.string().min(1),
      messageZone: z.string().min(1).optional(),
      relationship: z.enum(['combined', 'stacked', 'separate', 'absent']),
    }),
    hierarchyLevels: z.array(z.strictObject({
      level: z.number().int().positive(),
      semanticRole: z.string().min(1),
      relativeStrength: z.enum(['primary', 'secondary', 'supporting', 'annotation']),
    })).min(2),
    groupingStrategy: z.array(z.string().min(1)).min(1),
    whitespaceStrategy: z.array(z.string().min(1)).min(1),
    alignmentStrategy: z.array(z.string().min(1)).min(1),
    visualAnchor: z.strictObject({
      role: z.string().min(1),
      positionLogic: z.string().min(1),
      whyDominant: z.string().min(1),
    }),
    evidencePlacement: z.array(z.string().min(1)).min(1),
    connectorSemantics: z.array(z.strictObject({
      relationRole: z.string().min(1),
      carrier: z.string().min(1),
      scope: TeacherRelationScopeSchema,
      decorative: z.boolean(),
    })),
    accentStrategy: z.strictObject({
      semanticUses: z.array(z.string().min(1)).min(1),
      restraintRule: z.string().min(1),
    }),
    imageTextRelationship: z.string().min(1),
    repetitionStrategy: z.string().min(1),
  }),
  applicability: z.strictObject({
    fitsSemanticShapes: z.array(TeacherSemanticShapeSchema).min(1),
    requiredSignals: z.array(z.string().min(1)).min(1),
    forbiddenSignals: z.array(z.string().min(1)).min(1),
    useWhen: z.array(z.string().min(1)).min(1),
    doNotUseWhen: z.array(z.string().min(1)).min(1),
    densityRange: z.array(TeacherDensitySchema).min(1),
    blockCount: z.strictObject({
      min: z.number().int().nonnegative(),
      max: z.number().int().positive().optional(),
      hardLimit: z.boolean(),
    }),
    pairCount: z.strictObject({
      min: z.number().int().nonnegative(),
      max: z.number().int().positive().optional(),
      hardLimit: z.boolean(),
    }).optional(),
    assetRequirements: z.array(z.string().min(1)),
  }),
  qualityRationale: z.strictObject({
    whyStrong: z.array(z.string().min(1)).min(1),
    problemsSolved: z.array(z.string().min(1)).min(1),
    priorities: z.array(z.string().min(1)).min(1),
    tradeoffs: z.array(z.string().min(1)).min(1),
  }),
  reuseBoundary: z.strictObject({
    reusableAbstractPrinciples: z.array(z.string().min(1)).min(1),
    prohibitedCopy: z.array(z.string().min(1)).min(1),
    exactGeometryReusable: z.literal(false),
    sourcePaletteReusable: z.literal(false),
    sourceIpReusable: z.literal(false),
    sourceAssetReusable: z.literal(false),
  }),
  retrievalIndex: z.strictObject({
    intentTags: z.array(z.string().min(1)).min(1),
    semanticShapeTags: z.array(TeacherSemanticShapeSchema).min(1),
    relationTags: z.array(z.string().min(1)).min(1),
    groupRoleTags: z.array(z.string().min(1)).min(1),
    primaryArtifactTags: z.array(z.string().min(1)).min(1),
    readingPathTags: z.array(z.string().min(1)).min(1),
    densityTags: z.array(TeacherDensitySchema).min(1),
    compactRetrievalText: z.string().min(1).max(1200),
  }),
}).superRefine((record, context) => {
  const { rights, teacherStatus, curation } = record.provenance;
  if (rights.status === 'unknown' && (rights.reuseAssetAllowed || rights.redistributeAssetAllowed)) {
    context.addIssue({
      code: 'custom',
      path: ['provenance', 'rights'],
      message: '권리가 확인되지 않은 Teacher source asset은 재사용·재배포할 수 없습니다.',
    });
  }
  if (rights.redistributeAssetAllowed && !rights.reuseAssetAllowed) {
    context.addIssue({
      code: 'custom',
      path: ['provenance', 'rights', 'redistributeAssetAllowed'],
      message: '재사용이 금지된 Teacher source asset은 재배포할 수 없습니다.',
    });
  }
  if (rights.status === 'known-license' && rights.licenseId === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['provenance', 'rights', 'licenseId'],
      message: '확인된 라이선스 식별자가 필요합니다.',
    });
  }
  if (record.reuseBoundary.sourceAssetReusable && !rights.reuseAssetAllowed) {
    context.addIssue({
      code: 'custom',
      path: ['reuseBoundary', 'sourceAssetReusable'],
      message: 'rights가 허용하지 않은 source asset을 reuse boundary에서 허용할 수 없습니다.',
    });
  }
  if (teacherStatus === 'curated-teacher'
    && (curation.reviewedAt === undefined || curation.confidence === 'unassessed')) {
    context.addIssue({
      code: 'custom',
      path: ['provenance', 'curation'],
      message: 'curated-teacher에는 review 날짜와 평가 confidence가 필요합니다.',
    });
  }
  const groupIds = new Set(record.informationStructure.informationGroups.map((group) => group.groupId));
  for (const relation of record.informationStructure.relationStructure) {
    if (!groupIds.has(relation.fromGroupId) || !groupIds.has(relation.toGroupId)) {
      context.addIssue({
        code: 'custom',
        path: ['informationStructure', 'relationStructure'],
        message: 'relation endpoint는 같은 Teacher page의 information group을 참조해야 합니다.',
      });
    }
  }
  const orders = record.informationStructure.informationGroups.map((group) => group.order);
  if (new Set(orders).size !== orders.length) {
    context.addIssue({
      code: 'custom',
      path: ['informationStructure', 'informationGroups'],
      message: 'information group order는 page 안에서 중복될 수 없습니다.',
    });
  }
});

export type TeacherPageRecord = z.infer<typeof TeacherPageRecordSchema>;

export const TeacherPageRecordSetSchema = z.strictObject({
  schemaVersion: z.literal('1.0'),
  collectionId: z.string().min(1),
  sourceAnalysisFile: z.string().min(1),
  pages: z.array(TeacherPageRecordSchema).min(1),
}).superRefine((set, context) => {
  const ids = set.pages.map((page) => page.provenance.referenceId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({
      code: 'custom',
      path: ['pages'],
      message: 'Teacher page referenceId는 collection 안에서 중복될 수 없습니다.',
    });
  }
});

export type TeacherPageRecordSet = z.infer<typeof TeacherPageRecordSetSchema>;
