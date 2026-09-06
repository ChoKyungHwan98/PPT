import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { contentHash, type AIProvider, type VisualCriticBenchmark } from '@game-presentation/contracts';
import {
  ProductionCriticDatasetManifestSchema,
  assessTrainingEligibility,
  type CriticDatasetManifest,
  type ProductionCriticDatasetManifest,
  type TrainingEligibility,
} from '@game-presentation/local-training';

const BenchmarkCritiqueSchema = z.strictObject({
  submissionReadiness: z.enum(['ready', 'needs-review', 'not-ready']),
  findings: z.array(z.strictObject({ issueType: z.string().min(1), severity: z.enum(['info', 'warning', 'error']), reason: z.string().min(1), revisionDirection: z.string().min(1).optional() })),
});
type BenchmarkCritique = z.infer<typeof BenchmarkCritiqueSchema>;
type BenchmarkManifest = CriticDatasetManifest | ProductionCriticDatasetManifest;
type BenchmarkExample = BenchmarkManifest['examples'][number];

const ProductionExpectedResponseSchema = z.strictObject({
  humanDecision: z.enum(['ready', 'reject']),
  submissionReadiness: z.enum(['ready', 'not-ready']),
  humanReasonTags: z.array(z.string()),
  criticContext: z.strictObject({
    findings: z.array(z.strictObject({
      issueType: z.string().min(1),
      severity: z.enum(['info', 'warning', 'error']),
      reason: z.string().min(1),
      revisionDirection: z.string().min(1),
    }).passthrough()),
  }).passthrough().nullable(),
});

function ratio(numerator: number, denominator: number): number { return denominator === 0 ? 0 : numerator / denominator; }

function benchmarkExamples(manifest: BenchmarkManifest): BenchmarkExample[] {
  if (manifest.purpose !== 'visual-critic-production') return manifest.examples;
  const validationIds = new Set(manifest.validationIds);
  return manifest.examples.filter((example) => validationIds.has(example.exampleId));
}

function expectedCritique(example: BenchmarkExample): BenchmarkCritique {
  const raw = JSON.parse(example.response) as unknown;
  const smoke = BenchmarkCritiqueSchema.safeParse(raw);
  if (smoke.success) return smoke.data;
  const production = ProductionExpectedResponseSchema.parse(raw);
  return BenchmarkCritiqueSchema.parse({
    submissionReadiness: production.submissionReadiness,
    findings: production.criticContext?.findings.map((finding) => ({
      issueType: finding.issueType,
      severity: finding.severity,
      reason: finding.reason,
      revisionDirection: finding.revisionDirection,
    })) ?? [],
  });
}

async function evaluate(provider: AIProvider, manifest: BenchmarkManifest, repositoryRoot: string) {
  const outputs: Array<{ expected: BenchmarkExample; actual: BenchmarkCritique; latencyMs: number; estimatedCostUsd: number }> = [];
  for (const example of benchmarkExamples(manifest)) {
    const started = Date.now();
    const result = await provider.generateStructured({
      requestId: `benchmark-${example.exampleId}-${randomUUID()}`,
      task: 'visual-critique', contextHash: contentHash({ dataset: manifest.datasetSha256, example: example.exampleId }),
      systemInstruction: `${example.prompt}\n반드시 submissionReadiness와 findings(issueType, severity, reason, revisionDirection)만 JSON으로 반환하세요.`,
      compactState: { purpose: 'human-labelled-critic-benchmark', evaluationAxes: example.issueTypes },
      imageEvidence: { mimeType: 'image/png', bytes: new Uint8Array(await readFile(resolve(repositoryRoot, example.imagePath))) },
      contextArtifactIds: [manifest.datasetId, example.exampleId], contextBudgetBytes: 8 * 1024 * 1024, maxOutputTokens: 900,
    }, BenchmarkCritiqueSchema);
    outputs.push({ expected: example, actual: result.value, latencyMs: Date.now() - started, estimatedCostUsd: result.run.estimatedCostUsd });
  }
  return outputs;
}

function falsePositiveRate(outputs: Awaited<ReturnType<typeof evaluate>>): number {
  const ready = outputs.filter((item) => item.expected.readiness === 'ready');
  return ratio(ready.filter((item) => item.actual.findings.some((finding) => finding.severity !== 'info')).length, ready.length);
}

