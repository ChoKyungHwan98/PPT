import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SEED_PATTERN_FRAGMENTS,
  SEED_REFERENCE_CORPUS,
  resolveAlignedFeatureSpec,
  validateCompositionPlan,
  type CompositionPlan,
} from '@game-presentation/contracts';
import {
  buildTeacherDesignGuidance,
  externalComparisonReferenceRecords,
  loadExternalMasterReferenceSet,
  loadExternalMasterTeacherPageSet,
  retrieveReferencesForInformationPlan,
  selectCuratedTeachersForInformationPlan,
  type TeacherDesignGuidance,
} from '@game-presentation/reference-engine';
import {
  interpretAuthoredFeatureComparison,
  type AuthoredFeatureComparison,
} from '../../source-ingestion/src/authored-feature-comparison.js';
import { createCompositionPlanFromInformationPlan } from '../src/information-composition.js';

const referenceDir = fileURLToPath(new URL('../../reference-engine/references/external-master-2025-v1/', import.meta.url));
const referenceSet = await loadExternalMasterReferenceSet(referenceDir);
const teachers = (await loadExternalMasterTeacherPageSet(referenceDir)).pages;
const corpus = [...SEED_REFERENCE_CORPUS, ...externalComparisonReferenceRecords(referenceSet, referenceDir)];
const dodgeSource = JSON.parse(await readFile(
  new URL('../../source-ingestion/fixtures/dodge-feature-spec.source.json', import.meta.url),
  'utf8',
)) as AuthoredFeatureComparison;
const rewardSource = JSON.parse(await readFile(
  new URL('../../source-ingestion/fixtures/reward-feature-spec.source.json', import.meta.url),
  'utf8',
)) as AuthoredFeatureComparison;

function prepare(source: AuthoredFeatureComparison) {
  const interpreted = interpretAuthoredFeatureComparison(source);
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
  return { ...interpreted, retrieval, guidance: resolution.guidance };
}

function compose(
  prepared: ReturnType<typeof prepare>,
  guidance?: TeacherDesignGuidance,
): CompositionPlan {
  return createCompositionPlanFromInformationPlan({
    slide: prepared.slide,
    informationPlan: prepared.informationPlan,
    retrieval: prepared.retrieval,
    fragments: SEED_PATTERN_FRAGMENTS,
    ...(guidance === undefined ? {} : { teacherGuidance: guidance }),
  });
}

function expectGuidedPairAxis(prepared: ReturnType<typeof prepare>, plan: CompositionPlan) {
  const structure = resolveAlignedFeatureSpec(prepared.slide, prepared.informationPlan);
  if (structure === undefined) throw new Error('비교 fixture의 명시적 대응쌍을 찾지 못했습니다.');
  expect(validateCompositionPlan(
    plan,
    prepared.slide,
    prepared.informationPlan,
    SEED_PATTERN_FRAGMENTS,
    corpus,
  )).toEqual([]);
  expect(plan.layout.rationale).toMatch(/Primary Teacher Guidance/);
  expect(plan.regions.find((region) => region.regionId === 'page-heading')?.parentRegionId)
    .toBe('comparison-shared-basis');
  expect(plan.regions.find((region) => region.regionId === 'message-context')?.parentRegionId)
    .toBe('comparison-shared-basis');
  expect(plan.regions.find((region) => region.regionId === 'comparison-before-heading')?.parentRegionId)
    .toBe('comparison-heading');
  expect(plan.regions.find((region) => region.regionId === 'comparison-after-heading')?.parentRegionId)
    .toBe('comparison-heading');

  for (const [index, pair] of structure.pairs.entries()) {
    const pairRegionId = `comparison-pair-${index}`;
    const before = plan.bindings.find((binding) => binding.blockId === pair.fromBlockId);
    const after = plan.bindings.find((binding) => binding.blockId === pair.toBlockId);
    expect(before?.regionId).toBe(`${pairRegionId}-before`);
    expect(after?.regionId).toBe(`${pairRegionId}-after`);
    expect(plan.regions.find((region) => region.regionId === before?.regionId)?.parentRegionId).toBe(pairRegionId);
    expect(plan.regions.find((region) => region.regionId === after?.regionId)?.parentRegionId).toBe(pairRegionId);
    const changeRegion = plan.regions.find((region) => region.regionId === `${pairRegionId}-change`);
    expect(changeRegion).toMatchObject({ parentRegionId: pairRegionId, role: 'annotation', order: 1 });
    expect(plan.bindings.some((binding) => binding.regionId === changeRegion?.regionId)).toBe(false);
  }
  expect(new Set(plan.bindings.map((binding) => binding.blockId)))
    .toEqual(new Set(prepared.slide.blocks.map((block) => block.id)));
  expect(plan.bindings.map((binding) => binding.blockId)).toEqual(prepared.informationPlan.readingOrder);
  expect(plan.layout.readingPath).toBe('before-after');
  expect(plan.regions.some((region) => /timeline|causal/u.test(region.regionId))).toBe(false);
}

