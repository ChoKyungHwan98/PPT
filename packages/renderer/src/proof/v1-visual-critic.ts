import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VisualCritiqueReportSchema } from '@game-presentation/contracts';
import { launchRenderBrowser } from '../browser.js';
import { createCriticFixtureArtifacts, CRITIC_FIXTURE_PAGE_GOAL } from '../critic-fixtures.js';
import { exportRenderTree } from '../export.js';
import { loadSystemPretendard } from '../font.js';
import { OpenRouterAIProvider } from '../openrouter-provider.js';
import { benchmarkCriticReport, criticGuardrailIssues, runVisualCritic, type VisualCriticRun } from '../visual-critic.js';

type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high';

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

function reasoningEffort(): ReasoningEffort {
  const value = process.env.CRITIC_REASONING?.trim() ?? 'low';
  if (!['none', 'minimal', 'low', 'medium', 'high'].includes(value)) {
    throw new Error('CRITIC_REASONING은 none|minimal|low|medium|high 중 하나여야 합니다.');
  }
  return value as ReasoningEffort;
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

async function main(): Promise<void> {
  await loadLocalEnvironment();
  const providerKind = requiredEnvironment('CRITIC_PROVIDER');
  if (providerKind !== 'openrouter') throw new Error('이번 proof는 CRITIC_PROVIDER=openrouter만 지원합니다.');
  const replay = process.env.CRITIC_REPLAY === '1';
  const model = requiredEnvironment('CRITIC_MODEL_ID');
  const provider = replay ? undefined : new OpenRouterAIProvider({
    apiKey: requiredEnvironment('OPENROUTER_API_KEY'),
    model,
    reasoningEffort: reasoningEffort(),
  });
  const outputDir = resolve('output', 'v1-visual-critic');
  const fonts = await loadSystemPretendard();
  const browser = await launchRenderBrowser();
  try {
    const artifacts = await createCriticFixtureArtifacts({ browser, fonts });
    const fixtureResults = [];
    for (const artifact of artifacts) {
      const outputs = await exportRenderTree({
        browser,
        tree: artifact.tree,
        fonts,
        outputDir,
        basename: artifact.fixture.fixtureId,
      });
      await writeFile(
        resolve(outputDir, `${artifact.fixture.fixtureId}.composition-plan.json`),
        JSON.stringify(artifact.compositionPlan, null, 2) + '\n',
        'utf8',
      );
      const pngBytes = new Uint8Array(await readFile(outputs.pngPath));
      const criticPath = resolve(outputDir, `${artifact.fixture.fixtureId}.critic.json`);
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
        JSON.stringify({ report: critic.report, run: critic.run, inputTrace: critic.inputTrace, guardrailIssues: critic.guardrailIssues }, null, 2) + '\n',
        'utf8',
      );
    }

    const currentArtifact = artifacts.find((artifact) => artifact.fixture.fixtureId === 'clean-result');
    if (currentArtifact === undefined) throw new Error('정상 Critic fixture를 찾을 수 없습니다.');
    const currentPngPath = resolve('output', 'v1-information-flow', 'mec-01-threshold.png');
    const currentPngBytes = new Uint8Array(await readFile(currentPngPath));
    const currentCriticPath = resolve(outputDir, 'current-v1-threshold.critic.json');
    const currentCritic = replay
      ? await replayCritic(currentCriticPath, 'current-v1-threshold-render')
      : await runVisualCritic({
          provider: provider!,
          pngBytes: currentPngBytes,
          artifactId: 'current-v1-threshold-render',
          goal: CRITIC_FIXTURE_PAGE_GOAL,
          slide: currentArtifact.slide,
          informationPlan: currentArtifact.informationPlan,
          hardGate: currentArtifact.hardGate,
        });
    const currentReport = VisualCritiqueReportSchema.parse(currentCritic.report);
    await writeFile(
      currentCriticPath,
      JSON.stringify({ pngPath: currentPngPath, report: currentReport, run: currentCritic.run, inputTrace: currentCritic.inputTrace, guardrailIssues: currentCritic.guardrailIssues }, null, 2) + '\n',
      'utf8',
    );

    const problemFixtures = fixtureResults.filter((result) => result.fixture.expectedFindings.length > 0);
    const expectedTotal = problemFixtures.reduce((sum, result) => sum + result.benchmark.expectedCount, 0);
    const matchedTotal = problemFixtures.reduce((sum, result) => sum + result.benchmark.matchedExpectedCount, 0);
    const exhaustiveBenchmarks = fixtureResults.filter((result) => result.benchmark.falsePositiveCount !== null);
    const falsePositiveTotal = exhaustiveBenchmarks.reduce((sum, result) => sum + (result.benchmark.falsePositiveCount ?? 0), 0);
    const exhaustiveActionableTotal = exhaustiveBenchmarks.reduce((sum, result) => sum + result.benchmark.actualActionableCount, 0);
    const aggregate = {
      problemRecall: expectedTotal === 0 ? null : matchedTotal / expectedTotal,
      matchedExpectedCount: matchedTotal,
      expectedCount: expectedTotal,
      falsePositiveCount: falsePositiveTotal,
      falsePositiveRate: exhaustiveActionableTotal === 0 ? 0 : falsePositiveTotal / exhaustiveActionableTotal,
      normalFixturePassed: fixtureResults.find((result) => result.fixture.fixtureId === 'clean-result')?.benchmark.normalFixturePassed ?? false,
      allGuardrailsPassed: fixtureResults.every((result) => result.critic.guardrailIssues.length === 0)
        && currentCritic.guardrailIssues.length === 0,
      model,
      reasoning: reasoningEffort(),
      replayedFromStoredEvidence: replay,
      tokenUsage: {
        inputTokens: [...fixtureResults.map((result) => result.critic.run), currentCritic.run]
          .reduce((sum, run) => sum + (run.inputTokens ?? 0), 0),
        outputTokens: [...fixtureResults.map((result) => result.critic.run), currentCritic.run]
          .reduce((sum, run) => sum + (run.outputTokens ?? 0), 0),
        reasoningTokens: [...fixtureResults.map((result) => result.critic.run), currentCritic.run]
          .reduce((sum, run) => sum + (run.reasoningTokens ?? 0), 0),
        totalTokens: [...fixtureResults.map((result) => result.critic.run), currentCritic.run]
          .reduce((sum, run) => sum + (run.totalTokens ?? 0), 0),
        estimatedCostUsd: [...fixtureResults.map((result) => result.critic.run), currentCritic.run]
          .reduce((sum, run) => sum + run.estimatedCostUsd, 0),
      },
    };
    const report = {
      schemaVersion: '0.1',
      fixtureResults,
      currentV1: {
        pngPath: currentPngPath,
        critic: currentCritic,
      },
      aggregate,
    };
    await writeFile(resolve(outputDir, 'benchmark-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
    process.stdout.write(JSON.stringify({
      outputDir,
      fixtures: fixtureResults.map((result) => ({
        fixtureId: result.fixture.fixtureId,
        hardGatePassed: result.hardGate.passed,
        benchmark: result.benchmark,
        usage: result.critic.run,
      })),
      currentV1: { report: currentReport, usage: currentCritic.run, guardrailIssues: currentCritic.guardrailIssues },
      aggregate,
    }, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}

await main();
