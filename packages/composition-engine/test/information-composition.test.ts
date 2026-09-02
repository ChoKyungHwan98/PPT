import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SEED_PATTERN_FRAGMENTS,
  SEED_REFERENCE_CORPUS,
  validateCompositionPlan,
} from '@game-presentation/contracts';
import { retrieveReferencesForInformationPlan } from '@game-presentation/reference-engine';
import { createMec01InformationPlan, interpretMec01Source } from '../../source-ingestion/src/mec-01-semantic.js';
import { createCompositionPlanFromInformationPlan } from '../src/information-composition.js';
import {
  BEFORE_AFTER_NEGATIVE_FIXTURE,
  LONG_ACCUMULATION_FIXTURE,
  SHORT_ACCUMULATION_FIXTURE,
} from './fixtures/phase-contract-fixtures.js';

const rawText = '회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%';
const expectedPlan = JSON.parse(readFileSync(
  new URL('../fixtures/mec-01-accumulation-threshold-consequence.composition-plan.json', import.meta.url),
  'utf8',
)) as unknown;

function inputFor(fragmentId?: string) {
  const slide = interpretMec01Source({ rawText, createdAt: '2026-08-29T00:00:00.000Z' });
  const informationPlan = createMec01InformationPlan(slide);
  const retrieval = retrieveReferencesForInformationPlan({
    slide,
    informationPlan,
    corpus: SEED_REFERENCE_CORPUS,
    audience: 'game-design-reviewer',
    outputProfile: 'pdf-presentation',
    avoidSignatures: ['card-dashboard'],
    limit: 4,
  });
  const fragments = fragmentId === undefined
    ? SEED_PATTERN_FRAGMENTS
    : SEED_PATTERN_FRAGMENTS.filter((fragment) => fragment.fragmentId === fragmentId);
  return { slide, informationPlan, retrieval, fragments };
}

function genericInput(fixture: typeof SHORT_ACCUMULATION_FIXTURE) {
  const retrieval = retrieveReferencesForInformationPlan({
    slide: fixture.slide,
    informationPlan: fixture.informationPlan,
    corpus: SEED_REFERENCE_CORPUS,
    audience: 'game-design-reviewer',
    outputProfile: 'pdf-presentation',
    avoidSignatures: ['card-dashboard'],
    limit: 4,
  });
  return {
    ...fixture,
    retrieval,
    fragments: SEED_PATTERN_FRAGMENTS.filter(
      (fragment) => fragment.fragmentId === 'pattern-accumulation-threshold-consequence',
    ),
  };
}

function expectReusablePhasePlan(fixture: typeof SHORT_ACCUMULATION_FIXTURE, accumulationCount: number) {
  const input = genericInput(fixture);
  const plan = createCompositionPlanFromInformationPlan(input);
  const accumulationIds = fixture.informationPlan.groups.find((group) => group.role === 'setup')?.blockIds ?? [];
  const thresholdIds = fixture.informationPlan.groups.find((group) => group.role === 'transition')?.blockIds ?? [];
  const consequenceIds = fixture.informationPlan.groups.find((group) => group.role === 'consequence')?.blockIds ?? [];

  expect(plan.patternFragmentIds).toEqual(['pattern-accumulation-threshold-consequence']);
  expect(plan.regions.map((region) => region.regionId)).toEqual([
    'message-context',
    'phase-accumulation',
    'phase-threshold',
    'phase-consequence',
  ]);
  expect(accumulationIds).toHaveLength(accumulationCount);
  expect(plan.bindings.filter((binding) => binding.regionId === 'phase-accumulation').map((binding) => binding.blockId)).toEqual(accumulationIds);
  expect(plan.bindings.filter((binding) => binding.regionId === 'phase-threshold').map((binding) => binding.blockId)).toEqual(thresholdIds);
  expect(plan.bindings.filter((binding) => binding.regionId === 'phase-consequence').map((binding) => binding.blockId)).toEqual(consequenceIds);
  expect(plan.bindings.map((binding) => binding.blockId)).toEqual(fixture.informationPlan.readingOrder);
  expect(fixture.informationPlan.relationIds).toEqual(fixture.slide.relations.map((relation) => relation.id));
  expect(validateCompositionPlan(
    plan,
    fixture.slide,
    fixture.informationPlan,
    SEED_PATTERN_FRAGMENTS,
    SEED_REFERENCE_CORPUS,
  )).toEqual([]);

  const accumulationSet = new Set(accumulationIds);
  const thresholdSet = new Set(thresholdIds);
  const consequenceSet = new Set(consequenceIds);
  expect(fixture.slide.relations.some(
    (relation) => accumulationSet.has(relation.fromBlockId) && thresholdSet.has(relation.toBlockId),
  )).toBe(true);
  expect(fixture.slide.relations.some(
    (relation) => thresholdSet.has(relation.fromBlockId) && consequenceSet.has(relation.toBlockId),
  )).toBe(true);
  return plan;
}

