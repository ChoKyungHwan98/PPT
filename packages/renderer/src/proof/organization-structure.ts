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

async function main() {
  const sourcePath = resolve('packages/source-ingestion/fixtures/combat-system-organization.source.json');
  const outputDir = resolve('packages/renderer/fixtures/organization-structure');
  const source = JSON.parse(await readFile(sourcePath, 'utf8')) as AuthoredHierarchy;
  const { slide, informationPlan } = interpretAuthoredHierarchy(source);
  const referenceDir = resolve('packages/reference-engine/references/external-master-2025-v1');
  const referenceSet = await loadExternalMasterReferenceSet(referenceDir);
  const teachers = (await loadExternalMasterTeacherPageSet(referenceDir)).pages;
  const corpus = [
    ...SEED_REFERENCE_CORPUS,
    ...externalOrganizationReferenceRecords(referenceSet, referenceDir),
  ];
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
  if (guidance.structureLock.semanticShape !== 'hierarchy') {
    throw new Error('Organization fixture에 hierarchy Teacher가 선택되지 않았습니다.');
  }
  const compose = (teacherGuidance?: typeof guidance): CompositionPlan => createCompositionPlanFromInformationPlan({
    slide,
    informationPlan,
    retrieval,
    fragments: SEED_PATTERN_FRAGMENTS,
    ...(teacherGuidance === undefined ? {} : { teacherGuidance }),
  });
  const variants = [
    { name: 'baseline', basename: 'organization-structure-baseline', plan: compose() },
    { name: 'teacher-guided', basename: 'organization-structure-teacher-guided', plan: compose(guidance) },
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
      const hardGate = runHardGate({ slide, informationPlan, tree });
      if (!hardGate.passed) throw new Error(`${variant.name} PNG blocked by Hard Gate: ${JSON.stringify(hardGate)}`);
      await writeFile(resolve(outputDir, `${variant.basename}.render-tree.json`), JSON.stringify(tree, null, 2) + '\n');
      const outputs = await exportRenderPreview({ browser, tree, fonts, outputDir, basename: variant.basename });
      const png = await readFile(outputs.pngPath);
      const metadata = await sharp(png).metadata();
      const bytes = (await stat(outputs.pngPath)).size;
      if (metadata.width !== 1920 || metadata.height !== 1080 || bytes === 0) {
        throw new Error(`${variant.name} PNG output verification failed.`);
      }
      const visibleText = tree.nodes
        .filter((node): node is Extract<RenderTree['nodes'][number], { kind: 'text' }> => node.kind === 'text' && node.visible)
        .map((node) => node.text);
      const missingText = source.segments.map((segment) => segment.text)
        .filter((text) => !visibleText.includes(text));
      if (missingText.length > 0) throw new Error(`${variant.name} visible content missing: ${JSON.stringify(missingText)}`);
      proofVariants.push({
        name: variant.name,
        pngPath: `packages/renderer/fixtures/organization-structure/${variant.basename}.png`,
        width: metadata.width,
        height: metadata.height,
        bytes,
        sha256: createHash('sha256').update(png).digest('hex'),
        compositionPlanId: variant.plan.planId,
        renderTreeFingerprint: tree.deterministicFingerprint,
        hardGate,
      });
    }
    await writeFile(resolve(outputDir, 'organization-structure-comparison.proof.json'), JSON.stringify({
      artifactId: 'organization-structure-teacher-guidance-comparison',
      sourcePath: 'packages/source-ingestion/fixtures/combat-system-organization.source.json',
      criticCalled: false,
      readyPositiveFixture: false,
      teacherGuidance: { primaryTeacher: guidance.primaryTeacher, structureLock: guidance.structureLock },
      sourceParity: { sourceSpanCount: slide.source.spans.length, relationCount: slide.relations.length },
      variants: proofVariants,
      fontHashes: fonts.map((font) => ({ family: font.family, weight: font.weight, sha256: font.fileHash })),
      renderer: 'RenderTree → SVG/HTML → Chromium screenshot',
    }, null, 2) + '\n');
    process.stdout.write(JSON.stringify(proofVariants, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}

await main();
