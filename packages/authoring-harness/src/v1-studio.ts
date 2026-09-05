import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import {
  AuthoringRunTraceSchema,
  DesignEvaluationEventSchema,
  InformationPlanSchema,
  RenderTreeSchema,
  SEED_PATTERN_FRAGMENTS,
  SEED_REFERENCE_CORPUS,
  SlideIRSchema,
  StudioDesignInputSchema,
  StudioDesignOutputSchema,
  applyInformationDesignMode,
  contentHash,
  resolveInformationDesignMode,
  sha256Bytes,
  validateCompositionPlan,
  validateInformationPlan,
  validateInformationPlanForMode,
  type AIProvider,
  type AuthoringRunTrace,
  type DesignEvaluationEvent,
  type ReferenceRecord,
  type StudioDesignInput,
  type StudioDesignOutput,
} from '@game-presentation/contracts';
import { createCompositionPlanFromInformationPlan } from '@game-presentation/composition-engine';
import { validateEditablePptxArtifact, writeEditablePptxFromRenderTree } from '@game-presentation/pptx-exporter';
import {
  buildTeacherDesignGuidance,
  externalComparisonReferenceRecords,
  externalOrganizationReferenceRecords,
  loadExternalMasterReferenceSet,
  loadExternalMasterTeacherPageSet,
  retrieveReferencesForInformationPlan,
  selectCuratedTeachersForInformationPlan,
} from '@game-presentation/reference-engine';
import {
  interpretAuthoredFeatureComparison,
  interpretAuthoredHierarchy,
  parseAuthoredComparison,
  parseAuthoredHierarchy,
} from '@game-presentation/source-ingestion';
import {
  buildInformationRenderTree,
  exportRenderTree,
  informationMeasureRequests,
  launchRenderBrowser,
  loadSystemPretendard,
  measureTextBatch,
  runHardGate,
  runVisualCritic,
  validatePdfArtifact,
} from '@game-presentation/renderer/studio';
import {
  recordCriticRun,
  recordHarnessEvaluation,
  recordHarnessUserDecision,
  runAuthoringHarness,
  type AuthoringHarnessContext,
  type AuthoringHarnessPorts,
  type HarnessExportResult,
} from './harness.js';
import { AIUsageManager, withAIUsageManagement } from './ai-usage.js';

type ReferenceRuntime = {
  referenceSet: Awaited<ReturnType<typeof loadExternalMasterReferenceSet>>;
  teachers: Awaited<ReturnType<typeof loadExternalMasterTeacherPageSet>>['pages'];
  corpus: ReferenceRecord[];
  retrieval: ReturnType<typeof retrieveReferencesForInformationPlan>;
};

type TeacherRuntime = {
  selection: ReturnType<typeof selectCuratedTeachersForInformationPlan>;
  guidance: Extract<ReturnType<typeof buildTeacherDesignGuidance>, { status: 'ready' }>['guidance'];
};

type RenderRuntime = {
  browser: Awaited<ReturnType<typeof launchRenderBrowser>>;
  fonts: Awaited<ReturnType<typeof loadSystemPretendard>>;
};

export type StudioAuthoringOptions = {
  repositoryRoot: string;
  publicBaseUrl: string;
  outputRoot?: string;
  artifactId?: string;
};

export type StudioAuthoringArtifacts = {
  output: StudioDesignOutput;
  metadataPath: string;
  tracePath: string;
  outputDirectory: string;
  trace: AuthoringRunTrace;
};

function requireContext<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`${name} artifact가 없습니다.`);
  return value;
}

