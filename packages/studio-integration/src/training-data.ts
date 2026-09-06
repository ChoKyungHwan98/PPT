import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  HumanTrainingEventStore,
  ProductionCriticDatasetManifestSchema,
  assessTrainingEligibility,
  buildProductionCriticDataset,
  type ProductionCriticDatasetManifest,
} from '@game-presentation/local-training';

export async function synchronizeHumanTrainingEvents(input: {
  repositoryRoot: string;
  trainingDataRoot: string;
  jobsRoot?: string;
}): Promise<{ evaluationCount: number; preferenceCount: number }> {
  const store = new HumanTrainingEventStore(input.trainingDataRoot, input.repositoryRoot);
  const jobsRoot = input.jobsRoot ?? resolve(input.repositoryRoot, 'output/studio-jobs');
  let entries: string[] = [];
  try { entries = await readdir(jobsRoot); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  for (const entry of entries.sort()) {
    if (!/^slide-[0-9]+-[a-z0-9]+$/iu.test(entry)) continue;
    const metadataPath = resolve(jobsRoot, entry, 'job.json');
    let metadata: { evaluationEvent?: unknown; preferenceEvidence?: unknown };
    try { metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as typeof metadata; } catch { continue; }
    let evaluation = metadata.evaluationEvent;
    if (evaluation === undefined) {
      try { evaluation = JSON.parse(await readFile(resolve(jobsRoot, entry, 'evaluation.json'), 'utf8')); } catch { /* Historical job without evaluation. */ }
    }
    if (evaluation !== undefined) await store.appendEvaluation(evaluation, metadataPath);
    if (metadata.preferenceEvidence !== undefined) await store.appendPreference(metadata.preferenceEvidence, metadataPath);
  }
  return { evaluationCount: (await store.loadEvaluations()).length, preferenceCount: (await store.loadPreferences()).length };
}

export async function buildCurrentProductionDataset(input: {
  repositoryRoot: string;
  trainingDataRoot: string;
  createdAt?: string;
}) {
  await synchronizeHumanTrainingEvents(input);
  const store = new HumanTrainingEventStore(input.trainingDataRoot, input.repositoryRoot);
  return buildProductionCriticDataset({
    repositoryRoot: input.repositoryRoot,
    datasetsRoot: resolve(input.trainingDataRoot, 'datasets'),
    evaluations: await store.loadEvaluations(),
    preferences: await store.loadPreferences(),
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
  });
}

export async function latestProductionDataset(trainingDataRoot: string): Promise<ProductionCriticDatasetManifest | null> {
  const datasetsRoot = resolve(trainingDataRoot, 'datasets');
  let entries: string[];
  try { entries = await readdir(datasetsRoot); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  const manifests = await Promise.all(entries.filter((entry) => entry.startsWith('critic-production-')).map(async (entry) => {
    try { return ProductionCriticDatasetManifestSchema.parse(JSON.parse(await readFile(resolve(datasetsRoot, entry, 'manifest.json'), 'utf8'))); } catch { return null; }
  }));
  return manifests.filter((value): value is ProductionCriticDatasetManifest => value !== null).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

export async function productionTrainingSummary(input: { repositoryRoot: string; trainingDataRoot: string }) {
  await synchronizeHumanTrainingEvents(input);
  const store = new HumanTrainingEventStore(input.trainingDataRoot, input.repositoryRoot);
  const evaluations = await store.loadEvaluations();
  const preferences = await store.loadPreferences();
  const dataset = await latestProductionDataset(input.trainingDataRoot);
  const pairwiseCount = preferences.reduce((total, item) => total + (item.sourceEvent.selectedCandidateId === null ? 0 : Math.max(0, item.sourceEvent.candidateIds.length - 1)), 0);
  const eligibility = dataset === null ? {
    qualityTraining: false, smokeTraining: false, benchmark: false,
    humanLabelCount: evaluations.length,
    readyPositiveCount: evaluations.filter((item) => item.sourceEvent.userDecision === 'ready').length,
    rejectCount: evaluations.filter((item) => item.sourceEvent.userDecision === 'reject').length,
    pairwiseCount, trainCount: 0, validationCount: 0,
    reasons: ['production dataset snapshot을 먼저 만들어야 합니다.'],
  } : assessTrainingEligibility(dataset);
  return { evaluations, preferences, dataset, eligibility };
}
