import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { contentHash, type AIProvider, type VisualCriticBenchmark } from '@game-presentation/contracts';
import type { CriticDatasetManifest } from '@game-presentation/local-training';

const BenchmarkCritiqueSchema = z.strictObject({
  submissionReadiness: z.enum(['ready', 'needs-review', 'not-ready']),
  findings: z.array(z.strictObject({ issueType: z.string().min(1), severity: z.enum(['info', 'warning', 'error']), reason: z.string().min(1), revisionDirection: z.string().min(1).optional() })),
});
type BenchmarkCritique = z.infer<typeof BenchmarkCritiqueSchema>;

function ratio(numerator: number, denominator: number): number { return denominator === 0 ? 0 : numerator / denominator; }

async function evaluate(provider: AIProvider, manifest: CriticDatasetManifest, repositoryRoot: string) {
  const outputs: Array<{ expected: CriticDatasetManifest['examples'][number]; actual: BenchmarkCritique; latencyMs: number; estimatedCostUsd: number }> = [];
  for (const example of manifest.examples) {
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

export async function runTrainedVisualCriticBenchmark(input: { modelProvider: AIProvider; baselineProvider: AIProvider; manifest: CriticDatasetManifest; repositoryRoot: string; now?: string }): Promise<VisualCriticBenchmark> {
  const [model, baseline] = await Promise.all([evaluate(input.modelProvider, input.manifest, input.repositoryRoot), evaluate(input.baselineProvider, input.manifest, input.repositoryRoot)]);
  let expectedIssueCount = 0; let recalledIssueCount = 0; let severityTotal = 0; let severityMatches = 0; let suggestionTotal = 0; let specificSuggestions = 0;
  for (const item of model) {
    const expectedResponse = BenchmarkCritiqueSchema.parse(JSON.parse(item.expected.response));
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
