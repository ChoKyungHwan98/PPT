import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SEED_PATTERN_FRAGMENTS,
  SEED_REFERENCE_CORPUS,
  validateCompositionPlan,
  type CompositionPlan,
} from '@game-presentation/contracts';
import {
  buildTeacherDesignGuidance,
  externalOrganizationReferenceRecords,
  loadExternalMasterReferenceSet,
  loadExternalMasterTeacherPageSet,
  retrieveReferencesForInformationPlan,
  selectCuratedTeachersForInformationPlan,
  type TeacherDesignGuidance,
} from '@game-presentation/reference-engine';
import {
  interpretAuthoredHierarchy,
  type AuthoredHierarchy,
} from '../../source-ingestion/src/authored-hierarchy.js';
import { createCompositionPlanFromInformationPlan } from '../src/information-composition.js';

const referenceDir = fileURLToPath(new URL('../../reference-engine/references/external-master-2025-v1/', import.meta.url));
const referenceSet = await loadExternalMasterReferenceSet(referenceDir);
const teachers = (await loadExternalMasterTeacherPageSet(referenceDir)).pages;
const corpus = [
  ...SEED_REFERENCE_CORPUS,
  ...externalOrganizationReferenceRecords(referenceSet, referenceDir),
];
const source = JSON.parse(await readFile(
  new URL('../../source-ingestion/fixtures/combat-system-organization.source.json', import.meta.url),
  'utf8',
)) as AuthoredHierarchy;

function prepare() {
  const interpreted = interpretAuthoredHierarchy(source);
  const retrieval = retrieveReferencesForInformationPlan({
    ...interpreted,
    corpus,
    audience: 'game-design-reviewer',
    outputProfile: 'pdf-presentation',
    limit: 4,
  });
  const selection = selectCuratedTeachersForInformationPlan({
    ...interpreted,
    teachers,
    limit: 3,
  });
  const resolution = buildTeacherDesignGuidance({ ...interpreted, selection, teachers });
  if (resolution.status !== 'ready') throw new Error(resolution.reason);
  return { ...interpreted, retrieval, guidance: resolution.guidance, selection };
}

function compose(prepared: ReturnType<typeof prepare>, guidance?: TeacherDesignGuidance): CompositionPlan {
  return createCompositionPlanFromInformationPlan({
    slide: prepared.slide,
    informationPlan: prepared.informationPlan,
    retrieval: prepared.retrieval,
    fragments: SEED_PATTERN_FRAGMENTS,
    ...(guidance === undefined ? {} : { teacherGuidance: guidance }),
  });
}

describe('Teacher-guided Organization Composition', () => {
  it('separates authored operating explanation from the responsibility hierarchy', () => {
    const prepared = prepare();
    expect(prepared.selection.selected[0]?.semanticShape).toBe('hierarchy');
    expect(prepared.guidance.structureLock.semanticShape).toBe('hierarchy');

    const sourceBefore = structuredClone(prepared.slide.source);
    const relationsBefore = structuredClone(prepared.slide.relations);
    const general = compose(prepared);
    const guided = compose(prepared, prepared.guidance);

    expect(validateCompositionPlan(
      general,
      prepared.slide,
      prepared.informationPlan,
      SEED_PATTERN_FRAGMENTS,
      corpus,
    )).toEqual([]);
    expect(validateCompositionPlan(
      guided,
      prepared.slide,
      prepared.informationPlan,
      SEED_PATTERN_FRAGMENTS,
      corpus,
    )).toEqual([]);
    expect(guided.planId).not.toBe(general.planId);
    expect(guided.regions).toEqual(expect.arrayContaining([
      expect.objectContaining({ regionId: 'organization-body', flow: 'row' }),
      expect.objectContaining({
        regionId: 'organization-explanation',
        parentRegionId: 'organization-body',
        role: 'annotation',
      }),
      expect.objectContaining({
        regionId: 'organization-hierarchy-map',
        parentRegionId: 'organization-body',
        role: 'primary-artifact',
      }),
    ]));
    expect(general.regions.some((region) => region.regionId === 'organization-body')).toBe(false);
    expect(general.regions.some((region) => region.regionId === 'organization-hierarchy-map')).toBe(false);
    expect(guided.layout.readingPath).toBe('top-to-bottom');
    expect(guided.regions.some((region) => /timeline|causal/u.test(region.regionId))).toBe(false);

    const hierarchyBindings = new Map(
      guided.bindings
        .filter((binding) => binding.fragmentRole.startsWith('organization.hierarchy-'))
        .map((binding) => [binding.blockId, binding]),
    );
    const regions = new Map(guided.regions.map((region) => [region.regionId, region]));
    for (const relation of prepared.slide.relations) {
      expect(relation.type).toBe('part-of');
      const child = hierarchyBindings.get(relation.fromBlockId);
      const parent = hierarchyBindings.get(relation.toBlockId);
      expect(child).toBeDefined();
      expect(parent).toBeDefined();
      expect(regions.get(child!.regionId)?.parentRegionId).toBe(parent!.regionId);
    }
    const messageBlock = prepared.slide.blocks.find((block) => block.sourceSpanIds.includes('message'))!;
    expect(guided.bindings.find((binding) => binding.blockId === messageBlock.id)).toMatchObject({
      regionId: 'organization-explanation',
      fragmentRole: 'organization.operating-principle',
    });
    expect(hierarchyBindings.has(messageBlock.id)).toBe(false);
    expect(guided.bindings.map((binding) => binding.blockId)).toEqual(prepared.informationPlan.readingOrder);
    expect(new Set(guided.bindings.map((binding) => binding.blockId)))
      .toEqual(new Set(prepared.slide.blocks.map((block) => block.id)));
    expect(prepared.slide.source).toEqual(sourceBefore);
    expect(prepared.slide.relations).toEqual(relationsBefore);
  });

  it('does not let Secondary guidance replace the Primary hierarchy topology', () => {
    const prepared = prepare();
    const withSecondary = structuredClone(prepared.guidance);
    withSecondary.secondaryTeachers = [{ referenceId: 'secondary-test-only', semanticShape: 'tradeoff' }];
    withSecondary.secondarySupport = [{
      text: '모든 항목을 시간 순서로 배치한다.',
      sourceReferenceId: 'secondary-test-only',
      sourceField: 'test',
      teacherRole: 'secondary',
    }];
    expect(compose(prepared, withSecondary)).toEqual(compose(prepared, prepared.guidance));
  });

  it('does not branch on fixture words, reference IDs, IP, or event branding', async () => {
    const code = await Promise.all([
      readFile(new URL('../src/organization-composition.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/information-composition.ts', import.meta.url), 'utf8'),
    ]).then((files) => files.join('\n'));
    expect(code).not.toMatch(/전투|플레이어|보스|generic-combat-system-organization/u);
    expect(code).not.toMatch(/ext-2025-pokemon-initiative-team-structure|Pokemon|Pokémon|CEDEC/u);
  });
});
