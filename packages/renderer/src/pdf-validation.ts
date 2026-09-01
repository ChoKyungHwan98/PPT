import { readFile } from 'node:fs/promises';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

export type PdfValidationReport = {
  pageCount: number;
  widthPoints: number;
  heightPoints: number;
  extractedText: string;
  missingRequiredText: string[];
  embeddedFontProgramCount: number;
  imagePaintCount: number;
  vectorPaintCount: number;
  passed: boolean;
};

function compact(value: string): string {
  return value.replace(/\s+/g, '');
}

export async function validatePdfArtifact(input: {
  pdfPath: string;
  requiredText: string[];
  expectedPageCount: number;
  expectedAspectRatio: number;
}): Promise<PdfValidationReport> {
  const bytes = await readFile(input.pdfPath);
  const document = await getDocument({ data: new Uint8Array(bytes) }).promise;
  const page = await document.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent();
  const extractedText = textContent.items
    .map((item) => ('str' in item ? item.str : ''))
    .filter((text) => text.length > 0)
    .join(' ');
  const compactText = compact(extractedText);
  const missingRequiredText = input.requiredText.filter((text) => !compactText.includes(compact(text)));
  const operatorList = await page.getOperatorList();
  const imageOps = new Set<number>([
    OPS.paintImageMaskXObject,
    OPS.paintImageMaskXObjectGroup,
    OPS.paintImageXObject,
    OPS.paintInlineImageXObject,
    OPS.paintInlineImageXObjectGroup,
    OPS.paintSolidColorImageMask,
  ]);
  const vectorOps = new Set<number>([
    OPS.constructPath,
    OPS.stroke,
    OPS.fill,
    OPS.eoFill,
    OPS.fillStroke,
    OPS.eoFillStroke,
  ]);
  const imagePaintCount = operatorList.fnArray.filter((operation) => imageOps.has(operation)).length;
  const vectorPaintCount = operatorList.fnArray.filter((operation) => vectorOps.has(operation)).length;
  const pdfLatin = bytes.toString('latin1');
  const embeddedFontProgramCount =
    (pdfLatin.match(/\/FontFile2\b/g) ?? []).length + (pdfLatin.match(/\/FontFile3\b/g) ?? []).length;
  const aspectRatio = viewport.width / viewport.height;
  const aspectMatches = Math.abs(aspectRatio - input.expectedAspectRatio) < 0.001;
  const passed =
    document.numPages === input.expectedPageCount &&
    missingRequiredText.length === 0 &&
    embeddedFontProgramCount > 0 &&
    imagePaintCount === 0 &&
    vectorPaintCount > 0 &&
    aspectMatches;
  const report = {
    pageCount: document.numPages,
    widthPoints: viewport.width,
    heightPoints: viewport.height,
    extractedText,
    missingRequiredText,
    embeddedFontProgramCount,
    imagePaintCount,
    vectorPaintCount,
    passed,
  };
  await document.cleanup();
  return report;
}
