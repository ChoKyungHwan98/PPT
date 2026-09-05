import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import {
  SEED_PATTERN_FRAGMENTS, SEED_REFERENCE_CORPUS, StudioDesignInputSchema, StudioDesignOutputSchema,
  contentHash, validateCompositionPlan, type StudioDesignInput, type StudioDesignOutput,
} from '@game-presentation/contracts';
import { createCompositionPlanFromInformationPlan } from '@game-presentation/composition-engine';
import { validateEditablePptxArtifact, writeEditablePptxFromRenderTree } from '@game-presentation/pptx-exporter';
import {
  buildTeacherDesignGuidance, externalComparisonReferenceRecords, externalOrganizationReferenceRecords,
  loadExternalMasterReferenceSet, loadExternalMasterTeacherPageSet, retrieveReferencesForInformationPlan,
  selectCuratedTeachersForInformationPlan,
} from '@game-presentation/reference-engine';
import { interpretAuthoredFeatureComparison, interpretAuthoredHierarchy } from '@game-presentation/source-ingestion';
import {
  buildInformationRenderTree, exportRenderTree, informationMeasureRequests, launchRenderBrowser,
  loadSystemPretendard, measureTextBatch, runHardGate, validatePdfArtifact,
} from '@game-presentation/renderer/studio';
import { parseAuthoredComparison, parseAuthoredHierarchy } from './authored-content.js';

export type StudioJobArtifacts = { output: StudioDesignOutput; metadataPath: string; outputDirectory: string };

export async function runStudioDesignJob(raw: StudioDesignInput, options: { repositoryRoot: string; publicBaseUrl: string }): Promise<StudioJobArtifacts> {
  const input = StudioDesignInputSchema.parse(raw);
  const interpreted = input.authoredStructure === 'hierarchy'
    ? interpretAuthoredHierarchy(parseAuthoredHierarchy(input.authoredContent))
    : interpretAuthoredFeatureComparison(parseAuthoredComparison(input.authoredContent));
  const { slide, informationPlan } = interpreted;
  const referenceDir = resolve(options.repositoryRoot, 'packages/reference-engine/references/external-master-2025-v1');
  const referenceSet = await loadExternalMasterReferenceSet(referenceDir);
  const teachers = (await loadExternalMasterTeacherPageSet(referenceDir)).pages;
  const externalRecords = input.authoredStructure === 'hierarchy'
    ? externalOrganizationReferenceRecords(referenceSet, referenceDir)
    : externalComparisonReferenceRecords(referenceSet, referenceDir);
  const corpus = [...SEED_REFERENCE_CORPUS, ...externalRecords];
  const retrieval = retrieveReferencesForInformationPlan({ slide, informationPlan, corpus, audience: 'game-design-reviewer', outputProfile: 'pdf-presentation', limit: 4 });
  const selection = selectCuratedTeachersForInformationPlan({ slide, informationPlan, teachers, limit: 3 });
  const guidanceResolution = buildTeacherDesignGuidance({ slide, informationPlan, selection, teachers });
  if (guidanceResolution.status !== 'ready') throw new Error(`장표 설계 기준을 선택하지 못했습니다: ${guidanceResolution.reason}`);
  const guidance = guidanceResolution.guidance;
  const plan = createCompositionPlanFromInformationPlan({ slide, informationPlan, retrieval, fragments: SEED_PATTERN_FRAGMENTS, teacherGuidance: guidance });
  const contractIssues = validateCompositionPlan(plan, slide, informationPlan, SEED_PATTERN_FRAGMENTS, corpus);
  if (contractIssues.length > 0) throw new Error(`장표 배치 계약 실패: ${JSON.stringify(contractIssues)}`);
  const fonts = await loadSystemPretendard();
  const browser = await launchRenderBrowser();
  const artifactId = `slide-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const outputDirectory = resolve(options.repositoryRoot, 'output/studio-jobs', artifactId);
  await mkdir(outputDirectory, { recursive: true });
  try {
    const measures = await measureTextBatch(browser, fonts, informationMeasureRequests({ slide, informationPlan, plan }), { requireLoadedFonts: true });
    const tree = buildInformationRenderTree({ slide, informationPlan, plan, measures, fonts });
    const hardGate = runHardGate({ slide, informationPlan, tree });
    if (!hardGate.passed) throw new Error(`Hard Gate 실패: ${JSON.stringify(hardGate.findings)}`);
    const outputs = await exportRenderTree({ browser, tree, fonts, outputDir: outputDirectory, basename: artifactId });
    const pptxPath = resolve(outputDirectory, `${artifactId}.editable.pptx`);
    await writeEditablePptxFromRenderTree(tree, pptxPath);
    const requiredText = tree.nodes.flatMap((node) => node.kind === 'text' && node.visible ? [node.text] : []);
    const pdfValidation = await validatePdfArtifact({ pdfPath: outputs.pdfPath, requiredText, expectedPageCount: 1, expectedAspectRatio: 16 / 9 });
    const pptxValidation = await validateEditablePptxArtifact({ pptxPath, requiredText, requiredRelationIds: slide.relations.map((relation) => relation.id) });
    if (!pdfValidation.passed || !pptxValidation.passed) throw new Error('최종 출력 호환성 검사에 실패했습니다.');
    const publicFile = (path: string) => `${options.publicBaseUrl}/api/designer/jobs/${encodeURIComponent(artifactId)}/${encodeURIComponent(basename(path))}`;
    const pngSha256 = createHash('sha256').update(await readFile(outputs.pngPath)).digest('hex');
    const output = StudioDesignOutputSchema.parse({
      schemaVersion: '0.1', artifactId, projectId: input.projectId, documentId: input.documentId,
      previewPngUrl: publicFile(outputs.pngPath),
      exports: [
        { kind: 'png', url: publicFile(outputs.pngPath), editable: false },
        { kind: 'html', url: publicFile(outputs.htmlPath), editable: false },
        { kind: 'pdf', url: publicFile(outputs.pdfPath), editable: false },
        { kind: 'pptx', url: publicFile(pptxPath), editable: true },
      ],
      validation: { hardGatePassed: true, programFindingCount: 0, sourceFidelityFindingCount: 0 },
      critic: null, readiness: 'not-reviewed',
      trace: {
        semanticShape: guidance.structureLock.semanticShape,
        selectedTeacherIds: selection.selected.map((item) => item.referenceId),
        appliedGuidanceIds: Object.values(guidance.guidance).flat().map((item, index) => `${item.sourceReferenceId}:${item.sourceField}:${index}`),
        renderTreeFingerprint: tree.deterministicFingerprint,
        authoredContentHash: createHash('sha256').update(input.authoredContent, 'utf8').digest('hex'),
        pngSha256,
      },
    });
    const metadataPath = resolve(outputDirectory, 'job.json');
    await writeFile(metadataPath, JSON.stringify({ input, output, slide, informationPlan, tree, hardGate, pdfValidation, pptxValidation, imageSha256: pngSha256, contentHash: contentHash(input.authoredContent) }, null, 2) + '\n');
    return { output, metadataPath, outputDirectory };
  } finally { await browser.close(); }
}
