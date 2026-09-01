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

function validArtifacts() {
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
    fragments: SEED_PATTERN_FRAGMENTS,
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
    const { slide, informationPlan, tree } = validArtifacts();
    const gate = runHardGate({ slide, informationPlan, tree });

    expect(gate.passed).toBe(true);
    expect(gate.programFindings).toEqual([]);
    expect(gate.sourceFidelityFindings).toEqual([]);
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
