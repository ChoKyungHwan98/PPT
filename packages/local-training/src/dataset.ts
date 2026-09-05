import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CriticDatasetManifestSchema, type CriticDatasetManifest, type CriticTrainingExample } from './training-contract.js';

export function deterministicSplit(exampleIds: string[], validationCount: number, seed: number): { trainIds: string[]; validationIds: string[] } {
  if (validationCount < 1 || validationCount >= exampleIds.length) throw new Error('validationCount는 1 이상이고 전체 example 수보다 작아야 합니다.');
  const ranked = [...exampleIds].sort((left, right) => createHash('sha256').update(`${seed}:${left}`).digest('hex').localeCompare(createHash('sha256').update(`${seed}:${right}`).digest('hex')));
  return { validationIds: ranked.slice(0, validationCount), trainIds: ranked.slice(validationCount) };
}

export function datasetHash(examples: CriticTrainingExample[], trainIds: string[], validationIds: string[]): string {
  return createHash('sha256').update(JSON.stringify({ examples, trainIds, validationIds })).digest('hex');
}

export function loadCriticDatasetManifest(path: string): CriticDatasetManifest {
  const raw = JSON.parse(readFileSync(resolve(path), 'utf8')) as unknown;
  return CriticDatasetManifestSchema.parse(raw);
}
