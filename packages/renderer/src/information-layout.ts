import {
  RenderTreeSchema,
  contentHash,
  type CompositionPlan,
  type ContentRef,
  type InformationPlan,
  type RenderNode,
  type SemanticBlock,
  type SlideIR,
} from '@game-presentation/contracts';
import type { FontAsset } from './font.js';
import type { TextMeasureRequest, TextMeasurement } from './measure.js';
import { measuredTextNode, vectorNode } from './node-builders.js';
import { alignedFeatureMeasureRequests, buildAlignedFeatureRenderTree } from './aligned-feature-layout.js';
import {
  classifyRelationVisualRole,
  messagePresentationRecord,
  resolveMessagePresentation,
} from './render-contract.js';

type Region = CompositionPlan['regions'][number];
type Binding = CompositionPlan['bindings'][number];
type Box = RenderNode['box'];
type RegionPlacement = { region: Region; box: Box };

export type AccumulationLayoutPolishProfile =
  | 'balanced-runway'
  | 'balanced-runway-expanded'
  | 'balanced-runway-gentle-buildup'
  | 'balanced-runway-final'
  | 'balanced-runway-revision-1';

type AccumulationLayoutPolishSpec = {
  contentTop: number;
  contentHeight: number;
  contentSide: number;
  regionGap: number;
  accumulationTrackRatio: number;
  accumulationRiseRatio: number;
  accumulationBracketOffset: number;
  accumulationBracketOpacity: number;
  accumulationMarkerDiameter: number;
  accumulationFinalMarkerDiameter: number;
  thresholdYOffset: number;
  thresholdTextOffset: number;
  thresholdBoundaryRatio: number;
  thresholdMarkerDiameter: number;
  consequenceYOffset: number;
  consequenceAxisAbove: number;
  consequenceAxisBelow: number;
  consequenceTextInset: number;
  consequenceLineGap: number;
};

const ACCUMULATION_LAYOUT_POLISH: Record<AccumulationLayoutPolishProfile, AccumulationLayoutPolishSpec> = {
  'balanced-runway': {
    contentTop: 0.16,
    contentHeight: 0.66,
    contentSide: 0.07,
    regionGap: 0.018,
    accumulationTrackRatio: 0.5,
    accumulationRiseRatio: 0,
    accumulationBracketOffset: 54,
    accumulationBracketOpacity: 0.26,
    accumulationMarkerDiameter: 12,
    accumulationFinalMarkerDiameter: 12,
    thresholdYOffset: 0,
    thresholdTextOffset: 58,
    thresholdBoundaryRatio: 0.42,
    thresholdMarkerDiameter: 32,
    consequenceYOffset: 0,
    consequenceAxisAbove: 76,
    consequenceAxisBelow: 88,
    consequenceTextInset: 34,
    consequenceLineGap: 14,
  },
  'balanced-runway-expanded': {
    contentTop: 0.14,
    contentHeight: 0.72,
    contentSide: 0.045,
    regionGap: 0.014,
    accumulationTrackRatio: 0.5,
    accumulationRiseRatio: 0,
    accumulationBracketOffset: 48,
    accumulationBracketOpacity: 0.38,
    accumulationMarkerDiameter: 13,
    accumulationFinalMarkerDiameter: 16,
    thresholdYOffset: 0,
    thresholdTextOffset: 60,
    thresholdBoundaryRatio: 0.4,
    thresholdMarkerDiameter: 34,
    consequenceYOffset: 0,
    consequenceAxisAbove: 84,
    consequenceAxisBelow: 96,
    consequenceTextInset: 30,
    consequenceLineGap: 7,
  },
  'balanced-runway-gentle-buildup': {
    contentTop: 0.14,
    contentHeight: 0.72,
    contentSide: 0.045,
    regionGap: 0.014,
    accumulationTrackRatio: 0.54,
    accumulationRiseRatio: -0.065,
    accumulationBracketOffset: 48,
    accumulationBracketOpacity: 0.38,
    accumulationMarkerDiameter: 13,
    accumulationFinalMarkerDiameter: 16,
    thresholdYOffset: 0,
    thresholdTextOffset: 60,
    thresholdBoundaryRatio: 0.4,
    thresholdMarkerDiameter: 34,
    consequenceYOffset: 8,
    consequenceAxisAbove: 84,
    consequenceAxisBelow: 96,
    consequenceTextInset: 30,
    consequenceLineGap: 7,
  },
  'balanced-runway-final': {
    contentTop: 0.135,
    contentHeight: 0.73,
    contentSide: 0.04,
    regionGap: 0.013,
    accumulationTrackRatio: 0.54,
    accumulationRiseRatio: -0.055,
    accumulationBracketOffset: 44,
    accumulationBracketOpacity: 0.44,
    accumulationMarkerDiameter: 13,
    accumulationFinalMarkerDiameter: 16,
    thresholdYOffset: 0,
    thresholdTextOffset: 60,
    thresholdBoundaryRatio: 0.4,
    thresholdMarkerDiameter: 34,
    consequenceYOffset: 6,
    consequenceAxisAbove: 88,
    consequenceAxisBelow: 100,
    consequenceTextInset: 28,
    consequenceLineGap: 5,
  },
  'balanced-runway-revision-1': {
    contentTop: 0.11,
    contentHeight: 0.78,
    contentSide: 0.032,
    regionGap: 0.012,
    accumulationTrackRatio: 0.54,
    accumulationRiseRatio: -0.055,
    accumulationBracketOffset: 52,
    accumulationBracketOpacity: 0.44,
    accumulationMarkerDiameter: 13,
    accumulationFinalMarkerDiameter: 16,
    thresholdYOffset: 0,
    thresholdTextOffset: 60,
    thresholdBoundaryRatio: 0.46,
    thresholdMarkerDiameter: 34,
    consequenceYOffset: 0,
    consequenceAxisAbove: 104,
    consequenceAxisBelow: 116,
    consequenceTextInset: 28,
    consequenceLineGap: 5,
  },
};

const DEFAULT_ACCUMULATION_LAYOUT_POLISH: AccumulationLayoutPolishProfile = 'balanced-runway-final';
type BlockPlacement = {
  binding: Binding;
  region: Region;
  parentId: string;
  x: number;
  baselineY: number;
  connectorY: number;
};

function contentRefsForBlock(block: SemanticBlock): ContentRef[] {
  switch (block.kind) {
    case 'heading':
    case 'paragraph': return [block.text];
    case 'bullet-group': return block.items;
    case 'metric': return [block.label, block.value, ...(block.unit === undefined ? [] : [block.unit])];
    case 'key-value': return [block.key, block.value];
    case 'table': return [...block.columns, ...block.rows.flat()];
    case 'mechanic-step': return [block.label, ...(block.detail === undefined ? [] : [block.detail])];
    case 'state': return [block.name, ...(block.description === undefined ? [] : [block.description])];
    case 'timeline-event': return [block.label, ...(block.time === undefined ? [] : [block.time])];
    case 'boss-phase': return [block.label, block.threshold, ...block.behaviors];
    case 'resource-node': return [block.label, ...(block.amount === undefined ? [] : [block.amount])];
    case 'hierarchy-node': return [block.label];
    case 'ui-region': return [block.regionLabel, block.explanation];
    case 'exception': return [block.condition, block.outcome];
    case 'test-criterion': return [block.criterion, ...(block.target === undefined ? [] : [block.target])];
  }
}

function measureKey(blockId: string, index: number): string {
  return `information:${blockId}:${index}`;
}

const MESSAGE_MEASURE_KEY = 'information:message-context';

function requirePlanForInformation(plan: CompositionPlan, informationPlan: InformationPlan): void {
  if (plan.informationPlanId !== informationPlan.informationPlanId) {
    throw new Error('다른 InformationPlan의 CompositionPlan을 렌더링할 수 없습니다.');
  }
}

