import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SEED_PATTERN_FRAGMENTS,
  SEED_REFERENCE_CORPUS,
  TeacherPageRecordSchema,
} from '@game-presentation/contracts';
import {
  loadExternalMasterReferenceSet,
  loadExternalMasterTeacherPageSet,
} from '../src/external-master.js';

const referenceDir = fileURLToPath(new URL('../references/external-master-2025-v1/', import.meta.url));

describe('2025 External Master Reference corpus', () => {
  it('preserves six source-verified references without promoting them', async () => {
    const set = await loadExternalMasterReferenceSet(referenceDir);

    expect(set.references).toHaveLength(6);
    expect(set.readyGolden).toBe(false);
    expect(set.references.every((reference) => reference.readyGolden === false)).toBe(true);
    expect(set.references.every((reference) => reference.patternAssessment.promotionStatus === 'candidate-only')).toBe(true);
    expect(set.rights).toEqual({
      status: 'unknown',
      allowedUse: {
        analyze: true,
        deriveAbstractPrinciple: true,
        reuseAsset: false,
        redistributeAsset: false,
      },
    });
  });

  it('preserves the historical analysis snapshot without treating it as current workflow state', async () => {
    const set = await loadExternalMasterReferenceSet(referenceDir);

    // Source-evidence compatibility check only. Current project status lives outside this record.
    expect(set.stageState).toEqual({
      stage0: 'partial',
      stage6: 'incomplete',
      readyPositiveFixture: 'none',
      stage7: 'not-started',
      criticCalled: false,
    });
    expect('stageState' in set.references[0]!).toBe(false);
  });

  it('keeps source assets reference-only while recording the user-approved abstract V1 Pattern', async () => {
    const set = await loadExternalMasterReferenceSet(referenceDir);
    expect(set.v1Assessment.rankedReferenceGrammars.map((item) => item.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(set.v1Assessment.rankedReferenceGrammars[0]?.referenceId).toBe('ext-2025-pokemon-problem-task-leak');
    expect(set.v1Assessment.recommendedPatternCandidate).toMatchObject({
      name: 'pattern-accumulation-threshold-consequence',
      status: 'implemented-v1-pattern',
    });
    const externalIds = new Set(set.references.map((reference) => reference.referenceId));
    expect(SEED_REFERENCE_CORPUS.some((reference) => externalIds.has(reference.referenceId))).toBe(false);
    const promoted = SEED_PATTERN_FRAGMENTS.find(
      (fragment) => fragment.fragmentId === 'pattern-accumulation-threshold-consequence',
    );
    expect(promoted?.sourceReferenceIds.every((referenceId) => externalIds.has(referenceId))).toBe(true);
    expect(promoted?.phaseContract?.provenance.excludedMeanings).toEqual([
      'hidden omission',
      'diagnosis',
      'before-after comparison',
      'two-alternative comparison',
    ]);
  });

  it('validates all six manually mapped Teacher pages against source provenance', async () => {
    const source = await loadExternalMasterReferenceSet(referenceDir);
    const teachers = await loadExternalMasterTeacherPageSet(referenceDir);
    const sourceIds = new Set(source.references.map((reference) => reference.referenceId));

    expect(teachers.pages).toHaveLength(6);
    expect(teachers.pages.every((page) => TeacherPageRecordSchema.safeParse(page).success)).toBe(true);
    expect(teachers.pages.every((page) => sourceIds.has(page.provenance.referenceId))).toBe(true);
    expect(teachers.pages.every((page) => page.provenance.teacherStatus === 'seed-evidence')).toBe(true);
    expect(teachers.pages.every(
      (page) => page.provenance.compatibility.legacyReadyGolden === false,
    )).toBe(true);
    expect(new Set(teachers.pages.map(
      (page) => page.informationStructure.semanticShape,
    )).size).toBe(6);
    for (const page of teachers.pages) {
      expect(page.provenance.rights).toBeDefined();
      expect(page.applicability).toBeDefined();
      expect(page.reuseBoundary.prohibitedCopy.length).toBeGreaterThan(0);
    }
  });

  it('keeps corrected Teacher mappings within directly observed visual evidence', async () => {
    const teachers = await loadExternalMasterTeacherPageSet(referenceDir);
    const page = (referenceId: string) => {
      const found = teachers.pages.find((candidate) => candidate.provenance.referenceId === referenceId);
      if (found === undefined) throw new Error(`Teacher fixture가 없습니다: ${referenceId}`);
      return found;
    };

    const organization = page('ext-2025-pokemon-initiative-team-structure');
    const organizationEvidence = JSON.stringify({
      pageGoal: organization.informationStructure.pageGoal,
      connectorSemantics: organization.visualGrammar.connectorSemantics,
      requiredSignals: organization.applicability.requiredSignals,
      relationTags: organization.retrievalIndex.relationTags,
    });
    expect(organizationEvidence).not.toContain('reporting');
    expect(organization.visualGrammar.connectorSemantics.map(
      (connector) => connector.relationRole,
    )).toContain('responsibility-and-membership');
    expect(organization.retrievalIndex.relationTags).toEqual(expect.arrayContaining([
      'responsibility',
      'membership',
    ]));

    const beforeAfter = page('ext-2025-shadowverse-super-evolution');
    expect(beforeAfter.visualGrammar.titleMessagePlacement.relationship).toBe('absent');
    expect(beforeAfter.visualGrammar.pageOccupancy.band).toBe('balanced');
    expect(beforeAfter.retrievalIndex.densityTags).toEqual(['balanced']);

    const countermeasure = page('ext-2025-shadowverse-rules-vs-card-ability');
    const groupIds = new Set(countermeasure.informationStructure.informationGroups.map(
      (group) => group.groupId,
    ));
    expect(groupIds.has('shared-problem')).toBe(false);
    expect(countermeasure.informationStructure.relationStructure).toEqual([
      expect.objectContaining({
        fromGroupId: 'rule-evidence',
        toGroupId: 'rule-effect',
        relationType: 'produces-rule-effect',
        scope: 'group',
      }),
      expect.objectContaining({
        fromGroupId: 'content-evidence',
        toGroupId: 'content-effect',
        relationType: 'produces-content-effect',
        scope: 'group',
      }),
    ]);
    for (const relation of countermeasure.informationStructure.relationStructure) {
      expect(groupIds.has(relation.fromGroupId)).toBe(true);
      expect(groupIds.has(relation.toGroupId)).toBe(true);
    }
    expect(countermeasure.informationStructure.readingPath.endRole).toBe('content-effect');
    expect(countermeasure.visualGrammar.titleMessagePlacement.relationship).toBe('absent');
    expect(JSON.stringify(countermeasure.informationStructure)).not.toContain('shared-problem');
    expect(teachers.pages.every(
      (teacher) => teacher.provenance.teacherStatus === 'seed-evidence'
        && teacher.provenance.compatibility.legacyReadyGolden === false,
    )).toBe(true);
  });

  it('rejects missing rights and missing prohibited-copy boundaries', async () => {
    const record = (await loadExternalMasterTeacherPageSet(referenceDir)).pages[0]!;
    const { rights: _rights, ...provenanceWithoutRights } = record.provenance;
    const { prohibitedCopy: _prohibitedCopy, ...boundaryWithoutProhibitedCopy } = record.reuseBoundary;
    expect(TeacherPageRecordSchema.safeParse({
      ...record,
      provenance: provenanceWithoutRights,
    }).success).toBe(false);
    expect(TeacherPageRecordSchema.safeParse({
      ...record,
      reuseBoundary: boundaryWithoutProhibitedCopy,
    }).success).toBe(false);
  });

  it('rejects unsafe source reuse and non-abstract Teacher reuse boundaries', async () => {
    const record = (await loadExternalMasterTeacherPageSet(referenceDir)).pages[0]!;
    expect(TeacherPageRecordSchema.safeParse({
      ...record,
      reuseBoundary: { ...record.reuseBoundary, sourceAssetReusable: true },
    }).success).toBe(false);
    expect(TeacherPageRecordSchema.safeParse({
      ...record,
      provenance: {
        ...record.provenance,
        rights: {
          ...record.provenance.rights,
          status: 'unknown',
          reuseAssetAllowed: true,
        },
      },
    }).success).toBe(false);
    for (const field of ['exactGeometryReusable', 'sourcePaletteReusable', 'sourceIpReusable'] as const) {
      expect(TeacherPageRecordSchema.safeParse({
        ...record,
        reuseBoundary: { ...record.reuseBoundary, [field]: true },
      }).success).toBe(false);
    }
  });

  it('rejects invalid status while keeping legacyReadyGolden structurally independent', async () => {
    const record = (await loadExternalMasterTeacherPageSet(referenceDir)).pages[0]!;
    expect(TeacherPageRecordSchema.safeParse({
      ...record,
      provenance: { ...record.provenance, teacherStatus: 'ready-golden' },
    }).success).toBe(false);

    const legacyTrue = TeacherPageRecordSchema.parse({
      ...record,
      provenance: {
        ...record.provenance,
        teacherStatus: 'seed-evidence',
        compatibility: { legacyReadyGolden: true },
      },
    });
    expect(legacyTrue.provenance.teacherStatus).toBe('seed-evidence');
    expect(legacyTrue.provenance.compatibility.legacyReadyGolden).toBe(true);
  });
});
