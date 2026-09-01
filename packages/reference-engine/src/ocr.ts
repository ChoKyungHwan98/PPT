import { z } from 'zod';

export const OcrRegionSchema = z.strictObject({
  text: z.string(),
  confidence: z.number().min(0).max(1),
  box: z.strictObject({
    x: z.number().nonnegative(),
    y: z.number().nonnegative(),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
});

export const OcrResultSchema = z.strictObject({
  provider: z.string().min(1),
  language: z.string().min(1),
  fullText: z.string(),
  meanConfidence: z.number().min(0).max(1),
  regions: z.array(OcrRegionSchema),
});

export type OcrResult = z.infer<typeof OcrResultSchema>;

export interface OcrProvider {
  readonly providerId: string;
  recognize(bytes: Uint8Array, language: string): Promise<OcrResult>;
}

export class NoopOcrProvider implements OcrProvider {
  readonly providerId = 'noop';

  async recognize(_bytes: Uint8Array, language: string): Promise<OcrResult> {
    return OcrResultSchema.parse({
      provider: this.providerId,
      language,
      fullText: '',
      meanConfidence: 0,
      regions: [],
    });
  }
}

export class FakeOcrProvider implements OcrProvider {
  readonly providerId = 'fake';

  constructor(private readonly result: OcrResult) {}

  async recognize(_bytes: Uint8Array, _language: string): Promise<OcrResult> {
    return OcrResultSchema.parse(this.result);
  }
}
