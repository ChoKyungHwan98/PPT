import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import {
  RenderTreeSchema,
  SEED_PATTERN_FRAGMENTS,
  SEED_REFERENCE_CORPUS,
  validateCompositionPlan,
  type RenderTree,
} from '@game-presentation/contracts';
import { createCompositionPlanFromInformationPlan } from '@game-presentation/composition-engine';
import {
  buildTeacherDesignGuidance,
  externalOrganizationReferenceRecords,
  loadExternalMasterReferenceSet,
  loadExternalMasterTeacherPageSet,
  retrieveReferencesForInformationPlan,
  selectCuratedTeachersForInformationPlan,
} from '@game-presentation/reference-engine';
import {
  interpretAuthoredHierarchy,
  type AuthoredHierarchy,
} from '../../../source-ingestion/src/authored-hierarchy.js';
import { launchRenderBrowser } from '../browser.js';
import { loadSystemPretendard } from '../font.js';
import { runHardGate } from '../hard-gate.js';
import { buildInformationRenderTree, informationMeasureRequests } from '../information-layout.js';
import { measureTextBatch } from '../measure.js';
import { exportRenderPreview } from '../preview-export.js';

const fixtureDir = resolve('packages/renderer/fixtures/organization-structure');
const sourcePath = resolve('packages/source-ingestion/fixtures/combat-system-organization.source.json');
const criticPath = resolve(
  'output/v1-visual-critic/organization-structure/organization-structure-teacher-guided.critic-report.json',
);
const basename = 'organization-structure-teacher-guided-revision-1';

type SavedCritic = {
  criticCallCount: number;
  critic: {
    report: {
      submissionReadiness: string;
      findings: Array<{
        findingId: string;
        issueType: string;
        severity: string;
        problem: string;
        reason: string;
        revisionDirection: string;
      }>;
    };
    run: {
      provider: string;
      model: string;
      estimatedCostUsd: number;
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    };
    inputTrace: unknown;
    guardrailIssues: string[];
  };
};

function visibleText(tree: RenderTree): string[] {
  return tree.nodes
    .filter((node): node is Extract<RenderTree['nodes'][number], { kind: 'text' }> => node.kind === 'text' && node.visible)
    .map((node) => node.text);
}

function geometry(tree: RenderTree, nodeId: string) {
  const node = tree.nodes.find((candidate) => candidate.nodeId === nodeId);
  if (node === undefined) throw new Error(`RenderTree node가 없습니다: ${nodeId}`);
  return node.box;
}

