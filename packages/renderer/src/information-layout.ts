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

type Region = CompositionPlan['regions'][number];
type Binding = CompositionPlan['bindings'][number];
type Box = RenderNode['box'];
type RegionPlacement = { region: Region; box: Box };
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
  let size = isPrimary
    ? hierarchy.primaryTextSize
    : isEvidence
      ? hierarchy.evidenceTextSize
      : hierarchy.supportTextSize;
  if (input.binding.fragmentRole === 'modifier' && input.refIndex === 1) size += 12;
  else if (!isPrimary) size += Math.max(-2, input.binding.prominence - 3) * 2;
  const weight = isPrimary || input.binding.prominence >= 4
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
  const regions = new Map(input.plan.regions.map((region) => [region.regionId, region]));
  return [...input.plan.bindings]
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
  const primaryCenterRatio = plan.layout.readingPath === 'center-out' ? 0.6 : 0.52;
  const primaryWidth = clamp(width * (0.105 + primary.weight * 0.025), width * 0.13, width * 0.2);
  const primaryBox: Box = {
    x: width * primaryCenterRatio - primaryWidth / 2,
    y: height * 0.12,
    width: primaryWidth,
    height: height * 0.76,
  };
  const before = contentRegions.filter((region) => region.order < primary.order);
  const after = contentRegions.filter((region) => region.order > primary.order);
  const sideY = height * 0.2;
  const sideHeight = height * 0.62;
  const gutter = width * 0.035;
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
    { x: width * 0.055, y: height * 0.19, width: width * 0.89, height: height * 0.66 },
    width * 0.018,
  ).map((placement) => placement.region.role === 'primary-artifact'
    ? { ...placement, box: { x: placement.box.x, y: height * 0.135, width: placement.box.width, height: height * 0.77 } }
    : placement);
}

