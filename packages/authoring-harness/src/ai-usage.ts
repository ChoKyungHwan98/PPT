import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  contentHash,
  sha256Bytes,
  type AIActivityRecord,
  type AIActivityRole,
  type AIProvider,
  type AIUsageSummary,
  type ProviderRequest,
} from '@game-presentation/contracts';
import type { z } from 'zod';

export const DEFAULT_AI_CALL_BUDGETS: Readonly<Record<AIActivityRole, number>> = {
  interpretation: 1,
  'design-suggestion': 1,
  'visual-critic': 1,
  revision: 1,
};

export type AIUsageIdentity = {
  runId: string;
  projectId: string;
  documentId: string;
  artifactId: string;
};

export type ManagedAIRequest = {
  role: AIActivityRole;
  request: ProviderRequest;
  promptVersion: string;
  schemaVersion: string;
  canonicalArtifactHashes: string[];
  generationParameters?: Record<string, unknown>;
};

type CachedStructuredResult = {
  schemaVersion: '0.1';
  cacheKey: string;
  value: unknown;
  provider: string;
  model: string;
  storedAt: string;
};

function zero(value: number | undefined): number { return value ?? 0; }

export function summarizeAIUsage(records: readonly AIActivityRecord[]): AIUsageSummary {
  return records.reduce<AIUsageSummary>((summary, record) => ({
    totalAICalls: summary.totalAICalls + (record.cacheHit ? 0 : 1),
    totalInputTokens: summary.totalInputTokens + zero(record.inputTokens),
    totalOutputTokens: summary.totalOutputTokens + zero(record.outputTokens),
    totalReasoningTokens: summary.totalReasoningTokens + zero(record.reasoningTokens),
    totalTokens: summary.totalTokens + zero(record.totalTokens),
    totalEstimatedCostUsd: summary.totalEstimatedCostUsd + record.estimatedCostUsd,
    localCallCount: summary.localCallCount + (!record.cacheHit && record.execution === 'local' ? 1 : 0),
    remoteCallCount: summary.remoteCallCount + (!record.cacheHit && record.execution === 'remote' ? 1 : 0),
    cacheHitCount: summary.cacheHitCount + (record.cacheHit ? 1 : 0),
  }), {
    totalAICalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalReasoningTokens: 0,
    totalTokens: 0,
    totalEstimatedCostUsd: 0,
    localCallCount: 0,
    remoteCallCount: 0,
    cacheHitCount: 0,
  });
}

export class AIUsageManager {
  private readonly records: AIActivityRecord[] = [];
  private readonly attempts = new Map<AIActivityRole, number>();

  constructor(
    private readonly identity: AIUsageIdentity,
    private readonly cacheRoot: string,
    private readonly budgets: Readonly<Record<AIActivityRole, number>> = DEFAULT_AI_CALL_BUDGETS,
  ) {}

  activity(): readonly AIActivityRecord[] { return this.records; }
  summary(): AIUsageSummary { return summarizeAIUsage(this.records); }

  private cacheKey(provider: AIProvider, input: ManagedAIRequest): string {
    return contentHash({
      task: input.request.task,
      role: input.role,
      provider: provider.kind,
      model: provider.model,
      promptVersion: input.promptVersion,
      schemaVersion: input.schemaVersion,
      canonicalArtifactHashes: input.canonicalArtifactHashes,
      imageHash: input.request.imageEvidence === undefined ? null : sha256Bytes(input.request.imageEvidence.bytes),
      compactContextHash: contentHash(input.request.compactState),
      requestContextHash: input.request.contextHash,
      generationParameters: input.generationParameters ?? {},
      maxOutputTokens: input.request.maxOutputTokens,
    });
  }

  private async record(activity: AIActivityRecord): Promise<void> {
    this.records.push(activity);
    const activityDir = resolve(this.cacheRoot, 'activity');
    await mkdir(activityDir, { recursive: true });
    await appendFile(resolve(activityDir, `${contentHash(this.identity.runId)}.jsonl`), JSON.stringify(activity) + '\n', 'utf8');
  }

