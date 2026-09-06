import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CriticDatasetManifestSchema, TrainingRunRecordSchema } from '../src/training-contract.js';
import { datasetHash, deterministicSplit, loadCriticDatasetManifest } from '../src/dataset.js';

const manifestPath = fileURLToPath(new URL('../data/critic-smoke-v1.manifest.json', import.meta.url));

describe('R8 local critic training data', () => {
  it('validates the human-labelled snapshot and deterministic split', () => {
    const manifest = loadCriticDatasetManifest(manifestPath);
    expect(manifest.examples).toHaveLength(4);
    expect(manifest.examples.every((example) => example.humanLabel)).toBe(true);
    expect(manifest.examples.some((example) => example.readiness === 'ready')).toBe(false);
    expect(deterministicSplit(manifest.examples.map((example) => example.exampleId), 1, manifest.splitSeed)).toEqual({ trainIds: manifest.trainIds, validationIds: manifest.validationIds });
    expect(datasetHash(manifest.examples, manifest.trainIds, manifest.validationIds)).toBe(manifest.datasetSha256);
  });

  it('rejects a split overlap and a machine-labelled example', () => {
    const manifest = loadCriticDatasetManifest(manifestPath);
    expect(() => CriticDatasetManifestSchema.parse({ ...manifest, trainIds: [...manifest.trainIds, manifest.validationIds[0]] })).toThrow();
    expect(() => CriticDatasetManifestSchema.parse({ ...manifest, examples: manifest.examples.map((example, index) => index === 0 ? { ...example, humanLabel: false } : example) })).toThrow();
  });

  it('validates the persisted smoke training run when present', () => {
    const runPath = fileURLToPath(new URL('../artifacts/r8-smoke/run-record.json', import.meta.url));
    const raw = JSON.parse(readFileSync(runPath, 'utf8')) as unknown;
    const run = TrainingRunRecordSchema.parse(raw);
    expect(run.claim).toBe('adapter-pipeline-smoke-only');
    expect(run.adapterReloaded).toBe(true);
    expect(run.inferenceSmoke.passed).toBe(true);
    expect(run.evaluation.meaningfulQualityClaim).toBe(false);
  });
});
