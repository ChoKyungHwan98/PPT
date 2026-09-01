import {
  RenderTreeSchema,
  contentHash,
  type CompositionPlan,
  type ContentRef,
  type RenderNode,
  type RenderTree,
  type SemanticBlock,
  type SlideIR,
} from '@game-presentation/contracts';
import type { FontAsset } from './font.js';
import type { TextMeasureRequest, TextMeasurement } from './measure.js';
import { measuredTextNode, vectorNode } from './node-builders.js';

type MechanismAtoms = {
  trigger: { block: SemanticBlock; label: ContentRef };
  resource: { block: SemanticBlock; label: ContentRef };
  process: { block: SemanticBlock; label: ContentRef };
  focus: { block: SemanticBlock; label: ContentRef };
  consequence: { block: SemanticBlock; label: ContentRef; value: ContentRef };
};

function labelFor(block: SemanticBlock): ContentRef {
  if (block.kind === 'mechanic-step' || block.kind === 'resource-node') return block.label;
  if (block.kind === 'state') return block.name;
  if (block.kind === 'heading' || block.kind === 'paragraph') return block.text;
  if (block.kind === 'hierarchy-node') return block.label;
  throw new Error('이 mechanism layout이 지원하지 않는 block입니다: ' + block.kind);
}

function mechanismAtoms(slide: SlideIR): MechanismAtoms {
  const ordered = [...slide.blocks].sort((left, right) => left.order - right.order);
  if (ordered.length !== 5) {
    throw new Error('MEC-01 vertical slice는 5단계 mechanism만 지원합니다.');
  }
  const consequence = ordered[4]!;
  if (consequence.kind !== 'metric') {
    throw new Error('MEC-01 consequence는 metric이어야 합니다.');
  }
  return {
    trigger: { block: ordered[0]!, label: labelFor(ordered[0]!) },
    resource: { block: ordered[1]!, label: labelFor(ordered[1]!) },
    process: { block: ordered[2]!, label: labelFor(ordered[2]!) },
    focus: { block: ordered[3]!, label: labelFor(ordered[3]!) },
    consequence: {
      block: consequence,
      label: consequence.label,
      value: consequence.value,
    },
  };
}

function measurementKey(family: string, name: string): string {
  return family + ':' + name;
}

const TYPOGRAPHY = {
  'editorial-causal-spine': {
    trigger: { weight: 800, size: 64, letterSpacing: -1 },
    resource: { weight: 700, size: 32, letterSpacing: -0.4 },
    process: { weight: 800, size: 60, letterSpacing: -1 },
    focus: { weight: 800, size: 64, letterSpacing: 0.5 },
    consequenceLabel: { weight: 700, size: 32, letterSpacing: -0.4 },
    consequenceValue: { weight: 800, size: 120, letterSpacing: -1 },
  },
  'threshold-field': {
    trigger: { weight: 700, size: 34, letterSpacing: -0.3 },
    resource: { weight: 700, size: 30, letterSpacing: -0.3 },
    process: { weight: 800, size: 56, letterSpacing: -1 },
    focus: { weight: 800, size: 96, letterSpacing: 1 },
    consequenceLabel: { weight: 700, size: 32, letterSpacing: -0.3 },
    consequenceValue: { weight: 800, size: 110, letterSpacing: -1 },
  },
} as const;

export function mechanismMeasureRequests(
  slide: SlideIR,
  plans: CompositionPlan[],
): TextMeasureRequest[] {
  const atoms = mechanismAtoms(slide);
  return plans.flatMap((plan) => {
    const family = plan.hypothesis.topologyFamily;
    if (!(family in TYPOGRAPHY)) return [];
    const typography = TYPOGRAPHY[family as keyof typeof TYPOGRAPHY];
    const requests = [
      { name: 'trigger', text: atoms.trigger.label.text, style: typography.trigger },
      { name: 'resource', text: atoms.resource.label.text, style: typography.resource },
      { name: 'process', text: atoms.process.label.text, style: typography.process },
      { name: 'focus', text: atoms.focus.label.text, style: typography.focus },
      {
        name: 'consequence-label',
        text: atoms.consequence.label.text,
        style: typography.consequenceLabel,
      },
      {
        name: 'consequence-value',
        text: atoms.consequence.value.text,
        style: typography.consequenceValue,
      },
    ];
    return requests.map(({ name, text, style }) => ({
      key: measurementKey(family, name),
      text,
      family: 'Pretendard',
      weight: style.weight,
      size: style.size,
      letterSpacing: style.letterSpacing,
    }));
  });
}

