import { describe, expect, it } from 'vitest';
import {
  SEED_PATTERN_FRAGMENTS,
  SEED_REFERENCE_CORPUS,
  validateCompositionPlan,
} from '@game-presentation/contracts';
import { createCompositionPlanFromInformationPlan } from '@game-presentation/composition-engine';
import { retrieveReferencesForInformationPlan } from '@game-presentation/reference-engine';
import { createMec01InformationPlan, interpretMec01Source } from '../../source-ingestion/src/mec-01-semantic.js';
import { runHardGate } from '../src/hard-gate.js';
import { buildInformationRenderTree, informationMeasureRequests } from '../src/information-layout.js';
import type { FontAsset } from '../src/font.js';
import type { TextMeasurement } from '../src/measure.js';

const rawText = '회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%';

const fonts: FontAsset[] = [400, 700, 800].map((weight) => ({
  family: 'Pretendard',
  weight,
  path: `fixture-${weight}.ttf`,
  bytes: new Uint8Array(),
  fileHash: String(weight).padStart(64, '0'),
  dataUrl: 'data:font/ttf;base64,',
}));

function measurements(requests: ReturnType<typeof informationMeasureRequests>): Map<string, TextMeasurement> {
  return new Map(requests.map((request) => [request.key, {
    ...request,
    width: Math.max(request.size, request.text.length * request.size * 0.62),
    actualBoundingBoxAscent: request.size * 0.78,
    actualBoundingBoxDescent: request.size * 0.22,
  }]));
}

function validArtifacts(fragmentId?: string) {
  const slide = interpretMec01Source({ rawText, createdAt: '2026-08-29T00:00:00.000Z' });
  const informationPlan = createMec01InformationPlan(slide);
  const retrieval = retrieveReferencesForInformationPlan({
    slide,
    informationPlan,
    corpus: SEED_REFERENCE_CORPUS,
    audience: 'game-design-reviewer',
    outputProfile: 'pdf-presentation',
    avoidSignatures: ['card-dashboard'],
    limit: 3,
  });
  const plan = createCompositionPlanFromInformationPlan({
    slide,
    informationPlan,
    retrieval,
    // 새 phase Pattern의 Renderer primitive는 다음 승인 단계에서 정한다.
    // 이 기존 Renderer baseline은 승인된 threshold-field만 계속 검증한다.
    fragments: SEED_PATTERN_FRAGMENTS.filter(
      (fragment) => fragment.fragmentId === (fragmentId ?? 'pattern-break-threshold-field'),
    ),
  });
  const tree = buildInformationRenderTree({
    slide,
    informationPlan,
    plan,
    measures: measurements(informationMeasureRequests({ slide, informationPlan, plan })),
    fonts,
  });
  return { slide, informationPlan, retrieval, plan, tree };
}

