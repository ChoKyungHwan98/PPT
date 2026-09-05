import { z } from 'zod';
import type { AIProvider, ProviderCapabilities, ProviderRequest, ProviderRunRecord } from '@game-presentation/contracts';

export type OpenAICompatibleProviderOptions = {
  endpoint: string;
  model: string;
  apiKey?: string;
  localExecution: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

function responseText(value: unknown): string {
  const parsed = value as { choices?: Array<{ message?: { content?: string } }> };
  const text = parsed.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || text.trim() === '') throw new Error('Critic 응답 내용이 비어 있습니다.');
  return text.replace(/<think>[\s\S]*?<\/think>/giu, '').replace(/^```(?:json)?\s*|\s*```$/giu, '').trim();
}

/** vLLM 등 OpenAI-compatible vision endpoint용 adapter. 생성 역할에는 사용할 수 없다. */
export class OpenAICompatibleVisualCriticProvider implements AIProvider {
  readonly kind = 'local' as const;
  readonly model: string;
  private readonly options: OpenAICompatibleProviderOptions;

  constructor(options: OpenAICompatibleProviderOptions) {
    if (options.endpoint.trim() === '' || options.model.trim() === '') throw new Error('Local Critic endpoint와 model이 필요합니다.');
    this.options = options;
    this.model = options.model;
  }

  async capabilities(): Promise<ProviderCapabilities> {
    return { structuredOutput: true, vision: true, localExecution: this.options.localExecution, promptCaching: false };
  }

  async generateStructured<T>(request: ProviderRequest, schema: z.ZodType<T>): Promise<{ value: T; run: ProviderRunRecord }> {
    if (request.task !== 'visual-critique' || request.imageEvidence === undefined) {
      throw new Error('Local adapter는 실제 PNG를 보는 visual-critique만 허용합니다.');
    }
    const compact = JSON.stringify(request.compactState);
    const inputBytes = Buffer.byteLength(request.systemInstruction, 'utf8') + Buffer.byteLength(compact, 'utf8') + request.imageEvidence.bytes.byteLength;
    if (request.contextBudgetBytes !== undefined && inputBytes > request.contextBudgetBytes) throw new Error('Critic context budget을 초과했습니다.');
    const startedAt = new Date().toISOString();
    const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
    delete jsonSchema.$schema;
    const response = await (this.options.fetchImpl ?? fetch)(this.options.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.options.apiKey ?? 'local'}` },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: request.systemInstruction },
          { role: 'user', content: [
            { type: 'text', text: compact },
            { type: 'image_url', image_url: { url: `data:${request.imageEvidence.mimeType};base64,${Buffer.from(request.imageEvidence.bytes).toString('base64')}` } },
          ] },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'visual_critique_report', strict: true, schema: jsonSchema } },
        temperature: 0,
        max_tokens: request.maxOutputTokens,
        stream: false,
      }),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 120_000),
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`Local Critic 요청 실패 (${response.status}): ${raw.slice(0, 500)}`);
    const api = JSON.parse(raw) as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
    const output = responseText(api);
    const value = schema.parse(JSON.parse(output));
    return { value, run: {
      requestId: request.requestId, provider: this.kind, model: this.model, cacheHit: false,
      inputBytes, outputBytes: Buffer.byteLength(output, 'utf8'), estimatedCostUsd: 0,
      ...(api.usage?.prompt_tokens === undefined ? {} : { inputTokens: api.usage.prompt_tokens }),
      ...(api.usage?.completion_tokens === undefined ? {} : { outputTokens: api.usage.completion_tokens }),
      ...(api.usage?.total_tokens === undefined ? {} : { totalTokens: api.usage.total_tokens }),
      contextArtifactIds: request.contextArtifactIds ?? [], startedAt, completedAt: new Date().toISOString(),
    } };
  }
}