describe('Teacher-guided aligned Before / After Composition', () => {
  it('turns the Dodge comparison into shared context and aligned pair rows', () => {
    const prepared = prepare(dodgeSource);
    expect(prepared.guidance.structureLock.semanticShape).toBe('aligned-before-after-spec');
    const guided = compose(prepared, prepared.guidance);
    const general = compose(prepared);

    expectGuidedPairAxis(prepared, guided);
    expect(guided.planId).not.toBe(general.planId);
    expect(general.regions.some((region) => region.regionId === 'comparison-shared-basis')).toBe(false);
    expect(general.regions.some((region) => region.regionId.endsWith('-change'))).toBe(false);
    const firstPair = resolveAlignedFeatureSpec(prepared.slide, prepared.informationPlan)!.pairs[0]!;
    expect(general.bindings.find((binding) => binding.blockId === firstPair.fromBlockId)?.regionId)
      .toBe(general.bindings.find((binding) => binding.blockId === firstPair.toBlockId)?.regionId);
    expect(guided.bindings.find((binding) => binding.blockId === firstPair.fromBlockId)?.regionId)
      .not.toBe(guided.bindings.find((binding) => binding.blockId === firstPair.toBlockId)?.regionId);
  });

  it('applies the same structure to a separate reward-system comparison', () => {
    const prepared = prepare(rewardSource);
    expect(prepared.guidance.structureLock.semanticShape).toBe('aligned-before-after-spec');
    const guided = compose(prepared, prepared.guidance);

    expectGuidedPairAxis(prepared, guided);
    expect(guided.regions.filter((region) => /^comparison-pair-\d+$/u.test(region.regionId))).toHaveLength(2);
    expect(prepared.slide.source.spans.map((span) => span.text)).toEqual(expect.arrayContaining([
      '보상 상자 1개',
      '보상 상자 2개',
      '주간 보상 고정',
      '주간 보상 선택',
    ]));
    expect(prepared.slide.relations.map((relation) => relation.type)).toEqual(['compares-with', 'compares-with']);
  });

  it('does not let Secondary guidance alter the Primary pair topology', () => {
    const prepared = prepare(rewardSource);
    const withSecondary = structuredClone(prepared.guidance);
    withSecondary.secondaryTeachers = [{ referenceId: 'secondary-test-only', semanticShape: 'tradeoff' }];
    withSecondary.secondarySupport = [{
      text: '세로 타임라인으로 구조를 교체한다.',
      sourceReferenceId: 'secondary-test-only',
      sourceField: 'test',
      teacherRole: 'secondary',
    }];

    expect(compose(prepared, withSecondary)).toEqual(compose(prepared, prepared.guidance));
  });

  it('contains no Teacher reference, Dodge, reward fixture, palette, or IP branch in production logic', async () => {
    const code = await Promise.all([
      readFile(new URL('../src/aligned-feature-composition.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/information-composition.ts', import.meta.url), 'utf8'),
    ]).then((files) => files.join('\n'));
    expect(code).not.toMatch(/ext-2025-shadowverse-super-evolution|더킹|락온|회피|보상 구조|generic-reward-comparison/u);
    expect(code).not.toMatch(/Shadowverse|Pokemon|Pokémon|CEDEC|#[A-Fa-f0-9]{6}|\.png/u);
  });
});