function buildPorts(input: StudioDesignInput, options: StudioAuthoringOptions): AuthoringHarnessPorts {
  return {
    ingest() {
      return input.authoredStructure === 'hierarchy'
        ? parseAuthoredHierarchy(input.authoredContent)
        : parseAuthoredComparison(input.authoredContent);
    },
    interpret(context) {
      return input.authoredStructure === 'hierarchy'
        ? (() => {
          const result = interpretAuthoredHierarchy(context.ingested as Parameters<typeof interpretAuthoredHierarchy>[0]);
          return { slide: result.slide, informationPlanCandidate: result.informationPlan };
        })()
        : (() => {
          const result = interpretAuthoredFeatureComparison(context.ingested as Parameters<typeof interpretAuthoredFeatureComparison>[0]);
          return { slide: result.slide, informationPlanCandidate: result.informationPlan };
        })();
    },
    validateSemantic(context) {
      SlideIRSchema.parse(requireContext(context.slide, 'SlideIR'));
    },
    resolveMode() {
      return resolveInformationDesignMode(input.mode);
    },
    designInformation(context) {
      const slide = requireContext(context.slide, 'SlideIR');
      const candidate = InformationPlanSchema.parse(requireContext(context.informationPlanCandidate, 'InformationPlan'));
      const modeResolution = requireContext(context.modeResolution, 'Mode Resolution');
      const plan = applyInformationDesignMode({ slide, informationPlan: candidate, resolution: modeResolution });
      const issues = [
        ...validateInformationPlan(plan, slide),
        ...validateInformationPlanForMode({ slide, informationPlan: plan, resolution: modeResolution }),
      ];
      if (issues.length > 0) throw new Error(`Information Plan 계약 실패: ${JSON.stringify(issues)}`);
      return plan;
    },
    async retrieveReferences(context) {
      const slide = requireContext(context.slide, 'SlideIR');
      const informationPlan = requireContext(context.informationPlan, 'InformationPlan');
      const referenceDir = resolve(options.repositoryRoot, 'packages/reference-engine/references/external-master-2025-v1');
      const referenceSet = await loadExternalMasterReferenceSet(referenceDir);
      const teachers = (await loadExternalMasterTeacherPageSet(referenceDir)).pages;
      const externalRecords = input.authoredStructure === 'hierarchy'
        ? externalOrganizationReferenceRecords(referenceSet, referenceDir)
        : externalComparisonReferenceRecords(referenceSet, referenceDir);
      const corpus = [...SEED_REFERENCE_CORPUS, ...externalRecords];
      const retrieval = retrieveReferencesForInformationPlan({
        slide,
        informationPlan,
        corpus,
        audience: 'game-design-reviewer',
        outputProfile: 'pdf-presentation',
        limit: 4,
      });
      return { referenceSet, teachers, corpus, retrieval } satisfies ReferenceRuntime;
    },
    selectTeachers(context) {
      const slide = requireContext(context.slide, 'SlideIR');
      const informationPlan = requireContext(context.informationPlan, 'InformationPlan');
      const references = context.retrieval as ReferenceRuntime;
      const selection = selectCuratedTeachersForInformationPlan({ slide, informationPlan, teachers: references.teachers, limit: 3 });
      const guidanceResolution = buildTeacherDesignGuidance({ slide, informationPlan, selection, teachers: references.teachers });
      if (guidanceResolution.status !== 'ready') throw new Error(`장표 설계 기준을 선택하지 못했습니다: ${guidanceResolution.reason}`);
      return {
        selection,
        selectedTeacherIds: selection.selected.map((item) => item.referenceId),
        guidance: guidanceResolution.guidance,
      };
    },
    compose(context) {
      const slide = requireContext(context.slide, 'SlideIR');
      const informationPlan = requireContext(context.informationPlan, 'InformationPlan');
      const references = context.retrieval as ReferenceRuntime;
      const teacher = { selection: context.teacherSelection, guidance: context.teacherGuidance } as TeacherRuntime;
      const plan = createCompositionPlanFromInformationPlan({
        slide,
        informationPlan,
        retrieval: references.retrieval,
        fragments: SEED_PATTERN_FRAGMENTS,
        teacherGuidance: teacher.guidance,
      });
      const issues = validateCompositionPlan(plan, slide, informationPlan, SEED_PATTERN_FRAGMENTS, references.corpus);
      if (issues.length > 0) throw new Error(`장표 배치 계약 실패: ${JSON.stringify(issues)}`);
      return plan;
    },
    async render(context) {
      const slide = requireContext(context.slide, 'SlideIR');
      const informationPlan = requireContext(context.informationPlan, 'InformationPlan');
      const plan = requireContext(context.compositionPlan, 'CompositionPlan');
      const fonts = await loadSystemPretendard();
      const browser = await launchRenderBrowser();
      try {
        const measures = await measureTextBatch(
          browser,
          fonts,
          informationMeasureRequests({ slide, informationPlan, plan }),
          { requireLoadedFonts: true },
        );
        const tree = buildInformationRenderTree({ slide, informationPlan, plan, measures, fonts });
        return { tree, runtime: { browser, fonts } satisfies RenderRuntime };
      } catch (error) {
        await browser.close();
        throw error;
      }
    },
    runHardGate(context) {
      const result = runHardGate({
        slide: requireContext(context.slide, 'SlideIR'),
        informationPlan: requireContext(context.informationPlan, 'InformationPlan'),
        tree: requireContext(context.renderTree, 'RenderTree'),
      });
      return {
        passed: result.passed,
        programFindingCount: result.programFindings.length,
        sourceFidelityFindingCount: result.sourceFidelityFindings.length,
        value: result,
      };
    },
    async export(context): Promise<HarnessExportResult> {
      const slide = requireContext(context.slide, 'SlideIR');
      const informationPlan = requireContext(context.informationPlan, 'InformationPlan');
      const tree = requireContext(context.renderTree, 'RenderTree');
      const hardGate = requireContext(context.hardGate, 'Hard Gate');
      const runtime = context.renderRuntime as RenderRuntime;
      const artifactId = options.artifactId ?? tree.renderTreeId;
      const outputRoot = options.outputRoot ?? resolve(options.repositoryRoot, 'output/studio-jobs');
      const outputDirectory = resolve(outputRoot, artifactId);
      await mkdir(outputDirectory, { recursive: true });
      const outputs = await exportRenderTree({
        browser: runtime.browser,
        tree,
        fonts: runtime.fonts,
        outputDir: outputDirectory,
        basename: artifactId,
      });
      const pptxPath = resolve(outputDirectory, `${artifactId}.editable.pptx`);
      await writeEditablePptxFromRenderTree(tree, pptxPath);
      const requiredText = tree.nodes.flatMap((node) => node.kind === 'text' && node.visible ? [node.text] : []);
      const pdfValidation = await validatePdfArtifact({ pdfPath: outputs.pdfPath, requiredText, expectedPageCount: 1, expectedAspectRatio: 16 / 9 });
      const pptxValidation = await validateEditablePptxArtifact({
        pptxPath,
        requiredText,
        requiredRelationIds: slide.relations.map((relation) => relation.id),
      });
      if (!pdfValidation.passed || !pptxValidation.passed) throw new Error('최종 출력 호환성 검사에 실패했습니다.');
      const publicFile = (path: string) => `${options.publicBaseUrl}/api/designer/jobs/${encodeURIComponent(artifactId)}/${encodeURIComponent(basename(path))}`;
      const files = [
        { kind: 'png' as const, path: outputs.pngPath, url: publicFile(outputs.pngPath), editable: false },
        { kind: 'html' as const, path: outputs.htmlPath, url: publicFile(outputs.htmlPath), editable: false },
        { kind: 'pdf' as const, path: outputs.pdfPath, url: publicFile(outputs.pdfPath), editable: false },
        { kind: 'pptx' as const, path: pptxPath, url: publicFile(pptxPath), editable: true },
      ];
      const tracedFiles = await Promise.all(files.map(async (file) => ({
        ...file,
        hash: sha256Bytes(new Uint8Array(await readFile(file.path))),
      })));
      const pngHash = tracedFiles.find((file) => file.kind === 'png')!.hash;
      const teacher = { selection: context.teacherSelection, guidance: context.teacherGuidance } as TeacherRuntime;
      const output = StudioDesignOutputSchema.parse({
        schemaVersion: '0.1',
        artifactId,
        projectId: input.projectId,
        documentId: input.documentId,
        previewPngUrl: publicFile(outputs.pngPath),
        exports: tracedFiles.map(({ kind, url, editable }) => ({ kind, url, editable })),
        validation: {
          hardGatePassed: hardGate.passed,
          programFindingCount: hardGate.programFindingCount,
          sourceFidelityFindingCount: hardGate.sourceFidelityFindingCount,
        },
        critic: null,
        readiness: 'not-reviewed',
        trace: {
          semanticShape: teacher.guidance.structureLock.semanticShape,
          selectedTeacherIds: context.selectedTeacherIds,
          appliedGuidanceIds: Object.values(teacher.guidance.guidance).flat().map((item, index) => `${item.sourceReferenceId}:${item.sourceField}:${index}`),
          renderTreeFingerprint: tree.deterministicFingerprint,
          authoredContentHash: sha256Bytes(new TextEncoder().encode(input.authoredContent)),
          pngSha256: pngHash,
        },
      });
      return {
        output,
        pngPath: outputs.pngPath,
        pngHash,
        exports: tracedFiles,
        metadata: {
          input,
          output,
          slide,
          informationPlan,
          plan: context.compositionPlan,
          tree,
          hardGate: hardGate.value,
          pdfValidation,
          pptxValidation,
          imageSha256: pngHash,
          contentHash: contentHash(input.authoredContent),
        },
      };
    },
    async dispose(context) {
      const runtime = context.renderRuntime as RenderRuntime | undefined;
      await runtime?.browser.close();
    },
  };
}

