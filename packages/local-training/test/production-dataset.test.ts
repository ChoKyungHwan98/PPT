import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contentHash, type DesignEvaluationEvent, type PreferenceEvidenceEvent, type StudioDesignOutput } from '@game-presentation/contracts';
import {
  HumanTrainingEventStore,
  ProductionCriticDatasetManifestSchema,
  assessTrainingEligibility,
  buildProductionCriticDataset,
  type HumanEvaluationEvidence,
  type HumanPreferenceEvidence,
} from '../src/index.js';

const sha = (bytes: string) => createHash('sha256').update(bytes).digest('hex');
const hex = (value: string) => sha(value);

function output(artifactId: string, pngHash: string): StudioDesignOutput {
  return {
    schemaVersion: '0.1', artifactId, projectId: 'project-1', documentId: 'document-1', previewPngUrl: 'preview.png', comparisonId: `comparison-${artifactId}`,
    candidates: [{ candidateId: `candidate-${artifactId}`, label: '구조 A', compositionPlanHash: hex('plan'), renderTreeFingerprint: 'tree-fingerprint', renderTreeHash: hex('tree'), previewPngUrl: 'preview.png', pngSha256: pngHash, provenance: { patternFragmentIds: ['pattern'], referenceIds: [], layoutFamily: 'hierarchy', readingPath: 'guided-sequence' }, validation: { hardGatePassed: true, programFindingCount: 0, sourceFidelityFindingCount: 0 } }],
    exports: [{ kind: 'png', url: 'p', editable: false }, { kind: 'html', url: 'h', editable: false }, { kind: 'pdf', url: 'd', editable: false }, { kind: 'pptx', url: 'x', editable: true }],
    validation: { hardGatePassed: true, programFindingCount: 0, sourceFidelityFindingCount: 0 }, critic: null, readiness: 'not-reviewed',
    trace: { semanticShape: 'hierarchy', domain: 'test', selectedTeacherIds: [], appliedGuidanceIds: [], renderTreeFingerprint: 'tree-fingerprint', authoredContentHash: hex(`source-${artifactId}`), pngSha256: pngHash },
  };
}

function evaluationEvent(artifactId: string, pngHash: string, decision: 'ready' | 'reject' = 'reject'): DesignEvaluationEvent {
  return { schemaVersion: '0.1', eventId: `evaluation-${artifactId}`, artifactId, png: { path: 'preview.png', sha256: pngHash }, authoredContentHash: hex(`source-${artifactId}`), semanticShape: 'hierarchy', selectedTeacherIds: [], appliedGuidanceIds: [], critic: null, userDecision: decision, reasonTags: decision === 'ready' ? [] : ['aesthetics'], decidedAt: '2026-09-07T00:00:00.000Z', separation: { teacherQualityChanged: false, readyQualityRecorded: true, preferenceRecorded: false } };
}

function preferenceEvent(artifactId: string, pngHash: string): PreferenceEvidenceEvent {
  return { schemaVersion: '0.1', eventId: `preference-${artifactId}`, artifactId, comparisonId: `comparison-${artifactId}`, candidateIds: [`candidate-${artifactId}`], decision: 'choose-A', selectedCandidateId: `candidate-${artifactId}`, selectedCandidateHash: pngHash, semanticShape: 'hierarchy', mode: 'document', chosenPatternId: 'pattern', density: 'balanced', designSignature: { candidateId: `candidate-${artifactId}`, referenceClusterIds: ['cluster-test'], topologyFamily: 'hierarchy', readingPath: 'guided-sequence', featureTags: ['pattern'] }, reasonTags: [], approved: true, projectId: 'project-1', domain: 'test', occurredAt: '2026-09-07T00:00:00.000Z', separation: { teacherQualityChanged: false, readyQualityChanged: false, criticFindingsChanged: false } };
}

async function storedArtifact(root: string, artifactId: string) {
  const directory = resolve(root, 'output/studio-jobs', artifactId);
  await mkdir(directory, { recursive: true });
  const bytes = `png-${artifactId}`;
  const pngHash = sha(bytes);
  const pngPath = resolve(directory, `${artifactId}.png`);
  const metadataPath = resolve(directory, 'job.json');
  await writeFile(pngPath, bytes);
  const designOutput = output(artifactId, pngHash);
  await writeFile(metadataPath, JSON.stringify({ input: { mode: 'document' }, output: designOutput, candidates: [{ candidateId: designOutput.candidates[0]!.candidateId, pngPath, pngHash }] }));
  return { metadataPath, pngHash };
}

