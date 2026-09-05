import { describe, expect, it } from 'vitest';
import type { ModelRegistry } from '@game-presentation/contracts';
import { ModelRegistryRouter } from '../src/model-router.js';

function entry(overrides: Record<string, unknown> = {}) {
  return {
    modelId: 'local-qualified', displayName: 'Local Qualified', provider: 'local', endpointProfile: 'local', localExecution: true, baseModel: 'base', adapter: false, adapterPath: null,
    capabilities: { text: true, vision: true, structuredOutput: true }, supportedRoles: ['visual-critic'], maxContext: 8192, preferredOutputTokens: 1000, estimatedVRAMGb: 4, quantization: '4bit',
    benchmarkStatus: 'qualified', benchmarkScores: { recall: 0.9 }, latencyMs: 100, estimatedCostUsdPerMillionTokens: 0, active: true, version: '1', createdAt: '2026-09-06T00:00:00.000Z', ...overrides,
  };
}

function registry(models: ReturnType<typeof entry>[]): ModelRegistry { return { schemaVersion: '0.1', models } as ModelRegistry; }

describe('ModelRegistryRouter', () => {
  it('uses a qualified local model first when capabilities match', () => {
    const router = new ModelRegistryRouter(registry([
      entry(),
      entry({ modelId: 'remote-qualified', provider: 'openrouter', localExecution: false, estimatedCostUsdPerMillionTokens: 1 }),
    ]));
    expect(router.route({ role: 'visual-critic', capabilities: { vision: true }, policy: 'local-first' }).modelId).toBe('local-qualified');
  });

  it('rejects unbenchmarked, rejected, disabled, inactive, and capability-mismatched models', () => {
    const router = new ModelRegistryRouter(registry([
      entry({ modelId: 'unbenchmarked', benchmarkStatus: 'unbenchmarked' }),
      entry({ modelId: 'rejected', benchmarkStatus: 'rejected' }),
      entry({ modelId: 'disabled', benchmarkStatus: 'disabled', active: false }),
      entry({ modelId: 'inactive', active: false }),
      entry({ modelId: 'no-vision', capabilities: { text: true, vision: false, structuredOutput: true } }),
    ]));
    expect(() => router.route({ role: 'visual-critic', capabilities: { vision: true }, policy: 'local-first' })).toThrow(/fallback/u);
  });

  it('routes a remote model only when its exact id is explicitly approved', () => {
    const router = new ModelRegistryRouter(registry([
      entry({ modelId: 'remote', provider: 'openrouter', localExecution: false }),
    ]));
    expect(() => router.route({ role: 'visual-critic', capabilities: { vision: true }, policy: 'local-first' })).toThrow(/fallback/u);
    expect(() => router.route({ role: 'visual-critic', capabilities: { vision: true }, policy: 'explicit-remote' })).toThrow(/승인/u);
    expect(router.route({ role: 'visual-critic', capabilities: { vision: true }, policy: 'explicit-remote', approvedRemoteModelId: 'remote' }).modelId).toBe('remote');
  });
});
