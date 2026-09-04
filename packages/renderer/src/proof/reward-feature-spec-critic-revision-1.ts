import { createHash } from 'node:crypto';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import {
  CompositionPlanSchema,
  RenderTreeSchema,
  SEED_PATTERN_FRAGMENTS,
  SEED_REFERENCE_CORPUS,
  type RenderTree,
  type VisualCritiqueReport,
  type VisualIssueType,
} from '@game-presentation/contracts';
import { createCompositionPlanFromInformationPlan } from '@game-presentation/composition-engine';
import {
  buildTeacherDesignGuidance,
  externalComparisonReferenceRecords,
  loadExternalMasterReferenceSet,
  loadExternalMasterTeacherPageSet,
  retrieveReferencesForInformationPlan,
  selectCuratedTeachersForInformationPlan,
} from '@game-presentation/reference-engine';
import {
  interpretAuthoredFeatureComparison,
  type AuthoredFeatureComparison,
} from '../../../source-ingestion/src/authored-feature-comparison.js';
import type { AlignedFeaturePresentationRevision } from '../aligned-feature-layout.js';
import { launchRenderBrowser } from '../browser.js';
import { loadSystemPretendard } from '../font.js';
import { runHardGate } from '../hard-gate.js';
import { buildInformationRenderTree, informationMeasureRequests } from '../information-layout.js';
import { measureTextBatch } from '../measure.js';
import { OpenRouterAIProvider } from '../openrouter-provider.js';
import { exportRenderPreview } from '../preview-export.js';
import { runVisualCritic, type VisualCriticRun } from '../visual-critic.js';

const fixtureDir = resolve('packages/renderer/fixtures/reward-feature-spec');
const outputDir = resolve('output/v1-visual-critic/reward-feature-spec');
const sourcePath = resolve('packages/source-ingestion/fixtures/reward-feature-spec.source.json');
const revisedBasename = 'reward-feature-spec-teacher-guided-critic-revision-1';
const rubricIds = ['space-use', 'grouping', 'relation-clarity', 'submission-readiness'] as const satisfies readonly VisualIssueType[];

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

function reasoningEffort(): 'none' | 'minimal' | 'low' | 'medium' | 'high' {
  const value = requiredEnvironment('CRITIC_REASONING');
  if (!['none', 'minimal', 'low', 'medium', 'high'].includes(value)) {
    throw new Error('CRITIC_REASONING 설정이 올바르지 않습니다.');
  }
  return value as 'none' | 'minimal' | 'low' | 'medium' | 'high';
}

function revisionFrom(report: VisualCritiqueReport): AlignedFeaturePresentationRevision {
  const actionable = report.findings.filter((finding) => finding.severity !== 'info');
  const has = (issueType: VisualIssueType) => actionable.some((finding) => finding.issueType === issueType);
  const revision = {
    revisionId: 'critic-targeted-revision-1',
    tightenSpaceUse: has('space-use'),
    strengthenGrouping: has('grouping'),
    strengthenRelation: has('relation-clarity'),
  } as const;
  if (!revision.tightenSpaceUse && !revision.strengthenGrouping && !revision.strengthenRelation) {
    throw new Error('Critic finding에 허용된 presentation parameter로 수정할 수 있는 구체적 문제가 없습니다.');
  }
  return revision;
}

function parameterDiff(revision: AlignedFeaturePresentationRevision): string[] {
  return [
    ...(revision.tightenSpaceUse
      ? [
          'content bounds: top 7% → 4.5%, height 84% → 90%',
          'shared context/comparison field vertical share: 30/70 → 24/76',
        ]
      : []),
    ...(revision.strengthenGrouping
      ? ['pair row separator stroke: 1px → 1.4px']
      : []),
    ...(revision.strengthenRelation
      ? [
          'Before/change/After width share: 44/12/44 → 42/16/42',
          'change arrow: 40px/1.6px → 72px/2.2px',
        ]
      : []),
  ];
}

function findingLine(finding: VisualCritiqueReport['findings'][number]): string {
  return `- **${finding.severity}/${finding.issueType}** ${finding.problem} — ${finding.revisionDirection}`;
}

