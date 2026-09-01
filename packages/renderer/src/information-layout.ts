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

function contentRefsForBlock(block: SemanticBlock): ContentRef[] {
  switch (block.kind) {
    case 'heading':
    case 'paragraph':
      return [block.text];
    case 'bullet-group':
      return block.items;
    case 'metric':
      return [block.label, block.value, ...(block.unit === undefined ? [] : [block.unit])];
    case 'key-value':
      return [block.key, block.value];
    case 'table':
      return [...block.columns, ...block.rows.flat()];
    case 'mechanic-step':
      return [block.label, ...(block.detail === undefined ? [] : [block.detail])];
    case 'state':
      return [block.name, ...(block.description === undefined ? [] : [block.description])];
    case 'timeline-event':
      return [block.label, ...(block.time === undefined ? [] : [block.time])];
    case 'boss-phase':
      return [block.label, block.threshold, ...block.behaviors];
    case 'resource-node':
      return [block.label, ...(block.amount === undefined ? [] : [block.amount])];
    case 'hierarchy-node':
      return [block.label];
    case 'ui-region':
      return [block.regionLabel, block.explanation];
    case 'exception':
      return [block.condition, block.outcome];
    case 'test-criterion':
      return [block.criterion, ...(block.target === undefined ? [] : [block.target])];
  }
}

function measureKey(blockId: string, index: number): string {
  return `information:${blockId}:${index}`;
}

function styleFor(input: {
  block: SemanticBlock;
  refIndex: number;
  primaryBlockId: string;
}): Pick<TextMeasureRequest, 'weight' | 'size' | 'letterSpacing'> {
  if (input.block.id === input.primaryBlockId) return { weight: 800, size: 76, letterSpacing: -0.8 };
  if (input.block.kind === 'metric' && input.refIndex === 1) return { weight: 800, size: 62, letterSpacing: -0.7 };
  if (input.block.importance >= 4) return { weight: 800, size: 46, letterSpacing: -0.5 };
  return { weight: input.block.importance >= 3 ? 700 : 400, size: 30, letterSpacing: -0.25 };
}

export function informationMeasureRequests(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  plan: CompositionPlan;
}): TextMeasureRequest[] {
  if (input.plan.informationPlanId !== input.informationPlan.informationPlanId) {
    throw new Error('다른 InformationPlan의 CompositionPlan을 렌더링할 수 없습니다.');
  }
  return input.informationPlan.readingOrder.flatMap((blockId) => {
    const block = input.slide.blocks.find((candidate) => candidate.id === blockId);
    if (block === undefined) throw new Error(`SlideIR block을 찾을 수 없습니다: ${blockId}`);
    return contentRefsForBlock(block).map((ref, index) => ({
      key: measureKey(block.id, index),
      text: ref.text,
      family: 'Pretendard',
      ...styleFor({ block, refIndex: index, primaryBlockId: input.informationPlan.primaryArtifactBlockId }),
    }));
  });
}

function requiredMeasurement(measures: Map<string, TextMeasurement>, blockId: string, index: number): TextMeasurement {
  const measurement = measures.get(measureKey(blockId, index));
  if (measurement === undefined) throw new Error(`텍스트 측정값을 찾을 수 없습니다: ${measureKey(blockId, index)}`);
  return measurement;
}

function positionForBlock(input: {
  index: number;
  count: number;
  primaryIndex: number;
  width: number;
  height: number;
  readingPath: CompositionPlan['layout']['readingPath'];
}): { x: number; baselineY: number } {
  const marginX = Math.max(120, input.width * 0.08);
  const usableWidth = input.width - marginX * 2;
  const beforePrimaryCount = input.primaryIndex;
  const afterPrimaryCount = input.count - input.primaryIndex - 1;
  const x = input.readingPath === 'center-out'
    ? input.index === input.primaryIndex
      ? input.width * 0.58
      : input.index < input.primaryIndex
        ? marginX + (input.width * 0.36 * input.index) / Math.max(1, beforePrimaryCount - 1)
        : input.width * 0.82 + (input.width * 0.1 * (input.index - input.primaryIndex - 1)) / Math.max(1, afterPrimaryCount - 1)
    : input.count === 1
      ? input.width / 2
      : marginX + (usableWidth * input.index) / (input.count - 1);
  if (input.index === input.primaryIndex) return { x, baselineY: input.height * 0.34 };
  return { x, baselineY: input.height * 0.46 };
}

