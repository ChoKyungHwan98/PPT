import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { OpenAICompatibleVisualCriticProvider } from '../src/openai-compatible-provider.js';

describe('OpenAI-compatible local critic provider', () => {
  it('sends PNG and parses structured output without cloud cost', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: unknown }> };
      expect(JSON.stringify(body.messages[1]?.content)).toContain('data:image/png;base64,AQID');
      return new Response(JSON.stringify({ choices: [{ message: { content: '<think>internal</think>{"ok":true}' } }], usage: { total_tokens: 12 } }), { status: 200 });
    });
    const provider = new OpenAICompatibleVisualCriticProvider({ endpoint: 'http://127.0.0.1:8000/v1/chat/completions', model: 'afx-team/UI-UX', localExecution: true, fetchImpl });
    const result = await provider.generateStructured({ requestId: 'local-1', task: 'visual-critique', contextHash: 'x', systemInstruction: '검토', compactState: { goal: 'test' }, imageEvidence: { mimeType: 'image/png', bytes: new Uint8Array([1, 2, 3]) }, maxOutputTokens: 100 }, z.object({ ok: z.literal(true) }));
    expect(result.value.ok).toBe(true);
    expect(result.run.provider).toBe('local');
    expect(result.run.estimatedCostUsd).toBe(0);
  });
});
