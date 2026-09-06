import { spawn } from 'node:child_process';
import { z } from 'zod';
import type { AIProvider, ProviderCapabilities, ProviderRequest, ProviderRunRecord } from '@game-presentation/contracts';

export type PeftVisualCriticProviderOptions = { pythonExecutable: string; launcherPath: string; baseModel: string; adapterPath: string; modelId: string; timeoutMs?: number };
export type BaseTransformersVisualCriticProviderOptions = Omit<PeftVisualCriticProviderOptions, 'adapterPath'>;

async function execute(options: PeftVisualCriticProviderOptions | BaseTransformersVisualCriticProviderOptions, payload: unknown): Promise<{ generatedText: string; adapterLoaded: boolean; baseModel: string; adapterPath: string | null; latencyMs: number }> {
  return await new Promise((resolve, reject) => {
    const adapterPath = 'adapterPath' in options ? options.adapterPath : null;
    const child = spawn(options.pythonExecutable, [options.launcherPath, '--base-model', options.baseModel, ...(adapterPath === null ? [] : ['--adapter-path', adapterPath])], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = ''; let stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('PEFT Visual Critic 실행 시간이 초과되었습니다.')); }, options.timeoutMs ?? 180_000);
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8'); child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => { clearTimeout(timer); if (code !== 0) { reject(new Error(`PEFT Visual Critic 실패 (${code}): ${stderr.slice(-800)}`)); return; } try { resolve(JSON.parse(stdout) as never); } catch { reject(new Error(`PEFT Visual Critic 응답을 읽지 못했습니다: ${stdout.slice(0, 500)}`)); } });
    child.stdin.end(JSON.stringify(payload));
  });
}

function providerRun(request: ProviderRequest, model: string, startedAt: string, output: string): ProviderRunRecord {
  return { requestId: request.requestId, provider: 'local', model, cacheHit: false, inputBytes: Buffer.byteLength(request.systemInstruction) + Buffer.byteLength(JSON.stringify(request.compactState)) + (request.imageEvidence?.bytes.byteLength ?? 0), outputBytes: Buffer.byteLength(output), estimatedCostUsd: 0, contextArtifactIds: request.contextArtifactIds ?? [], startedAt, completedAt: new Date().toISOString() };
}

export class PeftVisualCriticProvider implements AIProvider {
  readonly kind = 'local' as const;
  readonly model: string;
  constructor(private readonly options: PeftVisualCriticProviderOptions) { this.model = options.modelId; }
  async capabilities(): Promise<ProviderCapabilities> { return { structuredOutput: true, vision: true, localExecution: true, promptCaching: false }; }
  async generateStructured<T>(request: ProviderRequest, schema: z.ZodType<T>): Promise<{ value: T; run: ProviderRunRecord }> {
    if (request.task !== 'visual-critique' || request.imageEvidence === undefined) throw new Error('PEFT adapter는 PNG visual critique만 허용합니다.');
    const startedAt = new Date().toISOString();
    const result = await execute(this.options, { systemInstruction: request.systemInstruction, compactState: request.compactState, imageBase64: Buffer.from(request.imageEvidence.bytes).toString('base64'), maxOutputTokens: request.maxOutputTokens });
    if (!result.adapterLoaded || result.baseModel !== this.options.baseModel || result.adapterPath !== this.options.adapterPath) throw new Error('선택한 base model + adapter가 실제 runtime에 로드되지 않았습니다.');
    const value = schema.parse(JSON.parse(result.generatedText));
    return { value, run: providerRun(request, this.model, startedAt, result.generatedText) };
  }
}

export class BaseTransformersVisualCriticProvider implements AIProvider {
  readonly kind = 'local' as const;
  readonly model: string;
  constructor(private readonly options: BaseTransformersVisualCriticProviderOptions) { this.model = options.modelId; }
  async capabilities(): Promise<ProviderCapabilities> { return { structuredOutput: true, vision: true, localExecution: true, promptCaching: false }; }
  async generateStructured<T>(request: ProviderRequest, schema: z.ZodType<T>): Promise<{ value: T; run: ProviderRunRecord }> {
    if (request.task !== 'visual-critique' || request.imageEvidence === undefined) throw new Error('base Transformers critic은 PNG visual critique만 허용합니다.');
    const startedAt = new Date().toISOString();
    const result = await execute(this.options, { systemInstruction: request.systemInstruction, compactState: request.compactState, imageBase64: Buffer.from(request.imageEvidence.bytes).toString('base64'), maxOutputTokens: request.maxOutputTokens });
    if (result.adapterLoaded || result.baseModel !== this.options.baseModel || result.adapterPath !== null) throw new Error('baseline benchmark는 adapter 없이 base model만 로드해야 합니다.');
    const value = schema.parse(JSON.parse(result.generatedText));
    return { value, run: providerRun(request, this.model, startedAt, result.generatedText) };
  }
}

export async function probePeftAdapterRuntime(options: PeftVisualCriticProviderOptions, pngBytes: Uint8Array) {
  return execute(options, { systemInstruction: 'Describe only what is visible.', compactState: { purpose: 'adapter-load-proof' }, imageBase64: Buffer.from(pngBytes).toString('base64'), maxOutputTokens: 12 });
}
