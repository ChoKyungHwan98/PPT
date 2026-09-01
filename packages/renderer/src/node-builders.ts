import type { RenderNode } from '@game-presentation/contracts';
import type { FontAsset } from './font.js';
import type { TextMeasurement } from './measure.js';

export function fontHashForWeight(fonts: FontAsset[], weight: number): string {
  const exact = fonts.find((font) => font.weight === weight);
  if (exact !== undefined) return exact.fileHash;
  const nearest = [...fonts].sort(
    (left, right) => Math.abs(left.weight - weight) - Math.abs(right.weight - weight),
  )[0];
  if (nearest === undefined) throw new Error('font asset이 없습니다.');
  return nearest.fileHash;
}

export function measuredTextNode(input: {
  nodeId: string;
  parentId?: string;
  semanticBlockId?: string;
  text: string;
  sourceSpanIds: string[];
  x: number;
  baselineY: number;
  align: 'start' | 'center' | 'end';
  color: string;
  measurement: TextMeasurement;
  fonts: FontAsset[];
  zIndex?: number;
}): RenderNode {
  const height =
    input.measurement.actualBoundingBoxAscent + input.measurement.actualBoundingBoxDescent + 8;
  const left =
    input.align === 'center'
      ? input.x - input.measurement.width / 2
      : input.align === 'end'
        ? input.x - input.measurement.width
        : input.x;
  return {
    nodeId: input.nodeId,
    kind: 'text',
    ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
    ...(input.semanticBlockId === undefined ? {} : { semanticBlockId: input.semanticBlockId }),
    zIndex: input.zIndex ?? 5,
    box: {
      x: Math.max(0, left - 4),
      y: input.baselineY - input.measurement.actualBoundingBoxAscent - 4,
      width: input.measurement.width + 8,
      height,
    },
    clip: false,
    visible: true,
    text: input.text,
    sourceSpanIds: input.sourceSpanIds,
    sourceTransform: { kind: 'exact' },
    font: {
      family: input.measurement.family,
      fileHash: fontHashForWeight(input.fonts, input.measurement.weight),
      size: input.measurement.size,
      weight: input.measurement.weight,
      lineHeight: Math.ceil(input.measurement.size * 1.25),
      letterSpacing: input.measurement.letterSpacing,
    },
    color: input.color,
    align: input.align,
    lines: [
      {
        text: input.text,
        x: input.x,
        baselineY: input.baselineY,
        advanceWidth: input.measurement.width,
      },
    ],
  };
}

export function vectorNode(input: {
  nodeId: string;
  parentId?: string;
  shape: 'rect' | 'round-rect' | 'ellipse' | 'line' | 'path';
  box: { x: number; y: number; width: number; height: number };
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  pathData?: string;
  semanticBlockId?: string;
  relationId?: string;
  zIndex?: number;
}): RenderNode {
  return {
    nodeId: input.nodeId,
    kind: 'shape',
    ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
    ...(input.semanticBlockId === undefined ? {} : { semanticBlockId: input.semanticBlockId }),
    ...(input.relationId === undefined ? {} : { relationId: input.relationId }),
    zIndex: input.zIndex ?? 2,
    box: input.box,
    clip: false,
    visible: true,
    shape: input.shape,
    paint: {
      ...(input.fill === undefined ? {} : { fill: input.fill }),
      ...(input.stroke === undefined ? {} : { stroke: input.stroke }),
      ...(input.strokeWidth === undefined ? {} : { strokeWidth: input.strokeWidth }),
      ...(input.opacity === undefined ? {} : { opacity: input.opacity }),
    },
    ...(input.pathData === undefined ? {} : { pathData: input.pathData }),
  };
}
