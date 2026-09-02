import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { SEED_PATTERN_FRAGMENTS, SEED_REFERENCE_CORPUS, RenderTreeSchema, validateCompositionPlan, resolveAlignedFeatureSpec } from '@game-presentation/contracts';
import { createCompositionPlanFromInformationPlan } from '@game-presentation/composition-engine';
import { externalComparisonReferenceRecords, loadExternalMasterReferenceSet, retrieveReferencesForInformationPlan } from '@game-presentation/reference-engine';
import { fileURLToPath } from 'node:url';
import { interpretAuthoredFeatureComparison, type AuthoredFeatureComparison } from '../../source-ingestion/src/authored-feature-comparison.js';
import { interpretMec01Source, createMec01InformationPlan } from '../../source-ingestion/src/mec-01-semantic.js';
import { buildInformationRenderTree, informationMeasureRequests } from '../src/information-layout.js';
import { loadSystemPretendard } from '../src/font.js';
import { launchRenderBrowser } from '../src/browser.js';
import { measureTextBatch } from '../src/measure.js';
import { runHardGate } from '../src/hard-gate.js';

const source = JSON.parse(await readFile(new URL('../../source-ingestion/fixtures/dodge-feature-spec.source.json', import.meta.url), 'utf8')) as AuthoredFeatureComparison;
const referenceDir = fileURLToPath(new URL('../../reference-engine/references/external-master-2025-v1', import.meta.url));
const referenceSet = await loadExternalMasterReferenceSet(referenceDir);
const corpus = [...SEED_REFERENCE_CORPUS, ...externalComparisonReferenceRecords(referenceSet, referenceDir)];

function genericSource(count: number): AuthoredFeatureComparison {
  const segments = [
    { id: 't', text: '자원 회복 사양 변경' }, { id: 'b', text: '변경 전' }, { id: 'a', text: '변경 후' },
    { id: 'm', text: '회복 조건과 적용 시점을 비교한다' },
    ...Array.from({ length: count }, (_, i) => ({ id: `x${i}`, text: `기존 조건 ${i + 1}에서 2초 대기` })),
    ...Array.from({ length: count }, (_, i) => ({ id: `z${i}`, text: `변경 조건 ${i + 1}에서 1초 대기` })),
  ];
  return {
    fixtureId: `generic-spec-${count}`, rawText: segments.map((entry) => entry.text).join('\n'), segments,
    titleSegmentId: 't', messageSegmentId: 'm',
    before: { labelSegmentId: 'b', itemSegmentIds: Array.from({ length: count }, (_, i) => `x${i}`) },
    // Deliberately reorder storage. Explicit authored edges must still win.
    after: { labelSegmentId: 'a', itemSegmentIds: Array.from({ length: count }, (_, i) => `z${count - 1 - i}`) },
    pairs: Array.from({ length: count }, (_, i) => ({ beforeSegmentId: `x${i}`, afterSegmentId: `z${i}` })),
  };
}

function compose(input: ReturnType<typeof interpretAuthoredFeatureComparison>) {
  const retrieval = retrieveReferencesForInformationPlan({
    ...input, corpus, audience: 'game-design-reviewer', outputProfile: 'pdf-presentation', limit: 4,
  });
  const plan = createCompositionPlanFromInformationPlan({ ...input, retrieval, fragments: SEED_PATTERN_FRAGMENTS });
  return { ...input, plan };
}

