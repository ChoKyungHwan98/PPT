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
import {
  buildInformationRenderTree,
  informationMeasureRequests,
  type OrganizationPresentationRevision,
} from '../information-layout.js';
import { measureTextBatch } from '../measure.js';
import { exportRenderPreview } from '../preview-export.js';

const fixtureDir = resolve('packages/renderer/fixtures/organization-structure');
const sourcePath = resolve('packages/source-ingestion/fixtures/combat-system-organization.source.json');
const baseTreePath = resolve(fixtureDir, 'organization-structure-teacher-guided-revision-1.render-tree.json');

const candidates = [
  {
    id: 'candidate-a',
    name: 'Cohesive Bridge',
    basename: 'organization-structure-candidate-a-cohesive-bridge',
    revision: 'candidate-a-cohesive-bridge',
    intent: '설명과 구조도 사이 간격을 줄이고 두 영역의 시작 높이를 맞춰 하나의 논지로 묶는다.',
  },
  {
    id: 'candidate-b',
    name: 'Hierarchy Focus',
    basename: 'organization-structure-candidate-b-hierarchy-focus',
    revision: 'candidate-b-hierarchy-focus',
    intent: '구조도 면적과 계층별 글자 위계를 조금 더 키워 책임·소속 구조의 존재감을 높인다.',
  },
] as const satisfies ReadonlyArray<{
  id: string;
  name: string;
  basename: string;
  revision: OrganizationPresentationRevision;
  intent: string;
}>;

function visibleTexts(tree: RenderTree): string[] {
  return tree.nodes
    .filter((node): node is Extract<RenderTree['nodes'][number], { kind: 'text' }> => node.kind === 'text' && node.visible)
    .map((node) => node.text);
}

