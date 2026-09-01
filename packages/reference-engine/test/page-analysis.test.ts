import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { analyzeReferenceImage } from '../src/image-analysis.js';
import { OcrResultSchema } from '../src/ocr.js';
import { analyzePageStructure } from '../src/page-analysis.js';

describe('reference page structure analysis', () => {
  it('derives bounded layout and typography features', async () => {
    const svg =
      '<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1600\" height=\"900\">' +
      '<rect width=\"100%\" height=\"100%\" fill=\"#F4F1EA\"/>' +
      '<rect x=\"100\" y=\"100\" width=\"900\" height=\"80\" fill=\"#111111\"/>' +
      '<rect x=\"100\" y=\"260\" width=\"500\" height=\"420\" fill=\"#222222\"/>' +
      '</svg>';
    const image = await analyzeReferenceImage(await sharp(Buffer.from(svg)).png().toBuffer());
    const ocr = OcrResultSchema.parse({
      provider: 'fake',
      language: 'ko',
      fullText: '시간 파편 BREAK',
      meanConfidence: 0.9,
      regions: [
        { text: '시간 파편', confidence: 0.9, box: { x: 100, y: 100, width: 700, height: 80 } },
        { text: 'BREAK', confidence: 0.9, box: { x: 100, y: 260, width: 300, height: 180 } },
      ],
    });
    const result = analyzePageStructure({ image, ocr });
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.typographyScaleCount).toBeGreaterThan(1);
    expect(result.readingPathCandidates.length).toBeGreaterThan(0);
  });
});
