import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { contentHash } from '@game-presentation/contracts';
import {
  HumanEvaluationEvidenceSchema,
  HumanPreferenceEvidenceSchema,
  ProductionCriticDatasetManifestSchema,
  ProductionCriticTrainingExampleSchema,
  ProductionPreferenceExampleSchema,
  TrainingArtifactEnvelopeSchema,
  type HumanEvaluationEvidence,
  type HumanPreferenceEvidence,
  type ProductionCriticDatasetManifest,
  type ProductionCriticTrainingExample,
} from './production-contract.js';

async function sha256File(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

function count(values: readonly string[]): Record<string, number> {
  return [...values].sort().reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
}

function criticExample(evidence: HumanEvaluationEvidence): ProductionCriticTrainingExample {
  const event = evidence.sourceEvent;
  const issueTypes = [...new Set([...event.reasonTags, ...(event.critic?.findings.map((finding) => finding.issueType) ?? [])])].sort();
  return ProductionCriticTrainingExampleSchema.parse({
    exampleId: `evaluation:${event.eventId}`,
    sourceEventId: event.eventId,
    sourceEventHash: evidence.sourceEventHash,
    artifactId: event.artifactId,
    artifactGroupId: evidence.artifact.authoredContentHash,
    imagePath: evidence.artifact.pngPath,
    imageSha256: evidence.artifact.pngSha256,
    prompt: JSON.stringify({
      task: 'visual-quality-critique',
      semanticShape: evidence.artifact.semanticShape,
      mode: evidence.artifact.mode,
      instruction: '실제 장표의 시각 품질과 제출 가능성을 평가한다. 원문은 변경하지 않는다.',
    }),
    response: JSON.stringify({
      humanDecision: event.userDecision,
      submissionReadiness: event.userDecision === 'ready' ? 'ready' : 'not-ready',
      humanReasonTags: event.reasonTags,
      criticContext: event.critic === null ? null : {
        provider: event.critic.provider,
        model: event.critic.model,
        findings: event.critic.findings,
      },
    }),
    readiness: event.userDecision === 'ready' ? 'ready' : 'not-ready',
    issueTypes,
    semanticShape: evidence.artifact.semanticShape,
    mode: evidence.artifact.mode,
    humanLabel: true,
    explicitHumanDecision: true,
  });
}

function groupAwareSplit(examples: ProductionCriticTrainingExample[], seed: number, validationRatio: number): { trainIds: string[]; validationIds: string[] } {
  const groups = new Map<string, ProductionCriticTrainingExample[]>();
  for (const example of examples) groups.set(example.artifactGroupId, [...(groups.get(example.artifactGroupId) ?? []), example]);
  const rankedGroups = [...groups.keys()].sort((left, right) => {
    const leftHash = contentHash(`${seed}:${left}`);
    const rightHash = contentHash(`${seed}:${right}`);
    return leftHash.localeCompare(rightHash);
  });
  if (rankedGroups.length < 2) return { trainIds: examples.map((example) => example.exampleId).sort(), validationIds: [] };
  const targetValidationExamples = Math.max(2, Math.round(examples.length * validationRatio));
  const validationGroups = new Set<string>();
  let validationExamples = 0;
  for (const groupId of rankedGroups.slice(0, -1)) {
    if (validationExamples >= targetValidationExamples) break;
    validationGroups.add(groupId);
    validationExamples += groups.get(groupId)!.length;
  }
  const trainIds: string[] = [];
  const validationIds: string[] = [];
  for (const example of examples) (validationGroups.has(example.artifactGroupId) ? validationIds : trainIds).push(example.exampleId);
  return { trainIds: trainIds.sort(), validationIds: validationIds.sort() };
}

async function validateEvidenceFiles(repositoryRoot: string, evaluations: HumanEvaluationEvidence[], preferences: HumanPreferenceEvidence[]): Promise<void> {
  const eventIds = [...evaluations.map((item) => item.sourceEvent.eventId), ...preferences.map((item) => item.sourceEvent.eventId)];
  if (new Set(eventIds).size !== eventIds.length) throw new Error('canonical human event ID가 중복됩니다.');
  for (const evidence of evaluations) {
    const output = TrainingArtifactEnvelopeSchema.parse(JSON.parse(await readFile(resolve(repositoryRoot, evidence.artifact.metadataPath), 'utf8'))).output;
    const identity = contentHash({ artifactId: output.artifactId, authoredContentHash: output.trace.authoredContentHash, pngSha256: output.trace.pngSha256, semanticShape: output.trace.semanticShape, renderTreeFingerprint: output.trace.renderTreeFingerprint });
    if (evidence.sourceEventHash !== contentHash(evidence.sourceEvent)) throw new Error(`source event hash mismatch: ${evidence.sourceEvent.eventId}`);
    if (identity !== evidence.artifact.artifactIdentitySha256 || output.artifactId !== evidence.sourceEvent.artifactId || output.trace.authoredContentHash !== evidence.artifact.authoredContentHash || output.trace.semanticShape !== evidence.artifact.semanticShape || output.trace.renderTreeFingerprint !== evidence.artifact.renderTreeFingerprint || evidence.sourceEvent.png.sha256 !== evidence.artifact.pngSha256) throw new Error(`artifact hash mismatch: ${evidence.sourceEvent.eventId}`);
    if (await sha256File(resolve(repositoryRoot, evidence.artifact.pngPath)) !== evidence.artifact.pngSha256) throw new Error(`PNG hash mismatch: ${evidence.sourceEvent.eventId}`);
    if (evidence.sourceEvent.userDecision === 'ready' && evidence.explicitHumanDecision !== true) throw new Error('Ready Positive에는 명시적인 사용자 승인이 필요합니다.');
  }
  for (const evidence of preferences) {
    const output = TrainingArtifactEnvelopeSchema.parse(JSON.parse(await readFile(resolve(repositoryRoot, evidence.artifact.metadataPath), 'utf8'))).output;
    const identity = contentHash({ artifactId: output.artifactId, authoredContentHash: output.trace.authoredContentHash, pngSha256: output.trace.pngSha256, semanticShape: output.trace.semanticShape, renderTreeFingerprint: output.trace.renderTreeFingerprint });
    if (evidence.sourceEventHash !== contentHash(evidence.sourceEvent)) throw new Error(`source event hash mismatch: ${evidence.sourceEvent.eventId}`);
    if (identity !== evidence.artifact.artifactIdentitySha256 || output.artifactId !== evidence.sourceEvent.artifactId || output.trace.authoredContentHash !== evidence.artifact.authoredContentHash) throw new Error(`artifact hash mismatch: ${evidence.sourceEvent.eventId}`);
    const outputCandidates = new Map(output.candidates.map((candidate) => [candidate.candidateId, candidate.pngSha256]));
    for (const candidate of evidence.artifact.candidates) {
      if (outputCandidates.get(candidate.candidateId) !== candidate.pngSha256) throw new Error(`candidate artifact hash mismatch: ${evidence.sourceEvent.eventId}/${candidate.candidateId}`);
      if (await sha256File(resolve(repositoryRoot, candidate.pngPath)) !== candidate.pngSha256) throw new Error(`candidate PNG hash mismatch: ${evidence.sourceEvent.eventId}/${candidate.candidateId}`);
    }
  }
}

function jsonl(values: readonly unknown[]): string {
  return values.map((value) => JSON.stringify(value)).join('\n') + (values.length > 0 ? '\n' : '');
}

export async function buildProductionCriticDataset(input: {
  repositoryRoot: string;
  datasetsRoot: string;
  evaluations: readonly HumanEvaluationEvidence[];
  preferences: readonly HumanPreferenceEvidence[];
  splitSeed?: number;
  validationRatio?: number;
  createdAt?: string;
}): Promise<{ manifest: ProductionCriticDatasetManifest; directory: string; reused: boolean }> {
  const evaluations = input.evaluations.map((value) => HumanEvaluationEvidenceSchema.parse(value));
  const preferences = input.preferences.map((value) => HumanPreferenceEvidenceSchema.parse(value));
  await validateEvidenceFiles(input.repositoryRoot, evaluations, preferences);
  const examples = evaluations.map(criticExample).sort((left, right) => left.exampleId.localeCompare(right.exampleId));
  const preferenceExamples = preferences.map((evidence) => ProductionPreferenceExampleSchema.parse({
    sourceEventId: evidence.sourceEvent.eventId,
    sourceEventHash: evidence.sourceEventHash,
    artifactId: evidence.sourceEvent.artifactId,
    comparisonId: evidence.sourceEvent.comparisonId,
    decision: evidence.sourceEvent.decision,
    selectedCandidateId: evidence.sourceEvent.selectedCandidateId,
    selectedCandidateHash: evidence.sourceEvent.selectedCandidateHash,
    candidateIds: evidence.sourceEvent.candidateIds,
    candidateArtifacts: evidence.artifact.candidates.map((candidate) => ({ candidateId: candidate.candidateId, imagePath: candidate.pngPath, imageSha256: candidate.pngSha256 })),
    semanticShape: evidence.sourceEvent.semanticShape,
    mode: evidence.sourceEvent.mode,
    chosenPatternId: evidence.sourceEvent.chosenPatternId,
    density: evidence.sourceEvent.density,
    designSignature: evidence.sourceEvent.designSignature,
    reasonTags: evidence.sourceEvent.reasonTags,
  })).sort((left, right) => left.sourceEventId.localeCompare(right.sourceEventId));
  const seed = input.splitSeed ?? 42;
  const validationRatio = input.validationRatio ?? 0.2;
  const { trainIds, validationIds } = groupAwareSplit(examples, seed, validationRatio);
  const sourceHashes = [
    ...evaluations.map((item) => ({ eventId: item.sourceEvent.eventId, sha256: item.sourceEventHash })),
    ...preferences.map((item) => ({ eventId: item.sourceEvent.eventId, sha256: item.sourceEventHash })),
  ].sort((left, right) => left.eventId.localeCompare(right.eventId));
  const stableDataset = {
    split: { seed, validationRatio, groupBy: 'authoredContentHash' as const },
    sourceEventHashes: sourceHashes,
    examples,
    preferences: preferenceExamples,
    trainIds,
    validationIds,
  };
  const datasetSha256 = contentHash(stableDataset);
  const datasetId = `critic-production-${datasetSha256.slice(0, 16)}`;
  const directory = resolve(input.datasetsRoot, datasetId);
  const manifestPath = resolve(directory, 'manifest.json');
  try {
    const existing = ProductionCriticDatasetManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
    if (existing.datasetSha256 !== datasetSha256) throw new Error('기존 immutable dataset hash가 일치하지 않습니다.');
    return { manifest: existing, directory, reused: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const allReasonTags = evaluations.flatMap((item) => item.sourceEvent.reasonTags);
  const pairwiseCount = preferenceExamples.reduce((total, event) => total + (event.selectedCandidateId === null ? 0 : Math.max(0, event.candidateIds.length - 1)), 0);
  const manifest = ProductionCriticDatasetManifestSchema.parse({
    schemaVersion: '0.1', purpose: 'visual-critic-production', datasetId, datasetSha256,
    createdAt: input.createdAt ?? new Date().toISOString(),
    split: stableDataset.split,
    sourceEventIds: sourceHashes.map((item) => item.eventId), sourceEventHashes: sourceHashes,
    humanLabelCount: examples.length,
    readyPositiveCount: examples.filter((example) => example.readiness === 'ready').length,
    rejectCount: examples.filter((example) => example.readiness === 'not-ready').length,
    preferenceEventCount: preferenceExamples.length,
    pairwiseCount,
    trainIds, validationIds, examples, preferences: preferenceExamples,
    distributions: {
      semanticShape: count(examples.map((example) => example.semanticShape)),
      mode: count(examples.map((example) => example.mode)),
      reasonTag: count(allReasonTags),
    },
    imageHashes: [
      ...examples.map((example) => ({ exampleId: example.exampleId, sha256: example.imageSha256 })),
      ...preferences.flatMap((evidence) => evidence.artifact.candidates.map((candidate) => ({ exampleId: `preference:${evidence.sourceEvent.eventId}:${candidate.candidateId}`, sha256: candidate.pngSha256 }))),
    ].sort((left, right) => left.exampleId.localeCompare(right.exampleId)),
    files: { train: 'train.jsonl', validation: 'validation.jsonl', preference: 'preference.jsonl' },
  });
  const byId = new Map(examples.map((example) => [example.exampleId, example]));
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(resolve(directory, manifest.files.train), jsonl(trainIds.map((id) => byId.get(id)!)), { encoding: 'utf8', flag: 'wx' }),
    writeFile(resolve(directory, manifest.files.validation), jsonl(validationIds.map((id) => byId.get(id)!)), { encoding: 'utf8', flag: 'wx' }),
    writeFile(resolve(directory, manifest.files.preference), jsonl(preferenceExamples), { encoding: 'utf8', flag: 'wx' }),
    writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' }),
  ]);
  return { manifest, directory, reused: false };
}

export async function loadProductionCriticDataset(path: string): Promise<ProductionCriticDatasetManifest> {
  return ProductionCriticDatasetManifestSchema.parse(JSON.parse(await readFile(path, 'utf8')));
}
