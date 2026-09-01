import { access, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  MEC_01_SLIDE_IR,
} from '../../../contracts/fixtures/mec-01.js';
import {
  PAGE_PROFILES,
  RenderTreeSchema,
  contentHash,
  hasSevereFindings,
  validateRenderTreeAgainstSlide,
  type RenderNode,
  type RenderTree,
} from '@game-presentation/contracts';
import { exportRenderTree } from '../export.js';
import { fontSetHash, loadFontAsset, type FontAsset } from '../font.js';
import { measureTextBatch, type TextMeasurement } from '../measure.js';
import { launchRenderBrowser } from '../browser.js';
import { validatePdfArtifact } from '../pdf-validation.js';
import { validateLayout } from '../layout-validation.js';
import { comparePngs, rasterizeFirstPdfPage } from '../image-validation.js';

const COLORS = {
  background: '#0A2030',
  ink: '#F4F1E8',
  muted: '#76A3AE',
  grid: '#234252',
  mint: '#95EADB',
  mintField: '#153E49',
  coral: '#FF6A5D',
  coralField: '#5B343A',
} as const;

async function firstExisting(paths: string[]): Promise<string> {
  for (const path of paths) {
    try {
      await access(path);
      return path;
    } catch {
      // Continue to the next explicit candidate.
    }
  }
  throw new Error('Pretendard font files were not found.');
}

async function loadProofFonts(): Promise<FontAsset[]> {
  const localFonts = join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'Windows', 'Fonts');
  const regular = await firstExisting([
    join(localFonts, 'Pretendard-Regular.ttf'),
    join(localFonts, 'Pretendard-Regular.otf'),
  ]);
  const bold = await firstExisting([
    join(localFonts, 'Pretendard-Bold.ttf'),
    join(localFonts, 'Pretendard-Bold.otf'),
  ]);
  const extraBold = await firstExisting([
    join(localFonts, 'Pretendard-ExtraBold.ttf'),
    join(localFonts, 'Pretendard-ExtraBold.otf'),
  ]);
  return Promise.all([
    loadFontAsset({ family: 'Pretendard', weight: 400, path: regular }),
    loadFontAsset({ family: 'Pretendard', weight: 700, path: bold }),
    loadFontAsset({ family: 'Pretendard', weight: 800, path: extraBold }),
  ]);
}

function requireMeasure(measures: Map<string, TextMeasurement>, key: string): TextMeasurement {
  const value = measures.get(key);
  if (value === undefined) throw new Error('Missing text measurement: ' + key);
  return value;
}