function directEvidence(index: number, imagePath: string, imageSha256: string, ready: boolean, group: string): HumanEvaluationEvidence {
  const artifactId = `slide-${index}`;
  const authoredContentHash = hex(group);
  const event: DesignEvaluationEvent = { ...evaluationEvent(artifactId, imageSha256, ready ? 'ready' : 'reject'), eventId: `evaluation-${index}`, authoredContentHash };
  return {
    schemaVersion: '0.1', eventKind: 'evaluation', sourceEvent: event, sourceEventHash: contentHash(event), explicitHumanDecision: true,
    artifact: { metadataPath: `artifacts/${index}.json`, artifactIdentitySha256: contentHash({ artifactId, authoredContentHash, pngSha256: imageSha256, semanticShape: 'hierarchy', renderTreeFingerprint: `tree-${index}` }), pngPath: imagePath, pngSha256: imageSha256, authoredContentHash, semanticShape: 'hierarchy', mode: 'document', renderTreeFingerprint: `tree-${index}` },
  };
}

async function writeEvidenceMetadata(root: string, evidence: HumanEvaluationEvidence): Promise<void> {
  const designOutput = output(evidence.sourceEvent.artifactId, evidence.artifact.pngSha256);
  designOutput.trace.authoredContentHash = evidence.artifact.authoredContentHash;
  designOutput.trace.semanticShape = evidence.artifact.semanticShape;
  designOutput.trace.renderTreeFingerprint = evidence.artifact.renderTreeFingerprint;
  await mkdir(resolve(root, 'artifacts'), { recursive: true });
  await writeFile(resolve(root, evidence.artifact.metadataPath), JSON.stringify({ output: designOutput }));
}

