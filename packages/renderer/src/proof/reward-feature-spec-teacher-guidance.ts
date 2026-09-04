import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import {
  SEED_PATTERN_FRAGMENTS,
  SEED_REFERENCE_CORPUS,
  validateCompositionPlan,
  type CompositionPlan,
  type RenderTree,
} from '@game-presentation/contracts';
import { createCompositionPlanFromInformationPlan } from '@game-presentation/composition-engine';
import {
  buildTeacherDesignGuidance,
  externalComparisonReferenceRecords,
  loadExternalMasterReferenceSet,
  loadExternalMasterTeacherPageSet,
  retrieveReferencesForInformationPlan,
  selectCuratedTeachersForInformationPlan,
  type TeacherDesignGuidance,
} from '@game-presentation/reference-engine';
import {
  interpretAuthoredFeatureComparison,
  type AuthoredFeatureComparison,
} from '../../../source-ingestion/src/authored-feature-comparison.js';
import { launchRenderBrowser } from '../browser.js';
import { loadSystemPretendard } from '../font.js';
import { runHardGate } from '../hard-gate.js';
import { buildInformationRenderTree, informationMeasureRequests } from '../information-layout.js';
import { measureTextBatch } from '../measure.js';
import { exportRenderPreview } from '../preview-export.js';

async function main() {
  const sourcePath = resolve('packages/source-ingestion/fixtures/reward-feature-spec.source.json');
  const outputDir = resolve('packages/renderer/fixtures/reward-feature-spec');
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
  const guidance = guidanceResolution.guidance;
  if (guidance.structureLock.semanticShape !== 'aligned-before-after-spec') {
    throw new Error('보상 비교 fixture에 Before / After Teacher가 선택되지 않았습니다.');
  }

  const compose = (teacherGuidance?: TeacherDesignGuidance): CompositionPlan =>
    createCompositionPlanFromInformationPlan({
      slide,
      informationPlan,
      retrieval,
      fragments: SEED_PATTERN_FRAGMENTS,
      ...(teacherGuidance === undefined ? {} : { teacherGuidance }),
    });
  const variants = [
    { name: 'baseline', basename: 'reward-feature-spec-baseline', plan: compose() },
    { name: 'teacher-guided', basename: 'reward-feature-spec-teacher-guided', plan: compose(guidance) },
  ] as const;
  const fonts = await loadSystemPretendard();
  const browser = await launchRenderBrowser();
  await mkdir(outputDir, { recursive: true });
  try {
    const proofVariants = [];
    for (const variant of variants) {
      const contractIssues = validateCompositionPlan(
        variant.plan,
        slide,
        informationPlan,
        SEED_PATTERN_FRAGMENTS,
        corpus,
      );
      if (contractIssues.length > 0) throw new Error(JSON.stringify(contractIssues));
      const measures = await measureTextBatch(
        browser,
        fonts,
        informationMeasureRequests({ slide, informationPlan, plan: variant.plan }),
        { requireLoadedFonts: true },
      );
      const treeInput = { slide, informationPlan, plan: variant.plan, measures, fonts };
      const tree = buildInformationRenderTree(treeInput);
      const second = buildInformationRenderTree(treeInput);
      if (JSON.stringify(tree) !== JSON.stringify(second)) throw new Error(`${variant.name} RenderTree가 결정적이지 않습니다.`);
      const hardGate = runHardGate({ slide, informationPlan, tree });
      if (!hardGate.passed) throw new Error(`${variant.name} PNG blocked by Hard Gate: ${JSON.stringify(hardGate)}`);

      await writeFile(
        resolve(outputDir, `${variant.basename}.composition-plan.json`),
        JSON.stringify(variant.plan, null, 2) + '\n',
      );
      const outputs = await exportRenderPreview({ browser, tree, fonts, outputDir, basename: variant.basename });
      const png = await readFile(outputs.pngPath);
      const metadata = await sharp(png).metadata();
      const bytes = (await stat(outputs.pngPath)).size;
      if (metadata.width !== 1920 || metadata.height !== 1080 || bytes === 0) {
        throw new Error(`${variant.name} PNG output verification failed.`);
      }
      const visibleText = tree.nodes
        .filter((node): node is Extract<RenderTree['nodes'][number], { kind: 'text' }> =>
          node.kind === 'text' && node.visible)
        .map((node) => node.text);
      const requiredText = source.segments.map((segment) => segment.text);
      const missingText = requiredText.filter((text) => !visibleText.includes(text));
      const requiredTokens = ['1개', '2개', '주간 보상 고정', '주간 보상 선택'];
      const missingTokens = requiredTokens.filter((token) => !visibleText.some((text) => text.includes(token)));
      if (missingText.length > 0 || missingTokens.length > 0) {
        throw new Error(`${variant.name} visible content verification failed: ${JSON.stringify({ missingText, missingTokens })}`);
      }
      proofVariants.push({
        name: variant.name,
        pngPath: `packages/renderer/fixtures/reward-feature-spec/${variant.basename}.png`,
        width: metadata.width,
        height: metadata.height,
        bytes,
        sha256: createHash('sha256').update(png).digest('hex'),
        compositionPlanId: variant.plan.planId,
        renderTreeFingerprint: tree.deterministicFingerprint,
        regions: variant.plan.regions.map((region) => ({
          regionId: region.regionId,
          parentRegionId: region.parentRegionId ?? null,
          flow: region.flow,
          order: region.order,
        })),
        hardGate,
        missingText,
        missingTokens,
      });
    }
    const baselineText = proofVariants[0];
    const guidedText = proofVariants[1];
    if (!baselineText || !guidedText) throw new Error('두 비교 PNG proof를 만들지 못했습니다.');
    const proof = {
      artifactId: 'reward-feature-spec-teacher-guidance-comparison',
      sourcePath: 'packages/source-ingestion/fixtures/reward-feature-spec.source.json',
      criticCalled: false,
      automaticRevision: false,
      readyPositiveFixture: false,
      teacherGuidance: {
        primaryTeacher: guidance.primaryTeacher,
        structureLock: guidance.structureLock,
      },
      sourceParity: {
        sameSlideId: true,
        sameInformationPlanId: true,
        sourceSpanCount: slide.source.spans.length,
        relationCount: slide.relations.length,
      },
      variants: proofVariants,
      fontHashes: fonts.map((font) => ({ family: font.family, weight: font.weight, sha256: font.fileHash })),
      renderer: 'RenderTree → SVG/HTML → Chromium screenshot',
    };
    await writeFile(resolve(outputDir, 'reward-feature-spec-comparison.proof.json'), JSON.stringify(proof, null, 2) + '\n');
    process.stdout.write(JSON.stringify(proof, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}

await main();