function textNode(input: {
  nodeId: string;
  semanticBlockId?: string;
  text: string;
  sourceSpanIds: string[];
  x: number;
  baselineY: number;
  align: 'start' | 'center' | 'end';
  color: string;
  measurement: TextMeasurement;
  fontHash: string;
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
      fileHash: input.fontHash,
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

function shapeNode(input: {
  nodeId: string;
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

function buildTree(input: {
  measures: Map<string, TextMeasurement>;
  fonts: FontAsset[];
}): RenderTree {
  const fontHash = new Map(input.fonts.map((font) => [font.weight, font.fileHash]));
  const nodes: RenderNode[] = [];

  for (const y of [250, 430, 610, 790]) {
    nodes.push(
      shapeNode({
        nodeId: 'grid-' + String(y),
        shape: 'line',
        box: { x: 120, y, width: 1680, height: 1 },
        stroke: COLORS.grid,
        strokeWidth: 1,
        opacity: 0.6,
        zIndex: 0,
      }),
    );
  }

  nodes.push(
    shapeNode({
      nodeId: 'dodge-flow',
      shape: 'path',
      box: { x: 150, y: 475, width: 300, height: 180 },
      stroke: COLORS.mint,
      strokeWidth: 7,
      pathData:
        'M150 635 L205 635 C225 635 225 550 250 550 C275 550 275 635 300 635 ' +
        'C325 635 325 500 355 500 C385 500 385 635 415 635 L450 635',
      semanticBlockId: 'dodge-step',
      zIndex: 3,
    }),
    shapeNode({
      nodeId: 'dodge-dot-1',
      shape: 'ellipse',
      box: { x: 238, y: 538, width: 24, height: 24 },
      fill: COLORS.mint,
      semanticBlockId: 'dodge-step',
      zIndex: 4,
    }),
    shapeNode({
      nodeId: 'dodge-dot-2',
      shape: 'ellipse',
      box: { x: 343, y: 488, width: 24, height: 24 },
      fill: COLORS.mint,
      semanticBlockId: 'dodge-step',
      zIndex: 4,
    }),
    shapeNode({
      nodeId: 'dodge-dot-3',
      shape: 'ellipse',
      box: { x: 403, y: 623, width: 24, height: 24 },
      fill: COLORS.mint,
      semanticBlockId: 'dodge-step',
      zIndex: 4,
    }),
    textNode({
      nodeId: 'dodge-label',
      semanticBlockId: 'dodge-step',
      text: '회피 ×3',
      sourceSpanIds: ['dodge'],
      x: 150,
      baselineY: 455,
      align: 'start',
      color: COLORS.mint,
      measurement: requireMeasure(input.measures, 'dodge'),
      fontHash: fontHash.get(700)!,
    }),
  );

  nodes.push(
    shapeNode({
      nodeId: 'relation-dodge-fragment',
      shape: 'line',
      box: { x: 450, y: 635, width: 90, height: 1 },
      stroke: COLORS.mint,
      strokeWidth: 7,
      relationId: 'r-dodge-fragment',
      zIndex: 2,
    }),
    shapeNode({
      nodeId: 'fragment-diamond',
      shape: 'path',
      box: { x: 520, y: 595, width: 80, height: 80 },
      fill: COLORS.mint,
      stroke: COLORS.mint,
      strokeWidth: 2,
      pathData: 'M560 595 L600 635 L560 675 L520 635 Z',
      semanticBlockId: 'fragment-resource',
      zIndex: 4,
    }),
    textNode({
      nodeId: 'fragment-label',
      semanticBlockId: 'fragment-resource',
      text: '시간 파편 획득',
      sourceSpanIds: ['fragment'],
      x: 560,
      baselineY: 735,
      align: 'center',
      color: COLORS.ink,
      measurement: requireMeasure(input.measures, 'fragment'),
      fontHash: fontHash.get(700)!,
    }),
  );

  nodes.push(
    shapeNode({
      nodeId: 'relation-fragment-freeze',
      shape: 'line',
      box: { x: 600, y: 635, width: 90, height: 1 },
      stroke: COLORS.mint,
      strokeWidth: 7,
      relationId: 'r-fragment-freeze',
      zIndex: 2,
    }),
    shapeNode({
      nodeId: 'freeze-field',
      shape: 'rect',
      box: { x: 690, y: 300, width: 400, height: 510 },
      fill: COLORS.mintField,
      stroke: COLORS.mint,
      strokeWidth: 3,
      opacity: 0.92,
      semanticBlockId: 'freeze-step',
      zIndex: 1,
    }),
  );
  for (let index = 1; index < 5; index += 1) {
    const x = 690 + index * 80;
    nodes.push(
      shapeNode({
        nodeId: 'freeze-tick-' + String(index),
        shape: 'line',
        box: { x, y: 330, width: 1, height: 450 },
        stroke: COLORS.muted,
        strokeWidth: 1,
        opacity: 0.4,
        semanticBlockId: 'freeze-step',
        zIndex: 2,
      }),
    );
  }
  nodes.push(
    textNode({
      nodeId: 'freeze-label',
      semanticBlockId: 'freeze-step',
      text: '시간 정지 5초',
      sourceSpanIds: ['freeze'],
      x: 890,
      baselineY: 585,
      align: 'center',
      color: COLORS.ink,
      measurement: requireMeasure(input.measures, 'freeze'),
      fontHash: fontHash.get(800)!,
      zIndex: 5,
    }),
  );

  nodes.push(
    shapeNode({
      nodeId: 'break-fracture',
      shape: 'path',
      box: { x: 1085, y: 245, width: 120, height: 600 },
      stroke: COLORS.coral,
      strokeWidth: 12,
      pathData: 'M1140 245 L1105 395 L1175 500 L1110 610 L1170 700 L1135 845',
      semanticBlockId: 'break-state',
      relationId: 'r-freeze-break',
      zIndex: 5,
    }),
    textNode({
      nodeId: 'break-label',
      semanticBlockId: 'break-state',
      text: 'BREAK',
      sourceSpanIds: ['break'],
      x: 1195,
      baselineY: 385,
      align: 'start',
      color: COLORS.coral,
      measurement: requireMeasure(input.measures, 'break'),
      fontHash: fontHash.get(800)!,
      zIndex: 7,
    }),
  );

  nodes.push(
    shapeNode({
      nodeId: 'result-field',
      shape: 'path',
      box: { x: 1170, y: 420, width: 610, height: 390 },
      fill: COLORS.coralField,
      opacity: 0.9,
      pathData: 'M1170 545 L1780 420 L1780 810 L1170 665 Z',
      semanticBlockId: 'damage-modifier',
      zIndex: 1,
    }),
    shapeNode({
      nodeId: 'relation-break-damage',
      shape: 'line',
      box: { x: 1160, y: 635, width: 620, height: 1 },
      stroke: COLORS.coral,
      strokeWidth: 7,
      relationId: 'r-break-damage',
      zIndex: 3,
    }),
    textNode({
      nodeId: 'damage-value',
      semanticBlockId: 'damage-modifier',
      text: '+50%',
      sourceSpanIds: ['damage-value'],
      x: 1570,
      baselineY: 615,
      align: 'center',
      color: COLORS.coral,
      measurement: requireMeasure(input.measures, 'damage-value'),
      fontHash: fontHash.get(800)!,
      zIndex: 6,
    }),
    textNode({
      nodeId: 'damage-label',
      semanticBlockId: 'damage-modifier',
      text: '받는 피해',
      sourceSpanIds: ['damage-label'],
      x: 1570,
      baselineY: 685,
      align: 'center',
      color: COLORS.ink,
      measurement: requireMeasure(input.measures, 'damage-label'),
      fontHash: fontHash.get(700)!,
      zIndex: 6,
    }),
  );

  const fingerprint = contentHash({
    slide: MEC_01_SLIDE_IR,
    pageProfile: PAGE_PROFILES.pdfPresentation,
    proofLayout: 'mec-01-render-contract-proof-v1',
    fontSetHash: fontSetHash(input.fonts),
  });
  return RenderTreeSchema.parse({
    schemaVersion: '0.1',
    renderTreeId: 'render-mec-01-proof-v1',
    compositionPlanId: 'plan-mec-01-proof-v1',
    slideId: MEC_01_SLIDE_IR.slideId,
    pageProfile: PAGE_PROFILES.pdfPresentation,
    background: COLORS.background,
    nodes,
    deterministicFingerprint: fingerprint,
  });
}

async function main(): Promise<void> {
  const fonts = await loadProofFonts();
  const browser = await launchRenderBrowser();
  try {
    const measures = await measureTextBatch(browser, fonts, [
      { key: 'dodge', text: '회피 ×3', family: 'Pretendard', weight: 700, size: 34, letterSpacing: -0.3 },
      { key: 'fragment', text: '시간 파편 획득', family: 'Pretendard', weight: 700, size: 30, letterSpacing: -0.3 },
      { key: 'freeze', text: '시간 정지 5초', family: 'Pretendard', weight: 800, size: 56, letterSpacing: -1 },
      { key: 'break', text: 'BREAK', family: 'Pretendard', weight: 800, size: 96, letterSpacing: 1 },
      { key: 'damage-value', text: '+50%', family: 'Pretendard', weight: 800, size: 110, letterSpacing: -1 },
      { key: 'damage-label', text: '받는 피해', family: 'Pretendard', weight: 700, size: 32, letterSpacing: -0.3 },
    ]);
    const tree = buildTree({ measures, fonts });
    const findings = [
      ...validateRenderTreeAgainstSlide(tree, MEC_01_SLIDE_IR),
      ...validateLayout(tree),
    ];
    if (hasSevereFindings(findings)) {
      throw new Error('RenderTree hard validation failed: ' + JSON.stringify(findings));
    }
    const outputDir = resolve('output', 'pdf', 'mec-01-proof');
    const outputs = await exportRenderTree({
      browser,
      tree,
      fonts,
      outputDir,
      basename: 'mec-01-deterministic-proof',
    });
    const pdfValidation = await validatePdfArtifact({
      pdfPath: outputs.pdfPath,
      requiredText: tree.nodes.flatMap((node) =>
        node.kind === 'text' && node.visible ? [node.text] : [],
      ),
      expectedPageCount: 1,
      expectedAspectRatio: 16 / 9,
    });
    if (!pdfValidation.passed) {
      throw new Error('PDF validation failed: ' + JSON.stringify(pdfValidation));
    }
    const pdfRasterPath = await rasterizeFirstPdfPage({
      pdfPath: outputs.pdfPath,
      outputPrefix: resolve('tmp', 'pdfs', 'mec-01-proof', 'pdf-render'),
      dpi: 96,
    });
    const rasterComparison = await comparePngs({
      expectedPath: outputs.pngPath,
      actualPath: pdfRasterPath,
      maximumRootMeanSquareDifference: 12,
      maximumChangedPixelFraction: 0.14,
    });
    if (!rasterComparison.passed) {
      throw new Error('PNG/PDF visual comparison failed: ' + JSON.stringify(rasterComparison));
    }
    const qaPath = join(outputDir, 'mec-01-deterministic-proof.qa.json');
    await writeFile(
      qaPath,
      JSON.stringify({ findings, pdfValidation, rasterComparison }, null, 2) + '\n',
      'utf8',
    );
    process.stdout.write(
      JSON.stringify({ outputs, qaPath, findings, pdfValidation, rasterComparison }, null, 2) + '\n',
    );
  } finally {
    await browser.close();
  }
}

await main();
