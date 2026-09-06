import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import {
  ProductionCriticDatasetManifestSchema,
  ProductionTrainingRunStatusSchema,
  QualityTrainingConfigSchema,
  assessTrainingEligibility,
  type ProductionTrainingRunStatus,
  type TrainingEligibility,
} from '@game-presentation/local-training';

export type TrainingMode = 'quality' | 'smoke';

export function requireProductionDatasetId(value: unknown): string {
  if (typeof value !== 'string' || !/^critic-production-[a-f0-9]{16}$/u.test(value)) {
    throw new Error('품질 학습에는 유효한 immutable production datasetId가 필요합니다.');
  }
  return value;
}

export function trainingStartDecision(input: {
  mode: TrainingMode;
  eligibility: TrainingEligibility;
  smokeEnabled: boolean;
}): { allowed: true; mode: TrainingMode } | { allowed: false; mode: TrainingMode; reason: string } {
  if (input.mode === 'quality') {
    return input.eligibility.qualityTraining
      ? { allowed: true, mode: input.mode }
      : { allowed: false, mode: input.mode, reason: '현재 데이터로는 품질 학습을 시작할 수 없습니다.' };
  }
  return input.eligibility.smokeTraining && input.smokeEnabled
    ? { allowed: true, mode: input.mode }
    : { allowed: false, mode: input.mode, reason: '개발자 smoke 실행이 허용되지 않았습니다.' };
}

export type QualityRuntimeAssessment = {
  supported: boolean;
  baseModel: string;
  gpuName: string | null;
  gpuMemoryMb: number | null;
  diskFreeGb: number;
  quantization: 'bnb-4bit';
  reasons: string[];
};

export function assessQualityRuntimeEnvironment(input: {
  baseModel?: string;
  platform: NodeJS.Platform;
  gpuName: string | null;
  gpuMemoryMb: number | null;
  diskFreeGb: number;
  runtimeVerified?: boolean;
}): QualityRuntimeAssessment {
  const baseModel = input.baseModel ?? 'afx-team/UI-UX';
  const reasons: string[] = [];
  if ((input.gpuMemoryMb ?? 0) < 12_000) reasons.push('선택한 5B vision model의 안전한 QLoRA 실행에는 검증된 12GB 이상 GPU 구성이 필요합니다.');
  if (input.diskFreeGb < 30) reasons.push('base model, cache, adapter를 안전하게 보관하려면 30GB 이상의 여유 공간이 필요합니다.');
  if (input.platform === 'win32' && input.runtimeVerified !== true) reasons.push('Windows bitsandbytes/Qwen3.5 QLoRA 조합이 이 컴퓨터에서 아직 검증되지 않았습니다.');
  return { supported: reasons.length === 0, baseModel, gpuName: input.gpuName, gpuMemoryMb: input.gpuMemoryMb, diskFreeGb: input.diskFreeGb, quantization: 'bnb-4bit', reasons };
}

function relativeRepositoryPath(repositoryRoot: string, path: string): string {
  return relative(repositoryRoot, path).replaceAll('\\', '/');
}

export async function prepareQualityTrainingRun(input: {
  repositoryRoot: string;
  trainingDataRoot: string;
  datasetId: string;
  runId: string;
  startedAt: string;
  runtime: QualityRuntimeAssessment;
  baseRevision?: string;
}): Promise<{ status: ProductionTrainingRunStatus; statusPath: string; command: { script: string; args: string[] } }> {
  requireProductionDatasetId(input.datasetId);
  const manifestPath = resolve(input.trainingDataRoot, 'datasets', input.datasetId, 'manifest.json');
  const manifest = ProductionCriticDatasetManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
  if (manifest.datasetId !== input.datasetId) throw new Error('요청 dataset과 immutable manifest가 일치하지 않습니다.');
  const eligibility = assessTrainingEligibility(manifest);
  if (!eligibility.qualityTraining) throw new Error(`현재 dataset으로는 품질 학습을 시작할 수 없습니다. ${eligibility.reasons.join(' ')}`);
  if (!input.runtime.supported) throw new Error(`데이터는 충분하지만 현재 hardware/model 설정으로 실행할 수 없습니다. ${input.runtime.reasons.join(' ')}`);
  const runDirectory = resolve(input.trainingDataRoot, 'runs', input.runId);
  const outputDirectory = resolve(runDirectory, 'artifact');
  const configPath = resolve(runDirectory, 'quality-config.json');
  const statusPath = resolve(runDirectory, 'status.json');
  const config = QualityTrainingConfigSchema.parse({
    schemaVersion: '0.1', mode: 'quality', datasetId: manifest.datasetId, datasetSha256: manifest.datasetSha256,
    baseModel: input.runtime.baseModel, baseRevision: input.baseRevision ?? 'main',
    lora: { r: 8, alpha: 16, dropout: 0.05, targetModules: ['q_proj', 'v_proj'] },
    epochs: 2, learningRate: 0.00005, batchSize: 1, gradientAccumulation: 8, seed: 42,
    device: 'cuda', quantization: input.runtime.quantization, maxSamples: null,
    validation: { maxSamples: null, maxNewTokens: 256 },
  });
  const status = ProductionTrainingRunStatusSchema.parse({
    schemaVersion: '0.1', trainingRunId: input.runId, mode: 'quality', status: 'running', modelStatus: 'training',
    datasetId: manifest.datasetId, datasetSha256: manifest.datasetSha256,
    configPath: relativeRepositoryPath(input.repositoryRoot, configPath), outputPath: relativeRepositoryPath(input.repositoryRoot, outputDirectory), startedAt: input.startedAt,
  });
  await mkdir(runDirectory, { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return {
    status, statusPath,
    command: {
      script: resolve(input.repositoryRoot, 'packages/local-training/scripts/train_visual_critic.py'),
      args: ['--mode', 'quality', '--root', input.repositoryRoot, '--manifest', manifestPath, '--config', configPath, '--output', outputDirectory],
    },
  };
}
