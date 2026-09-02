import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { SEED_PATTERN_FRAGMENTS, SEED_REFERENCE_CORPUS } from '@game-presentation/contracts';
import { createCompositionPlanFromInformationPlan } from '@game-presentation/composition-engine';
import { retrieveReferencesForInformationPlan } from '@game-presentation/reference-engine';
import { createMec01InformationPlan, interpretMec01Source } from '../../../source-ingestion/src/mec-01-semantic.js';
import { launchRenderBrowser } from '../browser.js';
import { loadSystemPretendard } from '../font.js';
import { runHardGate } from '../hard-gate.js';
import { buildInformationRenderTree, informationMeasureRequests } from '../information-layout.js';
import { measureTextBatch } from '../measure.js';
import { OpenRouterAIProvider } from '../openrouter-provider.js';
import { exportRenderPreview } from '../preview-export.js';
import { runVisualCritic } from '../visual-critic.js';

const rawText = '회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%';
const fixtureDir = resolve('packages', 'renderer', 'fixtures');
const outputDir = resolve('output', 'v1-visual-critic');
const beforePngPath = resolve(fixtureDir, 'mec-01-polish-final-balanced-runway-final.png');
const previousCriticPath = resolve(outputDir, 'mec-01-final-balanced-runway.critic-report.json');
const basename = 'mec-01-revision-1-balanced-runway';

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

function issuePersists(
  findings: Array<{ issueType: string; target: { ids: string[] } }>,
  issueType: string,
  targetId: string,
): boolean {
  return findings.some((finding) =>
    finding.issueType === issueType
    && (targetId === 'page' || finding.target.ids.includes(targetId)),
  );
}