describe('generic InformationPlan composition and render flow', () => {
  it('creates a composition plan without repeating semantic message or primary artifact fields', () => {
    const { slide, informationPlan, plan } = validArtifacts();

    expect(validateCompositionPlan(plan, slide, informationPlan, SEED_PATTERN_FRAGMENTS, SEED_REFERENCE_CORPUS)).toEqual([]);
    expect(plan.informationPlanId).toBe(informationPlan.informationPlanId);
    expect(plan).not.toHaveProperty('hypothesis');
    expect(plan.bindings.map((binding) => binding.blockId)).toEqual(informationPlan.readingOrder);
  });

  it('renders a fully traceable generic RenderTree that passes both Hard Gate validators', () => {
    const { slide, informationPlan, plan, tree } = validArtifacts();
    const gate = runHardGate({ slide, informationPlan, tree });

    expect(gate.passed).toBe(true);
    expect(gate.programFindings).toEqual([]);
    expect(gate.sourceFidelityFindings).toEqual([]);
    expect(tree.nodes.find((node) => node.nodeId === 'region-group-break-transition')?.kind).toBe('group');
    expect(tree.nodes.find((node) => node.nodeId === 'text-break-state-0')?.parentId).toBe('region-group-break-transition');
    const primaryText = tree.nodes.find((node) => node.nodeId === 'text-break-state-0');
    if (primaryText?.kind !== 'text') throw new Error('fixture error');
    expect(primaryText.font.size).toBe(plan.styleIntent.hierarchy.primaryTextSize);
    expect(primaryText.color).toBe(plan.styleIntent.accent.color);
    expect(tree.nodes.some((node) => node.nodeId === 'motif-threshold-marker')).toBe(true);
    expect(tree.nodes.some((node) => node.nodeId === 'connector-marker-dodge-step')).toBe(true);
  });

  it('creates structurally different RenderTrees for two allowed topology families', () => {
    const threshold = validArtifacts('pattern-break-threshold-field');
    const editorial = validArtifacts('pattern-editorial-causal-spine');

    expect(threshold.plan.layout.layoutFamily).toBe('threshold-field');
    expect(editorial.plan.layout.layoutFamily).toBe('editorial-causal-spine');
    expect(threshold.tree.nodes.some((node) => node.nodeId === 'motif-threshold-marker')).toBe(true);
    expect(editorial.tree.nodes.some((node) => node.nodeId === 'motif-causal-spine')).toBe(true);

    const thresholdRegions = threshold.tree.nodes
      .filter((node) => node.kind === 'group')
      .map((node) => ({ nodeId: node.nodeId, box: node.box }));
    const editorialRegions = editorial.tree.nodes
      .filter((node) => node.kind === 'group')
      .map((node) => ({ nodeId: node.nodeId, box: node.box }));
    expect(thresholdRegions).not.toEqual(editorialRegions);

    const thresholdBreak = threshold.tree.nodes.find((node) => node.nodeId === 'text-break-state-0');
    const editorialBreak = editorial.tree.nodes.find((node) => node.nodeId === 'text-break-state-0');
    expect(thresholdBreak?.box).not.toEqual(editorialBreak?.box);
    expect(runHardGate({ slide: threshold.slide, informationPlan: threshold.informationPlan, tree: threshold.tree }).passed).toBe(true);
    expect(runHardGate({ slide: editorial.slide, informationPlan: editorial.informationPlan, tree: editorial.tree }).passed).toBe(true);
  });

  it('keeps the threshold as a transition marker and makes the causal spine visibly sequential', () => {
    const threshold = validArtifacts('pattern-break-threshold-field');
    const spine = validArtifacts('pattern-editorial-causal-spine');
    const marker = threshold.tree.nodes.find((node) => node.nodeId === 'motif-threshold-marker');
    const thresholdRegion = threshold.tree.nodes.find((node) => node.nodeId === 'region-group-break-transition');
    if (marker?.kind !== 'shape' || thresholdRegion?.kind !== 'group') throw new Error('fixture error');
    expect(marker.box.height).toBeLessThan(thresholdRegion.box.height);
    expect(marker.box.width).toBeLessThan(thresholdRegion.box.width);

    const fragment = spine.tree.nodes.find((node) => node.nodeId === 'text-fragment-resource-0');
    const dodge = spine.tree.nodes.find((node) => node.nodeId === 'text-dodge-step-0');
    const breakText = spine.tree.nodes.find((node) => node.nodeId === 'text-break-state-0');
    const spineMarker = spine.tree.nodes.find((node) => node.nodeId === 'motif-spine-threshold');
    if (fragment?.kind !== 'text' || dodge?.kind !== 'text' || breakText?.kind !== 'text' || spineMarker?.kind !== 'shape') {
      throw new Error('fixture error');
    }
    expect(fragment.box.y).toBeGreaterThan(dodge.box.y);
    expect(breakText.box.y + breakText.box.height).toBeLessThan(spineMarker.box.y + spineMarker.box.height);
  });

  it('fails Source Fidelity when a rendered number or relation is altered', () => {
    const { slide, informationPlan, tree } = validArtifacts();
    const changedNumber = structuredClone(tree);
    const freeze = changedNumber.nodes.find((node) => node.nodeId === 'text-freeze-step-0');
    if (freeze?.kind !== 'text') throw new Error('fixture error');
    freeze.text = '시간 정지 6초';
    freeze.lines[0]!.text = '시간 정지 6초';
    expect(runHardGate({ slide, informationPlan, tree: changedNumber }).sourceFidelityFindings.some((finding) => finding.code === 'invented-number')).toBe(true);

    const missingRelation = structuredClone(tree);
    missingRelation.nodes = missingRelation.nodes.filter((node) => node.relationId !== 'r-freeze-break');
    expect(runHardGate({ slide, informationPlan, tree: missingRelation }).sourceFidelityFindings.some((finding) => finding.code === 'missing-relation')).toBe(true);
  });

  it('fails Program Validator for an out-of-bounds or colliding layout', () => {
    const { slide, informationPlan, tree } = validArtifacts();
    const outOfBounds = structuredClone(tree);
    outOfBounds.nodes[0]!.box.x = -1;
    expect(runHardGate({ slide, informationPlan, tree: outOfBounds }).programFindings.some((finding) => finding.code === 'out-of-bounds')).toBe(true);

    const colliding = structuredClone(tree);
    const first = colliding.nodes.find((node) => node.nodeId === 'text-dodge-step-0');
    const second = colliding.nodes.find((node) => node.nodeId === 'text-fragment-resource-0');
    if (first?.kind !== 'text' || second?.kind !== 'text') throw new Error('fixture error');
    second.box = { ...first.box };
    second.lines[0]!.x = first.lines[0]!.x;
    second.lines[0]!.baselineY = first.lines[0]!.baselineY;
    expect(runHardGate({ slide, informationPlan, tree: colliding }).programFindings.some((finding) => finding.code === 'collision')).toBe(true);
  });
});
