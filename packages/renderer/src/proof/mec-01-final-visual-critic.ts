import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { RenderTreeSchema } from '@game-presentation/contracts';
import { createMec01InformationPlan, interpretMec01Source } from '../../../source-ingestion/src/mec-01-semantic.js';
import { runHardGate } from '../hard-gate.js';
import { OpenRouterAIProvider } from '../openrouter-provider.js';
import { runVisualCritic } from '../visual-critic.js';

const rawText = '회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%';
const basename = 'mec-01-final-balanced-runway';
const pngPath = resolve(
  'packages',
  'renderer',
  'fixtures',
  'mec-01-polish-final-balanced-runway-final.png',
);
const renderTreePath = resolve(
  'packages',
  'renderer',
  'fixtures',
  'mec-01-polish-final-balanced-runway-final.render-tree.json',
);
const outputDir = resolve('output', 'v1-visual-critic');

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

function findingMarkdown(finding: {
  findingId: string;
  issueType: string;
  severity: string;
  target: { kind: string; ids: string[] };
  problem: string;
  reason: string;
  revisionDirection: string;
}): string {
  return [
    `### ${finding.severity.toUpperCase()} — ${finding.issueType}`,
    '',
    `- 대상: ${finding.target.kind} / ${finding.target.ids.join(', ')}`,
    `- 문제: ${finding.problem}`,
    `- 이유: ${finding.reason}`,
    `- 수정 방향: ${finding.revisionDirection}`,
  ].join('\n');
}

async function main(): Promise<void> {
  await loadLocalEnvironment();
  if (requiredEnvironment('CRITIC_PROVIDER') !== 'openrouter') {
    throw new Error('현재 final Critic proof는 OpenRouter provider만 지원합니다.');
  }
  const provider = new OpenRouterAIProvider({
    apiKey: requiredEnvironment('OPENROUTER_API_KEY'),
    model: requiredEnvironment('CRITIC_MODEL_ID'),
    reasoningEffort: 'medium',
  });
  const slide = interpretMec01Source({ rawText, createdAt: '2026-08-29T00:00:00.000Z' });
  const informationPlan = createMec01InformationPlan(slide);
  const tree = RenderTreeSchema.parse(JSON.parse(await readFile(renderTreePath, 'utf8')));
  const hardGate = runHardGate({ slide, informationPlan, tree });
  if (!hardGate.passed) {
    throw new Error(`Critic 실행 전 Hard Gate 실패: ${JSON.stringify(hardGate.findings)}`);
  }

  const critic = await runVisualCritic({
    provider,
    pngBytes: new Uint8Array(await readFile(pngPath)),
    artifactId: tree.renderTreeId,
    goal: '축적/준비 3단계가 BREAK라는 상태 경계를 거쳐 받는 피해 +50% 결과로 이어짐을 한눈에 전달한다. 현재 PNG에 실제 남아 있는 hierarchy, reading order, density/space-use, focal point, consequence-field cohesion 문제만 진단한다. 이전에 해결된 문제를 관성적으로 반복하지 않는다.',
    slide,
    informationPlan,
    hardGate,
    requestIdSalt: 'layout-frozen-final-critic-v1',
  });

  const actionableFindings = critic.report.findings.filter((finding) => finding.severity !== 'info');
  const nonActionableFindings = critic.report.findings.filter((finding) => finding.severity === 'info');
  const reportArtifact = {
    schemaVersion: '0.1',
    artifactId: tree.renderTreeId,
    sourcePngPath: pngPath,
    renderTreeFingerprint: tree.deterministicFingerprint,
    layoutFrozen: true,
    automaticRevisionPerformed: false,
    critic: {
      report: critic.report,
      actionableFindings,
      nonActionableFindings,
      guardrailIssues: critic.guardrailIssues,
      run: critic.run,
      inputTrace: critic.inputTrace,
    },
  };
  const severityOrder = ['error', 'warning', 'info'] as const;
  const severitySections = severityOrder.flatMap((severity) => {
    const findings = critic.report.findings.filter((finding) => finding.severity === severity);
    if (findings.length === 0) return [];
    return [
      `## ${severity.toUpperCase()}`,
      '',
      findings.map(findingMarkdown).join('\n\n'),
      '',
    ];
  });
  const markdown = [
    '# MEC-01 Final Visual Critic',
    '',
    `- Submission readiness: **${critic.report.submissionReadiness}**`,
    `- First fixation: **${critic.report.firstFixation.target}** — ${critic.report.firstFixation.assessment}`,
    `- Reading path: ${critic.report.readingPathAssessment}`,
    `- Hard Gate: **${critic.report.hardGateStatus}**`,
    `- Source change suggested: **${critic.report.sourceChangeSuggested}**`,
    '',
    ...severitySections,
    '## 지금 고칠 가치가 있는 문제',
    '',
    actionableFindings.length === 0
      ? '- 없음'
      : actionableFindings.map((finding) => `- **${finding.severity}/${finding.issueType}**: ${finding.problem}`).join('\n'),
    '',
    '## 굳이 안 고쳐도 되는 문제',
    '',
    nonActionableFindings.length === 0
      ? '- 없음'
      : nonActionableFindings.map((finding) => `- **${finding.issueType}**: ${finding.problem}`).join('\n'),
    '',
    '## 실행 기록',
    '',
    `- Provider/model: ${critic.run.provider} / ${critic.run.model}`,
    `- Reasoning: medium`,
    `- Tokens: input ${critic.run.inputTokens ?? 0}, output ${critic.run.outputTokens ?? 0}, total ${critic.run.totalTokens ?? 0}`,
    `- Estimated cost: $${critic.run.estimatedCostUsd.toFixed(6)}`,
    `- Guardrail issues: ${critic.guardrailIssues.length}`,
    '- Automatic revision: 실행하지 않음',
    '',
  ].join('\n');

  await mkdir(outputDir, { recursive: true });
  const jsonPath = resolve(outputDir, `${basename}.critic-report.json`);
  const markdownPath = resolve(outputDir, `${basename}.critic-summary.md`);
  await writeFile(jsonPath, JSON.stringify(reportArtifact, null, 2) + '\n', 'utf8');
  await writeFile(markdownPath, markdown, 'utf8');
  process.stdout.write(JSON.stringify({
    jsonPath,
    markdownPath,
    submissionReadiness: critic.report.submissionReadiness,
    findingCounts: Object.fromEntries(severityOrder.map((severity) => [
      severity,
      critic.report.findings.filter((finding) => finding.severity === severity).length,
    ])),
    actionableFindingCount: actionableFindings.length,
    nonActionableFindingCount: nonActionableFindings.length,
    guardrailIssues: critic.guardrailIssues,
    run: critic.run,
    inputTrace: critic.inputTrace,
  }, null, 2) + '\n');
}

await main();