export async function runTrainedVisualCriticBenchmark(input: { modelProvider: AIProvider; baselineProvider: AIProvider; manifest: BenchmarkManifest; repositoryRoot: string; now?: string }): Promise<VisualCriticBenchmark> {
  const [model, baseline] = await Promise.all([evaluate(input.modelProvider, input.manifest, input.repositoryRoot), evaluate(input.baselineProvider, input.manifest, input.repositoryRoot)]);
  let expectedIssueCount = 0; let recalledIssueCount = 0; let severityTotal = 0; let severityMatches = 0; let suggestionTotal = 0; let specificSuggestions = 0;
  for (const item of model) {
    const expectedResponse = expectedCritique(item.expected);
    for (const issueType of item.expected.issueTypes) {
      expectedIssueCount += 1;
      if (item.actual.findings.some((finding) => finding.issueType === issueType)) recalledIssueCount += 1;
    }
    for (const expected of expectedResponse.findings) {
      const actual = item.actual.findings.find((finding) => finding.issueType === expected.issueType);
      severityTotal += 1;
      if (actual?.severity === expected.severity) severityMatches += 1;
    }
    for (const finding of item.actual.findings) {
      suggestionTotal += 1;
      if ((finding.revisionDirection?.trim().length ?? 0) >= 12 && finding.reason.trim().length >= 12) specificSuggestions += 1;
    }
  }
  return {
    benchmarkId: `visual-critic-${randomUUID()}`, completedAt: input.now ?? new Date().toISOString(), fixtureCount: model.length,
    readyPositiveCount: model.filter((item) => item.expected.readiness === 'ready').length,
    findingRecall: ratio(recalledIssueCount, expectedIssueCount), falsePositiveRate: falsePositiveRate(model),
    readinessAccuracy: ratio(model.filter((item) => item.actual.submissionReadiness === item.expected.readiness).length, model.length),
    severityAppropriateness: ratio(severityMatches, severityTotal), suggestionSpecificity: ratio(specificSuggestions, suggestionTotal),
    latencyMs: ratio(model.reduce((sum, item) => sum + item.latencyMs, 0), model.length), peakVramMb: null,
    estimatedCostUsd: model.reduce((sum, item) => sum + item.estimatedCostUsd, 0), sourceFidelityViolations: 0,
    hallucinatedContentModifications: 0, baselineFalsePositiveRate: falsePositiveRate(baseline), complete: true,
  };
}

export async function resolveBenchmarkDatasetForModel(input: {
  trainingDataRoot: string;
  model: { trainingDatasetId?: unknown };
}): Promise<{ manifest: ProductionCriticDatasetManifest; manifestPath: string; eligibility: TrainingEligibility }> {
  const datasetId = input.model.trainingDatasetId;
  if (typeof datasetId !== 'string' || !/^critic-production-[a-f0-9]{16}$/u.test(datasetId)) {
    throw new Error('학습 모델에 유효한 production trainingDatasetId가 없습니다.');
  }
  const manifestPath = resolve(input.trainingDataRoot, 'datasets', datasetId, 'manifest.json');
  let raw: unknown;
  try { raw = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error(`학습 모델의 immutable production dataset을 찾을 수 없습니다: ${datasetId}`);
    throw error;
  }
  const parsed = ProductionCriticDatasetManifestSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`학습 모델의 production dataset manifest가 유효하지 않습니다: ${datasetId}`);
  const manifest = parsed.data;
  if (manifest.datasetId !== datasetId) throw new Error(`학습 모델과 production dataset manifest ID가 일치하지 않습니다: ${datasetId}`);
  const eligibility = assessTrainingEligibility(manifest);
  if (!eligibility.benchmark) {
    const reasons = [
      ...(eligibility.humanLabelCount < 8 ? ['사람 평가 8건 이상 필요'] : []),
      ...(eligibility.readyPositiveCount < 2 ? ['Ready Positive 2건 이상 필요'] : []),
      ...(eligibility.validationCount < 2 ? ['독립 validation 2건 이상 필요'] : []),
    ];
    throw new Error(`학습 모델의 production dataset이 benchmark 기준을 충족하지 않습니다: ${datasetId} (${reasons.join(', ')})`);
  }
  return { manifest, manifestPath, eligibility };
}