function requiredMeasure(
  measures: Map<string, TextMeasurement>,
  family: string,
  name: string,
): TextMeasurement {
  const value = measures.get(measurementKey(family, name));
  if (value === undefined) throw new Error('text measurement가 없습니다: ' + family + ':' + name);
  return value;
}

function relationId(slide: SlideIR, fromBlockId: string, toBlockId: string): string {
  const relation = slide.relations.find(
    (candidate) =>
      candidate.fromBlockId === fromBlockId && candidate.toBlockId === toBlockId,
  );
  if (relation === undefined) throw new Error('필요한 mechanism relation이 없습니다.');
  return relation.id;
}

function text(
  nodes: RenderNode[],
  input: Parameters<typeof measuredTextNode>[0],
): void {
  nodes.push(measuredTextNode(input));
}

function editorialTree(input: {
  slide: SlideIR;
  plan: CompositionPlan;
  measures: Map<string, TextMeasurement>;
  fonts: FontAsset[];
}): RenderTree {
  const family = 'editorial-causal-spine';
  const atoms = mechanismAtoms(input.slide);
  const nodes: RenderNode[] = [];
  const palette = {
    background: '#F2EFE8',
    ink: '#1E2326',
    muted: '#747A78',
    rule: '#C9C3B8',
    teal: '#23766F',
    tealPale: '#CDE5DF',
    coral: '#C54737',
    coralPale: '#E9C8C1',
    white: '#FFFDF8',
  };

  text(nodes, {
    nodeId: 'editorial-trigger-label',
    semanticBlockId: atoms.trigger.block.id,
    text: atoms.trigger.label.text,
    sourceSpanIds: atoms.trigger.label.sourceSpanIds,
    x: 130,
    baselineY: 330,
    align: 'start',
    color: palette.ink,
    measurement: requiredMeasure(input.measures, family, 'trigger'),
    fonts: input.fonts,
  });
  const pulseXs = [175, 275, 375];
  pulseXs.forEach((x, index) => {
    nodes.push(
      vectorNode({
        nodeId: 'editorial-pulse-' + String(index),
        shape: 'line',
        box: { x, y: 430 - index * 34, width: 1, height: 180 + index * 34 },
        stroke: palette.teal,
        strokeWidth: 10,
        semanticBlockId: atoms.trigger.block.id,
        zIndex: 3,
      }),
      vectorNode({
        nodeId: 'editorial-pulse-dot-' + String(index),
        shape: 'ellipse',
        box: { x: x - 13, y: 590 - 13, width: 26, height: 26 },
        fill: palette.teal,
        semanticBlockId: atoms.trigger.block.id,
        zIndex: 4,
      }),
    );
  });
  nodes.push(
    vectorNode({
      nodeId: 'editorial-relation-1',
      shape: 'path',
      box: { x: 390, y: 510, width: 200, height: 110 },
      stroke: palette.teal,
      strokeWidth: 5,
      pathData: 'M390 590 C455 590 500 545 565 545',
      relationId: relationId(input.slide, atoms.trigger.block.id, atoms.resource.block.id),
      zIndex: 2,
    }),
    vectorNode({
      nodeId: 'editorial-fragment',
      shape: 'path',
      box: { x: 540, y: 505, width: 80, height: 80 },
      fill: palette.teal,
      pathData: 'M580 505 L620 545 L580 585 L540 545 Z',
      semanticBlockId: atoms.resource.block.id,
      zIndex: 4,
    }),
  );
  text(nodes, {
    nodeId: 'editorial-resource-label',
    semanticBlockId: atoms.resource.block.id,
    text: atoms.resource.label.text,
    sourceSpanIds: atoms.resource.label.sourceSpanIds,
    x: 580,
    baselineY: 660,
    align: 'center',
    color: palette.ink,
    measurement: requiredMeasure(input.measures, family, 'resource'),
    fonts: input.fonts,
  });

  nodes.push(
    vectorNode({
      nodeId: 'editorial-relation-2',
      shape: 'path',
      box: { x: 620, y: 360, width: 210, height: 190 },
      stroke: palette.teal,
      strokeWidth: 5,
      pathData: 'M620 545 C710 545 720 430 830 430',
      relationId: relationId(input.slide, atoms.resource.block.id, atoms.process.block.id),
      zIndex: 2,
    }),
    vectorNode({
      nodeId: 'editorial-time-field',
      shape: 'ellipse',
      box: { x: 780, y: 270, width: 390, height: 390 },
      stroke: palette.teal,
      strokeWidth: 4,
      semanticBlockId: atoms.process.block.id,
      zIndex: 1,
    }),
    vectorNode({
      nodeId: 'editorial-time-arc',
      shape: 'path',
      box: { x: 830, y: 320, width: 290, height: 290 },
      stroke: palette.teal,
      strokeWidth: 8,
      opacity: 0.45,
      pathData: 'M975 320 A145 145 0 0 1 1120 465',
      semanticBlockId: atoms.process.block.id,
      zIndex: 3,
    }),
  );
  text(nodes, {
    nodeId: 'editorial-process-label',
    semanticBlockId: atoms.process.block.id,
    text: atoms.process.label.text,
    sourceSpanIds: atoms.process.label.sourceSpanIds,
    x: 975,
    baselineY: 500,
    align: 'center',
    color: palette.ink,
    measurement: requiredMeasure(input.measures, family, 'process'),
    fonts: input.fonts,
    zIndex: 5,
  });

  nodes.push(
    vectorNode({
      nodeId: 'editorial-break-field',
      shape: 'rect',
      box: { x: 1190, y: 185, width: 18, height: 725 },
      fill: palette.coral,
      semanticBlockId: atoms.focus.block.id,
      zIndex: 1,
    }),
    vectorNode({
      nodeId: 'editorial-relation-3',
      shape: 'path',
      box: { x: 1150, y: 185, width: 80, height: 725 },
      stroke: palette.coral,
      strokeWidth: 12,
      pathData: 'M1190 185 L1160 355 L1210 465 L1165 595 L1215 705 L1185 910',
      relationId: relationId(input.slide, atoms.process.block.id, atoms.focus.block.id),
      zIndex: 6,
    }),
  );
  text(nodes, {
    nodeId: 'editorial-focus-label',
    semanticBlockId: atoms.focus.block.id,
    text: atoms.focus.label.text,
    sourceSpanIds: atoms.focus.label.sourceSpanIds,
    x: 1260,
    baselineY: 360,
    align: 'start',
    color: palette.coral,
    measurement: requiredMeasure(input.measures, family, 'focus'),
    fonts: input.fonts,
    zIndex: 7,
  });

  nodes.push(
    vectorNode({
      nodeId: 'editorial-result-wash',
      shape: 'rect',
      box: { x: 1450, y: 275, width: 360, height: 495 },
      fill: palette.coralPale,
      opacity: 0.55,
      semanticBlockId: atoms.consequence.block.id,
      zIndex: 1,
    }),
    vectorNode({
      nodeId: 'editorial-relation-4',
      shape: 'line',
      box: { x: 1208, y: 575, width: 552, height: 1 },
      stroke: palette.coral,
      strokeWidth: 7,
      relationId: relationId(input.slide, atoms.focus.block.id, atoms.consequence.block.id),
      zIndex: 3,
    }),
  );
  text(nodes, {
    nodeId: 'editorial-consequence-value',
    semanticBlockId: atoms.consequence.block.id,
    text: atoms.consequence.value.text,
    sourceSpanIds: atoms.consequence.value.sourceSpanIds,
    x: 1635,
    baselineY: 550,
    align: 'center',
    color: palette.coral,
    measurement: requiredMeasure(input.measures, family, 'consequence-value'),
    fonts: input.fonts,
    zIndex: 6,
  });
  text(nodes, {
    nodeId: 'editorial-consequence-label',
    semanticBlockId: atoms.consequence.block.id,
    text: atoms.consequence.label.text,
    sourceSpanIds: atoms.consequence.label.sourceSpanIds,
    x: 1635,
    baselineY: 625,
    align: 'center',
    color: palette.ink,
    measurement: requiredMeasure(input.measures, family, 'consequence-label'),
    fonts: input.fonts,
    zIndex: 6,
  });

  return RenderTreeSchema.parse({
    schemaVersion: '0.1',
    renderTreeId: 'render-' + input.plan.planId,
    compositionPlanId: input.plan.planId,
    slideId: input.slide.slideId,
    pageProfile: input.plan.pageProfile,
    background: palette.background,
    nodes,
    deterministicFingerprint: contentHash({
      plan: input.plan,
      fonts: input.fonts.map((font) => font.fileHash),
      layoutVersion: 'editorial-causal-spine-v1',
    }),
  });
}