describe('R8 production human data and immutable dataset', () => {
  it('stores explicit human evaluation and preference once while keeping Ready separate', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'r8-human-store-'));
    try {
      const artifactId = 'slide-1000-test';
      const { metadataPath, pngHash } = await storedArtifact(root, artifactId);
      const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as { output: { readiness: string } };
      metadata.output.readiness = 'ready';
      await writeFile(metadataPath, JSON.stringify(metadata));
      const store = new HumanTrainingEventStore(resolve(root, 'workspace/training-data'), root);
      expect((await store.appendEvaluation(evaluationEvent(artifactId, pngHash), metadataPath)).inserted).toBe(true);
      const evaluation = evaluationEvent(artifactId, pngHash);
      expect((await store.appendEvaluation(evaluation, metadataPath)).inserted).toBe(false);
      await expect(store.appendEvaluation({ ...evaluation, decidedAt: '2026-09-07T00:01:00.000Z' }, metadataPath)).rejects.toThrow(/같은 evaluation eventId/u);
      expect((await store.appendPreference(preferenceEvent(artifactId, pngHash), metadataPath)).inserted).toBe(true);
      const preference = preferenceEvent(artifactId, pngHash);
      expect((await store.appendPreference(preference, metadataPath)).inserted).toBe(false);
      await expect(store.appendPreference({ ...preference, occurredAt: '2026-09-07T00:01:00.000Z' }, metadataPath)).rejects.toThrow(/같은 preference eventId/u);
      expect((await store.loadEvaluations()).filter((item) => item.sourceEvent.userDecision === 'ready')).toHaveLength(0);
      expect(await store.loadPreferences()).toHaveLength(1);
      const built = await buildProductionCriticDataset({ repositoryRoot: root, datasetsRoot: resolve(root, 'datasets'), evaluations: await store.loadEvaluations(), preferences: await store.loadPreferences() });
      expect(built.manifest).toMatchObject({ humanLabelCount: 1, readyPositiveCount: 0, rejectCount: 1, preferenceEventCount: 1 });
      expect(built.manifest.preferences[0]).toMatchObject({ selectedCandidateHash: pngHash, chosenPatternId: 'pattern', density: 'balanced', candidateArtifacts: [{ candidateId: `candidate-${artifactId}`, imageSha256: pngHash }] });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('builds deterministic snapshots and prevents group leakage', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'r8-production-dataset-'));
    try {
      await mkdir(resolve(root, 'images'), { recursive: true });
      const bytes = 'shared-image'; const imageHash = sha(bytes); await writeFile(resolve(root, 'images/page.png'), bytes);
      const evaluations = Array.from({ length: 20 }, (_, index) => directEvidence(index, 'images/page.png', imageHash, index < 3, `group-${Math.floor(index / 2)}`));
      await Promise.all(evaluations.map((evidence) => writeEvidenceMetadata(root, evidence)));
      const options = { repositoryRoot: root, datasetsRoot: resolve(root, 'datasets'), evaluations, preferences: [] as HumanPreferenceEvidence[], splitSeed: 42, validationRatio: 0.2, createdAt: '2026-09-07T00:00:00.000Z' };
      const first = await buildProductionCriticDataset(options);
      const second = await buildProductionCriticDataset({ ...options, createdAt: '2026-09-07T01:00:00.000Z' });
      expect(second.reused).toBe(true);
      expect(second.manifest.datasetSha256).toBe(first.manifest.datasetSha256);
      const split = new Map<string, string>([
        ...first.manifest.trainIds.map((id) => [id, 'train'] as const),
        ...first.manifest.validationIds.map((id) => [id, 'validation'] as const),
      ]);
      const groupSplits = new Map<string, Set<string>>();
      for (const example of first.manifest.examples) groupSplits.set(example.artifactGroupId, new Set([...(groupSplits.get(example.artifactGroupId) ?? []), split.get(example.exampleId)!]));
      expect([...groupSplits.values()].every((values) => values.size === 1)).toBe(true);
      expect(assessTrainingEligibility(first.manifest).qualityTraining).toBe(true);
      const added = directEvidence(21, 'images/page.png', imageHash, false, 'new-group'); await writeEvidenceMetadata(root, added);
      const changed = await buildProductionCriticDataset({ ...options, evaluations: [...evaluations, added] });
      expect(changed.manifest.datasetSha256).not.toBe(first.manifest.datasetSha256);
      expect(await readFile(resolve(first.directory, 'preference.jsonl'), 'utf8')).toBe('');
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('rejects PNG hash mismatch and fixes eligibility thresholds to production human labels', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'r8-production-guard-'));
    try {
      await mkdir(resolve(root, 'images'), { recursive: true }); await writeFile(resolve(root, 'images/page.png'), 'actual');
      const wrong = directEvidence(1, 'images/page.png', hex('wrong'), true, 'g1');
      await writeEvidenceMetadata(root, wrong);
      await expect(buildProductionCriticDataset({ repositoryRoot: root, datasetsRoot: resolve(root, 'datasets'), evaluations: [wrong], preferences: [] })).rejects.toThrow(/PNG hash mismatch/u);
      const actualHash = sha('actual');
      const mismatchedArtifact = directEvidence(2, 'images/page.png', actualHash, false, 'g2');
      await writeEvidenceMetadata(root, mismatchedArtifact);
      const tamperedArtifact = { ...mismatchedArtifact, artifact: { ...mismatchedArtifact.artifact, artifactIdentitySha256: hex('tampered-artifact') } };
      await expect(buildProductionCriticDataset({ repositoryRoot: root, datasetsRoot: resolve(root, 'datasets'), evaluations: [tamperedArtifact], preferences: [] })).rejects.toThrow(/artifact hash mismatch/u);
      const makeManifest = (count: number, ready: number) => ProductionCriticDatasetManifestSchema.parse({
        schemaVersion: '0.1', purpose: 'visual-critic-production', datasetId: 'd', datasetSha256: hex('d'), createdAt: '2026-09-07T00:00:00.000Z', split: { seed: 42, validationRatio: 0.2, groupBy: 'authoredContentHash' }, sourceEventIds: Array.from({ length: count }, (_, i) => `e${i}`), sourceEventHashes: Array.from({ length: count }, (_, i) => ({ eventId: `e${i}`, sha256: hex(`e${i}`) })), humanLabelCount: count, readyPositiveCount: ready, rejectCount: count - ready, preferenceEventCount: 0, pairwiseCount: 0, trainIds: Array.from({ length: Math.max(0, count - 2) }, (_, i) => `x${i}`), validationIds: count >= 2 ? [`x${count - 2}`, `x${count - 1}`] : [], examples: Array.from({ length: count }, (_, i) => ({ exampleId: `x${i}`, sourceEventId: `e${i}`, sourceEventHash: hex(`e${i}`), artifactId: `a${i}`, artifactGroupId: `g${i}`, imagePath: 'i.png', imageSha256: hex('i'), prompt: 'p', response: 'r', readiness: i < ready ? 'ready' : 'not-ready', issueTypes: [], semanticShape: 'hierarchy', mode: 'document', humanLabel: true, explicitHumanDecision: true })), preferences: [], distributions: { semanticShape: { hierarchy: count }, mode: { document: count }, reasonTag: {} }, imageHashes: Array.from({ length: count }, (_, i) => ({ exampleId: `x${i}`, sha256: hex('i') })), files: { train: 'train.jsonl', validation: 'validation.jsonl', preference: 'preference.jsonl' },
      });
      expect(assessTrainingEligibility(makeManifest(19, 3)).qualityTraining).toBe(false);
      expect(assessTrainingEligibility(makeManifest(20, 2)).qualityTraining).toBe(false);
      expect(assessTrainingEligibility(makeManifest(20, 3)).qualityTraining).toBe(true);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