async function main(): Promise<void> {
  const critic = JSON.parse(await readFile(criticPath, 'utf8')) as SavedCritic;
  if (critic.criticCallCount !== 1) throw new Error('Organization Critic은 정확히 한 번 실행되어야 합니다.');
  if (critic.critic.guardrailIssues.length > 0) throw new Error('Critic guardrail issue가 남아 있습니다.');
  const actionable = critic.critic.report.findings.filter((finding) => finding.severity !== 'info');
  const revisedFindingIds = actionable
    .filter((finding) => finding.issueType === 'space-use')
    .map((finding) => finding.findingId);
  if (revisedFindingIds.length !== 1) {
    throw new Error('이번 단일 revision이 해결할 명확한 space-use finding이 정확히 하나여야 합니다.');
  }
  const intentionallyNotRevised = critic.critic.report.findings
    .filter((finding) => !revisedFindingIds.includes(finding.findingId))
    .map((finding) => ({
      findingId: finding.findingId,
      reason: finding.severity === 'info'
        ? '정보성 제안이며, 노드 컨테이너 추가는 새 시각 요소를 늘려 현재 평면 조직도 문법을 바꾸므로 수정하지 않음'
        : '현재 허용된 presentation-level parameter로 해결할 명확한 문제가 아님',
    }));

  const source = JSON.parse(await readFile(sourcePath, 'utf8')) as AuthoredHierarchy;
  const { slide, informationPlan } = interpretAuthoredHierarchy(source);
  const referenceDir = resolve('packages/reference-engine/references/external-master-2025-v1');
  const referenceSet = await loadExternalMasterReferenceSet(referenceDir);
  const teachers = (await loadExternalMasterTeacherPageSet(referenceDir)).pages;
  const corpus = [...SEED_REFERENCE_CORPUS, ...externalOrganizationReferenceRecords(referenceSet, referenceDir)];
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
  const plan = createCompositionPlanFromInformationPlan({
    slide,
    informationPlan,
    retrieval,
    fragments: SEED_PATTERN_FRAGMENTS,
    teacherGuidance: guidanceResolution.guidance,
  });
  const compositionIssues = validateCompositionPlan(plan, slide, informationPlan, SEED_PATTERN_FRAGMENTS, corpus);
  if (compositionIssues.length > 0) throw new Error(`Composition contract 실패: ${JSON.stringify(compositionIssues)}`);

  const beforeTree = RenderTreeSchema.parse(JSON.parse(await readFile(
    resolve(fixtureDir, 'organization-structure-teacher-guided.render-tree.json'),
    'utf8',
  )));
  if (beforeTree.compositionPlanId !== plan.planId) {
    throw new Error('기존 Teacher-guided artifact와 현재 production CompositionPlan이 다릅니다.');
  }
  const fonts = await loadSystemPretendard();
  const browser = await launchRenderBrowser();
  let tree: RenderTree;
  let hardGate: ReturnType<typeof runHardGate>;
  let pngPath: string;
  let png: Buffer;
  try {
    const measures = await measureTextBatch(
      browser,
      fonts,
      informationMeasureRequests({ slide, informationPlan, plan }),
      { requireLoadedFonts: true },
    );
    const treeInput = {
      slide,
      informationPlan,
      plan,
      measures,
      fonts,
      organizationPresentationRevision: 'critic-revision-1' as const,
    };
    tree = buildInformationRenderTree(treeInput);
    const second = buildInformationRenderTree(treeInput);
    if (JSON.stringify(tree) !== JSON.stringify(second)) throw new Error('Revision RenderTree가 결정적이지 않습니다.');
    hardGate = runHardGate({ slide, informationPlan, tree });
    if (!hardGate.passed) throw new Error(`Revision Hard Gate 실패: ${JSON.stringify(hardGate.findings)}`);
    await mkdir(fixtureDir, { recursive: true });
    await writeFile(resolve(fixtureDir, `${basename}.render-tree.json`), JSON.stringify(tree, null, 2) + '\n');
    const outputs = await exportRenderPreview({ browser, tree, fonts, outputDir: fixtureDir, basename });
    pngPath = outputs.pngPath;
    png = await readFile(pngPath);
  } finally {
    await browser.close();
  }
  const metadata = await sharp(png).metadata();
  const bytes = (await stat(pngPath)).size;
  if (metadata.width !== 1920 || metadata.height !== 1080 || bytes === 0) {
    throw new Error('Revision PNG 자동 검사에 실패했습니다.');
  }
  const missingText = source.segments.map((segment) => segment.text)
    .filter((text) => !visibleText(tree).includes(text));
  if (missingText.length > 0) throw new Error(`Revision visible content 누락: ${JSON.stringify(missingText)}`);
  const relationIds = tree.nodes.flatMap((node) => node.relationId === undefined ? [] : [node.relationId]);
  if (JSON.stringify([...relationIds].sort()) !== JSON.stringify(slide.relations.map((relation) => relation.id).sort())) {
    throw new Error('Revision relation carrier가 authored relation과 일치하지 않습니다.');
  }
  const geometryDiff = [
    'region-organization-body',
    'region-organization-explanation',
    'region-organization-hierarchy-map',
    'text-block-message-0',
    'text-block-root-0',
  ].map((nodeId) => ({
    nodeId,
    before: geometry(beforeTree, nodeId),
    after: geometry(tree, nodeId),
  }));
  const proof = {
    schemaVersion: '0.1',
    artifactId: 'organization-structure-single-critic-revision-cycle',
    revisionCount: 1,
    criticCallCount: 1,
    secondCriticCallPerformed: false,
    readyPositiveFixture: false,
    sourcePath: 'packages/source-ingestion/fixtures/combat-system-organization.source.json',
    comparison: {
      baseline: 'packages/renderer/fixtures/organization-structure/organization-structure-baseline.png',
      teacherGuided: 'packages/renderer/fixtures/organization-structure/organization-structure-teacher-guided.png',
      revision1: `packages/renderer/fixtures/organization-structure/${basename}.png`,
    },
    critic: critic.critic,
    revisionDecision: {
      revisedFindingIds,
      intentionallyNotRevised,
      parameters: {
        bodyTop: { before: '23.5%', after: '20.5%' },
        bodyHeight: { before: '68%', after: '71%' },
        explanationBaselineWithinInnerRegion: { before: '28%', after: '10%' },
      },
      invariant: 'CompositionPlan, source text, hierarchy 관계, 부모/자식 관계는 변경하지 않음',
    },
    geometryDiff,
    hardGate: {
      passed: hardGate.passed,
      programFindingCount: hardGate.programFindings.length,
      sourceFidelityFindingCount: hardGate.sourceFidelityFindings.length,
      findings: hardGate.findings,
    },
    output: {
      pngPath: `packages/renderer/fixtures/organization-structure/${basename}.png`,
      width: metadata.width,
      height: metadata.height,
      bytes,
      sha256: createHash('sha256').update(png).digest('hex'),
      renderTreeFingerprint: tree.deterministicFingerprint,
    },
    fontHashes: fonts.map((font) => ({ family: font.family, weight: font.weight, sha256: font.fileHash })),
  };
  await writeFile(
    resolve(fixtureDir, 'organization-structure-critic-revision-1.proof.json'),
    JSON.stringify(proof, null, 2) + '\n',
  );
  await writeFile(
    resolve(fixtureDir, 'organization-structure-critic-revision-1.summary.md'),
    [
      '# Organization Teacher-guided Critic + Revision 1',
      '',
      `- Critic readiness: **${critic.critic.report.submissionReadiness}**`,
      '- Critic calls: **1**',
      '- Revision count: **1**',
      '- Second Critic: **실행하지 않음**',
      '- Ready promotion: **실행하지 않음**',
      `- Revised finding: ${revisedFindingIds.join(', ')}`,
      `- Intentionally unchanged: ${intentionallyNotRevised.map((item) => item.findingId).join(', ') || '없음'}`,
      `- Hard Gate: **${hardGate.passed ? 'PASS' : 'FAIL'}**`,
      `- Cost: $${critic.critic.run.estimatedCostUsd.toFixed(6)}`,
      '',
    ].join('\n'),
  );
  process.stdout.write(JSON.stringify({
    revisedPngPath: pngPath,
    revisedFindingIds,
    intentionallyNotRevised,
    geometryDiff,
    hardGate: proof.hardGate,
    output: proof.output,
    criticCostUsd: critic.critic.run.estimatedCostUsd,
  }, null, 2) + '\n');
}

await main();
