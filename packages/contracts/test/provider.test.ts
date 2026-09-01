import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { FakeAIProvider } from '../src/ai-provider.js';

describe('provider adapter contract', () => {
  it('returns only schema-valid structured output', async () => {
    const outputSchema = z.strictObject({ hypothesis: z.string(), confidence: z.number() });
    const provider = new FakeAIProvider(
      'fixture-model',
      new Map([['request-1', { hypothesis: 'guided mechanism flow', confidence: 0.8 }]]),
    );
    const result = await provider.generateStructured(
      {
        requestId: 'request-1',
        task: 'composition-hypothesis',
        contextHash: 'a'.repeat(64),
        systemInstruction: 'Return one bounded composition hypothesis.',
        compactState: { intent: 'mechanism' },
        maxOutputTokens: 200,
      },
      outputSchema,
    );
    expect(result.value.hypothesis).toBe('guided mechanism flow');
    expect(result.run.estimatedCostUsd).toBe(0);
  });

  it('rejects invalid provider output', async () => {
    const provider = new FakeAIProvider('fixture-model', new Map([['bad', { confidence: 'high' }]]));
    await expect(
      provider.generateStructured(
        {
          requestId: 'bad',
          task: 'visual-critique',
          contextHash: 'b'.repeat(64),
          systemInstruction: 'Return critique.',
          compactState: {},
          maxOutputTokens: 100,
        },
        z.strictObject({ confidence: z.number() }),
      ),
    ).rejects.toThrow();
  });
});
