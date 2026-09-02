import { describe, expect, it } from 'vitest';
import {
  CompositionPlanSchema,
  PAGE_PROFILES,
  validateCompositionPlan,
} from '../src/composition.js';
import { RenderTreeSchema, validateRenderTreeAgainstSlide } from '../src/render-tree.js';
import { MEC_01_SLIDE_IR } from '../fixtures/mec-01.js';
import { InformationPlanSchema } from '../src/information-plan.js';
import { SEED_PATTERN_FRAGMENTS } from '../src/seed-patterns.js';
import { SEED_REFERENCE_CORPUS } from '../src/seed-corpus.js';

const fontHash = 'a'.repeat(64);

function textNode(
  nodeId: string,
  semanticBlockId: string,
  text: string,
  sourceSpanIds: string[],
  x: number,
) {
  return {
    nodeId,
    kind: 'text' as const,
    semanticBlockId,
    zIndex: 2,
    box: { x, y: 300, width: 160, height: 80 },
    clip: false,
    visible: true,
    text,
    sourceSpanIds,
    sourceTransform: { kind: 'exact' as const },
    font: {
      family: 'Pretendard',
      fileHash: fontHash,
      size: 28,
      weight: 700,
      lineHeight: 36,
      letterSpacing: 0,
    },
    color: '#222222',
    align: 'center' as const,
    lines: [{ text, x, baselineY: 340, advanceWidth: 120 }],
  };
}

function relationNode(nodeId: string, relationId: string, x: number) {
  return {
    nodeId,
    kind: 'shape' as const,
    relationId,
    zIndex: 1,
    box: { x, y: 330, width: 40, height: 2 },
    clip: false,
    visible: true,
    shape: 'line' as const,
    paint: { stroke: '#888888', strokeWidth: 2 },
  };
}

function validTree() {
  return RenderTreeSchema.parse({
    schemaVersion: '0.1',
    renderTreeId: 'render-mec-01-a',
    compositionPlanId: 'plan-mec-01-a',
    slideId: MEC_01_SLIDE_IR.slideId,
    pageProfile: PAGE_PROFILES.pdfPresentation,
    background: '#F4F1EA',
    deterministicFingerprint: 'b'.repeat(64),
    nodes: [
      textNode('text-dodge', 'dodge-step', '회피 ×3', ['dodge'], 120),
      textNode('text-fragment', 'fragment-resource', '시간 파편 획득', ['fragment'], 440),
      textNode('text-freeze', 'freeze-step', '시간 정지 5초', ['freeze'], 760),
      textNode('text-break', 'break-state', 'BREAK', ['break'], 1080),
      textNode('text-damage-label', 'damage-modifier', '받는 피해', ['damage-label'], 1400),
      textNode('text-damage-value', 'damage-modifier', '+50%', ['damage-value'], 1580),
      relationNode('line-1', 'r-dodge-fragment', 300),
      relationNode('line-2', 'r-fragment-freeze', 620),
      relationNode('line-3', 'r-freeze-break', 940),
      relationNode('line-4', 'r-break-damage', 1260),
    ],
  });
}

describe('RenderTree contract', () => {
  it('accepts a fully traceable in-bounds render tree', () => {
    expect(validateRenderTreeAgainstSlide(validTree(), MEC_01_SLIDE_IR)).toEqual([]);
  });

  it('accepts the optional render-contract metadata while keeping legacy nodes valid', () => {
    const tree = validTree();
    const text = tree.nodes.find((node) => node.kind === 'text');
    const relation = tree.nodes.find((node) => node.relationId !== undefined);
    if (text?.kind !== 'text' || relation === undefined) throw new Error('fixture error');
    text.compositionRegionId = 'phase-accumulation';
    text.visualRole = 'ordered-step';
    text.sourceUsage = 'content';
    relation.compositionRegionId = 'phase-accumulation';
    relation.visualRole = 'relation-carrier';
    relation.relationVisualRole = 'accumulation-local';

    const parsed = RenderTreeSchema.parse(tree);
    expect(parsed.nodes.find((node) => node.nodeId === text.nodeId)).toMatchObject({
      compositionRegionId: 'phase-accumulation',
      visualRole: 'ordered-step',
      sourceUsage: 'content',
    });
    expect(parsed.nodes.find((node) => node.nodeId === relation.nodeId)).toMatchObject({
      visualRole: 'relation-carrier',
      relationVisualRole: 'accumulation-local',
    });
  });

  it('fails closed when visible text is invented', () => {
    const tree = validTree();
    const target = tree.nodes.find((node) => node.nodeId === 'text-freeze');
    if (target?.kind !== 'text') throw new Error('fixture error');
    target.text = '시간 정지 6초';
    const findings = validateRenderTreeAgainstSlide(tree, MEC_01_SLIDE_IR);
    expect(findings.some((finding) => finding.code === 'untraceable-content')).toBe(true);
  });

  it('reports out-of-bounds geometry', () => {
    const tree = validTree();
    tree.nodes[0]!.box.x = -1;
    const findings = validateRenderTreeAgainstSlide(tree, MEC_01_SLIDE_IR);
    expect(findings.some((finding) => finding.code === 'out-of-bounds')).toBe(true);
  });

  it('rejects a repeated locked source fact even when every text node is traceable', () => {
    const tree = validTree();
    tree.nodes.push({
      ...textNode('text-dodge-copy', 'dodge-step', '회피 ×3', ['dodge'], 300),
      box: { x: 300, y: 500, width: 160, height: 80 },
      lines: [{ text: '회피 ×3', x: 300, baselineY: 540, advanceWidth: 120 }],
    });
    const findings = validateRenderTreeAgainstSlide(tree, MEC_01_SLIDE_IR);
    expect(findings.some((finding) => finding.code === 'duplicate-content')).toBe(true);
  });

  it('rejects a semantic shape that omits its locked source text', () => {
    const tree = validTree();
    tree.nodes = tree.nodes.filter((node) => node.nodeId !== 'text-break');
    tree.nodes.push({
      nodeId: 'break-shape-only',
      kind: 'shape',
      semanticBlockId: 'break-state',
      zIndex: 2,
      box: { x: 1080, y: 300, width: 160, height: 80 },
      clip: false,
      visible: true,
      shape: 'rect',
      paint: { fill: '#CC0000' },
    });
    const findings = validateRenderTreeAgainstSlide(tree, MEC_01_SLIDE_IR);
    expect(findings.some((finding) => finding.code === 'missing-source-content')).toBe(true);
  });
});

