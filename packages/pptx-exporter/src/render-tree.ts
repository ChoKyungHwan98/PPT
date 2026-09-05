import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import type { RenderNode, RenderTree } from '@game-presentation/contracts';

const PptxGenJS = createRequire(import.meta.url)('pptxgenjs') as typeof import('pptxgenjs').default;

const SLIDE_WIDTH_IN = 13.333333;
const SLIDE_HEIGHT_IN = 7.5;

type Presentation = InstanceType<typeof PptxGenJS>;
type Slide = ReturnType<Presentation['addSlide']>;
type ShapeNode = Extract<RenderNode, { kind: 'shape' }>;

function color(value: string | undefined, fallback = '000000'): string {
  return (value ?? `#${fallback}`).slice(1, 7).toUpperCase();
}

function transparency(opacity: number | undefined): number {
  return Math.round((1 - (opacity ?? 1)) * 100);
}

function xIn(tree: RenderTree, value: number): number {
  return value / tree.pageProfile.width * SLIDE_WIDTH_IN;
}

function yIn(tree: RenderTree, value: number): number {
  return value / tree.pageProfile.height * SLIDE_HEIGHT_IN;
}

function relationAltText(node: RenderNode): string {
  return [
    `node:${node.nodeId}`,
    node.semanticBlockId === undefined ? undefined : `block:${node.semanticBlockId}`,
    node.relationId === undefined ? undefined : `relation:${node.relationId}`,
  ].filter((value): value is string => value !== undefined).join(';');
}

type PathPoint = { x: number; y: number };
type PathSegment = { from: PathPoint; to: PathPoint };

/** V1 RenderTree가 사용하는 절대 M/L/H/V path를 native line segment로 변환한다. */
function orthogonalPathSegments(pathData: string): PathSegment[] {
  const tokens = pathData.match(/[MLHV]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/giu) ?? [];
  const segments: PathSegment[] = [];
  let cursor: PathPoint | undefined;
  let index = 0;
  while (index < tokens.length) {
    const command = tokens[index++]?.toUpperCase();
    if (command === 'M') {
      const x = Number(tokens[index++]);
      const y = Number(tokens[index++]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`잘못된 path move: ${pathData}`);
      cursor = { x, y };
    } else if (command === 'L') {
      if (cursor === undefined) throw new Error(`move 없이 line이 시작됐습니다: ${pathData}`);
      const to = { x: Number(tokens[index++]), y: Number(tokens[index++]) };
      if (!Number.isFinite(to.x) || !Number.isFinite(to.y)) throw new Error(`잘못된 path line: ${pathData}`);
      segments.push({ from: cursor, to });
      cursor = to;
    } else if (command === 'H') {
      if (cursor === undefined) throw new Error(`move 없이 horizontal line이 시작됐습니다: ${pathData}`);
      const to = { x: Number(tokens[index++]), y: cursor.y };
      if (!Number.isFinite(to.x)) throw new Error(`잘못된 horizontal path: ${pathData}`);
      segments.push({ from: cursor, to });
      cursor = to;
    } else if (command === 'V') {
      if (cursor === undefined) throw new Error(`move 없이 vertical line이 시작됐습니다: ${pathData}`);
      const to = { x: cursor.x, y: Number(tokens[index++]) };
      if (!Number.isFinite(to.y)) throw new Error(`잘못된 vertical path: ${pathData}`);
      segments.push({ from: cursor, to });
      cursor = to;
    } else {
      throw new Error(`editable PPTX에서 지원하지 않는 path command입니다: ${String(command)}`);
    }
  }
  if (segments.length === 0) throw new Error(`선분이 없는 path입니다: ${pathData}`);
  return segments;
}

function addNativeLine(slide: Slide, tree: RenderTree, node: ShapeNode, from: PathPoint, to: PathPoint): void {
  slide.addShape('line', {
    x: xIn(tree, from.x),
    y: yIn(tree, from.y),
    w: xIn(tree, to.x - from.x),
    h: yIn(tree, to.y - from.y),
    line: {
      color: color(node.paint.stroke),
      width: (node.paint.strokeWidth ?? 1) * 0.75,
      transparency: transparency(node.paint.opacity),
    },
    objectName: relationAltText(node),
  });
}

function addShape(slide: Slide, tree: RenderTree, node: ShapeNode): void {
  if (node.shape === 'path') {
    if (node.pathData === undefined) throw new Error(`pathData가 없습니다: ${node.nodeId}`);
    for (const segment of orthogonalPathSegments(node.pathData)) {
      addNativeLine(slide, tree, node, segment.from, segment.to);
    }
    return;
  }
  if (node.shape === 'polygon') {
    throw new Error(`V1 editable PPTX에서 polygon은 fail-closed 처리합니다: ${node.nodeId}`);
  }
  const shapeType = node.shape === 'round-rect' ? 'roundRect' : node.shape;
  slide.addShape(shapeType, {
    x: xIn(tree, node.box.x),
    y: yIn(tree, node.box.y),
    w: xIn(tree, node.box.width),
    h: yIn(tree, node.box.height),
    fill: node.paint.fill === undefined
      ? { color: 'FFFFFF', transparency: 100 }
      : { color: color(node.paint.fill), transparency: transparency(node.paint.opacity) },
    line: node.paint.stroke === undefined
      ? { color: 'FFFFFF', transparency: 100 }
      : {
          color: color(node.paint.stroke),
          width: (node.paint.strokeWidth ?? 1) * 0.75,
          transparency: transparency(node.paint.opacity),
        },
    objectName: relationAltText(node),
  });
}

