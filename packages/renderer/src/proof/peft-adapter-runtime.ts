import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { probePeftAdapterRuntime } from '../peft-visual-critic-provider.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const registryPath = resolve(repositoryRoot, 'packages/local-training/artifacts/r9-model-registry.json');
const registry = JSON.parse(await readFile(registryPath, 'utf8')) as { models: Array<{ modelId: string; baseModel: string; adapterPath: string }> };
const model = registry.models[0];
if (model === undefined) throw new Error('runtime proof에 사용할 trained model registry entry가 없습니다.');
const adapterPath = resolve(repositoryRoot, model.adapterPath);
const pngPath = resolve(repositoryRoot, 'packages/local-training/fixtures/rough-but-readable.png');
const startedAt = new Date().toISOString();
const result = await probePeftAdapterRuntime({
  pythonExecutable: process.env.LOCAL_TRAINING_PYTHON ?? 'python',
  launcherPath: resolve(repositoryRoot, 'packages/local-training/scripts/infer_visual_critic.py'),
  baseModel: model.baseModel,
  adapterPath,
  modelId: model.modelId,
  timeoutMs: 300_000,
}, new Uint8Array(await readFile(pngPath)));
const proof = {
  schemaVersion: '0.1',
  purpose: 'production-compatible-adapter-load-and-image-inference-proof',
  modelId: model.modelId,
  registryPath: 'packages/local-training/artifacts/r9-model-registry.json',
  pngPath: 'packages/local-training/fixtures/rough-but-readable.png',
  baseModel: result.baseModel,
  adapterPath: model.adapterPath,
  resolvedAdapterMatched: result.adapterPath === adapterPath,
  adapterLoaded: result.adapterLoaded,
  imageInferenceReturned: result.generatedText.length > 0,
  generatedText: result.generatedText,
  latencyMs: result.latencyMs,
  startedAt,
  completedAt: new Date().toISOString(),
  qualityClaim: false,
};
if (!proof.adapterLoaded || !proof.imageInferenceReturned || result.baseModel !== model.baseModel || !proof.resolvedAdapterMatched) throw new Error('adapter runtime proof가 실패했습니다.');
const outputPath = resolve(repositoryRoot, 'packages/local-training/artifacts/r8-smoke/runtime-adapter-proof.json');
await writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ outputPath, adapterLoaded: proof.adapterLoaded, imageInferenceReturned: proof.imageInferenceReturned, latencyMs: proof.latencyMs })}\n`);