  async generateStructured<T>(provider: AIProvider, input: ManagedAIRequest, schema: z.ZodType<T>): Promise<{ value: T; activity: AIActivityRecord }> {
    const attempts = this.attempts.get(input.role) ?? 0;
    const budget = this.budgets[input.role];
    if (attempts >= budget) throw new Error(`${input.role} AI call budget 초과: ${attempts}/${budget}`);
    this.attempts.set(input.role, attempts + 1);

    const contextBytes = Buffer.byteLength(JSON.stringify(input.request.compactState), 'utf8')
      + (input.request.imageEvidence?.bytes.byteLength ?? 0);
    if (input.request.contextBudgetBytes !== undefined && contextBytes > input.request.contextBudgetBytes) {
      throw new Error(`AI context budget 초과: ${contextBytes}/${input.request.contextBudgetBytes} bytes`);
    }

    const cacheKey = this.cacheKey(provider, input);
    const cacheDir = resolve(this.cacheRoot, 'results');
    const cachePath = resolve(cacheDir, `${cacheKey}.json`);
    const startedAt = new Date();
    let cached: CachedStructuredResult | undefined;
    try { cached = JSON.parse(await readFile(cachePath, 'utf8')) as CachedStructuredResult; } catch { cached = undefined; }
    if (cached?.cacheKey === cacheKey) {
      const value = schema.parse(cached.value);
      const completedAt = new Date();
      const activity: AIActivityRecord = {
        requestId: input.request.requestId,
        provider: provider.kind,
        model: provider.model,
        cacheHit: true,
        inputBytes: contextBytes,
        outputBytes: Buffer.byteLength(JSON.stringify(value), 'utf8'),
        estimatedCostUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
        contextArtifactIds: input.request.contextArtifactIds ?? [],
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        ...this.identity,
        role: input.role,
        execution: provider.kind === 'local' || provider.kind === 'fake' ? 'local' : 'remote',
        latencyMs: completedAt.getTime() - startedAt.getTime(),
        retryCount: 0,
        contextBytes,
        maxContextBudget: input.request.contextBudgetBytes ?? null,
        maxOutputTokens: input.request.maxOutputTokens,
        promptVersion: input.promptVersion,
        schemaVersion: input.schemaVersion,
        contentHash: contentHash(input.canonicalArtifactHashes),
        contextHash: contentHash(input.request.compactState),
        imageHash: input.request.imageEvidence === undefined ? null : sha256Bytes(input.request.imageEvidence.bytes),
        cacheKey,
      };
      await this.record(activity);
      return { value, activity };
    }

    const result = await provider.generateStructured(input.request, schema);
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cachePath, JSON.stringify({
      schemaVersion: '0.1', cacheKey, value: result.value, provider: provider.kind, model: provider.model, storedAt: new Date().toISOString(),
    } satisfies CachedStructuredResult, null, 2) + '\n', 'utf8');
    const completedAt = new Date(result.run.completedAt);
    const activity: AIActivityRecord = {
      ...result.run,
      cacheHit: false,
      ...this.identity,
      role: input.role,
      execution: provider.kind === 'local' || provider.kind === 'fake' ? 'local' : 'remote',
      latencyMs: Math.max(0, completedAt.getTime() - new Date(result.run.startedAt).getTime()),
      retryCount: 0,
      contextBytes,
      maxContextBudget: input.request.contextBudgetBytes ?? null,
      maxOutputTokens: input.request.maxOutputTokens,
      promptVersion: input.promptVersion,
      schemaVersion: input.schemaVersion,
      contentHash: contentHash(input.canonicalArtifactHashes),
      contextHash: contentHash(input.request.compactState),
      imageHash: input.request.imageEvidence === undefined ? null : sha256Bytes(input.request.imageEvidence.bytes),
      cacheKey,
    };
    await this.record(activity);
    return { value: result.value, activity };
  }
}

export function withAIUsageManagement(input: {
  manager: AIUsageManager;
  provider: AIProvider;
  role: AIActivityRole;
  promptVersion: string;
  schemaVersion: string;
  canonicalArtifactHashes: string[];
  generationParameters?: Record<string, unknown>;
}): AIProvider {
  return {
    kind: input.provider.kind,
    model: input.provider.model,
    capabilities: () => input.provider.capabilities(),
    async generateStructured<T>(request: ProviderRequest, schema: z.ZodType<T>) {
      const result = await input.manager.generateStructured(input.provider, {
        role: input.role,
        request,
        promptVersion: input.promptVersion,
        schemaVersion: input.schemaVersion,
        canonicalArtifactHashes: input.canonicalArtifactHashes,
        ...(input.generationParameters === undefined ? {} : { generationParameters: input.generationParameters }),
      }, schema);
      return { value: result.value, run: result.activity };
    },
  };
}