describe('aligned Before / After Feature Spec', () => {
  let browser: Awaited<ReturnType<typeof launchRenderBrowser>>;
  let fonts: Awaited<ReturnType<typeof loadSystemPretendard>>;
  beforeAll(async () => { fonts = await loadSystemPretendard(); browser = await launchRenderBrowser(); });
  afterAll(async () => { await browser?.close(); });

  for (const [count, fixture] of [[2, genericSource(2)], [3, source], [4, genericSource(4)]] as const) {
    it(`preserves ${count} authored pairs through actual font measurement, composition and Hard Gate`, async () => {
      const input = compose(interpretAuthoredFeatureComparison(fixture));
      expect(input.plan.patternFragmentIds).toEqual(['pattern-aligned-before-after-spec']);
      expect(validateCompositionPlan(input.plan, input.slide, input.informationPlan, SEED_PATTERN_FRAGMENTS, corpus)).toEqual([]);
      expect(input.plan.regions.filter((region) => region.parentRegionId === 'comparison-field')).toHaveLength(count);
      const measures = await measureTextBatch(browser, fonts, informationMeasureRequests(input), { requireLoadedFonts: true });
      const tree = buildInformationRenderTree({ ...input, fonts, measures });
      expect(runHardGate({ ...input, tree })).toEqual({ passed: true, programFindings: [], sourceFidelityFindings: [], findings: [] });
      expect(tree.nodes.filter((node) => node.kind === 'text' && node.visualRole === 'comparison-before')).toHaveLength(count);
      expect(tree.nodes.filter((node) => node.kind === 'text' && node.visualRole === 'comparison-after')).toHaveLength(count);
      expect(tree.nodes.filter((node) => node.kind === 'shape' && node.shape === 'rect')).toHaveLength(1);
      for (const edge of input.slide.relations) {
        const left = input.plan.bindings.find((binding) => binding.blockId === edge.fromBlockId)!;
        const right = input.plan.bindings.find((binding) => binding.blockId === edge.toBlockId)!;
        expect(left.regionId).toBe(right.regionId);
        expect(tree.nodes.filter((node) => node.visible && node.relationId === edge.id)).toHaveLength(1);
      }
      expect(buildInformationRenderTree({ ...input, fonts, measures })).toEqual(tree);
      const visibleCorruption = structuredClone(tree);
      const text = visibleCorruption.nodes.find((node) => node.kind === 'text')!;
      if (text.kind === 'text') text.lines[0]!.text = '원문에 없는 주장';
      expect(runHardGate({ ...input, tree: visibleCorruption }).passed).toBe(false);
      const missingRelation = structuredClone(tree);
      missingRelation.nodes = missingRelation.nodes.filter((node) => node.relationId !== input.slide.relations[0]!.id);
      expect(runHardGate({ ...input, tree: missingRelation }).passed).toBe(false);
      const missingContent = structuredClone(tree);
      missingContent.nodes = missingContent.nodes.filter((node) => node.kind !== 'text' || node.visualRole !== 'comparison-before');
      expect(runHardGate({ ...input, tree: missingContent }).sourceFidelityFindings.some((finding) => finding.code === 'missing-source-content')).toBe(true);
      const duplicated = structuredClone(tree);
      const owner = duplicated.nodes.find((node) => node.kind === 'text')!;
      duplicated.nodes.push({ ...owner, nodeId: 'duplicate-owner' });
      expect(runHardGate({ ...input, tree: duplicated }).sourceFidelityFindings.some((finding) => finding.code === 'duplicate-content')).toBe(true);
      const mismatchedPair = structuredClone(tree);
      const carrier = mismatchedPair.nodes.find((node) => node.relationId === input.slide.relations[0]!.id)!;
      carrier.parentId = 'region-comparison-pair-1';
      expect(runHardGate({ ...input, tree: mismatchedPair }).passed).toBe(false);
      if (count !== 3) {
        const changedNumber = structuredClone(tree);
        const value = changedNumber.nodes.find((node) => node.kind === 'text' && node.text.includes('2초'))!;
        if (value.kind === 'text') value.text = value.text.replace('2초', '9초');
        expect(runHardGate({ ...input, tree: changedNumber }).sourceFidelityFindings.some((finding) => finding.code === 'invented-number')).toBe(true);
      }
    });
  }
  it('rejects unpaired/many-to-one comparisons rather than inferring from position', () => {
    const input = interpretAuthoredFeatureComparison(genericSource(2));
    input.slide.relations[1]!.toBlockId = input.slide.relations[0]!.toBlockId;
    expect(resolveAlignedFeatureSpec(input.slide, input.informationPlan)).toBeUndefined();
    expect(() => compose(input)).toThrow();
  });
  it('preserves the first production PNG as an unapproved candidate with zero Critic calls', async () => {
    const [png, treeText, proofText] = await Promise.all([
      readFile(new URL('../fixtures/dodge-feature-spec-01.png', import.meta.url)),
      readFile(new URL('../fixtures/dodge-feature-spec-01.render-tree.json', import.meta.url), 'utf8'),
      readFile(new URL('../fixtures/dodge-feature-spec-01.proof.json', import.meta.url), 'utf8'),
    ]);
    const tree = RenderTreeSchema.parse(JSON.parse(treeText));
    const proof = JSON.parse(proofText);
    const metadata = await sharp(png).metadata();
    expect([metadata.width, metadata.height]).toEqual([1920, 1080]);
    expect(createHash('sha256').update(png).digest('hex')).toBe(proof.png.sha256);
    expect(proof.readyPositiveFixture).toBe(false);
    expect(proof.readyPromotionApproval).toBeNull();
    expect(proof.criticCalled).toBe(false);
    expect(proof.pngRenderCount).toBe(1);
    expect(proof.polishIterations).toBe(0);
    expect(runHardGate({ ...interpretAuthoredFeatureComparison(source), tree }).passed).toBe(true);
  });
  it('contains no fixture text or fixture-ID tests in production comparison logic', async () => {
    for (const path of [
      '../src/aligned-feature-layout.ts', '../src/aligned-feature-validation.ts',
      '../../composition-engine/src/aligned-feature-composition.ts',
      '../../contracts/src/aligned-feature-spec.ts',
      '../../source-ingestion/src/authored-feature-comparison.ts',
    ]) {
      const code = await readFile(new URL(path, import.meta.url), 'utf8');
      expect(code).not.toMatch(/더킹|락온|회피|dodge-feature-spec-01|mec-01|break-state|damage-modifier/u);
    }
  });
  it('excludes causal-chain / accumulation structures and leaves MEC-01 plan unchanged', async () => {
    const slide = interpretMec01Source({ rawText: '회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%', createdAt: '2026-08-29T00:00:00.000Z' });
    const informationPlan = createMec01InformationPlan(slide);
    expect(resolveAlignedFeatureSpec(slide, informationPlan)).toBeUndefined();
    const retrieval = retrieveReferencesForInformationPlan({ slide, informationPlan, corpus: SEED_REFERENCE_CORPUS,
      audience: 'game-design-reviewer', outputProfile: 'pdf-presentation', avoidSignatures: ['card-dashboard'], limit: 4 });
    expect(() => createCompositionPlanFromInformationPlan({ slide, informationPlan, retrieval,
      fragments: SEED_PATTERN_FRAGMENTS.filter((pattern) => pattern.comparisonContract) })).toThrow();
    const plan = createCompositionPlanFromInformationPlan({ slide, informationPlan, retrieval, fragments: SEED_PATTERN_FRAGMENTS });
    const expected = JSON.parse(await readFile(new URL('../../composition-engine/fixtures/mec-01-accumulation-threshold-consequence.composition-plan.json', import.meta.url), 'utf8'));
    expect(plan).toEqual(expected);
  });
});
