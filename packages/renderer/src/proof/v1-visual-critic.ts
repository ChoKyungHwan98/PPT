import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VisualCritiqueReportSchema, type ProviderRunRecord } from '@game-presentation/contracts';
import { launchRenderBrowser } from '../browser.js';
import { createCriticFixtureArtifacts, CRITIC_FIXTURE_PAGE_GOAL, type CriticFixtureArtifact } from '../critic-fixtures.js';
import { exportRenderTree } from '../export.js';
import { loadSystemPretendard } from '../font.js';
import { OpenRouterAIProvider } from '../openrouter-provider.js';
import { benchmarkCriticReport, criticGuardrailIssues, runVisualCritic, type VisualCriticRun } from '../visual-critic.js';

type ComparedReasoningEffort = 'low' | 'medium';
const COMPARED_REASONING: readonly ComparedReasoningEffort[] = ['low', 'medium'];

async function loadLocalEnvironment(): Promise<void> {
  const path = resolve('.env.local');
  const text = await readFile(path, 'utf8').catch(() => '');
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (process.env[name] === undefined && value.length > 0) process.env[name] = value;
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
}

async function replayCritic(path: string, artifactId: string): Promise<VisualCriticRun> {
  const stored = JSON.parse(await readFile(path, 'utf8')) as Partial<VisualCriticRun>;
  const report = VisualCritiqueReportSchema.parse(stored.report);
  if (report.artifactId !== artifactId || stored.run === undefined || stored.inputTrace === undefined) {
    throw new Error(`재사용할 Critic evidence가 현재 artifact와 일치하지 않습니다: ${path}`);
  }
  return {
    report,
    run: { ...stored.run, cacheHit: true },
    inputTrace: stored.inputTrace,
    guardrailIssues: criticGuardrailIssues(report),
  };
}

function usageTotals(runs: ProviderRunRecord[]) {
  return {
    inputTokens: runs.reduce((sum, run) => sum + (run.inputTokens ?? 0), 0),
    outputTokens: runs.reduce((sum, run) => sum + (run.outputTokens ?? 0), 0),
    reasoningTokens: runs.reduce((sum, run) => sum + (run.reasoningTokens ?? 0), 0),
    totalTokens: runs.reduce((sum, run) => sum + (run.totalTokens ?? 0), 0),
    estimatedCostUsd: runs.reduce((sum, run) => sum + run.estimatedCostUsd, 0),
  };
}

function aggregateResults(results: Array<ReturnType<typeof benchmarkCriticReport>>, runs: ProviderRunRecord[]) {
  const problemResults = results.filter((result) => result.expectedCount > 0);
  const expectedCount = problemResults.reduce((sum, result) => sum + result.expectedCount, 0);
  const matchedCount = problemResults.reduce((sum, result) => sum + result.matchedExpectedCount, 0);
  const actualFindingCount = results.reduce((sum, result) => sum + result.actualFindingCount, 0);
  const falsePositiveCount = results.reduce((sum, result) => sum + (result.falsePositiveCount ?? 0), 0);
  const severityDenominator = results.reduce((sum, result) => sum + result.matchedExpectedCount, 0);
  const severityExactCount = results.reduce((sum, result) => sum + result.severityExactCount, 0);
  const specificSuggestionCount = results.reduce((sum, result) => sum + result.specificSuggestionCount, 0);
  const readinessMatchedCount = results.filter((result) => result.readinessMatched).length;
  const positiveResults = results.filter((result) => result.expectedSubmissionReadiness === 'ready');
  const positiveFixturePresent = positiveResults.length > 0;
  return {
    problemRecall: expectedCount === 0 ? null : matchedCount / expectedCount,
    matchedExpectedCount: matchedCount,
    expectedCount,
    falsePositiveCount,
    falsePositiveRate: actualFindingCount === 0 ? 0 : falsePositiveCount / actualFindingCount,
    readinessAccuracy: results.length === 0 ? null : readinessMatchedCount / results.length,
    readinessMatchedCount,
    readinessFixtureCount: results.length,
    severityAccuracy: severityDenominator === 0 ? null : severityExactCount / severityDenominator,
    severityExactCount,
    severityDenominator,
    revisionSuggestionSpecificity: severityDenominator === 0 ? null : specificSuggestionCount / severityDenominator,
    specificSuggestionCount,
    positiveFixturePresent,
    positiveFixturePassed: positiveFixturePresent
      ? positiveResults.every((result) => result.positiveFixturePassed === true)
      : null,
    everyFixturePassed: positiveFixturePresent && results.every((result) => result.fixturePassed),
    allGuardrailsPassed: results.every((result) => result.guardrailIssues.length === 0),
    tokenUsage: usageTotals(runs),
  };
}

