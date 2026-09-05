import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import type { AIProvider, ProviderRequest } from '@game-presentation/contracts';
import { AIUsageManager } from '../src/ai-usage.js';

const ResultSchema = z.strictObject({ answer: z.string() });

class CountingProvider implements AIProvider {
  readonly kind = 'local' as const;
  readonly model = 'counting-model';
  calls = 0;
  async capabilities() { return { structuredOutput: true, vision: true, localExecution: true, promptCaching: false }; }
  async generateStructured<T>(request: ProviderRequest, schema: z.ZodType<T>) {
    this.calls += 1;
    const startedAt = new Date().toISOString();
    const value = schema.parse({ answer: 'ok' });
    return { value, run: { requestId: request.requestId, provider: this.kind, model: this.model, cacheHit: false, inputBytes: 12, outputBytes: 15, estimatedCostUsd: 0, inputTokens: 3, outputTokens: 2, reasoningTokens: 1, totalTokens: 6, contextArtifactIds: request.contextArtifactIds ?? [], startedAt, completedAt: new Date().toISOString() } };
  }
}

function request(requestId: string): ProviderRequest {
  return { requestId, task: 'visual-critique', contextHash: 'context', systemInstruction: 'inspect', compactState: { goal: 'test' }, contextArtifactIds: ['render-tree-1'], contextBudgetBytes: 1000, maxOutputTokens: 100 };
}

describe('AIUsageManager', () => {
  it('persists an exact-result cache and records a cache hit without invoking the provider', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'ai-usage-'));
    const identity = { runId: 'run-1', projectId: 'project-1', documentId: 'document-1', artifactId: 'artifact-1' };
    try {
      const provider = new CountingProvider();
      const first = new AIUsageManager(identity, root);
      const spec = { role: 'visual-critic' as const, request: request('request-1'), promptVersion: 'p1', schemaVersion: 's1', canonicalArtifactHashes: ['a'.repeat(64)], generationParameters: { temperature: 0 } };
      await first.generateStructured(provider, spec, ResultSchema);
      const second = new AIUsageManager({ ...identity, runId: 'run-2' }, root);
      const cached = await second.generateStructured(provider, { ...spec, request: request('request-2') }, ResultSchema);
      expect(provider.calls).toBe(1);
      expect(cached.activity.cacheHit).toBe(true);
      expect(second.summary()).toMatchObject({ totalAICalls: 0, cacheHitCount: 1, localCallCount: 0 });
      expect((await readFile(resolve(root, 'results', `${cached.activity.cacheKey}.json`), 'utf8')).length).toBeGreaterThan(0);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('misses cache when prompt, schema, model, or generation parameters change', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'ai-usage-miss-'));
    try {
      const provider = new CountingProvider();
      const manager = (runId: string) => new AIUsageManager({ runId, projectId: 'p', documentId: 'd', artifactId: 'a' }, root);
      const base = { role: 'visual-critic' as const, request: request('r'), promptVersion: 'p1', schemaVersion: 's1', canonicalArtifactHashes: ['h'], generationParameters: { temperature: 0 } };
      await manager('1').generateStructured(provider, base, ResultSchema);
      await manager('2').generateStructured(provider, { ...base, promptVersion: 'p2' }, ResultSchema);
      await manager('3').generateStructured(provider, { ...base, schemaVersion: 's2' }, ResultSchema);
      await manager('4').generateStructured(provider, { ...base, generationParameters: { temperature: 1 } }, ResultSchema);
      const other = new CountingProvider(); Object.defineProperty(other, 'model', { value: 'other-model' });
      await manager('5').generateStructured(other, base, ResultSchema);
      expect(provider.calls + other.calls).toBe(5);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('enforces one call per role and never performs a paid fallback', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'ai-usage-budget-'));
    try {
      const provider = new CountingProvider();
      const manager = new AIUsageManager({ runId: 'r', projectId: 'p', documentId: 'd', artifactId: 'a' }, root);
      const spec = { role: 'interpretation' as const, request: { ...request('one'), task: 'source-to-slide-ir' as const }, promptVersion: 'p', schemaVersion: 's', canonicalArtifactHashes: ['h'] };
      await manager.generateStructured(provider, spec, ResultSchema);
      await expect(manager.generateStructured(provider, { ...spec, request: { ...spec.request, requestId: 'two' } }, ResultSchema)).rejects.toThrow(/budget/u);
      expect(provider.calls).toBe(1);
      expect(manager.summary()).toMatchObject({ totalAICalls: 1, localCallCount: 1, remoteCallCount: 0, totalTokens: 6 });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