function styleForBinding(input: {
  plan: CompositionPlan;
  binding: Binding;
  region: Region;
  refIndex: number;
  block: SemanticBlock;
}): Pick<TextMeasureRequest, 'weight' | 'size' | 'letterSpacing'> {
  const hierarchy = input.plan.styleIntent.hierarchy;
  const isPrimary = input.region.role === 'primary-artifact';
  const isEvidence = input.region.role === 'evidence';
  const isConsequenceMetric =
    input.region.regionId === 'phase-consequence' && input.block.kind === 'metric';
  let size = isPrimary
    ? hierarchy.primaryTextSize
    : isEvidence
      ? hierarchy.evidenceTextSize
      : hierarchy.supportTextSize;
  if (isConsequenceMetric && input.refIndex === 1) {
    size = Math.min(hierarchy.primaryTextSize - 8, hierarchy.evidenceTextSize + 12);
  }
  else if (input.binding.fragmentRole === 'modifier' && input.refIndex === 1) size += 12;
  else if (!isPrimary) size += Math.max(-2, input.binding.prominence - 3) * 2;
  const weight = isPrimary || (isConsequenceMetric && input.refIndex === 1) || input.binding.prominence >= 4
    ? hierarchy.primaryWeight
    : hierarchy.supportWeight;
  return { weight, size, letterSpacing: size >= 60 ? -0.8 : size >= 40 ? -0.5 : -0.25 };
}

/** Text measurement follows Composition bindings and hierarchy, not InformationPlan readingOrder. */
export function informationMeasureRequests(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  plan: CompositionPlan;
}): TextMeasureRequest[] {
  requirePlanForInformation(input.plan, input.informationPlan);
  if (input.plan.layout.layoutFamily === 'aligned-before-after-spec') return alignedFeatureMeasureRequests(input);
  const regions = new Map(input.plan.regions.map((region) => [region.regionId, region]));
  const blockRequests = [...input.plan.bindings]
    .sort((left, right) => left.readingOrder - right.readingOrder)
    .flatMap((binding) => {
      const block = input.slide.blocks.find((candidate) => candidate.id === binding.blockId);
      const region = regions.get(binding.regionId);
      if (block === undefined) throw new Error(`SlideIR block을 찾을 수 없습니다: ${binding.blockId}`);
      if (region === undefined) throw new Error(`Composition region을 찾을 수 없습니다: ${binding.regionId}`);
      return contentRefsForBlock(block).map((ref, index) => ({
        key: measureKey(block.id, index),
        text: ref.text,
        family: 'Pretendard',
        ...styleForBinding({ plan: input.plan, binding, region, refIndex: index, block }),
      }));
    });
  if (input.plan.layout.layoutFamily !== 'accumulation-threshold-consequence') {
    return blockRequests;
  }
  const presentation = resolveMessagePresentation({
    message: input.informationPlan.message,
    slide: input.slide,
  });
  if (presentation.presentationKind === 'suppressed-duplicate') return blockRequests;
  const hierarchy = input.plan.styleIntent.hierarchy;
  const size = presentation.presentationKind === 'headline'
    ? Math.min(hierarchy.primaryTextSize, hierarchy.supportTextSize + 12)
    : Math.max(16, hierarchy.supportTextSize - 4);
  return [{
    key: MESSAGE_MEASURE_KEY,
    text: presentation.text,
    family: 'Pretendard',
    weight: presentation.presentationKind === 'headline'
      ? hierarchy.primaryWeight
      : hierarchy.supportWeight,
    size,
    letterSpacing: size >= 40 ? -0.5 : -0.25,
  }, ...blockRequests];
}