/** layoutFamily chooses topology; region order, weight, and role determine actual boxes. */
function placeRegions(plan: CompositionPlan): RegionPlacement[] {
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
  const contentBlocks = input.blocks.filter((block) => !['message', 'navigation', 'annotation'].includes(block.region.role));
  if (target === undefined || contentBlocks.length === 0) return [];
  if (motif.family === 'threshold-plane') {
    return [
      vectorNode({
        nodeId: 'motif-threshold-plane',
        parentId: `region-${target.region.regionId}`,
        shape: 'rect',
        box: target.box,
        fill: accent.softColor,
        zIndex: 0,
      }),
      vectorNode({
        nodeId: 'motif-threshold-rule',
        parentId: `region-${target.region.regionId}`,
        shape: 'line',
        box: { x: target.box.x, y: target.box.y, width: 1, height: target.box.height },
        stroke: motif.color,
        strokeWidth: motif.strokeWidth,
        zIndex: 1,
      }),
    ];
  }
  if (motif.family === 'causal-spine') {
    const left = Math.min(...contentBlocks.map((block) => block.x));
    const right = Math.max(...contentBlocks.map((block) => block.x));
    const y = contentBlocks.reduce((sum, block) => sum + block.connectorY, 0) / contentBlocks.length;
    return [vectorNode({
      nodeId: 'motif-causal-spine',
      shape: 'line',
      box: { x: left, y, width: Math.max(1, right - left), height: 1 },
      stroke: motif.color,
      strokeWidth: motif.strokeWidth,
      zIndex: 1,
    })];
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

function relationNode(input: {
  relationId: string;
  nodeId: string;
  from: BlockPlacement;
  to: BlockPlacement;
  plan: CompositionPlan;
}): RenderNode {
  const targetRole = input.plan.styleIntent.accent.targetRole;
  const accented = input.from.region.role === targetRole || input.to.region.role === targetRole;
  const fromX = input.from.x;
  const fromY = input.from.connectorY;
  const toX = input.to.x;
  const toY = input.to.connectorY;
  const middleX = (fromX + toX) / 2;
  return vectorNode({
    nodeId: input.nodeId,
    shape: 'path',
    box: {
      x: Math.min(fromX, toX),
      y: Math.min(fromY, toY),
      width: Math.max(1, Math.abs(toX - fromX)),
      height: Math.max(1, Math.abs(toY - fromY)),
    },
    pathData: `M ${fromX} ${fromY} C ${middleX} ${fromY}, ${middleX} ${toY}, ${toX} ${toY}`,
    stroke: accented ? input.plan.styleIntent.accent.color : input.plan.styleIntent.palette.connector,
    strokeWidth: accented ? input.plan.styleIntent.motif.strokeWidth : Math.max(2, input.plan.styleIntent.motif.strokeWidth * 0.55),
    relationId: input.relationId,
    zIndex: 1,
  });
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
}) {
  requirePlanForInformation(input.plan, input.informationPlan);
  const placements = placeRegions(input.plan);
  const placementByRegion = new Map(placements.map((placement) => [placement.region.regionId, placement]));
  const bindingsByRegion = new Map<string, Binding[]>();
  for (const binding of input.plan.bindings) {
    const bucket = bindingsByRegion.get(binding.regionId) ?? [];
    bucket.push(binding);
    bindingsByRegion.set(binding.regionId, bucket);
  }
  const blockPlacements = placements.flatMap((placement) => placementsInRegion({
    plan: input.plan,
    placement,
    bindings: bindingsByRegion.get(placement.region.regionId) ?? [],
  }));
  const placementByBlockId = new Map(blockPlacements.map((placement) => [placement.binding.blockId, placement]));

  const nodes: RenderNode[] = placements.map(regionGroupNode);
  nodes.push(...motifNodes({ plan: input.plan, regions: placements, blocks: blockPlacements }));
  for (const relation of input.slide.relations) {
    const from = placementByBlockId.get(relation.fromBlockId);
    const to = placementByBlockId.get(relation.toBlockId);
    if (from === undefined || to === undefined) continue;
    nodes.push(relationNode({ relationId: relation.id, nodeId: `relation-${relation.id}`, from, to, plan: input.plan }));
  }

  for (const blockPlacement of blockPlacements) {
    const block = input.slide.blocks.find((candidate) => candidate.id === blockPlacement.binding.blockId);
    const regionPlacement = placementByRegion.get(blockPlacement.binding.regionId);
    if (block === undefined) throw new Error(`SlideIR block을 찾을 수 없습니다: ${blockPlacement.binding.blockId}`);
    if (regionPlacement === undefined) throw new Error(`Composition region을 찾을 수 없습니다: ${blockPlacement.binding.regionId}`);
    const refs = contentRefsForBlock(block);
    const lineGap = 14 * (input.plan.pageProfile.width / 1920);
    const measured = refs.map((_, index) => requiredMeasurement(input.measures, block.id, index));
    const totalHeight = measured.reduce(
      (sum, measurement) => sum + measurement.actualBoundingBoxAscent + measurement.actualBoundingBoxDescent,
      0,
    ) + lineGap * Math.max(0, measured.length - 1);
    let baseline = blockPlacement.baselineY - totalHeight / 2 + (measured[0]?.actualBoundingBoxAscent ?? 0);
    const accented = blockPlacement.region.role === input.plan.styleIntent.accent.targetRole;
    refs.forEach((ref, refIndex) => {
      const measurement = measured[refIndex]!;
      nodes.push(measuredTextNode({
        nodeId: `text-${block.id}-${refIndex}`,
        parentId: blockPlacement.parentId,
        semanticBlockId: block.id,
        text: ref.text,
        sourceSpanIds: ref.sourceSpanIds,
        x: blockPlacement.x,
        baselineY: baseline,
        align: 'center',
        color: accented
          ? input.plan.styleIntent.accent.color
          : blockPlacement.binding.prominence <= 2
            ? input.plan.styleIntent.palette.mutedInk
            : input.plan.styleIntent.palette.ink,
        measurement,
        fonts: input.fonts,
        zIndex: 3,
      }));
      baseline += measurement.actualBoundingBoxDescent + lineGap + (measured[refIndex + 1]?.actualBoundingBoxAscent ?? 0);
    });
  }

  return RenderTreeSchema.parse({
    schemaVersion: '0.1',
    renderTreeId: `render-${input.plan.planId}`,
    compositionPlanId: input.plan.planId,
    slideId: input.slide.slideId,
    pageProfile: input.plan.pageProfile,
    background: input.plan.styleIntent.palette.background,
    nodes,
    deterministicFingerprint: contentHash({
      slideId: input.slide.slideId,
      informationPlanId: input.informationPlan.informationPlanId,
      compositionPlan: input.plan,
      fonts: input.fonts.map((font) => font.fileHash),
      layoutVersion: 'composition-authoritative-v2',
    }),
  });
}