function addText(slide: Slide, tree: RenderTree, node: Extract<RenderNode, { kind: 'text' }>): void {
  slide.addText(node.text, {
    x: xIn(tree, node.box.x),
    y: yIn(tree, node.box.y),
    w: xIn(tree, node.box.width),
    h: yIn(tree, node.box.height),
    fontFace: node.font.family,
    fontSize: node.font.size * 0.75,
    bold: node.font.weight >= 700,
    color: color(node.color),
    align: node.align === 'start' ? 'left' : node.align === 'end' ? 'right' : 'center',
    valign: 'middle',
    margin: 0,
    breakLine: false,
    fit: 'shrink',
    objectName: relationAltText(node),
  });
}

export function createEditablePptxFromRenderTree(tree: RenderTree): Presentation {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'GAME_PRESENTATION_16_9', width: SLIDE_WIDTH_IN, height: SLIDE_HEIGHT_IN });
  pptx.layout = 'GAME_PRESENTATION_16_9';
  pptx.author = 'GAME PPT DESIGNER NEXT';
  pptx.company = 'GAME PPT DESIGNER NEXT';
  pptx.subject = 'RenderTree editable compatibility output';
  pptx.title = tree.slideId;
  pptx.theme = { headFontFace: 'Pretendard', bodyFontFace: 'Pretendard' };
  const slide = pptx.addSlide();
  slide.background = { color: color(tree.background) };
  for (const node of [...tree.nodes].filter((candidate) => candidate.visible).sort((left, right) => left.zIndex - right.zIndex)) {
    if (node.kind === 'group') continue;
    if (node.kind === 'image') {
      throw new Error(`editable PPTX는 image node를 자동 raster fallback하지 않습니다: ${node.nodeId}`);
    }
    if (node.kind === 'text') addText(slide, tree, node);
    else addShape(slide, tree, node);
  }
  return pptx;
}

export async function writeEditablePptxFromRenderTree(tree: RenderTree, outputPath: string): Promise<string> {
  await createEditablePptxFromRenderTree(tree).writeFile({ fileName: outputPath });
  return outputPath;
}

function decodeXml(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

export type EditablePptxValidationReport = {
  slideCount: number;
  editableTextRunCount: number;
  nativeShapeCount: number;
  nativeLineCount: number;
  pictureCount: number;
  mediaAssetCount: number;
  missingRequiredText: string[];
  missingRelationIds: string[];
  pretendardDeclared: boolean;
  oneSlide16By9: boolean;
  passed: boolean;
};

export async function validateEditablePptxArtifact(input: {
  pptxPath: string;
  requiredText: string[];
  requiredRelationIds: string[];
}): Promise<EditablePptxValidationReport> {
  const archive = unzipSync(new Uint8Array(await readFile(input.pptxPath)));
  const names = Object.keys(archive);
  const slideNames = names.filter((name) => /^ppt\/slides\/slide\d+\.xml$/u.test(name));
  const slideXml = slideNames.map((name) => new TextDecoder().decode(archive[name])).join('\n');
  const presentationXml = new TextDecoder().decode(archive['ppt/presentation.xml']);
  const textRuns = [...slideXml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/gu)].map((match) => decodeXml(match[1] ?? ''));
  const compact = (value: string): string => value.replace(/\s+/gu, '');
  const joinedText = compact(textRuns.join(' '));
  const missingRequiredText = input.requiredText.filter((text) => !joinedText.includes(compact(text)));
  const missingRelationIds = input.requiredRelationIds.filter((relationId) => !slideXml.includes(`relation:${relationId}`));
  const pictureCount = (slideXml.match(/<p:pic\b/gu) ?? []).length;
  const mediaAssetCount = names.filter((name) => name.startsWith('ppt/media/') && !name.endsWith('/')).length;
  const nativeShapeCount = (slideXml.match(/<p:sp\b/gu) ?? []).length;
  const nativeLineCount = (slideXml.match(/<a:prstGeom\s+prst="line"/gu) ?? []).length;
  const pretendardDeclared = slideXml.includes('typeface="Pretendard"');
  const slideSize = /<p:sldSz\s+cx="(\d+)"\s+cy="(\d+)"/u.exec(presentationXml);
  const ratio = slideSize === null ? 0 : Number(slideSize[1]) / Number(slideSize[2]);
  const oneSlide16By9 = slideNames.length === 1 && Math.abs(ratio - 16 / 9) < 0.001;
  const passed =
    oneSlide16By9 &&
    textRuns.length >= input.requiredText.length &&
    nativeShapeCount > textRuns.length &&
    nativeLineCount > 0 &&
    pictureCount === 0 &&
    mediaAssetCount === 0 &&
    missingRequiredText.length === 0 &&
    missingRelationIds.length === 0 &&
    pretendardDeclared;
  return {
    slideCount: slideNames.length,
    editableTextRunCount: textRuns.length,
    nativeShapeCount,
    nativeLineCount,
    pictureCount,
    mediaAssetCount,
    missingRequiredText,
    missingRelationIds,
    pretendardDeclared,
    oneSlide16By9,
    passed,
  };
}