async function main(): Promise<void> {
  await loadLocalEnvironment();
  if (requiredEnvironment('CRITIC_PROVIDER') !== 'openrouter') {
    throw new Error('현재 revision proof는 OpenRouter provider만 지원합니다.');
  }
  const slide = interpretMec01Source({ rawText, createdAt: '2026-08-29T00:00:00.000Z' });
  const informationPlan = createMec01InformationPlan(slide);
  const retrieval = retrieveReferencesForInformationPlan({
    slide,
    informationPlan,
    corpus: SEED_REFERENCE_CORPUS,
    audience: 'game-design-reviewer',
    outputProfile: 'pdf-presentation',
    avoidSignatures: ['card-dashboard'],
    limit: 4,
  });
  const plan = createCompositionPlanFromInformationPlan({
    slide,
    informationPlan,
    retrieval,
    fragments: SEED_PATTERN_FRAGMENTS.filter(
      (fragment) => fragment.fragmentId === 'pattern-accumulation-threshold-consequence',
    ),
  });
  const fonts = await loadSystemPretendard();
  const browser = await launchRenderBrowser();
  try {
    const measures = await measureTextBatch(
      browser,
      fonts,
      informationMeasureRequests({ slide, informationPlan, plan }),
    );
    const tree = buildInformationRenderTree({
      slide,
      informationPlan,
      plan,
      measures,
      fonts,
      accumulationLayoutPolish: 'balanced-runway-revision-1',
    });
    const hardGate = runHardGate({ slide, informationPlan, tree });
    if (!hardGate.passed) {
      throw new Error(`Partial Revision 1 Hard Gate 실패: ${JSON.stringify(hardGate.findings)}`);
    }
    const outputs = await exportRenderPreview({ browser, tree, fonts, outputDir: fixtureDir, basename });
    const pngBytes = new Uint8Array(await readFile(outputs.pngPath));
    const pngStat = await stat(outputs.pngPath);
    const metadata = await sharp(pngBytes).metadata();
    if (metadata.width !== 1920 || metadata.height !== 1080 || pngStat.size <= 0) {
      throw new Error('Partial Revision 1 PNG 자동 검사에 실패했습니다.');
    }

    const provider = new OpenRouterAIProvider({
      apiKey: requiredEnvironment('OPENROUTER_API_KEY'),
      model: requiredEnvironment('CRITIC_MODEL_ID'),
      reasoningEffort: 'medium',
    });
    const critic = await runVisualCritic({
      provider,
      pngBytes,
      artifactId: tree.renderTreeId,
      goal: 'Partial Revision 1 재검사다. 축적/준비 3단계가 BREAK 상태 경계를 거쳐 받는 피해 +50% 결과로 이어진다. 이전 finding f-space-use-1의 과도한 상하 여백/얇은 footprint와 f-relation-clarity-2의 BREAK→결과 연결 단차/괄호 정렬이 해결됐는지 확인하고, 새 error가 생겼는지만 진단한다. 새로운 디자인 탐색이나 원문 변경을 제안하지 않는다.',
      slide,
      informationPlan,
      hardGate,
      requestIdSalt: 'partial-revision-1-only',
    });

    const previous = JSON.parse(await readFile(previousCriticPath, 'utf8')) as {
      critic?: { report?: { findings?: Array<{ findingId: string }> } };
    };
    const previousFindingIds = previous.critic?.report?.findings?.map((finding) => finding.findingId) ?? [];
    if (!previousFindingIds.includes('f-space-use-1') || !previousFindingIds.includes('f-relation-clarity-2')) {
      throw new Error('승인된 이전 Critic finding을 확인할 수 없습니다.');
    }
    const spaceUseResolved = !issuePersists(critic.report.findings, 'space-use', 'page');
    const relationClarityResolved = !issuePersists(critic.report.findings, 'relation-clarity', 'damage-modifier');
    const newErrors = critic.report.findings.filter((finding) => finding.severity === 'error');
    const newFindings = critic.report.findings.filter(
      (finding) => finding.issueType !== 'space-use' && finding.issueType !== 'relation-clarity',
    );
    const geometryChanges = [
      'contentSide 0.040 → 0.032',
      'contentTop 0.135 → 0.110',
      'contentHeight 0.730 → 0.780',
      'regionGap 0.013 → 0.012',
      'accumulationBracketOffset 44 → 52',
      'thresholdBoundaryRatio 0.40 → 0.46',
      'consequenceYOffset 6 → 0',
      'consequenceAxisAbove/Below 88/100 → 104/116',
      'BREAK→consequence carrier: 단일 수평 path',
      'consequence anchor: 정확한 수평 path',
    ];
    const report = {
      schemaVersion: '0.1',
      revisionId: 'mec-01-partial-revision-1',
      revisionCount: 1,
      beforePngPath,
      revisedPngPath: outputs.pngPath,
      renderTreePath: outputs.renderTreePath,
      compositionPlanId: plan.planId,
      renderTreeFingerprint: tree.deterministicFingerprint,
      geometryChanges,
      hardGate: {
        passed: hardGate.passed,
        programFindingCount: hardGate.programFindings.length,
        sourceFidelityFindingCount: hardGate.sourceFidelityFindings.length,
      },
      png: {
        width: metadata.width,
        height: metadata.height,
        fileSizeBytes: pngStat.size,
        sha256: createHash('sha256').update(pngBytes).digest('hex'),
      },
      critic: {
        report: critic.report,
        run: critic.run,
        inputTrace: critic.inputTrace,
        guardrailIssues: critic.guardrailIssues,
        resolution: {
          'f-space-use-1': spaceUseResolved ? 'resolved' : 'unresolved',
          'f-relation-clarity-2': relationClarityResolved ? 'resolved' : 'unresolved',
          newErrorCount: newErrors.length,
          newFindings,
        },
      },
      automaticRevisionPerformed: false,
    };
    await mkdir(outputDir, { recursive: true });
    const jsonPath = resolve(outputDir, `${basename}.revision-report.json`);
    const markdownPath = resolve(outputDir, `${basename}.revision-summary.md`);
    await writeFile(jsonPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    await writeFile(markdownPath, [
      '# MEC-01 Partial Revision 1',
      '',
      `- Readiness: **${critic.report.submissionReadiness}**`,
      `- f-space-use-1: **${spaceUseResolved ? 'resolved' : 'unresolved'}**`,
      `- f-relation-clarity-2: **${relationClarityResolved ? 'resolved' : 'unresolved'}**`,
      `- New errors: **${newErrors.length}**`,
      `- New findings: **${newFindings.length}**`,
      `- Hard Gate: **${hardGate.passed ? 'PASS' : 'FAIL'}**`,
      '',
      '## Geometry changes',
      '',
      ...geometryChanges.map((change) => `- ${change}`),
      '',
      '## Critic findings',
      '',
      ...(critic.report.findings.length === 0
        ? ['- 없음']
        : critic.report.findings.map((finding) =>
            `- **${finding.severity}/${finding.issueType}** ${finding.problem}`)),
      '',
      `- Estimated cost: $${critic.run.estimatedCostUsd.toFixed(6)}`,
      '- Automatic revision: 실행하지 않음',
      '',
    ].join('\n'), 'utf8');
    process.stdout.write(JSON.stringify({
      outputs,
      beforePngPath,
      jsonPath,
      markdownPath,
      geometryChanges,
      hardGate: report.hardGate,
      png: report.png,
      readiness: critic.report.submissionReadiness,
      resolution: report.critic.resolution,
      guardrailIssues: critic.guardrailIssues,
      run: critic.run,
    }, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}

await main();
