import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
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
  PreferenceEvidenceEventSchema,
  type PreferenceEvidenceEvent,
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
import { PreferenceEvidenceStore, buildDesignProfile, promotePreferencePatterns } from '@game-presentation/preference-learning';
import { candidateComparisonFromArtifacts, generateValidatedCandidateArtifacts, type ValidatedCandidateArtifact } from './candidate-generation.js';

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
      const plan = requireContext(context.compositionPlan, 'CompositionPlan');
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
      const primaryCandidateId = `candidate-${contentHash({ plan: plan.planId, tree: tree.deterministicFingerprint }).slice(0, 12)}`;
      const comparisonId = `comparison-${contentHash({ artifactId, source: slide.source.contentHash }).slice(0, 12)}`;
      const output = StudioDesignOutputSchema.parse({
        schemaVersion: '0.1',
        artifactId,
        projectId: input.projectId,
        documentId: input.documentId,
        previewPngUrl: publicFile(outputs.pngPath),
        comparisonId,
        candidates: [{
          candidateId: primaryCandidateId,
          label: '구조 A',
          compositionPlanHash: contentHash(plan),
          renderTreeFingerprint: tree.deterministicFingerprint,
          renderTreeHash: contentHash(tree),
          previewPngUrl: publicFile(outputs.pngPath),
          pngSha256: pngHash,
          provenance: { patternFragmentIds: plan.patternFragmentIds, referenceIds: plan.referenceIds, layoutFamily: plan.layout.layoutFamily, readingPath: plan.layout.readingPath },
          validation: { hardGatePassed: true, programFindingCount: 0, sourceFidelityFindingCount: 0 },
        }],
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
          domain: slide.domain.topic,
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
  const exported = requireContext(result.context.exported, 'Export');
  const metadata = exported.metadata;
  const slide = requireContext(result.context.slide, 'SlideIR');
  const informationPlan = requireContext(result.context.informationPlan, 'InformationPlan');
  const primaryPlan = requireContext(result.context.compositionPlan, 'CompositionPlan');
  const primaryTree = requireContext(result.context.renderTree, 'RenderTree');
  const references = result.context.retrieval as ReferenceRuntime;
  const primary: ValidatedCandidateArtifact = {
    candidateId: result.output.candidates[0]!.candidateId,
    provenance: result.output.candidates[0]!.provenance,
    compositionPlan: primaryPlan,
    renderTree: primaryTree,
    pngPath: exported.pngPath,
    pngHash: exported.pngHash,
    validation: { hardGatePassed: true, programFindingCount: 0, sourceFidelityFindingCount: 0 },
  };
  const generated = await generateValidatedCandidateArtifacts({
    slide,
    informationPlan,
    retrieval: references.retrieval,
    outputRoot: resolve(outputDirectory, 'candidate-renders'),
    fragments: SEED_PATTERN_FRAGMENTS,
    corpus: references.corpus,
    teacherGuidance: result.context.teacherGuidance as TeacherRuntime['guidance'],
    maximumCandidates: 3,
  });
  const candidates = [primary, ...generated.accepted].filter((candidate, index, all) => all.findIndex((other) => other.provenance.layoutFamily === candidate.provenance.layoutFamily && other.provenance.readingPath === candidate.provenance.readingPath) === index).slice(0, 3);
  const publicFile = (filename: string) => `${options.publicBaseUrl}/api/designer/jobs/${encodeURIComponent(artifactId)}/${encodeURIComponent(filename)}`;
  const studioCandidates = await Promise.all(candidates.map(async (candidate, index) => {
    const filename = index === 0 ? basename(exported.pngPath) : `${candidate.candidateId}.png`;
    if (index > 0) await copyFile(candidate.pngPath, resolve(outputDirectory, filename));
    return {
      candidateId: candidate.candidateId,
      label: `구조 ${String.fromCharCode(65 + index)}`,
      compositionPlanHash: contentHash(candidate.compositionPlan),
      renderTreeFingerprint: candidate.renderTree.deterministicFingerprint,
      renderTreeHash: contentHash(candidate.renderTree),
      previewPngUrl: publicFile(filename),
      pngSha256: candidate.pngHash,
      provenance: candidate.provenance,
      validation: candidate.validation,
    };
  }));
  const comparison = candidateComparisonFromArtifacts({
    slide,
    context: {
      intent: slide.intent.communicationGoal.text,
      semanticShape: result.output.trace.semanticShape,
      relationshipShape: slide.relations.map((relation) => relation.type),
      primaryArtifact: informationPlan.primaryArtifactBlockId,
      audience: 'game-design-reviewer',
      outputProfile: input.mode === 'document' ? 'pdf-document' : 'pdf-presentation',
    },
    artifacts: candidates,
    createdAt: new Date().toISOString(),
  });
  const output = StudioDesignOutputSchema.parse({ ...result.output, comparisonId: comparison.comparisonId, candidates: studioCandidates, previewPngUrl: studioCandidates[0]!.previewPngUrl, trace: { ...result.output.trace, pngSha256: studioCandidates[0]!.pngSha256 } });
  await writeFile(metadataPath, JSON.stringify({ ...metadata, output, candidates, comparison, rejectedCandidates: generated.rejected, authoringTrace: result.trace }, null, 2) + '\n');
  return { output, metadataPath, tracePath, outputDirectory, trace: result.trace };
}

export async function runV1StudioVisualCritic(input: {
  metadataPath: string;
  provider: AIProvider;
  cacheRoot?: string;
}): Promise<{
  output: StudioDesignOutput;
  run: Awaited<ReturnType<typeof runVisualCritic>>['run'];
  trace: AuthoringRunTrace;
  aiActivity: ReturnType<AIUsageManager['activity']>;
  aiUsage: ReturnType<AIUsageManager['summary']>;
}> {
  const metadata = JSON.parse(await readFile(input.metadataPath, 'utf8')) as Record<string, unknown>;
  const storedOutput = StudioDesignOutputSchema.parse(metadata.output);
  const trace = AuthoringRunTraceSchema.parse(metadata.authoringTrace);
  if (!storedOutput.validation.hardGatePassed) throw new Error('Hard Gate FAIL 결과는 AI 검토로 보낼 수 없습니다.');
  const slide = SlideIRSchema.parse(metadata.slide);
  const informationPlan = InformationPlanSchema.parse(metadata.informationPlan);
  const selectedCandidateId = typeof metadata.selectedCandidateId === 'string' ? metadata.selectedCandidateId : storedOutput.candidates[0]!.candidateId;
  const selectedOutput = storedOutput.candidates.find((candidate) => candidate.candidateId === selectedCandidateId);
  const candidateArtifacts = Array.isArray(metadata.candidates) ? metadata.candidates as Array<Record<string, unknown>> : [];
  const selectedArtifact = candidateArtifacts.find((candidate) => candidate.candidateId === selectedCandidateId);
  const tree = selectedArtifact === undefined ? RenderTreeSchema.parse(metadata.tree) : RenderTreeSchema.parse(selectedArtifact.renderTree);
  const pngPath = selectedArtifact === undefined ? trace.renderedPng?.path : String(selectedArtifact.pngPath);
  if (pngPath === undefined) throw new Error('Critic이 볼 PNG artifact가 없습니다.');
  if (selectedOutput === undefined || !selectedOutput.validation.hardGatePassed) throw new Error('선택 candidate가 없거나 Hard Gate를 통과하지 못했습니다.');
  const output = StudioDesignOutputSchema.parse({ ...storedOutput, previewPngUrl: selectedOutput.previewPngUrl, trace: { ...storedOutput.trace, renderTreeFingerprint: selectedOutput.renderTreeFingerprint, pngSha256: selectedOutput.pngSha256 } });
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
    canonicalArtifactHashes: [trace.sourceHash, trace.slideIR?.hash ?? '', trace.informationPlan?.hash ?? '', contentHash(tree), output.trace.pngSha256],
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
  const aiActivity = manager.activity();
  const aiUsage = manager.summary();
  await writeFile(input.metadataPath, JSON.stringify({
    ...metadata,
    output: updatedOutput,
    authoringTrace: updatedTrace,
    criticRun: critic.run,
    aiActivity,
    aiUsage,
    criticInputTrace: critic.inputTrace,
  }, null, 2) + '\n');
  await writeFile(resolve(dirname(input.metadataPath), 'authoring-run.json'), JSON.stringify(updatedTrace, null, 2) + '\n');
  return { output: updatedOutput, run: critic.run, trace: updatedTrace, aiActivity, aiUsage };
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

export async function recordV1CandidatePreference(input: {
  metadataPath: string;
  event: PreferenceEvidenceEvent;
  preferenceRoot?: string;
}) {
  const metadata = JSON.parse(await readFile(input.metadataPath, 'utf8')) as Record<string, unknown>;
  const output = StudioDesignOutputSchema.parse(metadata.output);
  const trace = AuthoringRunTraceSchema.parse(metadata.authoringTrace);
  const event = PreferenceEvidenceEventSchema.parse(input.event);
  if (event.artifactId !== output.artifactId || event.projectId !== trace.projectId || event.mode !== trace.mode || event.semanticShape !== output.trace.semanticShape) {
    throw new Error('Preference evidence가 현재 Harness artifact와 일치하지 않습니다.');
  }
  if (event.comparisonId !== output.comparisonId) throw new Error('Preference evidence가 현재 candidate comparison과 일치하지 않습니다.');
  if (!sameList(event.candidateIds, output.candidates.map((candidate) => candidate.candidateId))) throw new Error('Preference evidence의 candidate 목록이 현재 comparison과 일치하지 않습니다.');
  const selectedIndex = event.decision === 'reject-all' ? -1 : ['choose-A', 'choose-B', 'choose-C'].indexOf(event.decision);
  const selected = selectedIndex < 0 ? null : output.candidates[selectedIndex] ?? null;
  if ((selected?.candidateId ?? null) !== event.selectedCandidateId || (selected?.pngSha256 ?? null) !== event.selectedCandidateHash) throw new Error('선택 candidate ID/hash가 실제 candidate와 일치하지 않습니다.');
  if ((selected?.provenance.patternFragmentIds[0] ?? null) !== event.chosenPatternId) throw new Error('선택 candidate의 pattern trace가 일치하지 않습니다.');
  if ((selected === null) !== (event.designSignature === null)) throw new Error('선택 candidate signature가 누락되었습니다.');
  if (selected !== null && (event.designSignature?.candidateId !== selected.candidateId || event.designSignature.topologyFamily !== selected.provenance.layoutFamily || event.designSignature.readingPath !== selected.provenance.readingPath)) throw new Error('선택 candidate signature가 실제 candidate와 일치하지 않습니다.');
  const slide = SlideIRSchema.parse(metadata.slide);
  if (event.domain !== slide.domain.topic) throw new Error('Preference evidence의 domain이 현재 source와 일치하지 않습니다.');
  let selectedOutput = output;
  let selectedTree: ReturnType<typeof RenderTreeSchema.parse> | undefined;
  let selectedPlan: unknown;
  if (selected !== null && selected.candidateId !== output.candidates[0]!.candidateId) {
    const artifacts = Array.isArray(metadata.candidates) ? metadata.candidates as Array<Record<string, unknown>> : [];
    const artifact = artifacts.find((candidate) => candidate.candidateId === selected.candidateId);
    if (artifact === undefined) throw new Error('선택 candidate의 render artifact가 없습니다.');
    selectedTree = RenderTreeSchema.parse(artifact.renderTree); selectedPlan = artifact.compositionPlan;
    const browser = await launchRenderBrowser(); const fonts = await loadSystemPretendard(); const directory = dirname(input.metadataPath);
    try {
      const rendered = await exportRenderTree({ browser, tree: selectedTree, fonts, outputDir: directory, basename: output.artifactId });
      const pptxPath = resolve(directory, `${output.artifactId}.editable.pptx`); await writeEditablePptxFromRenderTree(selectedTree, pptxPath);
      const requiredText = selectedTree.nodes.flatMap((node) => node.kind === 'text' && node.visible ? [node.text] : []);
      const pdf = await validatePdfArtifact({ pdfPath: rendered.pdfPath, requiredText, expectedPageCount: 1, expectedAspectRatio: 16 / 9 });
      const pptx = await validateEditablePptxArtifact({ pptxPath, requiredText, requiredRelationIds: slide.relations.map((relation) => relation.id) });
      if (!pdf.passed || !pptx.passed) throw new Error('선택 candidate의 최종 출력 호환성 검사에 실패했습니다.');
    } finally { await browser.close(); }
    selectedOutput = StudioDesignOutputSchema.parse({ ...output, previewPngUrl: selected.previewPngUrl, trace: { ...output.trace, renderTreeFingerprint: selected.renderTreeFingerprint, pngSha256: selected.pngSha256 } });
  }
  const store = new PreferenceEvidenceStore(input.preferenceRoot ?? resolve(dirname(input.metadataPath), '..', '..', 'preference-memory'));
  await store.append(event);
  const events = await store.load();
  const patterns = promotePreferencePatterns(events);
  const profile = buildDesignProfile(patterns, event.occurredAt);
  await writeFile(input.metadataPath, JSON.stringify({ ...metadata, output: selectedOutput, ...(selectedTree === undefined ? {} : { tree: selectedTree, plan: selectedPlan }), selectedCandidateId: event.selectedCandidateId, preferenceEvidence: event, preferencePatterns: patterns, designProfile: profile }, null, 2) + '\n');
  return { output: selectedOutput, event, patterns, profile };
}
