import {
  ModelRegistrySchema,
  type ModelRegistry,
  type ModelRegistryEntry,
  type ModelRouteRequest,
} from '@game-presentation/contracts';

function supports(entry: ModelRegistryEntry, request: ModelRouteRequest): boolean {
  return entry.supportedRoles.includes(request.role)
    && (!request.capabilities.text || entry.capabilities.text)
    && (!request.capabilities.vision || entry.capabilities.vision)
    && (!request.capabilities.structuredOutput || entry.capabilities.structuredOutput);
}

export class ModelRegistryRouter {
  readonly registry: ModelRegistry;

  constructor(raw: ModelRegistry) { this.registry = ModelRegistrySchema.parse(raw); }

  route(request: ModelRouteRequest): ModelRegistryEntry {
    const qualified = this.registry.models.filter((entry) => entry.active && entry.benchmarkStatus === 'qualified' && supports(entry, request));
    if (request.policy === 'explicit-local') {
      const local = qualified.filter((entry) => entry.localExecution);
      if (local.length === 0) throw new Error('요구 역할과 capability를 통과한 local model이 없습니다.');
      return this.preferred(local);
    }
    if (request.policy === 'explicit-remote') {
      if (request.approvedRemoteModelId === undefined) throw new Error('remote model은 사용자가 승인한 modelId가 필요합니다.');
      const selected = qualified.find((entry) => !entry.localExecution && entry.modelId === request.approvedRemoteModelId);
      if (selected === undefined) throw new Error('승인한 remote model이 qualified/active 조건을 충족하지 않습니다.');
      return selected;
    }
    const local = qualified.filter((entry) => entry.localExecution);
    if (local.length > 0) return this.preferred(local);
    throw new Error('qualified local model이 없습니다. 유료 remote fallback은 자동 실행하지 않습니다.');
  }

  private preferred(entries: ModelRegistryEntry[]): ModelRegistryEntry {
    return [...entries].sort((left, right) => {
      if (left.latencyMs !== null && right.latencyMs !== null && left.latencyMs !== right.latencyMs) return left.latencyMs - right.latencyMs;
      return left.estimatedCostUsdPerMillionTokens - right.estimatedCostUsdPerMillionTokens || left.modelId.localeCompare(right.modelId);
    })[0]!;
  }
}

export function runtimeModelRegistry(environment: NodeJS.ProcessEnv): ModelRegistry {
  const createdAt = '2026-09-06T00:00:00.000Z';
  return ModelRegistrySchema.parse({
    schemaVersion: '0.1',
    models: [
      {
        modelId: environment.LOCAL_CRITIC_MODEL_ID ?? 'local-ui-ux-critic', displayName: environment.LOCAL_CRITIC_MODEL ?? 'afx-team/UI-UX',
        provider: 'local', endpointProfile: 'local-openai-compatible', localExecution: true, baseModel: environment.LOCAL_CRITIC_MODEL ?? 'afx-team/UI-UX', adapter: false, adapterPath: null,
        capabilities: { text: true, vision: true, structuredOutput: true }, supportedRoles: ['visual-critic'], maxContext: Number(environment.LOCAL_CRITIC_MAX_CONTEXT ?? 32768), preferredOutputTokens: 2200,
        estimatedVRAMGb: null, quantization: null, benchmarkStatus: environment.LOCAL_CRITIC_MODEL_STATUS ?? 'unbenchmarked', benchmarkScores: {}, latencyMs: null, estimatedCostUsdPerMillionTokens: 0,
        active: environment.LOCAL_CRITIC_ACTIVE === 'true', version: 'registry-r3', createdAt,
      },
      {
        modelId: environment.OPENROUTER_CRITIC_MODEL_ID ?? 'openrouter-critic', displayName: environment.CRITIC_MODEL_ID ?? 'OpenRouter critic (model not configured)',
        provider: 'openrouter', endpointProfile: 'openrouter-chat-completions', localExecution: false, baseModel: environment.CRITIC_MODEL_ID ?? 'unconfigured', adapter: false, adapterPath: null,
        capabilities: { text: true, vision: true, structuredOutput: true }, supportedRoles: ['visual-critic'], maxContext: Number(environment.OPENROUTER_CRITIC_MAX_CONTEXT ?? 32768), preferredOutputTokens: 2200,
        estimatedVRAMGb: null, quantization: null, benchmarkStatus: environment.OPENROUTER_CRITIC_MODEL_STATUS ?? 'unbenchmarked', benchmarkScores: {}, latencyMs: null, estimatedCostUsdPerMillionTokens: Number(environment.OPENROUTER_CRITIC_COST ?? 0),
        active: environment.OPENROUTER_CRITIC_ACTIVE === 'true' && Boolean(environment.OPENROUTER_API_KEY) && Boolean(environment.CRITIC_MODEL_ID), version: 'registry-r3', createdAt,
      },
    ],
  });
}