describe('CompositionPlan contract', () => {
  it('binds every authored block through permitted abstract references', () => {
    const informationPlan = InformationPlanSchema.parse({
      schemaVersion: '0.1',
      informationPlanId: 'information-mec-01',
      slideId: MEC_01_SLIDE_IR.slideId,
      semanticShape: 'causal-chain',
      grammarId: 'mechanism-causal-chain-v1',
      message: {
        text: MEC_01_SLIDE_IR.source.rawText,
        sourceSpanIds: ['source-all'],
        locked: true,
        transform: { kind: 'exact' },
      },
      primaryArtifactBlockId: 'break-state',
      readingOrder: MEC_01_SLIDE_IR.blocks.map((block) => block.id),
      groups: [
        { groupId: 'setup', role: 'setup', order: 0, blockIds: ['dodge-step', 'fragment-resource', 'freeze-step'] },
        { groupId: 'transition', role: 'transition', order: 1, blockIds: ['break-state'] },
        { groupId: 'consequence', role: 'consequence', order: 2, blockIds: ['damage-modifier'] },
      ],
      relationIds: MEC_01_SLIDE_IR.relations.map((relation) => relation.id),
      interpretation: { author: 'deterministic-planner', confidence: 1, ambiguityIds: [] },
    });
    const plan = CompositionPlanSchema.parse({
      schemaVersion: '0.1',
      planId: 'plan-mec-01-a',
      slideId: MEC_01_SLIDE_IR.slideId,
      informationPlanId: informationPlan.informationPlanId,
      seed: 17,
      pageProfile: PAGE_PROFILES.pdfPresentation,
      retrievalBriefId: 'brief-mec-01',
      referenceIds: ['ref-oh-my-ppt-layout', 'ref-marp-reproducible'],
      patternFragmentIds: ['pattern-editorial-causal-spine'],
      layout: {
        layoutFamily: 'editorial-causal-spine',
        readingPath: 'left-to-right',
        rationale: 'The authored content is a causal chain with one dominant state transition.',
      },
      regions: [
        {
          regionId: 'artifact',
          role: 'primary-artifact',
          flow: 'row',
          order: 0,
          weight: 1,
          gapToken: 'normal',
          paddingToken: 'open',
        },
      ],
      bindings: MEC_01_SLIDE_IR.blocks.map((block, index) => ({
        blockId: block.id,
        regionId: 'artifact',
        fragmentRole: block.role,
        prominence: block.importance,
        readingOrder: index,
      })),
      styleIntent: {
        tone: 'professional game-design document',
        contrastModel: 'quiet-field-strong-focus',
        hierarchy: {
          primaryTextSize: 68,
          supportTextSize: 30,
          evidenceTextSize: 40,
          primaryWeight: 800,
          supportWeight: 500,
        },
        accent: {
          targetRole: 'primary-artifact',
          color: '#5B5C8D',
          softColor: '#E3E2F0',
        },
        motif: {
          family: 'causal-spine',
          color: '#6A6B9B',
          strokeWidth: 5,
        },
        palette: {
          background: '#F5F3EE',
          ink: '#222522',
          mutedInk: '#686C68',
          connector: '#777A76',
        },
      },
      qualityFloor: {
        requireAllBlocks: true,
        requireAllRelations: true,
        maximumSevereFindings: 0,
        allowCandidateOmission: true,
      },
    });

    expect(
      validateCompositionPlan(plan, MEC_01_SLIDE_IR, informationPlan, SEED_PATTERN_FRAGMENTS, SEED_REFERENCE_CORPUS),
    ).toEqual([]);
  });
});
