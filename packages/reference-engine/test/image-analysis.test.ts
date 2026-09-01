import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { analyzeReferenceImage, perceptualHashDistance } from '../src/image-analysis.js';

async function fixture(width = 1600, height = 900): Promise<Uint8Array> {
  const svg =
    '<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"' +
    String(width) +
    '\" height=\"' +
    String(height) +
    '\"><rect width=\"100%\" height=\"100%\" fill=\"#F2EFE8\"/>' +
    '<rect x=\"120\" y=\"120\" width=\"520\" height=\"620\" fill=\"#0A2030\"/>' +
    '<path d=\"M720 650 L1050 300 L1450 650\" fill=\"none\" stroke=\"#FF6A5D\" stroke-width=\"28\"/>' +
    '</svg>';
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe('local reference image analysis', () => {
  it('extracts deterministic visual metadata', async () => {
    const bytes = await fixture();
    const first = await analyzeReferenceImage(bytes);
    const second = await analyzeReferenceImage(bytes);
    expect(second).toEqual(first);
    expect(first.quality.accepted).toBe(true);
    expect(first.palette.length).toBeGreaterThan(1);
    expect(first.regions).toHaveLength(9);
    expect(first.perceptualHash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('recognizes a recompressed near-duplicate', async () => {
    const bytes = await fixture();
    const recompressed = await sharp(bytes).jpeg({ quality: 80 }).toBuffer();
    const originalAnalysis = await analyzeReferenceImage(bytes);
    const recompressedAnalysis = await analyzeReferenceImage(recompressed);
    expect(
      perceptualHashDistance(originalAnalysis.perceptualHash, recompressedAnalysis.perceptualHash),
    ).toBeLessThanOrEqual(4);
  });

  it('rejects undersized visual references', async () => {
    const analysis = await analyzeReferenceImage(await fixture(320, 180));
    expect(analysis.quality.accepted).toBe(false);
    expect(analysis.quality.reasons).toContain('resolution-below-800x450');
  });
});