function requiredMeasurement(measures: Map<string, TextMeasurement>, blockId: string, index: number): TextMeasurement {
  const measurement = measures.get(measureKey(blockId, index));
  if (measurement === undefined) throw new Error(`텍스트 측정값을 찾을 수 없습니다: ${measureKey(blockId, index)}`);
  return measurement;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function gapFor(token: Region['gapToken'], scale: number): number {
  return ({ none: 0, tight: 16, normal: 30, open: 50 } as const)[token] * scale;
}

function paddingFor(token: Region['paddingToken'], scale: number): number {
  return ({ none: 0, tight: 18, normal: 34, open: 54 } as const)[token] * scale;
}

function allocateHorizontal(regions: Region[], box: Box, gap: number): RegionPlacement[] {
  if (regions.length === 0) return [];
  const totalWeight = regions.reduce((sum, region) => sum + region.weight, 0);
  const usableWidth = box.width - gap * Math.max(0, regions.length - 1);
  let x = box.x;
  return regions.map((region, index) => {
    const width = index === regions.length - 1
      ? box.x + box.width - x
      : usableWidth * (region.weight / totalWeight);
    const placement = { region, box: { x, y: box.y, width: Math.max(1, width), height: box.height } };
    x += width + gap;
    return placement;
  });
}

function allocateVertical(regions: Region[], box: Box, gap: number): RegionPlacement[] {
  if (regions.length === 0) return [];
  const totalWeight = regions.reduce((sum, region) => sum + region.weight, 0);
  const usableHeight = box.height - gap * Math.max(0, regions.length - 1);
  let y = box.y;
  return regions.map((region, index) => {
    const height = index === regions.length - 1
      ? box.y + box.height - y
      : usableHeight * (region.weight / totalWeight);
    const placement = { region, box: { x: box.x, y, width: box.width, height: Math.max(1, height) } };
    y += height + gap;
    return placement;
  });
}

function auxiliaryRegionPlacements(plan: CompositionPlan): RegionPlacement[] {
  const width = plan.pageProfile.width;
  const height = plan.pageProfile.height;
  return plan.regions
    .filter((region) => ['message', 'navigation', 'annotation'].includes(region.role))
    .map((region) => region.role === 'navigation'
      ? { region, box: { x: width * 0.055, y: height * 0.92, width: width * 0.89, height: height * 0.045 } }
      : { region, box: { x: width * 0.055, y: height * 0.055, width: width * 0.89, height: height * 0.09 } });
}

function thresholdFieldRegions(plan: CompositionPlan, contentRegions: Region[]): RegionPlacement[] {
  const width = plan.pageProfile.width;
  const height = plan.pageProfile.height;
  const primary = contentRegions.find((region) => region.role === 'primary-artifact');
  if (primary === undefined) {
    return allocateHorizontal(contentRegions, { x: width * 0.06, y: height * 0.18, width: width * 0.88, height: height * 0.68 }, width * 0.018);
  }
  const primaryCenterRatio = plan.layout.readingPath === 'center-out' ? 0.61 : 0.52;
  const primaryWidth = clamp(width * (0.075 + primary.weight * 0.025), width * 0.105, width * 0.145);
  const primaryBox: Box = {
    x: width * primaryCenterRatio - primaryWidth / 2,
    y: height * 0.36,
    width: primaryWidth,
    height: height * 0.22,
  };
  const before = contentRegions.filter((region) => region.order < primary.order);
  const after = contentRegions.filter((region) => region.order > primary.order);
  const sideY = height * 0.31;
  const sideHeight = height * 0.34;
  const gutter = width * 0.045;
  const leftBox: Box = {
    x: width * 0.06,
    y: sideY,
    width: Math.max(1, primaryBox.x - gutter - width * 0.06),
    height: sideHeight,
  };
  const rightX = primaryBox.x + primaryBox.width + gutter;
  const rightBox: Box = {
    x: rightX,
    y: sideY,
    width: Math.max(1, width * 0.94 - rightX),
    height: sideHeight,
  };
  return [
    ...allocateHorizontal(before, leftBox, width * 0.018),
    { region: primary, box: primaryBox },
    ...allocateHorizontal(after, rightBox, width * 0.018),
  ];
}

function causalSpineRegions(plan: CompositionPlan, contentRegions: Region[]): RegionPlacement[] {
  const width = plan.pageProfile.width;
  const height = plan.pageProfile.height;
  return allocateHorizontal(
    contentRegions,
    { x: width * 0.065, y: height * 0.4, width: width * 0.87, height: height * 0.18 },
    width * 0.03,
  );
}

function accumulationThresholdConsequenceRegions(
  plan: CompositionPlan,
  contentRegions: Region[],
  polish: AccumulationLayoutPolishSpec,
): RegionPlacement[] {
  const width = plan.pageProfile.width;
  const height = plan.pageProfile.height;
  return allocateHorizontal(
    contentRegions,
    {
      x: width * polish.contentSide,
      y: height * polish.contentTop,
      width: width * (1 - polish.contentSide * 2),
      height: height * polish.contentHeight,
    },
    width * polish.regionGap,
  );
}

/** layoutFamily chooses topology; region order, weight, and role determine actual boxes. */
function placeRegions(
  plan: CompositionPlan,
  polishProfile: AccumulationLayoutPolishProfile,
): RegionPlacement[] {
  const contentRegions = [...plan.regions]
    .filter((region) => !['message', 'navigation', 'annotation'].includes(region.role))
    .sort((left, right) => left.order - right.order);
  const auxiliary = auxiliaryRegionPlacements(plan);
  if (plan.layout.layoutFamily === 'threshold-field') {
    return [...auxiliary, ...thresholdFieldRegions(plan, contentRegions)];
  }
  if (plan.layout.layoutFamily === 'editorial-causal-spine') {
    return [...auxiliary, ...causalSpineRegions(plan, contentRegions)];
  }
  if (plan.layout.layoutFamily === 'accumulation-threshold-consequence') {
    return [
      ...auxiliary,
      ...accumulationThresholdConsequenceRegions(
        plan,
        contentRegions,
        ACCUMULATION_LAYOUT_POLISH[polishProfile],
      ),
    ];
  }
  const width = plan.pageProfile.width;
  const height = plan.pageProfile.height;
  const contentBox = { x: width * 0.07, y: height * 0.18, width: width * 0.86, height: height * 0.7 };
  const fallback = plan.layout.readingPath === 'top-to-bottom'
    ? allocateVertical(contentRegions, contentBox, height * 0.025)
    : allocateHorizontal(contentRegions, contentBox, width * 0.02);
  return [...auxiliary, ...fallback];
}

function placementsInRegion(input: {
  plan: CompositionPlan;
  placement: RegionPlacement;
  bindings: Binding[];
}): BlockPlacement[] {
  const { region, box } = input.placement;
  const bindings = [...input.bindings].sort((left, right) => left.readingOrder - right.readingOrder);
  if (bindings.length === 0) return [];
  const scale = input.plan.pageProfile.width / 1920;
  const padding = paddingFor(region.paddingToken, scale);
  const gap = gapFor(region.gapToken, scale);
  const inner = {
    x: box.x + padding,
    y: box.y + padding,
    width: Math.max(1, box.width - padding * 2),
    height: Math.max(1, box.height - padding * 2),
  };
  const parentId = `region-${region.regionId}`;
  const placement = (binding: Binding, x: number, baselineY: number): BlockPlacement => ({
    binding,
    region,
    parentId,
    x,
    baselineY,
    connectorY: clamp(baselineY + 105 * scale, inner.y + inner.height * 0.55, inner.y + inner.height * 0.86),
  });
  if (region.flow === 'column') {
    const step = inner.height / bindings.length;
    return bindings.map((binding, index) => placement(binding, inner.x + inner.width / 2, inner.y + step * (index + 0.42)));
  }
  if (region.flow === 'overlay') {
    const center = (bindings.length - 1) / 2;
    return bindings.map((binding, index) => placement(binding, inner.x + inner.width / 2, inner.y + inner.height * 0.48 + (index - center) * (gap + 54 * scale)));
  }
  if (region.flow === 'radial') {
    const radiusX = inner.width * 0.34;
    const radiusY = inner.height * 0.22;
    return bindings.map((binding, index) => {
      const angle = -Math.PI + (Math.PI * index) / Math.max(1, bindings.length - 1);
      return placement(binding, inner.x + inner.width / 2 + Math.cos(angle) * radiusX, inner.y + inner.height * 0.52 + Math.sin(angle) * radiusY);
    });
  }
  if (region.flow === 'free-composition') {
    return bindings.map((binding, index) => {
      const progress = bindings.length === 1 ? 0.5 : index / (bindings.length - 1);
      return placement(binding, inner.x + inner.width * progress, inner.y + inner.height * (0.38 + (index % 2) * 0.16));
    });
  }
  const step = inner.width / bindings.length;
  return bindings.map((binding, index) => placement(binding, inner.x + step * (index + 0.5), inner.y + inner.height * 0.48));
}

function regionGroupNode(placement: RegionPlacement): RenderNode {
  return {
    nodeId: `region-${placement.region.regionId}`,
    kind: 'group',
    ...(placement.region.parentRegionId === undefined ? {} : { parentId: `region-${placement.region.parentRegionId}` }),
    zIndex: 0,
    box: placement.box,
    clip: false,
    visible: true,
  };
}

function motifNodes(input: {
  plan: CompositionPlan;
  regions: RegionPlacement[];
  blocks: BlockPlacement[];
}): RenderNode[] {
  const motif = input.plan.styleIntent.motif;
  const accent = input.plan.styleIntent.accent;
  const target = input.regions.find((placement) => placement.region.role === accent.targetRole);
  const buildup = input.regions.find((placement) => placement.region.role === 'support');
  const consequence = input.regions.find((placement) => placement.region.role === 'evidence');
  const contentBlocks = input.blocks.filter((block) => !['message', 'navigation', 'annotation'].includes(block.region.role));
  if (target === undefined || contentBlocks.length === 0) return [];
  if (motif.family === 'threshold-plane') {
    const focusWidth = Math.min(target.box.width * 0.88, input.plan.pageProfile.width * 0.105);
    const focusHeight = Math.min(target.box.height * 0.58, input.plan.pageProfile.height * 0.12);
    const focusBox: Box = {
      x: target.box.x + (target.box.width - focusWidth) / 2,
      y: target.box.y + (target.box.height - focusHeight) / 2,
      width: focusWidth,
      height: focusHeight,
    };
    return [
      vectorNode({
        nodeId: 'motif-threshold-marker',
        parentId: `region-${target.region.regionId}`,
        shape: 'round-rect',
        box: focusBox,
        fill: accent.softColor,
        zIndex: 0,
      }),
      vectorNode({
        nodeId: 'motif-threshold-rule',
        parentId: `region-${target.region.regionId}`,
        shape: 'line',
        box: {
          x: target.box.x + target.box.width / 2,
          y: target.box.y - input.plan.pageProfile.height * 0.045,
          width: 1,
          height: target.box.height + input.plan.pageProfile.height * 0.09,
        },
        stroke: motif.color,
        strokeWidth: Math.max(2, motif.strokeWidth * 0.6),
        opacity: 0.78,
        zIndex: 1,
      }),
      ...(buildup === undefined ? [] : [
        vectorNode({
          nodeId: 'motif-buildup-field',
          parentId: `region-${buildup.region.regionId}`,
          shape: 'rect',
          box: buildup.box,
          fill: '#EEEBE4',
          opacity: 0.82,
          zIndex: 0,
        }),
        vectorNode({
          nodeId: 'motif-buildup-rule',
          parentId: `region-${buildup.region.regionId}`,
          shape: 'line',
          box: {
            x: buildup.box.x + buildup.box.width * 0.08,
            y: contentBlocks[0]!.connectorY,
            width: buildup.box.width * 0.84,
            height: 1,
          },
          stroke: input.plan.styleIntent.palette.connector,
          strokeWidth: 2,
          opacity: 0.55,
          zIndex: 0,
        }),
      ]),
      ...(consequence === undefined ? [] : [
        vectorNode({
          nodeId: 'motif-consequence-field',
          parentId: `region-${consequence.region.regionId}`,
          shape: 'rect',
          box: consequence.box,
          fill: '#F6EEEA',
          opacity: 0.9,
          zIndex: 0,
        }),
        vectorNode({
          nodeId: 'motif-consequence-rule',
          parentId: `region-${consequence.region.regionId}`,
          shape: 'line',
          box: {
            x: consequence.box.x + input.plan.pageProfile.width * 0.012,
            y: consequence.box.y + consequence.box.height * 0.18,
            width: 1,
            height: consequence.box.height * 0.64,
          },
          stroke: accent.color,
          strokeWidth: Math.max(2, motif.strokeWidth * 0.7),
          zIndex: 1,
        }),
      ]),
    ];
  }
  if (motif.family === 'causal-spine') {
    const left = Math.min(...contentBlocks.map((block) => block.x));
    const right = Math.max(...contentBlocks.map((block) => block.x));
    const y = contentBlocks.reduce((sum, block) => sum + block.connectorY, 0) / contentBlocks.length;
    const primary = input.blocks.find((block) => block.region.role === 'primary-artifact');
    return [
      vectorNode({
        nodeId: 'motif-causal-spine',
        shape: 'line',
        box: { x: left, y, width: Math.max(1, right - left), height: 1 },
        stroke: motif.color,
        strokeWidth: motif.strokeWidth,
        opacity: 0.55,
        zIndex: 0,
      }),
      ...(primary === undefined ? [] : [vectorNode({
        nodeId: 'motif-spine-threshold',
        parentId: primary.parentId,
        semanticBlockId: primary.binding.blockId,
        shape: 'ellipse',
        box: { x: primary.x - 22, y: y - 22, width: 44, height: 44 },
        fill: accent.softColor,
        stroke: accent.color,
        strokeWidth: motif.strokeWidth,
        zIndex: 1,
      })]),
    ];
  }
  if (motif.family === 'editorial-rule') {
    return [vectorNode({
      nodeId: 'motif-editorial-rule',
      shape: 'line',
      box: { x: target.box.x, y: target.box.y, width: target.box.width, height: 1 },
      stroke: motif.color,
      strokeWidth: motif.strokeWidth,
      zIndex: 1,
    })];
  }
  return [vectorNode({
    nodeId: 'motif-focus-field',
    parentId: `region-${target.region.regionId}`,
    shape: 'ellipse',
    box: target.box,
    fill: accent.softColor,
    stroke: motif.color,
    strokeWidth: motif.strokeWidth,
    zIndex: 0,
  })];
}

function relationNodes(input: {
  relationId: string;
  nodeId: string;
  from: BlockPlacement;
  to: BlockPlacement;
  plan: CompositionPlan;
}): RenderNode[] {
  const targetRole = input.plan.styleIntent.accent.targetRole;
  const accented = input.from.region.role === targetRole || input.to.region.role === targetRole;
  const fromX = input.from.x;
  const fromY = input.from.connectorY;
  const toX = input.to.x;
  const toY = input.to.connectorY;
  const orderedConnector = ['threshold-field', 'editorial-causal-spine'].includes(input.plan.layout.layoutFamily);
  const color = accented ? input.plan.styleIntent.accent.color : input.plan.styleIntent.palette.connector;
  const strokeWidth = accented ? input.plan.styleIntent.motif.strokeWidth : Math.max(2, input.plan.styleIntent.motif.strokeWidth * 0.55);
  if (!orderedConnector) {
    const middleX = (fromX + toX) / 2;
    return [vectorNode({
      nodeId: input.nodeId,
      shape: 'path',
      box: {
        x: Math.min(fromX, toX),
        y: Math.min(fromY, toY),
        width: Math.max(1, Math.abs(toX - fromX)),
        height: Math.max(1, Math.abs(toY - fromY)),
      },
      pathData: `M ${fromX} ${fromY} C ${middleX} ${fromY}, ${middleX} ${toY}, ${toX} ${toY}`,
      stroke: color,
      strokeWidth,
      relationId: input.relationId,
      zIndex: 1,
    })];
  }

  const direction = toX >= fromX ? 1 : -1;
  const inset = 24 * (input.plan.pageProfile.width / 1920);
  const startX = fromX + direction * inset;
  const endX = toX - direction * inset;
  const y = (fromY + toY) / 2;
  const arrowSize = 10 * (input.plan.pageProfile.width / 1920);
  return [
    vectorNode({
      nodeId: input.nodeId,
      shape: 'line',
      box: {
        x: Math.min(startX, endX),
        y,
        width: Math.max(1, Math.abs(endX - startX)),
        height: 1,
      },
      stroke: color,
      strokeWidth,
      relationId: input.relationId,
      zIndex: 1,
    }),
    vectorNode({
      nodeId: `${input.nodeId}-arrow`,
      shape: 'path',
      box: {
        x: Math.min(endX - direction * arrowSize, endX),
        y: y - arrowSize,
        width: arrowSize,
        height: arrowSize * 2,
      },
      pathData: `M ${endX - direction * arrowSize} ${y - arrowSize} L ${endX} ${y} L ${endX - direction * arrowSize} ${y + arrowSize}`,
      stroke: color,
      strokeWidth,
      relationId: input.relationId,
      zIndex: 1,
    }),
  ];
}

function connectorMarkers(plan: CompositionPlan, blocks: BlockPlacement[]): RenderNode[] {
  if (!['threshold-field', 'editorial-causal-spine'].includes(plan.layout.layoutFamily)) return [];
  return blocks
    .filter((block) => !(plan.layout.layoutFamily === 'editorial-causal-spine' && block.region.role === 'primary-artifact'))
    .map((block) => {
      const isResult = block.region.role === 'evidence';
      const isPrimary = block.region.role === 'primary-artifact';
      const diameter = isResult ? 16 : isPrimary ? 18 : 11;
      return vectorNode({
        nodeId: `connector-marker-${block.binding.blockId}`,
        parentId: block.parentId,
        semanticBlockId: block.binding.blockId,
        shape: 'ellipse',
        box: { x: block.x - diameter / 2, y: block.connectorY - diameter / 2, width: diameter, height: diameter },
        fill: isResult || isPrimary ? plan.styleIntent.accent.color : plan.styleIntent.palette.background,
        stroke: isResult || isPrimary ? plan.styleIntent.accent.color : plan.styleIntent.palette.connector,
        strokeWidth: isResult || isPrimary ? 2 : 3,
        zIndex: 2,
      });
    });
}

type AccumulationPlacement = BlockPlacement & {
  laneIndex: number;
  positionInLane: number;
  laneSize: number;
  slotBox: Box;
};

function maximumMeasuredWidth(
  slide: SlideIR,
  measures: Map<string, TextMeasurement>,
  binding: Binding,
): number {
  const block = slide.blocks.find((candidate) => candidate.id === binding.blockId);
  if (block === undefined) throw new Error(`SlideIR block을 찾을 수 없습니다: ${binding.blockId}`);
  return Math.max(
    1,
    ...contentRefsForBlock(block).map((_, index) => requiredMeasurement(measures, block.id, index).width),
  );
}

/**
 * Accumulation is a bounded ordered sequence. Up to four measured steps share one lane;
 * longer or wider content deterministically wraps in reading order without shrinking text.
 */
function placeAccumulationSequence(input: {
  slide: SlideIR;
  plan: CompositionPlan;
  regionPlacement: RegionPlacement;
  bindings: Binding[];
  measures: Map<string, TextMeasurement>;
  polish: AccumulationLayoutPolishSpec;
}): AccumulationPlacement[] {
  const bindings = [...input.bindings].sort((left, right) => left.readingOrder - right.readingOrder);
  if (bindings.length === 0) return [];
  const scale = input.plan.pageProfile.width / 1920;
  const padding = paddingFor(input.regionPlacement.region.paddingToken, scale);
  const inner: Box = {
    x: input.regionPlacement.box.x + padding,
    y: input.regionPlacement.box.y + padding,
    width: Math.max(1, input.regionPlacement.box.width - padding * 2),
    height: Math.max(1, input.regionPlacement.box.height - padding * 2),
  };
  const minimumGap = 34 * scale;
  const widestText = Math.max(...bindings.map((binding) =>
    maximumMeasuredWidth(input.slide, input.measures, binding),
  ));
  const minimumSlotWidth = widestText + minimumGap;
  const measuredCapacity = Math.max(1, Math.floor(inner.width / minimumSlotWidth));
  const itemsPerLane = Math.max(1, Math.min(4, bindings.length, measuredCapacity));
  const laneCount = Math.ceil(bindings.length / itemsPerLane);
  const laneHeight = inner.height / laneCount;
  const parentId = `region-${input.regionPlacement.region.regionId}`;

  return bindings.map((binding, index) => {
    const laneIndex = Math.floor(index / itemsPerLane);
    const laneStart = laneIndex * itemsPerLane;
    const laneSize = Math.min(itemsPerLane, bindings.length - laneStart);
    const positionInLane = index - laneStart;
    const slotWidth = inner.width / laneSize;
    const readingProgress = bindings.length === 1 ? 0 : index / (bindings.length - 1);
    const trackRatio = clamp(
      input.polish.accumulationTrackRatio + input.polish.accumulationRiseRatio * readingProgress,
      0.24,
      0.76,
    );
    const trackY = inner.y + laneHeight * laneIndex + laneHeight * trackRatio;
    return {
      binding,
      region: input.regionPlacement.region,
      parentId,
      x: inner.x + slotWidth * (positionInLane + 0.5),
      baselineY: trackY - 42 * scale,
      connectorY: trackY,
      laneIndex,
      positionInLane,
      laneSize,
      slotBox: {
        x: inner.x + slotWidth * positionInLane,
        y: inner.y + laneHeight * laneIndex,
        width: slotWidth,
        height: laneHeight,
      },
    };
  });
}

function placeThresholdEvents(input: {
  plan: CompositionPlan;
  regionPlacement: RegionPlacement;
  bindings: Binding[];
  entryY: number;
  polish: AccumulationLayoutPolishSpec;
}): BlockPlacement[] {
  const bindings = [...input.bindings].sort((left, right) => left.readingOrder - right.readingOrder);
  if (bindings.length === 0) return [];
  const scale = input.plan.pageProfile.width / 1920;
  const padding = paddingFor(input.regionPlacement.region.paddingToken, scale);
  const inner: Box = {
    x: input.regionPlacement.box.x + padding,
    y: input.regionPlacement.box.y + padding,
    width: Math.max(1, input.regionPlacement.box.width - padding * 2),
    height: Math.max(1, input.regionPlacement.box.height - padding * 2),
  };
  const centerY = clamp(
    input.entryY + input.polish.thresholdYOffset * scale,
    inner.y + inner.height * 0.26,
    inner.y + inner.height * 0.74,
  );
  const eventGap = Math.min(110 * scale, inner.height / Math.max(1, bindings.length));
  const centerIndex = (bindings.length - 1) / 2;
  return bindings.map((binding, index) => {
    const connectorY = centerY + (index - centerIndex) * eventGap;
    return {
      binding,
      region: input.regionPlacement.region,
      parentId: `region-${input.regionPlacement.region.regionId}`,
      x: inner.x + inner.width / 2,
      baselineY: connectorY - input.polish.thresholdTextOffset * scale,
      connectorY,
    };
  });
}

function placeConsequenceResults(input: {
  plan: CompositionPlan;
  regionPlacement: RegionPlacement;
  bindings: Binding[];
  activationY: number;
  polish: AccumulationLayoutPolishSpec;
}): BlockPlacement[] {
  const bindings = [...input.bindings].sort((left, right) => left.readingOrder - right.readingOrder);
  if (bindings.length === 0) return [];
  const scale = input.plan.pageProfile.width / 1920;
  const padding = paddingFor(input.regionPlacement.region.paddingToken, scale);
  const inner: Box = {
    x: input.regionPlacement.box.x + padding,
    y: input.regionPlacement.box.y + padding,
    width: Math.max(1, input.regionPlacement.box.width - padding * 2),
    height: Math.max(1, input.regionPlacement.box.height - padding * 2),
  };
  const axisX = inner.x + inner.width * 0.12;
  const firstY = clamp(
    input.activationY + input.polish.consequenceYOffset * scale,
    inner.y + inner.height * 0.2,
    inner.y + inner.height * 0.68,
  );
  const availableAfterFirst = inner.y + inner.height * 0.82 - firstY;
  const gap = bindings.length === 1
    ? 0
    : Math.min(170 * scale, availableAfterFirst / (bindings.length - 1));
  return bindings.map((binding, index) => {
    const connectorY = firstY + gap * index;
    return {
      binding,
      region: input.regionPlacement.region,
      parentId: `region-${input.regionPlacement.region.regionId}`,
      x: axisX + input.polish.consequenceTextInset * scale,
      baselineY: connectorY,
      connectorY,
    };
  });
}

function blockTextNodes(input: {
  slide: SlideIR;
  plan: CompositionPlan;
  placement: BlockPlacement;
  measures: Map<string, TextMeasurement>;
  fonts: FontAsset[];
  parentId?: string;
  compositionRegionId?: string;
  visualRole?: 'ordered-step' | 'threshold-event' | 'consequence-result';
  align?: 'start' | 'center' | 'end';
  lineGap?: number;
}): RenderNode[] {
  const block = input.slide.blocks.find((candidate) => candidate.id === input.placement.binding.blockId);
  if (block === undefined) throw new Error(`SlideIR block을 찾을 수 없습니다: ${input.placement.binding.blockId}`);
  const refs = contentRefsForBlock(block);
  const scale = input.plan.pageProfile.width / 1920;
  const lineGap = (input.lineGap ?? 14) * scale;
  const measured = refs.map((_, index) => requiredMeasurement(input.measures, block.id, index));
  const totalHeight = measured.reduce(
    (sum, measurement) => sum + measurement.actualBoundingBoxAscent + measurement.actualBoundingBoxDescent,
    0,
  ) + lineGap * Math.max(0, measured.length - 1);
  let baseline = input.placement.baselineY - totalHeight / 2 + (measured[0]?.actualBoundingBoxAscent ?? 0);
  const accented = input.placement.region.role === input.plan.styleIntent.accent.targetRole;
  return refs.map((ref, refIndex) => {
    const measurement = measured[refIndex]!;
    const isResultValue =
      input.compositionRegionId === 'phase-consequence' && block.kind === 'metric' && refIndex === 1;
    const node = measuredTextNode({
      nodeId: `text-${block.id}-${refIndex}`,
      parentId: input.parentId ?? input.placement.parentId,
      semanticBlockId: block.id,
      ...(input.compositionRegionId === undefined ? {} : { compositionRegionId: input.compositionRegionId }),
      ...(input.visualRole === undefined ? {} : { visualRole: input.visualRole }),
      text: ref.text,
      sourceSpanIds: ref.sourceSpanIds,
      x: input.placement.x,
      baselineY: baseline,
      align: input.align ?? 'center',
      color: accented || isResultValue
        ? input.plan.styleIntent.accent.color
        : input.placement.binding.prominence <= 2
          ? input.plan.styleIntent.palette.mutedInk
          : input.plan.styleIntent.palette.ink,
      measurement,
      fonts: input.fonts,
      zIndex: 3,
    });
    baseline += measurement.actualBoundingBoxDescent + lineGap + (measured[refIndex + 1]?.actualBoundingBoxAscent ?? 0);
    return node;
  });
}

function accumulationThresholdNodes(input: {
  slide: SlideIR;
  plan: CompositionPlan;
  placements: RegionPlacement[];
  bindingsByRegion: Map<string, Binding[]>;
  measures: Map<string, TextMeasurement>;
  fonts: FontAsset[];
  polish: AccumulationLayoutPolishSpec;
}): RenderNode[] {
  const accumulationRegion = input.placements.find(
    (placement) => placement.region.regionId === 'phase-accumulation',
  );
  if (accumulationRegion === undefined) throw new Error('phase-accumulation Composition region을 찾을 수 없습니다.');
  const accumulationPlacements = placeAccumulationSequence({
    slide: input.slide,
    plan: input.plan,
    regionPlacement: accumulationRegion,
    bindings: input.bindingsByRegion.get('phase-accumulation') ?? [],
    measures: input.measures,
    polish: input.polish,
  });
  const thresholdRegion = input.placements.find(
    (placement) => placement.region.regionId === 'phase-threshold',
  );
  if (thresholdRegion === undefined) throw new Error('phase-threshold Composition region을 찾을 수 없습니다.');
  const lastAccumulation = [...accumulationPlacements]
    .sort((left, right) => left.binding.readingOrder - right.binding.readingOrder)
    .at(-1);
  if (lastAccumulation === undefined) throw new Error('threshold 앞에 accumulation binding이 필요합니다.');
  const thresholdPlacements = placeThresholdEvents({
    plan: input.plan,
    regionPlacement: thresholdRegion,
    bindings: input.bindingsByRegion.get('phase-threshold') ?? [],
    entryY: lastAccumulation.connectorY,
    polish: input.polish,
  });
  const consequenceRegion = input.placements.find(
    (placement) => placement.region.regionId === 'phase-consequence',
  );
  if (consequenceRegion === undefined) throw new Error('phase-consequence Composition region을 찾을 수 없습니다.');
  const lastThreshold = [...thresholdPlacements]
    .sort((left, right) => left.binding.readingOrder - right.binding.readingOrder)
    .at(-1);
  if (lastThreshold === undefined) throw new Error('consequence 앞에 threshold binding이 필요합니다.');
  const consequencePlacements = placeConsequenceResults({
    plan: input.plan,
    regionPlacement: consequenceRegion,
    bindings: input.bindingsByRegion.get('phase-consequence') ?? [],
    activationY: lastThreshold.connectorY,
    polish: input.polish,
  });
  const otherPlacements = input.placements
    .filter((placement) =>
      placement.region.regionId !== 'phase-accumulation' &&
      placement.region.regionId !== 'phase-threshold' &&
      placement.region.regionId !== 'phase-consequence',
    )
    .flatMap((placement) => placementsInRegion({
      plan: input.plan,
      placement,
      bindings: input.bindingsByRegion.get(placement.region.regionId) ?? [],
    }));
  const allPlacements: BlockPlacement[] = [
    ...accumulationPlacements,
    ...thresholdPlacements,
    ...consequencePlacements,
    ...otherPlacements,
  ];
  const placementsByBlockId = new Map(allPlacements.map((placement) => [placement.binding.blockId, placement]));
  const nodes: RenderNode[] = [];

  const lanes = new Map<number, AccumulationPlacement[]>();
  for (const placement of accumulationPlacements) {
    const lane = lanes.get(placement.laneIndex) ?? [];
    lane.push(placement);
    lanes.set(placement.laneIndex, lane);
  }
  for (const [laneIndex, lane] of lanes) {
    const ordered = [...lane].sort((left, right) => left.positionInLane - right.positionInLane);
    const first = ordered[0]!;
    const last = ordered.at(-1)!;
    const isLevel = Math.abs(last.connectorY - first.connectorY) < 0.5;
    nodes.push(vectorNode({
      nodeId: `accumulation-shared-track-${laneIndex + 1}`,
      parentId: first.parentId,
      compositionRegionId: 'phase-accumulation',
      shape: isLevel ? 'line' : 'path',
      box: {
        x: first.x,
        y: Math.min(first.connectorY, last.connectorY),
        width: Math.max(1, last.x - first.x),
        height: Math.max(1, Math.abs(last.connectorY - first.connectorY)),
      },
      ...(isLevel ? {} : { pathData: `M ${first.x} ${first.connectorY} L ${last.x} ${last.connectorY}` }),
      stroke: input.plan.styleIntent.palette.connector,
      strokeWidth: Math.max(1, input.plan.styleIntent.motif.strokeWidth * 0.32),
      opacity: 0.28,
      zIndex: 0,
    }));
  }

  const firstAccumulation = accumulationPlacements[0];
  const lastAccumulationForBracket = accumulationPlacements.at(-1);
  if (firstAccumulation !== undefined && lastAccumulationForBracket !== undefined) {
    const bracketY = Math.max(...accumulationPlacements.map((placement) => placement.connectorY))
      + input.polish.accumulationBracketOffset;
    nodes.push(vectorNode({
      nodeId: 'accumulation-group-bracket',
      parentId: firstAccumulation.parentId,
      compositionRegionId: 'phase-accumulation',
      visualRole: 'phase-container',
      shape: 'path',
      box: {
        x: firstAccumulation.x,
        y: bracketY - 12,
        width: Math.max(1, lastAccumulationForBracket.x - firstAccumulation.x),
        height: 12,
      },
      pathData: `M ${firstAccumulation.x} ${bracketY - 12} V ${bracketY} H ${lastAccumulationForBracket.x} V ${bracketY - 12}`,
      stroke: input.plan.styleIntent.palette.connector,
      strokeWidth: 1.6,
      opacity: input.polish.accumulationBracketOpacity,
      zIndex: 0,
    }));
  }

  for (const placement of accumulationPlacements) {
    const stepGroupId = `ordered-step-${placement.binding.blockId}`;
    const markerDiameter = placement.binding.prominence >= 4
      ? input.polish.accumulationFinalMarkerDiameter
      : input.polish.accumulationMarkerDiameter;
    nodes.push({
      nodeId: stepGroupId,
      kind: 'group',
      parentId: placement.parentId,
      semanticBlockId: placement.binding.blockId,
      compositionRegionId: 'phase-accumulation',
      visualRole: 'ordered-step',
      zIndex: 1,
      box: placement.slotBox,
      clip: false,
      visible: true,
    });
    nodes.push(vectorNode({
      nodeId: `ordered-step-anchor-${placement.binding.blockId}`,
      parentId: stepGroupId,
      semanticBlockId: placement.binding.blockId,
      compositionRegionId: 'phase-accumulation',
      visualRole: 'ordered-step',
      shape: 'ellipse',
      box: {
        x: placement.x - markerDiameter / 2,
        y: placement.connectorY - markerDiameter / 2,
        width: markerDiameter,
        height: markerDiameter,
      },
      fill: input.plan.styleIntent.palette.background,
      stroke: input.plan.styleIntent.palette.connector,
      strokeWidth: 2,
      zIndex: 2,
    }));
    nodes.push(...blockTextNodes({
      slide: input.slide,
      plan: input.plan,
      placement,
      measures: input.measures,
      fonts: input.fonts,
      parentId: stepGroupId,
      compositionRegionId: 'phase-accumulation',
      visualRole: 'ordered-step',
    }));
  }

  const thresholdCenterX = thresholdRegion.box.x + thresholdRegion.box.width / 2;
  const thresholdMarkerRadius = input.polish.thresholdMarkerDiameter / 2;
  const thresholdBoundaryHeight = thresholdRegion.box.height * input.polish.thresholdBoundaryRatio;
  const thresholdConnectorY = thresholdPlacements[0]?.connectorY
    ?? thresholdRegion.box.y + thresholdRegion.box.height / 2;
  const thresholdBoundaryTop = thresholdConnectorY - thresholdBoundaryHeight / 2;
  nodes.push(vectorNode({
    nodeId: 'threshold-boundary-rule',
    parentId: `region-${thresholdRegion.region.regionId}`,
    compositionRegionId: 'phase-threshold',
    visualRole: 'threshold-boundary',
    shape: 'path',
    box: {
      x: thresholdCenterX,
      y: thresholdBoundaryTop,
      width: 1,
      height: thresholdBoundaryHeight,
    },
    pathData: `M ${thresholdCenterX} ${thresholdBoundaryTop} V ${thresholdConnectorY - thresholdMarkerRadius - 8} M ${thresholdCenterX} ${thresholdConnectorY + thresholdMarkerRadius + 8} V ${thresholdBoundaryTop + thresholdBoundaryHeight}`,
    stroke: input.plan.styleIntent.accent.color,
    strokeWidth: Math.max(2, input.plan.styleIntent.motif.strokeWidth * 0.48),
    opacity: 0.48,
    zIndex: 0,
  }));
  for (const placement of thresholdPlacements) {
    const eventGroupId = `threshold-event-${placement.binding.blockId}`;
    const eventHeight = Math.min(thresholdRegion.box.height * 0.24, 150 * (input.plan.pageProfile.width / 1920));
    nodes.push({
      nodeId: eventGroupId,
      kind: 'group',
      parentId: placement.parentId,
      semanticBlockId: placement.binding.blockId,
      compositionRegionId: 'phase-threshold',
      visualRole: 'threshold-event',
      zIndex: 1,
      box: {
        x: thresholdRegion.box.x + thresholdRegion.box.width * 0.08,
        y: placement.connectorY - eventHeight / 2,
        width: thresholdRegion.box.width * 0.84,
        height: eventHeight,
      },
      clip: false,
      visible: true,
    });
    nodes.push(vectorNode({
      nodeId: `threshold-event-marker-${placement.binding.blockId}`,
      parentId: eventGroupId,
      semanticBlockId: placement.binding.blockId,
      compositionRegionId: 'phase-threshold',
      visualRole: 'threshold-event',
      shape: 'ellipse',
      box: {
        x: placement.x - thresholdMarkerRadius,
        y: placement.connectorY - thresholdMarkerRadius,
        width: input.polish.thresholdMarkerDiameter,
        height: input.polish.thresholdMarkerDiameter,
      },
      fill: input.plan.styleIntent.accent.softColor,
      stroke: input.plan.styleIntent.accent.color,
      strokeWidth: Math.max(2, input.plan.styleIntent.motif.strokeWidth * 0.55),
      zIndex: 2,
    }));
    nodes.push(...blockTextNodes({
      slide: input.slide,
      plan: input.plan,
      placement,
      measures: input.measures,
      fonts: input.fonts,
      parentId: eventGroupId,
      compositionRegionId: 'phase-threshold',
      visualRole: 'threshold-event',
    }));
  }

  const consequenceAxisX = consequencePlacements[0]?.x === undefined
    ? consequenceRegion.box.x + consequenceRegion.box.width * 0.16
    : consequencePlacements[0].x
      - input.polish.consequenceTextInset * (input.plan.pageProfile.width / 1920);
  const firstConsequenceY = consequencePlacements[0]?.connectorY ?? consequenceRegion.box.y + consequenceRegion.box.height * 0.4;
  const lastConsequenceY = consequencePlacements.at(-1)?.connectorY ?? firstConsequenceY;
  const consequenceTop = Math.min(firstConsequenceY, lastConsequenceY) - input.polish.consequenceAxisAbove;
  const consequenceBottom = Math.max(firstConsequenceY, lastConsequenceY) + input.polish.consequenceAxisBelow;
  nodes.push(vectorNode({
    nodeId: 'consequence-alignment-axis',
    parentId: `region-${consequenceRegion.region.regionId}`,
    compositionRegionId: 'phase-consequence',
    shape: 'path',
    box: {
      x: consequenceAxisX,
      y: consequenceTop,
      width: 18,
      height: Math.max(1, consequenceBottom - consequenceTop),
    },
    pathData: `M ${consequenceAxisX + 18} ${consequenceTop} H ${consequenceAxisX} V ${consequenceBottom} H ${consequenceAxisX + 18}`,
    stroke: input.plan.styleIntent.palette.connector,
    strokeWidth: Math.max(1, input.plan.styleIntent.motif.strokeWidth * 0.32),
    opacity: 0.38,
    zIndex: 0,
  }));
  for (const placement of consequencePlacements) {
    const resultGroupId = `consequence-result-${placement.binding.blockId}`;
    const resultHeight = Math.min(
      consequenceRegion.box.height * 0.28,
      170 * (input.plan.pageProfile.width / 1920),
    );
    nodes.push({
      nodeId: resultGroupId,
      kind: 'group',
      parentId: placement.parentId,
      semanticBlockId: placement.binding.blockId,
      compositionRegionId: 'phase-consequence',
      visualRole: 'consequence-result',
      zIndex: 1,
      box: {
        x: consequenceAxisX,
        y: placement.connectorY - resultHeight / 2,
        width: consequenceRegion.box.x + consequenceRegion.box.width - consequenceAxisX,
        height: resultHeight,
      },
      clip: false,
      visible: true,
    });
    nodes.push(vectorNode({
      nodeId: `consequence-result-anchor-${placement.binding.blockId}`,
      parentId: resultGroupId,
      semanticBlockId: placement.binding.blockId,
      compositionRegionId: 'phase-consequence',
      visualRole: 'consequence-result',
      shape: 'path',
      box: {
        x: consequenceAxisX,
        y: placement.connectorY,
        width: 22,
        height: 1,
      },
      pathData: `M ${consequenceAxisX} ${placement.connectorY} H ${consequenceAxisX + 22}`,
      stroke: input.plan.styleIntent.accent.color,
      strokeWidth: Math.max(2, input.plan.styleIntent.motif.strokeWidth * 0.52),
      zIndex: 2,
    }));
    nodes.push(...blockTextNodes({
      slide: input.slide,
      plan: input.plan,
      placement,
      measures: input.measures,
      fonts: input.fonts,
      parentId: resultGroupId,
      compositionRegionId: 'phase-consequence',
      visualRole: 'consequence-result',
      align: 'start',
      lineGap: input.polish.consequenceLineGap,
    }));
  }

  for (const relation of input.slide.relations) {
    const classified = classifyRelationVisualRole({ relation, plan: input.plan });
    const from = placementsByBlockId.get(relation.fromBlockId);
    const to = placementsByBlockId.get(relation.toBlockId);
    if (classified === undefined || from === undefined || to === undefined) continue;
    if (classified.visualRole === 'accumulation-local') {
      const fromAccumulation = accumulationPlacements.find((placement) => placement.binding.blockId === relation.fromBlockId);
      const toAccumulation = accumulationPlacements.find((placement) => placement.binding.blockId === relation.toBlockId);
      if (fromAccumulation === undefined || toAccumulation === undefined) continue;
      const sameLane = fromAccumulation.laneIndex === toAccumulation.laneIndex;
      const sameY = Math.abs(fromAccumulation.connectorY - toAccumulation.connectorY) < 0.5;
      const markerInset = 6;
      const direction = toAccumulation.x >= fromAccumulation.x ? 1 : -1;
      const startX = fromAccumulation.x + direction * markerInset;
      const endX = sameLane
        ? toAccumulation.x - direction * markerInset
        : toAccumulation.x + markerInset;
      const bendX = accumulationRegion.box.x + accumulationRegion.box.width - 8;
      const carrierXs = sameLane ? [startX, endX] : [startX, bendX, endX];
      nodes.push(vectorNode({
        nodeId: `accumulation-relation-${relation.id}`,
        parentId: fromAccumulation.parentId,
        compositionRegionId: 'phase-accumulation',
        visualRole: 'relation-carrier',
        relationVisualRole: 'accumulation-local',
        relationId: relation.id,
        shape: sameLane && sameY ? 'line' : 'path',
        box: {
          x: Math.min(...carrierXs),
          y: Math.min(fromAccumulation.connectorY, toAccumulation.connectorY),
          width: Math.max(1, Math.max(...carrierXs) - Math.min(...carrierXs)),
          height: Math.max(1, Math.abs(toAccumulation.connectorY - fromAccumulation.connectorY)),
        },
        ...(sameLane && sameY ? {} : {
          pathData: sameLane
            ? `M ${startX} ${fromAccumulation.connectorY} L ${endX} ${toAccumulation.connectorY}`
            : `M ${startX} ${fromAccumulation.connectorY} H ${bendX} V ${toAccumulation.connectorY} H ${endX}`,
        }),
        stroke: input.plan.styleIntent.palette.connector,
        strokeWidth: Math.max(2, input.plan.styleIntent.motif.strokeWidth * 0.55),
        zIndex: 1,
      }));
      continue;
    }

    if (classified.visualRole === 'threshold-entry') {
      const startX = from.x + 6;
      const endX = to.x - thresholdMarkerRadius;
      const sameY = Math.abs(from.connectorY - to.connectorY) < 0.5;
      const carrierXs = [startX, endX];
      nodes.push(vectorNode({
        nodeId: `threshold-entry-${relation.id}`,
        parentId: `region-${thresholdRegion.region.regionId}`,
        relationId: relation.id,
        compositionRegionId: 'phase-threshold',
        visualRole: 'relation-carrier',
        relationVisualRole: 'threshold-entry',
        shape: sameY ? 'line' : 'path',
        box: {
          x: Math.min(...carrierXs),
          y: Math.min(from.connectorY, to.connectorY),
          width: Math.max(1, Math.max(...carrierXs) - Math.min(...carrierXs)),
          height: Math.max(1, Math.abs(to.connectorY - from.connectorY)),
        },
        ...(sameY ? {} : {
          pathData: `M ${startX} ${from.connectorY} H ${(startX + endX) / 2} V ${to.connectorY} H ${endX}`,
        }),
        stroke: input.plan.styleIntent.accent.color,
        strokeWidth: Math.max(2, input.plan.styleIntent.motif.strokeWidth * 0.58),
        zIndex: 1,
      }));
      continue;
    }

    if (classified.visualRole === 'consequence-activation') {
      const startX = from.x + thresholdMarkerRadius;
      const endX = to.x
        - input.polish.consequenceTextInset * (input.plan.pageProfile.width / 1920);
      const sameY = Math.abs(from.connectorY - to.connectorY) < 0.5;
      nodes.push(vectorNode({
        nodeId: `consequence-activation-${relation.id}`,
        parentId: `region-${consequenceRegion.region.regionId}`,
        relationId: relation.id,
        compositionRegionId: 'phase-consequence',
        visualRole: 'relation-carrier',
        relationVisualRole: 'consequence-activation',
        shape: 'path',
        box: {
          x: Math.min(startX, endX),
          y: Math.min(from.connectorY, to.connectorY),
          width: Math.max(1, Math.abs(endX - startX)),
          height: Math.max(1, Math.abs(to.connectorY - from.connectorY)),
        },
        pathData: sameY
          ? `M ${startX} ${from.connectorY} H ${endX}`
          : `M ${startX} ${from.connectorY} H ${(startX + endX) / 2} V ${to.connectorY} H ${endX}`,
        stroke: input.plan.styleIntent.accent.color,
        strokeWidth: Math.max(2, input.plan.styleIntent.motif.strokeWidth * 0.5),
        opacity: 0.78,
        zIndex: 1,
      }));
      continue;
    }

    if (classified.visualRole === 'consequence-local') {
      const axisX = from.x
        - input.polish.consequenceTextInset * (input.plan.pageProfile.width / 1920);
      const startY = Math.min(from.connectorY, to.connectorY) + 2;
      const endY = Math.max(from.connectorY, to.connectorY) - 2;
      nodes.push(vectorNode({
        nodeId: `consequence-local-${relation.id}`,
        parentId: `region-${consequenceRegion.region.regionId}`,
        relationId: relation.id,
        compositionRegionId: 'phase-consequence',
        visualRole: 'relation-carrier',
        relationVisualRole: 'consequence-local',
        shape: 'line',
        box: {
          x: axisX,
          y: startY,
          width: 1,
          height: Math.max(1, endY - startY),
        },
        stroke: input.plan.styleIntent.palette.connector,
        strokeWidth: Math.max(2, input.plan.styleIntent.motif.strokeWidth * 0.45),
        zIndex: 1,
      }));
      continue;
    }

    throw new Error(`새 layout에서 지원하지 않는 relation visual role입니다: ${classified.visualRole}`);
  }

  for (const placement of otherPlacements) {
    nodes.push(...blockTextNodes({
      slide: input.slide,
      plan: input.plan,
      placement,
      measures: input.measures,
      fonts: input.fonts,
      compositionRegionId: placement.binding.regionId,
    }));
  }

  return nodes;
}

/**
 * CompositionPlan is authoritative. InformationPlan only verifies the contract link;
 * coordinates, order, grouping, hierarchy, and styling come from CompositionPlan.
 */
export function buildInformationRenderTree(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  plan: CompositionPlan;
  measures: Map<string, TextMeasurement>;
  fonts: FontAsset[];
  accumulationLayoutPolish?: AccumulationLayoutPolishProfile;
}) {
  requirePlanForInformation(input.plan, input.informationPlan);
  if (input.plan.layout.layoutFamily === 'aligned-before-after-spec') return buildAlignedFeatureRenderTree(input);
  const accumulationLayoutPolish = input.accumulationLayoutPolish ?? DEFAULT_ACCUMULATION_LAYOUT_POLISH;
  const placements = placeRegions(input.plan, accumulationLayoutPolish);
  const placementByRegion = new Map(placements.map((placement) => [placement.region.regionId, placement]));
  const bindingsByRegion = new Map<string, Binding[]>();
  for (const binding of input.plan.bindings) {
    const bucket = bindingsByRegion.get(binding.regionId) ?? [];
    bucket.push(binding);
    bindingsByRegion.set(binding.regionId, bucket);
  }
  const isAccumulationLayout = input.plan.layout.layoutFamily === 'accumulation-threshold-consequence';
  const messagePresentation = isAccumulationLayout
    ? resolveMessagePresentation({ message: input.informationPlan.message, slide: input.slide })
    : undefined;

  const nodes: RenderNode[] = placements.map((placement) => {
    const group = regionGroupNode(placement);
    if (
      isAccumulationLayout &&
      (
        placement.region.regionId === 'phase-accumulation' ||
        placement.region.regionId === 'phase-threshold' ||
        placement.region.regionId === 'phase-consequence'
      )
    ) {
      return {
        ...group,
        compositionRegionId: placement.region.regionId,
        visualRole: 'phase-container' as const,
      };
    }
    return group;
  });
  if (messagePresentation !== undefined && messagePresentation.presentationKind !== 'suppressed-duplicate') {
    const messageRegion = placements.find((placement) => placement.region.regionId === 'message-context');
    if (messageRegion === undefined) throw new Error('message-context Composition region을 찾을 수 없습니다.');
    const measurement = input.measures.get(MESSAGE_MEASURE_KEY);
    if (measurement === undefined) throw new Error('message-context 텍스트 측정값을 찾을 수 없습니다.');
    const scale = input.plan.pageProfile.width / 1920;
    const padding = paddingFor(messageRegion.region.paddingToken, scale);
    nodes.push(measuredTextNode({
      nodeId: 'message-context-text',
      parentId: `region-${messageRegion.region.regionId}`,
      compositionRegionId: messageRegion.region.regionId,
      visualRole: 'message-context',
      sourceUsage: messagePresentation.sourceUsage,
      text: messagePresentation.text,
      sourceSpanIds: messagePresentation.sourceSpanIds,
      sourceTransform: messagePresentation.sourceTransform,
      x: messageRegion.box.x + padding,
      baselineY: messageRegion.box.y + messageRegion.box.height * 0.62,
      align: 'start',
      color: input.plan.styleIntent.palette.ink,
      measurement,
      fonts: input.fonts,
      zIndex: 3,
    }));
  }
  if (isAccumulationLayout) {
    nodes.push(...accumulationThresholdNodes({
      slide: input.slide,
      plan: input.plan,
      placements,
      bindingsByRegion,
      measures: input.measures,
      fonts: input.fonts,
      polish: ACCUMULATION_LAYOUT_POLISH[accumulationLayoutPolish],
    }));
  } else {
    const rawBlockPlacements = placements.flatMap((placement) => placementsInRegion({
      plan: input.plan,
      placement,
      bindings: bindingsByRegion.get(placement.region.regionId) ?? [],
    }));
    const sharedConnectorY = input.plan.layout.layoutFamily === 'threshold-field'
      ? input.plan.pageProfile.height * 0.61
      : input.plan.layout.layoutFamily === 'editorial-causal-spine'
        ? input.plan.pageProfile.height * 0.62
        : undefined;
    const blockPlacements = sharedConnectorY === undefined
      ? rawBlockPlacements
      : rawBlockPlacements.map((placement) => {
          if (input.plan.layout.layoutFamily !== 'editorial-causal-spine') {
            return { ...placement, connectorY: sharedConnectorY };
          }
          const spineBaseline = placement.region.role === 'primary-artifact'
            ? input.plan.pageProfile.height * 0.56
            : placement.region.role === 'support' && placement.binding.readingOrder % 2 === 1
              ? input.plan.pageProfile.height * 0.74
              : input.plan.pageProfile.height * 0.46;
          return { ...placement, baselineY: spineBaseline, connectorY: sharedConnectorY };
        });
    const placementByBlockId = new Map(blockPlacements.map((placement) => [placement.binding.blockId, placement]));
    nodes.push(...motifNodes({ plan: input.plan, regions: placements, blocks: blockPlacements }));
    for (const relation of input.slide.relations) {
      const from = placementByBlockId.get(relation.fromBlockId);
      const to = placementByBlockId.get(relation.toBlockId);
      if (from === undefined || to === undefined) continue;
      nodes.push(...relationNodes({ relationId: relation.id, nodeId: `relation-${relation.id}`, from, to, plan: input.plan }));
    }
    nodes.push(...connectorMarkers(input.plan, blockPlacements));
    for (const blockPlacement of blockPlacements) {
      const regionPlacement = placementByRegion.get(blockPlacement.binding.regionId);
      if (regionPlacement === undefined) throw new Error(`Composition region을 찾을 수 없습니다: ${blockPlacement.binding.regionId}`);
      nodes.push(...blockTextNodes({
        slide: input.slide,
        plan: input.plan,
        placement: blockPlacement,
        measures: input.measures,
        fonts: input.fonts,
      }));
    }
  }

  return RenderTreeSchema.parse({
    schemaVersion: '0.1',
    renderTreeId: `render-${input.plan.planId}`,
    compositionPlanId: input.plan.planId,
    slideId: input.slide.slideId,
    pageProfile: input.plan.pageProfile,
    layoutFamily: input.plan.layout.layoutFamily,
    ...(messagePresentation === undefined
      ? {}
      : { messagePresentation: messagePresentationRecord(messagePresentation) }),
    background: input.plan.styleIntent.palette.background,
    nodes,
    deterministicFingerprint: contentHash({
      slideId: input.slide.slideId,
      informationPlanId: input.informationPlan.informationPlanId,
      compositionPlan: input.plan,
      fonts: input.fonts.map((font) => font.fileHash),
      layoutVersion: isAccumulationLayout
        ? `accumulation-sequence-v1:${accumulationLayoutPolish}`
        : 'composition-authoritative-v2',
      ...(isAccumulationLayout
        ? { accumulationLayoutPolish: ACCUMULATION_LAYOUT_POLISH[accumulationLayoutPolish] }
        : {}),
    }),
  });
}
