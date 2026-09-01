import type { ReferenceImageAnalysis } from './image-analysis.js';
import type { OcrResult } from './ocr.js';

export type PageStructureAnalysis = {
  densityBand: 'sparse' | 'balanced' | 'dense';
  focalRegion: { column: number; row: number };
  horizontalBalance: number;
  verticalBalance: number;
  hierarchyStrength: number;
  typographyScaleCount: number;
  readingPathCandidates: Array<
    'left-to-right' | 'top-to-bottom' | 'center-out' | 'guided-sequence'
  >;
  graphicLanguageTags: string[];
  confidence: number;
};

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function standardDeviation(values: number[]): number {
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

export function analyzePageStructure(input: {
  image: ReferenceImageAnalysis;
  ocr: OcrResult;
}): PageStructureAnalysis {
  const meanInk = average(input.image.regions.map((region) => region.inkDensity));
  const densityBand =
    meanInk < 0.18 && input.image.edgeDensity < 0.08
      ? 'sparse'
      : meanInk > 0.46 || input.image.edgeDensity > 0.2
        ? 'dense'
        : 'balanced';
  const focal = [...input.image.regions].sort(
    (left, right) =>
      right.inkDensity - left.inkDensity ||
      Math.abs(left.column - 1) + Math.abs(left.row - 1) -
        (Math.abs(right.column - 1) + Math.abs(right.row - 1)),
  )[0] ?? { column: 1, row: 1, inkDensity: 0, meanLuminance: 0 };
  const columnInk = [0, 1, 2].map((column) =>
    average(
      input.image.regions
        .filter((region) => region.column === column)
        .map((region) => region.inkDensity),
    ),
  );
  const rowInk = [0, 1, 2].map((row) =>
    average(
      input.image.regions.filter((region) => region.row === row).map((region) => region.inkDensity),
    ),
  );
  const horizontalBalance = 1 - Math.min(1, Math.abs((columnInk[0] ?? 0) - (columnInk[2] ?? 0)));
  const verticalBalance = 1 - Math.min(1, Math.abs((rowInk[0] ?? 0) - (rowInk[2] ?? 0)));

  const textAreas = input.ocr.regions
    .map((region) => region.box.width * region.box.height)
    .filter((area) => area > 0)
    .sort((left, right) => left - right);
  const medianArea = textAreas[Math.floor(textAreas.length / 2)] ?? 0;
  const largestArea = textAreas[textAreas.length - 1] ?? 0;
  const hierarchyStrength =
    medianArea === 0 ? 0 : Math.min(4, largestArea / medianArea);
  const heightBuckets = new Set(
    input.ocr.regions.map((region) => Math.round(Math.log2(Math.max(1, region.box.height)))),
  );
  const typographyScaleCount = heightBuckets.size;

  const readingPathCandidates: PageStructureAnalysis['readingPathCandidates'] = [];
  if (focal.column === 1 && focal.row === 1) readingPathCandidates.push('center-out');
  if (standardDeviation(columnInk) >= standardDeviation(rowInk)) {
    readingPathCandidates.push('left-to-right');
  } else {
    readingPathCandidates.push('top-to-bottom');
  }
  if (input.ocr.regions.length >= 3) readingPathCandidates.push('guided-sequence');

  const graphicLanguageTags: string[] = [];
  if (input.image.meanLuminance < 0.35) graphicLanguageTags.push('dark-field');
  if (input.image.meanLuminance > 0.75) graphicLanguageTags.push('light-field');
  if (input.image.whitespaceRatio > 0.55) graphicLanguageTags.push('editorial-whitespace');
  if (densityBand === 'dense') graphicLanguageTags.push('dense-information');
  if (hierarchyStrength >= 2) graphicLanguageTags.push('strong-type-hierarchy');
  if (input.image.palette.length <= 3) graphicLanguageTags.push('restricted-palette');

  const confidence =
    input.ocr.provider === 'noop'
      ? 0.45
      : Math.min(1, 0.55 + input.ocr.meanConfidence * 0.45);
  return {
    densityBand,
    focalRegion: { column: focal.column, row: focal.row },
    horizontalBalance: Math.round(horizontalBalance * 10000) / 10000,
    verticalBalance: Math.round(verticalBalance * 10000) / 10000,
    hierarchyStrength: Math.round(hierarchyStrength * 10000) / 10000,
    typographyScaleCount,
    readingPathCandidates: [...new Set(readingPathCandidates)],
    graphicLanguageTags,
    confidence,
  };
}