function relationNode(input: {
  relationId: string;
  nodeId: string;
  fromX: number;
  toX: number;
  flowY: number;
  primary: boolean;
}): RenderNode {
  return vectorNode({
    nodeId: input.nodeId,
    shape: 'line',
    box: {
      x: input.fromX,
      y: input.flowY,
      width: input.toX - input.fromX,
      height: 1,
    },
    stroke: input.primary ? '#D75043' : '#5C827E',
    strokeWidth: input.primary ? 8 : 4,
    relationId: input.relationId,
    zIndex: 1,
  });
}

/**
 * 모든 causal/sequence SlideIR에 적용 가능한 첫 RenderTree layout이다.
 * fixture-specific ID나 특정 블록 개수에는 의존하지 않는다.
 */
export function buildInformationRenderTree(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  plan: CompositionPlan;
  measures: Map<string, TextMeasurement>;
  fonts: FontAsset[];
}) {
  if (input.plan.informationPlanId !== input.informationPlan.informationPlanId) {
    throw new Error('다른 InformationPlan의 CompositionPlan을 렌더링할 수 없습니다.');
  }
  const orderedBlocks = input.informationPlan.readingOrder.map((blockId) => {
    const block = input.slide.blocks.find((candidate) => candidate.id === blockId);
    if (block === undefined) throw new Error(`SlideIR block을 찾을 수 없습니다: ${blockId}`);
    return block;
  });
  const primaryIndex = orderedBlocks.findIndex((block) => block.id === input.informationPlan.primaryArtifactBlockId);
  if (primaryIndex < 0) throw new Error('InformationPlan의 주요 block을 찾을 수 없습니다.');

  const positions = orderedBlocks.map((_, index) =>
    positionForBlock({
      index,
      count: orderedBlocks.length,
      primaryIndex,
      width: input.plan.pageProfile.width,
      height: input.plan.pageProfile.height,
      readingPath: input.plan.layout.readingPath,
    }),
  );
  const nodes: RenderNode[] = [];
  const primaryPosition = positions[primaryIndex]!;
  nodes.push(vectorNode({
    nodeId: 'primary-emphasis',
    shape: 'ellipse',
    box: {
      x: primaryPosition.x - 122,
      y: primaryPosition.baselineY - 124,
      width: 244,
      height: 170,
    },
    fill: '#F3D7D1',
    semanticBlockId: input.informationPlan.primaryArtifactBlockId,
    zIndex: 0,
  }));

  for (const [blockIndex, block] of orderedBlocks.entries()) {
    const position = positions[blockIndex]!;
    const refs = contentRefsForBlock(block);
    const spacing = 58;
    const firstBaseline = position.baselineY - ((refs.length - 1) * spacing) / 2;
    refs.forEach((ref, refIndex) => {
      const measurement = requiredMeasurement(input.measures, block.id, refIndex);
      nodes.push(measuredTextNode({
        nodeId: `text-${block.id}-${refIndex}`,
        semanticBlockId: block.id,
        text: ref.text,
        sourceSpanIds: ref.sourceSpanIds,
        x: position.x,
        baselineY: firstBaseline + refIndex * spacing,
        align: 'center',
        color: block.id === input.informationPlan.primaryArtifactBlockId ? '#B43E32' : '#1E2726',
        measurement,
        fonts: input.fonts,
        zIndex: 3,
      }));
    });
  }

  const positionsByBlockId = new Map(orderedBlocks.map((block, index) => [block.id, positions[index]!]));
  for (const relation of input.slide.relations) {
    const from = positionsByBlockId.get(relation.fromBlockId);
    const to = positionsByBlockId.get(relation.toBlockId);
    if (from === undefined || to === undefined) continue;
    nodes.push(relationNode({
      relationId: relation.id,
      nodeId: `relation-${relation.id}`,
      fromX: from.x,
      toX: to.x,
      flowY: input.plan.pageProfile.height * 0.59,
      primary: relation.toBlockId === input.informationPlan.primaryArtifactBlockId || relation.fromBlockId === input.informationPlan.primaryArtifactBlockId,
    }));
  }

  return RenderTreeSchema.parse({
    schemaVersion: '0.1',
    renderTreeId: `render-${input.plan.planId}`,
    compositionPlanId: input.plan.planId,
    slideId: input.slide.slideId,
    pageProfile: input.plan.pageProfile,
    background: '#F6F3ED',
    nodes,
    deterministicFingerprint: contentHash({
      slideId: input.slide.slideId,
      informationPlanId: input.informationPlan.informationPlanId,
      compositionPlanId: input.plan.planId,
      fonts: input.fonts.map((font) => font.fileHash),
      layoutVersion: 'information-flow-v1',
    }),
  });
}