describe('accumulation-threshold-consequence PatternFragment', () => {
  it('wins for a matching phase structure and produces three authoritative phase regions', () => {
    const input = inputFor();
    const plan = createCompositionPlanFromInformationPlan(input);

    expect(plan.patternFragmentIds).toEqual(['pattern-accumulation-threshold-consequence']);
    expect(plan.layout).toMatchObject({
      layoutFamily: 'accumulation-threshold-consequence',
      readingPath: 'guided-sequence',
    });
    expect(plan.regions.map((region) => ({
      regionId: region.regionId,
      role: region.role,
      flow: region.flow,
      order: region.order,
    }))).toEqual([
      { regionId: 'message-context', role: 'message', flow: 'column', order: 0 },
      { regionId: 'phase-accumulation', role: 'support', flow: 'row', order: 1 },
      { regionId: 'phase-threshold', role: 'primary-artifact', flow: 'overlay', order: 2 },
      { regionId: 'phase-consequence', role: 'evidence', flow: 'column', order: 3 },
    ]);
    expect(plan.bindings.map(({ blockId, regionId, fragmentRole }) => ({
      blockId,
      regionId,
      fragmentRole,
    }))).toEqual([
      { blockId: 'dodge-step', regionId: 'phase-accumulation', fragmentRole: 'accumulation.trigger' },
      { blockId: 'fragment-resource', regionId: 'phase-accumulation', fragmentRole: 'accumulation.input' },
      { blockId: 'freeze-step', regionId: 'phase-accumulation', fragmentRole: 'accumulation.process' },
      { blockId: 'break-state', regionId: 'phase-threshold', fragmentRole: 'threshold.primary' },
      { blockId: 'damage-modifier', regionId: 'phase-consequence', fragmentRole: 'consequence.modifier' },
    ]);
    expect(validateCompositionPlan(
      plan,
      input.slide,
      input.informationPlan,
      SEED_PATTERN_FRAGMENTS,
      SEED_REFERENCE_CORPUS,
    )).toEqual([]);
    expect(plan).toEqual(expectedPlan);
  });

  it('keeps all three Pattern families available as different CompositionPlans', () => {
    const newPlan = createCompositionPlanFromInformationPlan(inputFor('pattern-accumulation-threshold-consequence'));
    const threshold = createCompositionPlanFromInformationPlan(inputFor('pattern-break-threshold-field'));
    const editorial = createCompositionPlanFromInformationPlan(inputFor('pattern-editorial-causal-spine'));

    expect([
      newPlan.layout.layoutFamily,
      threshold.layout.layoutFamily,
      editorial.layout.layoutFamily,
    ]).toEqual([
      'accumulation-threshold-consequence',
      'threshold-field',
      'editorial-causal-spine',
    ]);
    expect(newPlan.regions.map((region) => region.regionId)).not.toEqual(
      threshold.regions.map((region) => region.regionId),
    );
    expect(newPlan.regions.map((region) => region.regionId)).not.toEqual(
      editorial.regions.map((region) => region.regionId),
    );
  });

  it('contains no MEC-01 block ID, fixed block count, or fixture wording in the reusable Pattern', () => {
    const fragment = SEED_PATTERN_FRAGMENTS.find(
      (candidate) => candidate.fragmentId === 'pattern-accumulation-threshold-consequence',
    );
    if (fragment === undefined) throw new Error('Pattern fixture missing');
    const serialized = JSON.stringify(fragment);

    expect(serialized).not.toMatch(/mec-01|break-state|damage-modifier|dodge-step|fragment-resource|freeze-step/iu);
    expect(fragment.phaseContract?.regions.find((region) => region.phase === 'accumulation')?.sourceGroupRoles).toEqual(['trigger', 'setup']);
    expect(fragment.constraints).toContain('Do not require an exact number of blocks inside any phase.');
  });

  it('reuses the same phase contract for a four-block structure with two accumulation steps', () => {
    const plan = expectReusablePhasePlan(SHORT_ACCUMULATION_FIXTURE, 2);
    expect(plan.bindings).toHaveLength(4);
  });

  it('reuses the same phase contract for a seven-block structure with four accumulation steps', () => {
    const plan = expectReusablePhasePlan(LONG_ACCUMULATION_FIXTURE, 4);
    expect(plan.bindings).toHaveLength(7);
    expect(plan.bindings.filter((binding) => binding.regionId === 'phase-consequence')).toHaveLength(2);
  });

  it('rejects a before-after comparison that has no accumulation-threshold-consequence contract', () => {
    const input = genericInput(BEFORE_AFTER_NEGATIVE_FIXTURE);
    expect(() => createCompositionPlanFromInformationPlan(input)).toThrow(
      '현재 SlideIR과 InformationPlan에 맞는 허용된 pattern fragment를 찾지 못했습니다.',
    );
  });
});
