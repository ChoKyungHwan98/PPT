import { describe, expect, it } from 'vitest';
import { SEED_REFERENCE_CORPUS, type ReferenceRecord } from '@game-presentation/contracts';
import {
  GITHUB_RAW_ANALYSIS_POLICY,
  SerialRequestLimiter,
  assertAssetUrlAllowed,
  fetchReferenceAsset,
} from '../src/policy.js';

describe('reference source policy', () => {
  it('rejects hosts outside the explicit allowlist', () => {
    expect(() =>
      assertAssetUrlAllowed('https://example.com/reference.png', GITHUB_RAW_ANALYSIS_POLICY),
    ).toThrow(/허용되지 않은/);
  });

  it('enforces MIME, size, and persistence rights before accepting bytes', async () => {
    const bytes = new TextEncoder().encode('fixture-image-bytes');
    const record = structuredClone(SEED_REFERENCE_CORPUS[0]!) as ReferenceRecord;
    record.source.assetUrl =
      'https://raw.githubusercontent.com/example/project/main/reference.png';
    const asset = await fetchReferenceAsset({
      record,
      policy: GITHUB_RAW_ANALYSIS_POLICY,
      limiter: { wait: async () => undefined },
      fetcher: async () =>
        new Response(bytes, {
          status: 200,
          headers: {
            'content-type': 'image/png',
            'content-length': String(bytes.byteLength),
          },
        }),
    });
    expect(asset.bytes).toEqual(bytes);
    expect(asset.persistAllowed).toBe(false);
    expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('serializes requests according to the source interval', async () => {
    let now = 1000;
    const delays: number[] = [];
    const limiter = new SerialRequestLimiter(
      500,
      () => now,
      async (delay) => {
        delays.push(delay);
        now += delay;
      },
    );
    await limiter.wait();
    await limiter.wait();
    await limiter.wait();
    expect(delays).toEqual([500, 500]);
  });
});