function shouldAdoptMedium(
  low: ReturnType<typeof aggregateResults>,
  medium: ReturnType<typeof aggregateResults>,
): boolean {
  const lowReadiness = low.readinessAccuracy ?? 0;
  const mediumReadiness = medium.readinessAccuracy ?? 0;
  const lowRecall = low.problemRecall ?? 0;
  const mediumRecall = medium.problemRecall ?? 0;
  return mediumReadiness >= lowReadiness
    && mediumRecall >= lowRecall
    && (mediumReadiness > lowReadiness || mediumRecall > lowRecall);
}

async function fixturePng(input: {
  artifact: CriticFixtureArtifact;
  outputDir: string;
  browser: Awaited<ReturnType<typeof launchRenderBrowser>>;
  fonts: Awaited<ReturnType<typeof loadSystemPretendard>>;
}) {
  const { artifact, outputDir, browser, fonts } = input;
  await writeFile(
    resolve(outputDir, `${artifact.fixture.fixtureId}.human-label.json`),
    JSON.stringify(artifact.fixture, null, 2) + '\n',
    'utf8',
  );
  await writeFile(
    resolve(outputDir, `${artifact.fixture.fixtureId}.composition-plan.json`),
    JSON.stringify(artifact.compositionPlan, null, 2) + '\n',
    'utf8',
  );
  if (artifact.pngSourcePath !== undefined) {
    const pngPath = resolve(outputDir, `${artifact.fixture.fixtureId}.png`);
    await copyFile(resolve(artifact.pngSourcePath), pngPath);
    return { pngPath, sourcePngPath: resolve(artifact.pngSourcePath) };
  }
  return exportRenderTree({
    browser,
    tree: artifact.tree,
    fonts,
    outputDir,
    basename: artifact.fixture.fixtureId,
  });
}

