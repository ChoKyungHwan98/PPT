import { z } from 'zod';
import type {
  AIProvider,
  ProviderCapabilities,
  ProviderRequest,
  ProviderRunRecord,
} from '@game-presentation/contracts';

type OpenRouterProviderOptions = {
  apiKey: string;
  model: string;
  reasoningEffort: 'none' | 'minimal' | 'low' | 'medium' | 'high';
  endpoint?: string;
  timeoutMs?: number;
};

type OpenRouterResponse = {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
};

function responseContent(response: OpenRouterResponse): string {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('OpenRouter가 구조화된 응답 내용을 반환하지 않았습니다.');
  }
  return content;
}

function jsonSchemaFor<T>(schema: z.ZodType<T>): Record<string, unknown> {
  const converted = z.toJSONSchema(schema) as Record<string, unknown>;
  const { $schema: _dialect, ...jsonSchema } = converted;
  return jsonSchema;
}

export class OpenRouterAIProvider implements AIProvider {
  readonly kind = 'openrouter' as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly reasoningEffort: OpenRouterProviderOptions['reasoningEffort'];
  private readonly endpoint: string;
  private readonly timeoutMs: number;

  constructor(options: OpenRouterProviderOptions) {
    if (!options.apiKey.startsWith('sk-or-v1-')) {
      throw new Error('OPENROUTER_API_KEY가 없거나 형식이 올바르지 않습니다.');
    }
    if (options.model.trim().length === 0) {
      throw new Error('CRITIC_MODEL_ID를 설정해야 합니다.');
    }
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.reasoningEffort = options.reasoningEffort;
    this.endpoint = options.endpoint ?? 'https://openrouter.ai/api/v1/chat/completions';
    this.timeoutMs = options.timeoutMs ?? 90_000;
  }

  async capabilities(): Promise<ProviderCapabilities> {
    return {
      structuredOutput: true,
      vision: true,
      localExecution: false,
      promptCaching: false,
    };
  }

  async generateStructured<T>(request: ProviderRequest, schema: z.ZodType<T>): Promise<{
    value: T;
    run: ProviderRunRecord;
  }> {
    if (request.task !== 'visual-critique') {
      throw new Error('현재 OpenRouter adapter는 V1 visual-critique 역할만 허용합니다.');
    }
    if (request.imageEvidence === undefined) {
      throw new Error('visual-critique에는 실제 PNG가 필요합니다.');
    }

    const compactJson = JSON.stringify(request.compactState);
    const inputBytes = Buffer.byteLength(request.systemInstruction, 'utf8')
      + Buffer.byteLength(compactJson, 'utf8')
      + request.imageEvidence.bytes.byteLength;
    if (request.contextBudgetBytes !== undefined && inputBytes > request.contextBudgetBytes) {
      throw new Error(`Critic context budget 초과: ${inputBytes}/${request.contextBudgetBytes} bytes`);
    }

    const startedAt = new Date().toISOString();
    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: request.systemInstruction },
        {
          role: 'user',
          content: [
            { type: 'text', text: compactJson },
            {
              type: 'image_url',
              image_url: {
                url: `data:${request.imageEvidence.mimeType};base64,${Buffer.from(request.imageEvidence.bytes).toString('base64')}`,
              },
            },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'visual_critique_report',
          strict: true,
          schema: jsonSchemaFor(schema),
        },
      },
      provider: {
        require_parameters: true,
        allow_fallbacks: false,
      },
      reasoning: {
        effort: this.reasoningEffort,
        exclude: true,
      },
      temperature: 0,
      max_tokens: request.maxOutputTokens,
      stream: false,
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/ChoKyungHwan98/PPT',
        'X-Title': 'Game PPT Designer Visual Critic',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`OpenRouter 요청 실패 (${response.status}): ${rawText.slice(0, 600)}`);
    }
    const parsedResponse = JSON.parse(rawText) as OpenRouterResponse;
    const outputText = responseContent(parsedResponse);
    const value = schema.parse(JSON.parse(outputText));
    const usage = parsedResponse.usage;
    const completedAt = new Date().toISOString();
    return {
      value,
      run: {
        requestId: request.requestId,
        provider: this.kind,
        model: parsedResponse.model ?? this.model,
        cacheHit: false,
        inputBytes,
        outputBytes: Buffer.byteLength(outputText, 'utf8'),
        estimatedCostUsd: usage?.cost ?? 0,
        ...(usage?.prompt_tokens === undefined ? {} : { inputTokens: usage.prompt_tokens }),
        ...(usage?.completion_tokens === undefined ? {} : { outputTokens: usage.completion_tokens }),
        ...(usage?.completion_tokens_details?.reasoning_tokens === undefined
          ? {}
          : { reasoningTokens: usage.completion_tokens_details.reasoning_tokens }),
        ...(usage?.total_tokens === undefined ? {} : { totalTokens: usage.total_tokens }),
        contextArtifactIds: request.contextArtifactIds ?? [],
        startedAt,
        completedAt,
      },
    };
  }
}
