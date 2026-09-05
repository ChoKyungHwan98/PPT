import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  SEED_PATTERN_FRAGMENTS,
  SEED_REFERENCE_CORPUS,
  contentHash,
  sha256Bytes,
  validateCompositionPlan,
  type CandidateEvidence,
  type InformationPlan,
  type PatternFragment,
  type PreferenceContext,
  type ReferenceRecord,
  type ReferenceRetrievalBrief,
  type SlideIR,
} from '@game-presentation/contracts';
import { buildCandidateComparison, createCompositionPlanCandidatesFromInformationPlan } from '@game-presentation/composition-engine';
import type { ReferenceSearchResult, TeacherDesignGuidance } from '@game-presentation/reference-engine';
import {
  buildInformationRenderTree,
  exportRenderTree,
  informationMeasureRequests,
  launchRenderBrowser,
  loadSystemPretendard,
  measureTextBatch,
  runHardGate,
} from '@game-presentation/renderer/studio';

export type ValidatedCandidateArtifact = {
  candidateId: string;
  provenance: { patternFragmentIds: string[]; referenceIds: string[]; layoutFamily: string; readingPath: string };
  compositionPlan: ReturnType<typeof createCompositionPlanCandidatesFromInformationPlan>[number];
  renderTree: ReturnType<typeof buildInformationRenderTree>;
  pngPath: string;
  pngHash: string;
  validation: { hardGatePassed: true; programFindingCount: 0; sourceFidelityFindingCount: 0 };
};

export async function generateValidatedCandidateArtifacts(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  retrieval: { brief: ReferenceRetrievalBrief; results: ReferenceSearchResult[] };
  outputRoot: string;
  fragments?: PatternFragment[];
  corpus?: ReferenceRecord[];
  teacherGuidance?: TeacherDesignGuidance;
  maximumCandidates?: number;
}) {
  const fragments = input.fragments ?? SEED_PATTERN_FRAGMENTS;
  const corpus = input.corpus ?? SEED_REFERENCE_CORPUS;
  const plans = createCompositionPlanCandidatesFromInformationPlan({
    slide: input.slide,
    informationPlan: input.informationPlan,
    retrieval: input.retrieval,
    fragments,
    ...(input.teacherGuidance === undefined ? {} : { teacherGuidance: input.teacherGuidance }),
    maximumCandidates: input.maximumCandidates ?? 3,
  });
  const browser = await launchRenderBrowser();
  const fonts = await loadSystemPretendard();
  const accepted: ValidatedCandidateArtifact[] = [];
  const rejected: Array<{ planId: string; reason: string }> = [];
  await mkdir(input.outputRoot, { recursive: true });
  try {
    for (const plan of plans) {
      const planIssues = validateCompositionPlan(plan, input.slide, input.informationPlan, fragments, corpus);
      if (planIssues.length > 0) { rejected.push({ planId: plan.planId, reason: 'composition-contract' }); continue; }
      const measures = await measureTextBatch(browser, fonts, informationMeasureRequests({ slide: input.slide, informationPlan: input.informationPlan, plan }), { requireLoadedFonts: true });
      const tree = buildInformationRenderTree({ slide: input.slide, informationPlan: input.informationPlan, plan, measures, fonts });
      const hardGate = runHardGate({ slide: input.slide, informationPlan: input.informationPlan, tree });
      if (!hardGate.passed) { rejected.push({ planId: plan.planId, reason: 'hard-gate' }); continue; }
      const candidateId = `candidate-${contentHash({ plan: plan.planId, tree: tree.deterministicFingerprint }).slice(0, 12)}`;
      const outputDirectory = resolve(input.outputRoot, candidateId);
      const output = await exportRenderTree({ browser, tree, fonts, outputDir: outputDirectory, basename: candidateId });
      accepted.push({
        candidateId,
        provenance: { patternFragmentIds: plan.patternFragmentIds, referenceIds: plan.referenceIds, layoutFamily: plan.layout.layoutFamily, readingPath: plan.layout.readingPath },
        compositionPlan: plan,
        renderTree: tree,
        pngPath: output.pngPath,
        pngHash: sha256Bytes(new Uint8Array(await readFile(output.pngPath))),
        validation: { hardGatePassed: true, programFindingCount: 0, sourceFidelityFindingCount: 0 },
      });
    }
  } finally { await browser.close(); }
  return { accepted, rejected };
}

export function candidateComparisonFromArtifacts(input: {
  slide: SlideIR;
  context: PreferenceContext;
  artifacts: ValidatedCandidateArtifact[];
  createdAt: string;
}) {
  const evidences: CandidateEvidence[] = input.artifacts.map((artifact) => ({
    candidateId: artifact.candidateId,
    signature: {
      candidateId: artifact.candidateId,
      referenceClusterIds: artifact.provenance.referenceIds,
      topologyFamily: artifact.provenance.layoutFamily,
      readingPath: artifact.compositionPlan.layout.readingPath,
      featureTags: [...artifact.compositionPlan.patternFragmentIds, artifact.compositionPlan.styleIntent.motif.family],
    },
    compositionPlanHash: contentHash(artifact.compositionPlan),
    renderTreeHash: contentHash(artifact.renderTree),
    pngHash: artifact.pngHash,
    hardGate: 'passed',
    nonSevereFindingCount: 0,
  }));
  return buildCandidateComparison({
    slideId: input.slide.slideId,
    sourceContentHash: input.slide.source.contentHash,
    context: input.context,
    candidates: evidences,
    presentationSeed: Number.parseInt(input.slide.source.contentHash.slice(0, 8), 16),
    createdAt: input.createdAt,
  });
}
