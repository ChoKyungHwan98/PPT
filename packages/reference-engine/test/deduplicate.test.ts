import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { deduplicateReferences } from '../src/deduplicate.js';
import { analyzeReferenceImage } from '../src/image-analysis.js';

describe('reference deduplication', () => {
  it('keeps the higher provenance copy of the same design', async () => {
    const svg =
      '<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1600\" height=\"900\">' +
      '<rect width=\"100%\" height=\"100%\" fill=\"#FFFFFF\"/>' +
      '<circle cx=\"800\" cy=\"450\" r=\"240\" fill=\"#FF6A5D\"/></svg>';
    const original = await sharp(Buffer.from(svg)).png().toBuffer();
    const recompressed = await sharp(original).jpeg({ quality: 75 }).toBuffer();
    const result = deduplicateReferences([
      { referenceId: 'repost', provenanceRank: 1, analysis: await analyzeReferenceImage(recompressed) },
      { referenceId: 'original', provenanceRank: 3, analysis: await analyzeReferenceImage(original) },
    ]);
    expect(result.kept.map((candidate) => candidate.referenceId)).toEqual(['original']);
    expect(result.duplicates[0]?.removedReferenceId).toBe('repost');
  });
});