async function main(): Promise<void> {
  await loadLocalEnvironment();
  const providerKind = requiredEnvironment('CRITIC_PROVIDER');
  if (providerKind !== 'openrouter') throw new Error('이번 proof는 CRITIC_PROVIDER=openrouter만 지원합니다.');
  const replay = process.env.CRITIC_REPLAY === '1';
  const model = requiredEnvironment('CRITIC_MODEL_ID');
  const apiKey = replay ? '' : requiredEnvironment('OPENROUTER_API_KEY');
  const outputDir = resolve('output', 'v1-visual-critic');
  await mkdir(outputDir, { recursive: true });
  const fonts = await loadSystemPretendard();
  const browser = await launchRenderBrowser();
  try {
    const artifacts = await createCriticFixtureArtifacts({ browser, fonts });
    const prepared = [];
    for (const artifact of artifacts) {
      const outputs = await fixturePng({ artifact, outputDir, browser, fonts });
      prepared.push({ artifact, outputs, pngBytes: new Uint8Array(await readFile(outputs.pngPath)) });
    }

    const comparisons: Record<ComparedReasoningEffort, {
      fixtureResults: Array<{
        fixture: CriticFixtureArtifact['fixture'];
        outputs: (typeof prepared)[number]['outputs'];
        hardGate: { passed: boolean; programFindingCount: number; sourceFidelityFindingCount: number };
        critic: VisualCriticRun;
        benchmark: ReturnType<typeof benchmarkCriticReport>;
      }>;
      aggregate: ReturnType<typeof aggregateResults>;
    }> = {} as never;

    for (const effort of COMPARED_REASONING) {
      const provider = replay ? undefined : new OpenRouterAIProvider({ apiKey, model, reasoningEffort: effort });
      const fixtureResults = [];
      for (const item of prepared) {
        const { artifact, outputs, pngBytes } = item;
        const criticPath = resolve(outputDir, `${artifact.fixture.fixtureId}.${effort}.critic.json`);
        const critic = replay
          ? await replayCritic(criticPath, artifact.fixture.artifactId)
          : await runVisualCritic({
              provider: provider!,
              pngBytes,
              artifactId: artifact.fixture.artifactId,
              goal: CRITIC_FIXTURE_PAGE_GOAL,
              slide: artifact.slide,
              informationPlan: artifact.informationPlan,
              hardGate: artifact.hardGate,
              requestIdSalt: effort,
            });
        const benchmark = benchmarkCriticReport(artifact.fixture, critic.report);
        fixtureResults.push({
          fixture: artifact.fixture,
          outputs,
          hardGate: {
            passed: artifact.hardGate.passed,
            programFindingCount: artifact.hardGate.programFindings.length,
            sourceFidelityFindingCount: artifact.hardGate.sourceFidelityFindings.length,
          },
          critic,
          benchmark,
        });
        await writeFile(
          criticPath,
          JSON.stringify({
            reasoningEffort: effort,
            report: critic.report,
            run: critic.run,
            inputTrace: critic.inputTrace,
            guardrailIssues: critic.guardrailIssues,
          }, null, 2) + '\n',
          'utf8',
        );
      }
      comparisons[effort] = {
        fixtureResults,
        aggregate: aggregateResults(
          fixtureResults.map((result) => result.benchmark),
          fixtureResults.map((result) => result.critic.run),
        ),
      };
    }

    const adoptedReasoning = shouldAdoptMedium(comparisons.low.aggregate, comparisons.medium.aggregate)
      ? 'medium'
      : 'low';
    const report = {
      schemaVersion: '0.2',
      benchmarkPolicy: {
        labelCoverage: 'exhaustive',
        readinessComparison: 'exact',
        positiveRequiresReadyAndZeroFindings: true,
        mediumAdoptionRule: 'Medium은 Readiness Accuracy와 Problem Recall을 악화시키지 않으면서 둘 중 하나 이상을 개선할 때만 채택한다.',
      },
      model,
      replayedFromStoredEvidence: replay,
      comparisons,
      adoptedReasoning,
      currentV1FixtureId: 'rough-but-readable',
      positiveFixtureId: null,
      intermediateFixtureId: 'intermediate-golden-case',
      totalActualCostUsd: comparisons.low.aggregate.tokenUsage.estimatedCostUsd
        + comparisons.medium.aggregate.tokenUsage.estimatedCostUsd,
    };
    await writeFile(resolve(outputDir, 'benchmark-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
    process.stdout.write(JSON.stringify({
      outputDir,
      model,
      adoptedReasoning,
      low: comparisons.low.aggregate,
      medium: comparisons.medium.aggregate,
      currentV1: {
        low: comparisons.low.fixtureResults.find((result) => result.fixture.fixtureId === 'rough-but-readable')?.critic.report,
        medium: comparisons.medium.fixtureResults.find((result) => result.fixture.fixtureId === 'rough-but-readable')?.critic.report,
      },
      intermediate: {
        low: comparisons.low.fixtureResults.find((result) => result.fixture.fixtureId === 'intermediate-golden-case')?.critic.report,
        medium: comparisons.medium.fixtureResults.find((result) => result.fixture.fixtureId === 'intermediate-golden-case')?.critic.report,
      },
      totalActualCostUsd: report.totalActualCostUsd,
    }, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}

await main();