export async function runV1StudioAuthoring(
  raw: StudioDesignInput,
  options: StudioAuthoringOptions,
): Promise<StudioAuthoringArtifacts> {
  const input = StudioDesignInputSchema.parse(raw);
  const artifactId = options.artifactId ?? `slide-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const outputRoot = options.outputRoot ?? resolve(options.repositoryRoot, 'output/studio-jobs');
  const outputDirectory = resolve(outputRoot, artifactId);
  const tracePath = resolve(outputDirectory, 'authoring-run.json');
  const metadataPath = resolve(outputDirectory, 'job.json');
  await mkdir(outputDirectory, { recursive: true });
  const result = await runAuthoringHarness(input, {
    runId: `authoring-${artifactId}`,
    ports: buildPorts(input, { ...options, outputRoot, artifactId }),
    onTrace: async (trace) => {
      await writeFile(tracePath, JSON.stringify(trace, null, 2) + '\n');
    },
  });
  const metadata = requireContext(result.context.exported, 'Export').metadata;
  await writeFile(metadataPath, JSON.stringify({ ...metadata, authoringTrace: result.trace }, null, 2) + '\n');
  return { output: result.output, metadataPath, tracePath, outputDirectory, trace: result.trace };
}

export async function runV1StudioVisualCritic(input: {
  metadataPath: string;
  provider: AIProvider;
  cacheRoot?: string;
}): Promise<{ output: StudioDesignOutput; run: Awaited<ReturnType<typeof runVisualCritic>>['run']; trace: AuthoringRunTrace }> {
  const metadata = JSON.parse(await readFile(input.metadataPath, 'utf8')) as Record<string, unknown>;
  const output = StudioDesignOutputSchema.parse(metadata.output);
  const trace = AuthoringRunTraceSchema.parse(metadata.authoringTrace);
  if (!output.validation.hardGatePassed) throw new Error('Hard Gate FAIL 결과는 AI 검토로 보낼 수 없습니다.');
  const slide = SlideIRSchema.parse(metadata.slide);
  const informationPlan = InformationPlanSchema.parse(metadata.informationPlan);
  const tree = RenderTreeSchema.parse(metadata.tree);
  const pngPath = trace.renderedPng?.path;
  if (pngPath === undefined) throw new Error('Critic이 볼 PNG artifact가 없습니다.');
  const manager = new AIUsageManager({
    runId: trace.runId,
    projectId: trace.projectId,
    documentId: trace.documentId,
    artifactId: output.artifactId,
  }, input.cacheRoot ?? resolve(dirname(input.metadataPath), '..', '..', 'ai-cache'));
  const managedProvider = withAIUsageManagement({
    manager,
    provider: input.provider,
    role: 'visual-critic',
    promptVersion: 'visual-critic-v1',
    schemaVersion: 'visual-critique-report-0.1',
    canonicalArtifactHashes: [trace.sourceHash, trace.slideIR?.hash ?? '', trace.informationPlan?.hash ?? '', trace.renderTree?.hash ?? '', trace.renderedPng?.hash ?? ''],
    generationParameters: { maxOutputTokens: 2200 },
  });
  const critic = await runVisualCritic({
    provider: managedProvider,
    pngBytes: new Uint8Array(await readFile(pngPath)),
    artifactId: output.artifactId,
    goal: informationPlan.message.text,
    slide,
    informationPlan,
    hardGate: metadata.hardGate as Parameters<typeof runVisualCritic>[0]['hardGate'],
  });
  if (critic.guardrailIssues.length > 0) throw new Error(`AI 검토 안전 규칙 실패: ${critic.guardrailIssues.join(', ')}`);
  const updatedOutput = StudioDesignOutputSchema.parse({
    ...output,
    critic: critic.report,
    readiness: critic.report.submissionReadiness,
  });
  const updatedTrace = recordCriticRun(trace, {
    requestId: critic.run.requestId,
    provider: critic.run.provider,
    model: critic.run.model,
  });
  await writeFile(input.metadataPath, JSON.stringify({
    ...metadata,
    output: updatedOutput,
    authoringTrace: updatedTrace,
    criticRun: critic.run,
    aiActivity: manager.activity(),
    aiUsage: manager.summary(),
    criticInputTrace: critic.inputTrace,
  }, null, 2) + '\n');
  await writeFile(resolve(dirname(input.metadataPath), 'authoring-run.json'), JSON.stringify(updatedTrace, null, 2) + '\n');
  return { output: updatedOutput, run: critic.run, trace: updatedTrace };
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export async function recordV1StudioUserDecision(input: {
  metadataPath: string;
  event: DesignEvaluationEvent;
}): Promise<{ output: StudioDesignOutput; event: DesignEvaluationEvent; trace: AuthoringRunTrace; evaluationPath: string }> {
  const metadata = JSON.parse(await readFile(input.metadataPath, 'utf8')) as Record<string, unknown>;
  const output = StudioDesignOutputSchema.parse(metadata.output);
  const trace = AuthoringRunTraceSchema.parse(metadata.authoringTrace);
  const event = DesignEvaluationEventSchema.parse(input.event);
  if (event.artifactId !== output.artifactId) throw new Error('사용자 판단이 다른 artifact를 가리킵니다.');
  if (event.png.sha256 !== output.trace.pngSha256) throw new Error('사용자 판단의 PNG hash가 현재 artifact와 다릅니다.');
  if (event.authoredContentHash !== output.trace.authoredContentHash) throw new Error('사용자 판단의 원문 hash가 현재 run과 다릅니다.');
  if (event.semanticShape !== output.trace.semanticShape) throw new Error('사용자 판단의 semantic shape가 현재 run과 다릅니다.');
  if (!sameList(event.selectedTeacherIds, output.trace.selectedTeacherIds)) throw new Error('사용자 판단의 Teacher trace가 현재 run과 다릅니다.');
  if (!sameList(event.appliedGuidanceIds, output.trace.appliedGuidanceIds)) throw new Error('사용자 판단의 Guidance trace가 현재 run과 다릅니다.');

  const decisionTrace = recordHarnessUserDecision(trace, event.userDecision);
  const evaluationHash = contentHash(event);
  const updatedTrace = recordHarnessEvaluation(decisionTrace, { eventId: event.eventId, hash: evaluationHash });
  const evaluationPath = resolve(dirname(input.metadataPath), 'evaluation.json');
  await writeFile(evaluationPath, JSON.stringify(event, null, 2) + '\n');
  await writeFile(input.metadataPath, JSON.stringify({
    ...metadata,
    authoringTrace: updatedTrace,
    evaluationEvent: event,
  }, null, 2) + '\n');
  await writeFile(resolve(dirname(input.metadataPath), 'authoring-run.json'), JSON.stringify(updatedTrace, null, 2) + '\n');
  return { output, event, trace: updatedTrace, evaluationPath };
}
