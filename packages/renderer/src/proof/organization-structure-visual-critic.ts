import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { RenderTreeSchema } from '@game-presentation/contracts';
import {
  interpretAuthoredHierarchy,
  type AuthoredHierarchy,
} from '../../../source-ingestion/src/authored-hierarchy.js';
import { runHardGate } from '../hard-gate.js';
import { OpenRouterAIProvider } from '../openrouter-provider.js';
import { runVisualCritic } from '../visual-critic.js';

const fixtureDir = resolve('packages/renderer/fixtures/organization-structure');
const sourcePath = resolve('packages/source-ingestion/fixtures/combat-system-organization.source.json');
const pngPath = resolve(fixtureDir, 'organization-structure-teacher-guided.png');
const renderTreePath = resolve(fixtureDir, 'organization-structure-teacher-guided.render-tree.json');
const outputDir = resolve('output/v1-visual-critic/organization-structure');

async function loadLocalEnvironment(): Promise<void> {
  const text = await readFile(resolve('.env.local'), 'utf8').catch(() => '');
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

function criticReasoning(): 'none' | 'minimal' | 'low' | 'medium' | 'high' {
  const value = requiredEnvironment('CRITIC_REASONING');
  if (!['none', 'minimal', 'low', 'medium', 'high'].includes(value)) {
    throw new Error(`지원하지 않는 CRITIC_REASONING입니다: ${value}`);
  }
  return value as 'none' | 'minimal' | 'low' | 'medium' | 'high';
}

async function main(): Promise<void> {
  await loadLocalEnvironment();
  if (requiredEnvironment('CRITIC_PROVIDER') !== 'openrouter') {
    throw new Error('Organization V1 Critic proof는 현재 OpenRouter provider만 지원합니다.');
  }
  const source = JSON.parse(await readFile(sourcePath, 'utf8')) as AuthoredHierarchy;
  const { slide, informationPlan } = interpretAuthoredHierarchy(source);
  const tree = RenderTreeSchema.parse(JSON.parse(await readFile(renderTreePath, 'utf8')));
  const hardGate = runHardGate({ slide, informationPlan, tree });
  if (!hardGate.passed) {
    throw new Error(`Critic 실행 전 Hard Gate 실패: ${JSON.stringify(hardGate.findings)}`);
  }
  const provider = new OpenRouterAIProvider({
    apiKey: requiredEnvironment('OPENROUTER_API_KEY'),
    model: requiredEnvironment('CRITIC_MODEL_ID'),
    reasoningEffort: criticReasoning(),
  });
  const critic = await runVisualCritic({
    provider,
    pngBytes: new Uint8Array(await readFile(pngPath)),
    artifactId: tree.renderTreeId,
    goal: '전투 시스템의 운영 원칙 설명과 책임·소속 구조도를 역할별로 분리해 보여준다. 실제 PNG에서 정보 위계, 첫 시선, 설명 영역과 구조도의 균형, 부모·자식 관계와 연결선 가독성, 글자 위계, 여백·정렬·통일감, 실제 게임 기획 포트폴리오 제출 수준을 평가한다. 화면에서 확인되며 현재 배치 수준에서 고칠 가치가 있는 문제만 finding으로 남긴다.',
    slide,
    informationPlan,
    hardGate,
    requestIdSalt: 'organization-teacher-guided-single-critic-v1',
  });
  if (critic.guardrailIssues.length > 0) {
    throw new Error(`Critic guardrail 실패: ${JSON.stringify(critic.guardrailIssues)}`);
  }
  const reportArtifact = {
    schemaVersion: '0.1',
    artifactId: tree.renderTreeId,
    sourcePngPath: pngPath,
    renderTreeFingerprint: tree.deterministicFingerprint,
    criticCallCount: 1,
    automaticRevisionPerformed: false,
    readyPositiveFixture: false,
    hardGateBeforeCritic: {
      passed: hardGate.passed,
      programFindingCount: hardGate.programFindings.length,
      sourceFidelityFindingCount: hardGate.sourceFidelityFindings.length,
    },
    critic,
  };
  const findings = critic.report.findings.map((finding) => [
    `### ${finding.severity.toUpperCase()} — ${finding.issueType}`,
    '',
    `- 대상: ${finding.target.kind} / ${finding.target.ids.join(', ')}`,
    `- 문제: ${finding.problem}`,
    `- 이유: ${finding.reason}`,
    `- 수정 방향: ${finding.revisionDirection}`,
  ].join('\n'));
  const markdown = [
    '# Organization Teacher-guided Visual Critic',
    '',
    `- Submission readiness: **${critic.report.submissionReadiness}**`,
    `- First fixation: **${critic.report.firstFixation.target}** — ${critic.report.firstFixation.assessment}`,
    `- Reading path: ${critic.report.readingPathAssessment}`,
    `- Hard Gate: **${critic.report.hardGateStatus}**`,
    `- Source change suggested: **${critic.report.sourceChangeSuggested}**`,
    '',
    '## Findings',
    '',
    ...(findings.length === 0 ? ['- 없음'] : findings),
    '',
    '## 실행 기록',
    '',
    `- Provider/model: ${critic.run.provider} / ${critic.run.model}`,
    `- Reasoning: ${process.env.CRITIC_REASONING}`,
    `- Tokens: input ${critic.run.inputTokens ?? 0}, output ${critic.run.outputTokens ?? 0}, total ${critic.run.totalTokens ?? 0}`,
    `- Estimated cost: $${critic.run.estimatedCostUsd.toFixed(6)}`,
    '- Critic call count: 1',
    '- Ready promotion: 실행하지 않음',
    '',
  ].join('\n');
  await mkdir(outputDir, { recursive: true });
  const jsonPath = resolve(outputDir, 'organization-structure-teacher-guided.critic-report.json');
  const markdownPath = resolve(outputDir, 'organization-structure-teacher-guided.critic-summary.md');
  await writeFile(jsonPath, JSON.stringify(reportArtifact, null, 2) + '\n', 'utf8');
  await writeFile(markdownPath, markdown, 'utf8');
  process.stdout.write(JSON.stringify({
    jsonPath,
    markdownPath,
    submissionReadiness: critic.report.submissionReadiness,
    findings: critic.report.findings,
    guardrailIssues: critic.guardrailIssues,
    run: critic.run,
    inputTrace: critic.inputTrace,
  }, null, 2) + '\n');
}

await main();