async function main(): Promise<void> {
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
  const frozenBase = RenderTreeSchema.parse(JSON.parse(await readFile(baseTreePath, 'utf8')));
  if (frozenBase.compositionPlanId !== plan.planId) {
    throw new Error('동결된 revision-1과 현재 production CompositionPlan이 다릅니다.');
  }

  const fonts = await loadSystemPretendard();
  const browser = await launchRenderBrowser();
  const artifacts: Array<{
    id: string;
    name: string;
    intent: string;
    pngPath: string;
    pngBytes: Buffer;
    width: number;
    height: number;
    sha256: string;
    tree: RenderTree;
    hardGate: ReturnType<typeof runHardGate>;
  }> = [];
  await mkdir(fixtureDir, { recursive: true });
  try {
    for (const candidate of candidates) {
      const measures = await measureTextBatch(
        browser,
        fonts,
        informationMeasureRequests({
          slide,
          informationPlan,
          plan,
          organizationPresentationRevision: candidate.revision,
        }),
        { requireLoadedFonts: true },
      );
      const treeInput = {
        slide,
        informationPlan,
        plan,
        measures,
        fonts,
        organizationPresentationRevision: candidate.revision,
      };
      const tree = buildInformationRenderTree(treeInput);
      if (JSON.stringify(tree) !== JSON.stringify(buildInformationRenderTree(treeInput))) {
        throw new Error(`${candidate.id} RenderTree가 결정적이지 않습니다.`);
      }
      const hardGate = runHardGate({ slide, informationPlan, tree });
      if (!hardGate.passed) throw new Error(`${candidate.id} Hard Gate 실패: ${JSON.stringify(hardGate.findings)}`);
      if (tree.compositionPlanId !== frozenBase.compositionPlanId) {
        throw new Error(`${candidate.id}가 동결된 CompositionPlan을 변경했습니다.`);
      }
      const missingText = source.segments.map((segment) => segment.text)
        .filter((text) => !visibleTexts(tree).includes(text));
      if (missingText.length > 0) throw new Error(`${candidate.id} 원문 누락: ${JSON.stringify(missingText)}`);
      const actualRelations = tree.nodes.flatMap((node) => node.relationId === undefined ? [] : [node.relationId]).sort();
      const expectedRelations = slide.relations.map((relation) => relation.id).sort();
      if (JSON.stringify(actualRelations) !== JSON.stringify(expectedRelations)) {
        throw new Error(`${candidate.id} authored relation carrier가 원문 관계와 다릅니다.`);
      }
      await writeFile(resolve(fixtureDir, `${candidate.basename}.render-tree.json`), JSON.stringify(tree, null, 2) + '\n');
      const outputs = await exportRenderPreview({ browser, tree, fonts, outputDir: fixtureDir, basename: candidate.basename });
      const pngBytes = await readFile(outputs.pngPath);
      const metadata = await sharp(pngBytes).metadata();
      const bytes = (await stat(outputs.pngPath)).size;
      if (metadata.width !== 1920 || metadata.height !== 1080 || bytes === 0) {
        throw new Error(`${candidate.id} PNG 자동 검사에 실패했습니다.`);
      }
      artifacts.push({
        id: candidate.id,
        name: candidate.name,
        intent: candidate.intent,
        pngPath: outputs.pngPath,
        pngBytes,
        width: metadata.width,
        height: metadata.height,
        sha256: createHash('sha256').update(pngBytes).digest('hex'),
        tree,
        hardGate,
      });
    }
  } finally {
    await browser.close();
  }

  const comparisonPath = resolve(fixtureDir, 'organization-structure-candidates-comparison.png');
  await sharp({ create: { width: 3840, height: 1080, channels: 4, background: '#F5F3EE' } })
    .composite(artifacts.map((artifact, index) => ({ input: artifact.pngBytes, left: index * 1920, top: 0 })))
    .png()
    .toFile(comparisonPath);
  const proof = {
    schemaVersion: '0.1',
    artifactId: 'organization-structure-targeted-candidates',
    baseArtifact: 'packages/renderer/fixtures/organization-structure/organization-structure-teacher-guided-revision-1.png',
    candidateGenerationPasses: 1,
    automaticAdditionalRevisionAllowed: false,
    readyPositiveFixture: false,
    semanticInvariant: {
      slideId: slide.slideId,
      informationPlanId: informationPlan.informationPlanId,
      compositionPlanId: plan.planId,
      sourceSpanIds: slide.source.spans.map((span) => span.id),
      relationIds: slide.relations.map((relation) => relation.id),
      changed: false,
    },
    candidates: artifacts.map((artifact) => ({
      id: artifact.id,
      name: artifact.name,
      intent: artifact.intent,
      pngPath: `packages/renderer/fixtures/organization-structure/${artifact.pngPath.split(/[\\/]/u).at(-1)}`,
      width: artifact.width,
      height: artifact.height,
      bytes: artifact.pngBytes.byteLength,
      sha256: artifact.sha256,
      renderTreeFingerprint: artifact.tree.deterministicFingerprint,
      hardGate: {
        passed: artifact.hardGate.passed,
        programFindingCount: artifact.hardGate.programFindings.length,
        sourceFidelityFindingCount: artifact.hardGate.sourceFidelityFindings.length,
      },
    })),
    criticComparison: {
      prepared: true,
      executed: false,
      allowedFutureCallCount: 1,
      singleImageInput: 'packages/renderer/fixtures/organization-structure/organization-structure-candidates-comparison.png',
      candidateOrder: ['candidate-a', 'candidate-b'],
      rubric: [
        '설명 영역과 구조도의 응집력',
        '구조도의 존재감과 계층 위계',
        '공간 활용',
        '관계선 가독성',
        'portfolio submission readiness',
      ],
      note: '사용자 확인 후 한 번의 비교 Critic 호출에만 사용한다.',
    },
    comparisonPngPath: 'packages/renderer/fixtures/organization-structure/organization-structure-candidates-comparison.png',
    fontHashes: fonts.map((font) => ({ family: font.family, weight: font.weight, sha256: font.fileHash })),
  };
  await writeFile(
    resolve(fixtureDir, 'organization-structure-candidates.proof.json'),
    JSON.stringify(proof, null, 2) + '\n',
  );
  process.stdout.write(JSON.stringify(proof, null, 2) + '\n');
}

await main();