function thresholdTree(input: {
  slide: SlideIR;
  plan: CompositionPlan;
  measures: Map<string, TextMeasurement>;
  fonts: FontAsset[];
}): RenderTree {
  const family = 'threshold-field';
  const atoms = mechanismAtoms(input.slide);
  const nodes: RenderNode[] = [];
  const palette = {
    background: '#0A2030',
    ink: '#F4F1E8',
    muted: '#76A3AE',
    grid: '#234252',
    mint: '#95EADB',
    mintField: '#153E49',
    coral: '#FF6A5D',
    coralField: '#5B343A',
  };
  for (const y of [250, 430, 610, 790]) {
    nodes.push(
      vectorNode({
        nodeId: 'threshold-grid-' + String(y),
        shape: 'line',
        box: { x: 120, y, width: 1680, height: 1 },
        stroke: palette.grid,
        strokeWidth: 1,
        opacity: 0.6,
        zIndex: 0,
      }),
    );
  }
  nodes.push(
    vectorNode({
      nodeId: 'threshold-trigger-flow',
      shape: 'path',
      box: { x: 150, y: 475, width: 300, height: 180 },
      stroke: palette.mint,
      strokeWidth: 7,
      pathData:
        'M150 635 L205 635 C225 635 225 550 250 550 C275 550 275 635 300 635 ' +
        'C325 635 325 500 355 500 C385 500 385 635 415 635 L450 635',
      semanticBlockId: atoms.trigger.block.id,
      zIndex: 3,
    }),
  );
  text(nodes, {
    nodeId: 'threshold-trigger-label',
    semanticBlockId: atoms.trigger.block.id,
    text: atoms.trigger.label.text,
    sourceSpanIds: atoms.trigger.label.sourceSpanIds,
    x: 150,
    baselineY: 455,
    align: 'start',
    color: palette.mint,
    measurement: requiredMeasure(input.measures, family, 'trigger'),
    fonts: input.fonts,
  });
  nodes.push(
    vectorNode({
      nodeId: 'threshold-relation-1',
      shape: 'line',
      box: { x: 450, y: 635, width: 90, height: 1 },
      stroke: palette.mint,
      strokeWidth: 7,
      relationId: relationId(input.slide, atoms.trigger.block.id, atoms.resource.block.id),
    }),
    vectorNode({
      nodeId: 'threshold-fragment',
      shape: 'path',
      box: { x: 520, y: 595, width: 80, height: 80 },
      fill: palette.mint,
      pathData: 'M560 595 L600 635 L560 675 L520 635 Z',
      semanticBlockId: atoms.resource.block.id,
      zIndex: 4,
    }),
  );
  text(nodes, {
    nodeId: 'threshold-resource-label',
    semanticBlockId: atoms.resource.block.id,
    text: atoms.resource.label.text,
    sourceSpanIds: atoms.resource.label.sourceSpanIds,
    x: 560,
    baselineY: 735,
    align: 'center',
    color: palette.ink,
    measurement: requiredMeasure(input.measures, family, 'resource'),
    fonts: input.fonts,
  });
  nodes.push(
    vectorNode({
      nodeId: 'threshold-relation-2',
      shape: 'line',
      box: { x: 600, y: 635, width: 90, height: 1 },
      stroke: palette.mint,
      strokeWidth: 7,
      relationId: relationId(input.slide, atoms.resource.block.id, atoms.process.block.id),
    }),
    vectorNode({
      nodeId: 'threshold-time-field',
      shape: 'line',
      box: { x: 690, y: 635, width: 400, height: 1 },
      stroke: palette.mint,
      strokeWidth: 6,
      semanticBlockId: atoms.process.block.id,
      zIndex: 1,
    }),
  );
  [0, 1, 2, 3, 4, 5].forEach((index) => {
    nodes.push(
      vectorNode({
        nodeId: 'threshold-time-tick-' + String(index),
        shape: 'line',
        box: { x: 690 + index * 80, y: 390, width: 1, height: 300 },
        stroke: palette.muted,
        strokeWidth: index === 0 || index === 5 ? 3 : 1,
        opacity: index === 0 || index === 5 ? 0.8 : 0.45,
        semanticBlockId: atoms.process.block.id,
      }),
    );
  });
  text(nodes, {
    nodeId: 'threshold-process-label',
    semanticBlockId: atoms.process.block.id,
    text: atoms.process.label.text,
    sourceSpanIds: atoms.process.label.sourceSpanIds,
    x: 890,
    baselineY: 585,
    align: 'center',
    color: palette.ink,
    measurement: requiredMeasure(input.measures, family, 'process'),
    fonts: input.fonts,
  });
  nodes.push(
    vectorNode({
      nodeId: 'threshold-fracture',
      shape: 'path',
      box: { x: 1085, y: 245, width: 120, height: 600 },
      stroke: palette.coral,
      strokeWidth: 12,
      pathData: 'M1140 245 L1105 395 L1175 500 L1110 610 L1170 700 L1135 845',
      semanticBlockId: atoms.focus.block.id,
      relationId: relationId(input.slide, atoms.process.block.id, atoms.focus.block.id),
      zIndex: 5,
    }),
  );
  text(nodes, {
    nodeId: 'threshold-focus-label',
    semanticBlockId: atoms.focus.block.id,
    text: atoms.focus.label.text,
    sourceSpanIds: atoms.focus.label.sourceSpanIds,
    x: 1195,
    baselineY: 385,
    align: 'start',
    color: palette.coral,
    measurement: requiredMeasure(input.measures, family, 'focus'),
    fonts: input.fonts,
    zIndex: 7,
  });
  nodes.push(
    vectorNode({
      nodeId: 'threshold-relation-4',
      shape: 'line',
      box: { x: 1160, y: 635, width: 620, height: 1 },
      stroke: palette.coral,
      strokeWidth: 7,
      relationId: relationId(input.slide, atoms.focus.block.id, atoms.consequence.block.id),
      zIndex: 3,
    }),
  );
  text(nodes, {
    nodeId: 'threshold-consequence-value',
    semanticBlockId: atoms.consequence.block.id,
    text: atoms.consequence.value.text,
    sourceSpanIds: atoms.consequence.value.sourceSpanIds,
    x: 1570,
    baselineY: 615,
    align: 'center',
    color: palette.coral,
    measurement: requiredMeasure(input.measures, family, 'consequence-value'),
    fonts: input.fonts,
  });
  text(nodes, {
    nodeId: 'threshold-consequence-label',
    semanticBlockId: atoms.consequence.block.id,
    text: atoms.consequence.label.text,
    sourceSpanIds: atoms.consequence.label.sourceSpanIds,
    x: 1570,
    baselineY: 685,
    align: 'center',
    color: palette.ink,
    measurement: requiredMeasure(input.measures, family, 'consequence-label'),
    fonts: input.fonts,
  });
  return RenderTreeSchema.parse({
    schemaVersion: '0.1',
    renderTreeId: 'render-' + input.plan.planId,
    compositionPlanId: input.plan.planId,
    slideId: input.slide.slideId,
    pageProfile: input.plan.pageProfile,
    background: palette.background,
    nodes,
    deterministicFingerprint: contentHash({
      plan: input.plan,
      fonts: input.fonts.map((font) => font.fileHash),
      layoutVersion: 'threshold-field-v1',
    }),
  });
}

export function buildMechanismRenderTree(input: {
  slide: SlideIR;
  plan: CompositionPlan;
  measures: Map<string, TextMeasurement>;
  fonts: FontAsset[];
}): RenderTree {
  if (input.plan.hypothesis.topologyFamily === 'editorial-causal-spine') {
    return editorialTree(input);
  }
  if (input.plan.hypothesis.topologyFamily === 'threshold-field') {
    return thresholdTree(input);
  }
  throw new Error('지원하지 않는 mechanism topology입니다: ' + input.plan.hypothesis.topologyFamily);
}
