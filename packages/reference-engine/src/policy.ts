import { z } from 'zod';
import type { ReferenceRecord } from '@game-presentation/contracts';
import { createHash } from 'node:crypto';

export const SourcePolicySchema = z.strictObject({
  policyId: z.string().min(1),
  adapterId: z.string().min(1),
  allowedHosts: z.array(z.string().min(1)).min(1),
  allowedPathPrefixes: z.array(z.string()),
  allowedMimeTypes: z.array(z.string().min(1)).min(1),
  maximumAssetBytes: z.number().int().positive(),
  minimumRequestIntervalMs: z.number().int().nonnegative(),
  termsUrl: z.url(),
  termsCheckedAt: z.iso.datetime(),
  robotsHandling: z.enum(['obey-site-robots', 'not-applicable-api', 'not-applicable-direct-file']),
  accessMode: z.enum(['api', 'direct-file', 'local-user-owned']),
});

export type SourcePolicy = z.infer<typeof SourcePolicySchema>;

export const GITHUB_RAW_ANALYSIS_POLICY: SourcePolicy = SourcePolicySchema.parse({
  policyId: 'github-raw-analysis-v1',
  adapterId: 'github-curated-manifest',
  allowedHosts: ['raw.githubusercontent.com'],
  allowedPathPrefixes: ['/'],
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  maximumAssetBytes: 15 * 1024 * 1024,
  minimumRequestIntervalMs: 1000,
  termsUrl: 'https://docs.github.com/en/site-policy/github-terms/github-terms-of-service',
  termsCheckedAt: '2026-08-29T00:00:00.000Z',
  robotsHandling: 'not-applicable-direct-file',
  accessMode: 'direct-file',
});

export function assertAssetUrlAllowed(urlValue: string, policy: SourcePolicy): URL {
  const url = new URL(urlValue);
  if (url.protocol !== 'https:') {
    throw new Error('HTTPS가 아닌 reference asset URL은 허용되지 않습니다.');
  }
  if (!policy.allowedHosts.includes(url.hostname)) {
    throw new Error('허용되지 않은 reference host입니다: ' + url.hostname);
  }
  if (!policy.allowedPathPrefixes.some((prefix) => url.pathname.startsWith(prefix))) {
    throw new Error('허용되지 않은 reference 경로입니다: ' + url.pathname);
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error('인증 정보가 포함된 reference URL은 허용되지 않습니다.');
  }
  return url;
}

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Pick<Response, 'ok' | 'status' | 'headers' | 'arrayBuffer'>>;

export interface RequestLimiter {
  wait(): Promise<void>;
}

export class SerialRequestLimiter implements RequestLimiter {
  private nextAllowedAt = 0;

  constructor(
    private readonly intervalMs: number,
    private readonly now: () => number = Date.now,
    private readonly sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {}

  async wait(): Promise<void> {
    const delay = Math.max(0, this.nextAllowedAt - this.now());
    if (delay > 0) await this.sleep(delay);
    this.nextAllowedAt = Math.max(this.nextAllowedAt, this.now()) + this.intervalMs;
  }
}

export type FetchedReferenceAsset = {
  bytes: Uint8Array;
  mimeType: string;
  sha256: string;
  sourceUrl: string;
  persistAllowed: boolean;
};

export async function fetchReferenceAsset(input: {
  record: ReferenceRecord;
  policy: SourcePolicy;
  fetcher: FetchLike;
  limiter: RequestLimiter;
}): Promise<FetchedReferenceAsset> {
  const assetUrl = input.record.source.assetUrl;
  if (assetUrl === undefined) throw new Error('reference asset URL이 없습니다.');
  const allowedUrl = assertAssetUrlAllowed(assetUrl, input.policy);
  if (!input.record.allowedUse.analyze) throw new Error('분석이 허용되지 않은 reference입니다.');
  await input.limiter.wait();
  const response = await input.fetcher(allowedUrl, {
    method: 'GET',
    headers: { 'User-Agent': 'game-presentation-designer-reference-engine/0.1' },
    redirect: 'error',
  });
  if (!response.ok) throw new Error('reference asset 요청 실패: HTTP ' + String(response.status));
  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!input.policy.allowedMimeTypes.includes(mimeType)) {
    throw new Error('허용되지 않은 reference MIME type입니다: ' + mimeType);
  }
  const declaredLength = Number(response.headers.get('content-length') ?? '0');
  if (declaredLength > input.policy.maximumAssetBytes) {
    throw new Error('reference asset이 허용 크기를 초과합니다.');
  }
  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.byteLength > input.policy.maximumAssetBytes) {
    throw new Error('reference asset이 허용 크기를 초과합니다.');
  }
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  if (input.record.hashes.sourceSha256 !== undefined && input.record.hashes.sourceSha256 !== sha256) {
    throw new Error('reference asset 해시가 등록값과 다릅니다.');
  }
  return {
    bytes: buffer,
    mimeType,
    sha256,
    sourceUrl: allowedUrl.toString(),
    persistAllowed: input.record.allowedUse.cacheThumbnail,
  };
}
