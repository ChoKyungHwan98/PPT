import type { z } from 'zod';

export type ProviderKind = 'local' | 'openrouter' | 'openai' | 'anthropic' | 'fake';
export type ProviderTask =
  | 'source-to-slide-ir'
  | 'composition-hypothesis'
  | 'visual-critique'
  | 'preference-reason';

export type ProviderCapabilities = {
  structuredOutput: boolean;
  vision: boolean;
  localExecution: boolean;
  promptCaching: boolean;
};

export type ProviderRequest = {
  requestId: string;
  task: ProviderTask;
  contextHash: string;
  systemInstruction: string;
  sourceSpans?: { id: string; text: string }[];
  compactState: unknown;
  imageEvidence?: { mimeType: 'image/png'; bytes: Uint8Array };
  contextArtifactIds?: string[];
  contextBudgetBytes?: number;
  maxOutputTokens: number;
};

export type ProviderRunRecord = {
  requestId: string;
  provider: ProviderKind;
  model: string;
  cacheHit: boolean;
  inputBytes: number;
  outputBytes: number;
  estimatedCostUsd: number;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  contextArtifactIds: string[];
  startedAt: string;
  completedAt: string;
};

export type AIActivityRole = 'interpretation' | 'design-suggestion' | 'visual-critic' | 'revision';

export type AIActivityRecord = ProviderRunRecord & {
  runId: string;
  projectId: string;
  documentId: string;
  artifactId: string;
  role: AIActivityRole;
  execution: 'local' | 'remote';
  latencyMs: number;
  retryCount: number;
  contextBytes: number;
  maxContextBudget: number | null;
  maxOutputTokens: number;
  promptVersion: string;
  schemaVersion: string;
  contentHash: string;
  contextHash: string;
  imageHash: string | null;
  cacheKey: string;
};

export type AIUsageSummary = {
  totalAICalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalReasoningTokens: number;
  totalTokens: number;
  totalEstimatedCostUsd: number;
  localCallCount: number;
  remoteCallCount: number;
  cacheHitCount: number;
};

export interface AIProvider {
  readonly kind: ProviderKind;
  readonly model: string;
  capabilities(): Promise<ProviderCapabilities>;
  generateStructured<T>(request: ProviderRequest, schema: z.ZodType<T>): Promise<{
    value: T;
    run: ProviderRunRecord;
  }>;
}

export class FakeAIProvider implements AIProvider {
  readonly kind = 'fake' as const;

  constructor(
    readonly model: string,
    private readonly fixtures: ReadonlyMap<string, unknown>,
  ) {}

  async capabilities(): Promise<ProviderCapabilities> {
    return {
      structuredOutput: true,
      vision: true,
      localExecution: true,
      promptCaching: true,
    };
  }

  async generateStructured<T>(request: ProviderRequest, schema: z.ZodType<T>): Promise<{
    value: T;
    run: ProviderRunRecord;
  }> {
    const startedAt = new Date().toISOString();
    const fixture = this.fixtures.get(request.requestId);
    if (fixture === undefined) {
      throw new Error('등록되지 않은 fake provider 응답입니다: ' + request.requestId);
    }
    const value = schema.parse(fixture);
    const completedAt = new Date().toISOString();
    return {
      value,
      run: {
        requestId: request.requestId,
        provider: this.kind,
        model: this.model,
        cacheHit: true,
        inputBytes: Buffer.byteLength(JSON.stringify(request.compactState), 'utf8'),
        outputBytes: Buffer.byteLength(JSON.stringify(value), 'utf8'),
        estimatedCostUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
        contextArtifactIds: request.contextArtifactIds ?? [],
        startedAt,
        completedAt,
      },
    };
  }
}