async function main(): Promise<void> {
  await loadLocalEnvironment();
  if (requiredEnvironment('CRITIC_PROVIDER') !== 'openrouter') {
    throw new Error('현재 reward Critic proof는 OpenRouter provider만 지원합니다.');
  }
  const combinedReportPath = resolve(outputDir, 'reward-feature-spec-critic-revision-1.report.json');
  try {
    await access(combinedReportPath);
    throw new Error('이 fixture의 Critic + 단일 revision cycle은 이미 실행되었습니다. 추가 실행을 차단합니다.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('추가 실행을 차단')) throw error;
  }

  const source = JSON.parse(await readFile(sourcePath, 'utf8')) as AuthoredFeatureComparison;
  const { slide, informationPlan } = interpretAuthoredFeatureComparison(source);
  const referenceDir = resolve('packages/reference-engine/references/external-master-2025-v1');
  const references = await loadExternalMasterReferenceSet(referenceDir);
  const teachers = (await loadExternalMasterTeacherPageSet(referenceDir)).pages;
  const corpus = [...SEED_REFERENCE_CORPUS, ...externalComparisonReferenceRecords(references, referenceDir)];
  const retrieval = retrieveReferencesForInformationPlan({
    slide,
    informationPlan,
    corpus,
    audience: 'game-design-reviewer',
    outputProfile: 'pdf-presentation',
    limit: 4,
  });
  const selection = selectCuratedTeachersForInformationPlan({ slide, informationPlan, teachers, limit: 3 });
  const guidanceResolution = buildTeacherDesignGuidance({ slide, informationPlan, selection, teachers });
  if (guidanceResolution.status !== 'ready') throw new Error(guidanceResolution.reason);
  const guidedPlan = createCompositionPlanFromInformationPlan({
    slide,
    informationPlan,
    retrieval,
    fragments: SEED_PATTERN_FRAGMENTS,
    teacherGuidance: guidanceResolution.guidance,
  });
  const savedGuidedPlan = CompositionPlanSchema.parse(JSON.parse(await readFile(
    resolve(fixtureDir, 'reward-feature-spec-teacher-guided.composition-plan.json'),
    'utf8',
  )));
  if (JSON.stringify(guidedPlan) !== JSON.stringify(savedGuidedPlan)) {
    throw new Error('저장된 Teacher-guided CompositionPlan과 현재 production plan이 다릅니다.');
  }

  const initialArtifacts = [
    {
      name: 'baseline',
      pngPath: resolve(fixtureDir, 'reward-feature-spec-baseline.png'),
      treePath: resolve(fixtureDir, 'reward-feature-spec-baseline.render-tree.json'),
    },
    {
      name: 'teacher-guided',
      pngPath: resolve(fixtureDir, 'reward-feature-spec-teacher-guided.png'),
      treePath: resolve(fixtureDir, 'reward-feature-spec-teacher-guided.render-tree.json'),
    },
  ] as const;
  const provider = new OpenRouterAIProvider({
    apiKey: requiredEnvironment('OPENROUTER_API_KEY'),
    model: requiredEnvironment('CRITIC_MODEL_ID'),
    reasoningEffort: reasoningEffort(),
  });
  await mkdir(outputDir, { recursive: true });
  const criticRuns: Array<{ name: string; pngPath: string; tree: RenderTree; critic: VisualCriticRun }> = [];
  for (const artifact of initialArtifacts) {
    const tree = RenderTreeSchema.parse(JSON.parse(await readFile(artifact.treePath, 'utf8')));
    const hardGate = runHardGate({ slide, informationPlan, tree });
    if (!hardGate.passed) throw new Error(`${artifact.name} Critic 실행 전 Hard Gate 실패`);
    const critic = await runVisualCritic({
      provider,
      pngBytes: new Uint8Array(await readFile(artifact.pngPath)),
      artifactId: tree.renderTreeId,
      goal: '기존 보상 구조와 개선 보상 구조의 두 대응쌍을 같은 행에서 비교하고, 변화 방향과 핵심 메시지를 실제 제출용 게임 기획 장표 수준으로 전달한다. 제공된 네 가지 visual rubric만 평가하고 원문 변경은 제안하지 않는다.',
      slide,
      informationPlan,
      hardGate,
      rubricIds,
      requestIdSalt: `reward-feature-spec-${artifact.name}-four-rubric-v1`,
    });
    if (critic.guardrailIssues.length > 0) {
      throw new Error(`${artifact.name} Critic guardrail 실패: ${JSON.stringify(critic.guardrailIssues)}`);
    }
    criticRuns.push({ name: artifact.name, pngPath: artifact.pngPath, tree, critic });
    await writeFile(
      resolve(outputDir, `${artifact.name}.critic-report.json`),
      JSON.stringify({ sourcePngPath: artifact.pngPath, ...critic }, null, 2) + '\n',
    );
  }

  const guidedCritic = criticRuns.find((item) => item.name === 'teacher-guided')?.critic;
  if (guidedCritic === undefined) throw new Error('Teacher-guided Critic 결과가 없습니다.');
  const revision = revisionFrom(guidedCritic.report);
  const diff = parameterDiff(revision);
  const fonts = await loadSystemPretendard();
  const browser = await launchRenderBrowser();
  let revisedCritic: VisualCriticRun;
  let revisedPngPath: string;
  let revisedTree: RenderTree;
  let revisedHardGate: ReturnType<typeof runHardGate>;
  let revisedPng: Uint8Array;
  try {
    const measures = await measureTextBatch(
      browser,
      fonts,
      informationMeasureRequests({ slide, informationPlan, plan: guidedPlan }),
      { requireLoadedFonts: true },
    );
    const treeInput = {
      slide,
      informationPlan,
      plan: guidedPlan,
      measures,
      fonts,
      alignedFeaturePresentationRevision: revision,
    };
    revisedTree = buildInformationRenderTree(treeInput);
    if (JSON.stringify(revisedTree) !== JSON.stringify(buildInformationRenderTree(treeInput))) {
      throw new Error('Revision RenderTree가 결정적이지 않습니다.');
    }
    revisedHardGate = runHardGate({ slide, informationPlan, tree: revisedTree });
    if (!revisedHardGate.passed) {
      throw new Error(`Revision Hard Gate 실패: ${JSON.stringify(revisedHardGate.findings)}`);
    }
    const outputs = await exportRenderPreview({
      browser,
      tree: revisedTree,
      fonts,
      outputDir: fixtureDir,
      basename: revisedBasename,
    });
    revisedPngPath = outputs.pngPath;
    revisedPng = new Uint8Array(await readFile(revisedPngPath));
    const metadata = await sharp(revisedPng).metadata();
    if (metadata.width !== 1920 || metadata.height !== 1080 || (await stat(revisedPngPath)).size === 0) {
      throw new Error('Revision PNG 자동 검사에 실패했습니다.');
    }
    revisedCritic = await runVisualCritic({
      provider,
      pngBytes: revisedPng,
      artifactId: revisedTree.renderTreeId,
      goal: '기존 보상 구조와 개선 보상 구조의 두 대응쌍을 같은 행에서 비교하고, 변화 방향과 핵심 메시지를 실제 제출용 게임 기획 장표 수준으로 전달한다. 단일 targeted revision 이후에도 남아 있거나 새로 생긴 문제를 제공된 네 가지 visual rubric만으로 평가한다.',
      slide,
      informationPlan,
      hardGate: revisedHardGate,
      rubricIds,
      requestIdSalt: 'reward-feature-spec-targeted-revision-1-four-rubric-v1',
    });
    if (revisedCritic.guardrailIssues.length > 0) {
      throw new Error(`Revised Critic guardrail 실패: ${JSON.stringify(revisedCritic.guardrailIssues)}`);
    }
  } finally {
    await browser.close();
  }

  criticRuns.push({ name: 'teacher-guided-critic-revision-1', pngPath: revisedPngPath, tree: revisedTree, critic: revisedCritic });
  await writeFile(
    resolve(outputDir, 'teacher-guided-critic-revision-1.critic-report.json'),
    JSON.stringify({ sourcePngPath: revisedPngPath, ...revisedCritic }, null, 2) + '\n',
  );
  const initialTypes = new Set(guidedCritic.report.findings.map((finding) => finding.issueType));
  const revisedTypes = new Set(revisedCritic.report.findings.map((finding) => finding.issueType));
  const report = {
    schemaVersion: '0.1',
    artifactId: 'reward-feature-spec-critic-revision-1',
    revisionCount: 1,
    automaticAdditionalRevisionAllowed: false,
    readyPositiveFixture: false,
    promotionDecision: revisedCritic.report.submissionReadiness === 'ready'
      ? 'user-approval-required'
      : 'blocked-by-remaining-findings',
    rubricIds,
    compositionLock: {
      planId: guidedPlan.planId,
      layoutFamily: guidedPlan.layout.layoutFamily,
      readingPath: guidedPlan.layout.readingPath,
      pairRegionIds: guidedPlan.regions
        .filter((region) => /^comparison-pair-\d+-(?:before|change|after)$/u.test(region.regionId))
        .map((region) => region.regionId),
    },
    revision,
    parameterDiff: diff,
    hardGate: {
      passed: revisedHardGate.passed,
      programFindingCount: revisedHardGate.programFindings.length,
      sourceFidelityFindingCount: revisedHardGate.sourceFidelityFindings.length,
    },
    revisedPng: {
      path: revisedPngPath,
      bytes: revisedPng.byteLength,
      sha256: createHash('sha256').update(revisedPng).digest('hex'),
      renderTreeFingerprint: revisedTree.deterministicFingerprint,
    },
    criticRuns: criticRuns.map((item) => ({
      name: item.name,
      pngPath: item.pngPath,
      renderTreeId: item.tree.renderTreeId,
      report: item.critic.report,
      run: item.critic.run,
      inputTrace: item.critic.inputTrace,
      guardrailIssues: item.critic.guardrailIssues,
    })),
    criticDelta: {
      resolvedIssueTypes: [...initialTypes].filter((issueType) => !revisedTypes.has(issueType)),
      remainingIssueTypes: [...initialTypes].filter((issueType) => revisedTypes.has(issueType)),
      newIssueTypes: [...revisedTypes].filter((issueType) => !initialTypes.has(issueType)),
      beforeReadiness: guidedCritic.report.submissionReadiness,
      afterReadiness: revisedCritic.report.submissionReadiness,
    },
  };
  const markdown = [
    '# Reward Feature Spec Critic + Targeted Revision 1',
    '',
    `- Revision count: **1**`,
    `- Before readiness: **${guidedCritic.report.submissionReadiness}**`,
    `- After readiness: **${revisedCritic.report.submissionReadiness}**`,
    `- Ready promotion: **${report.promotionDecision}**`,
    `- Hard Gate: **${revisedHardGate.passed ? 'PASS' : 'FAIL'}**`,
    '',
    '## Revision parameters',
    '',
    ...diff.map((item) => `- ${item}`),
    '',
    ...criticRuns.flatMap((item) => [
      `## ${item.name}`,
      '',
      `- Readiness: **${item.critic.report.submissionReadiness}**`,
      ...(item.critic.report.findings.length === 0
        ? ['- Finding 없음']
        : item.critic.report.findings.map(findingLine)),
      '',
    ]),
    '## Cost',
    '',
    ...criticRuns.map((item) => `- ${item.name}: $${item.critic.run.estimatedCostUsd.toFixed(6)}`),
    '',
  ].join('\n');
  await writeFile(combinedReportPath, JSON.stringify(report, null, 2) + '\n');
  await writeFile(resolve(outputDir, 'reward-feature-spec-critic-revision-1.summary.md'), markdown);
  process.stdout.write(JSON.stringify({
    revisedPngPath,
    revision,
    parameterDiff: diff,
    hardGate: report.hardGate,
    criticDelta: report.criticDelta,
    findings: Object.fromEntries(criticRuns.map((item) => [item.name, item.critic.report.findings])),
    readiness: Object.fromEntries(criticRuns.map((item) => [item.name, item.critic.report.submissionReadiness])),
    costUsd: Object.fromEntries(criticRuns.map((item) => [item.name, item.critic.run.estimatedCostUsd])),
  }, null, 2) + '\n');
}

await main();
