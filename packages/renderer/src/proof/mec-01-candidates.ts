import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  EMPTY_PREFERENCE_STATE,
  SEED_PATTERN_FRAGMENTS,
  SEED_REFERENCE_CORPUS,
  buildReferenceRetrievalBrief,
  contentHash,
  hasSevereFindings,
  sha256Bytes,
  validateCompositionPlan,
  validateRenderTreeAgainstSlide,
} from '@game-presentation/contracts';
import { buildReferenceIndex, searchReferenceIndex } from '@game-presentation/reference-engine';
import { buildCandidateComparison, generateCompositionCandidates } from '@game-presentation/composition-engine';
import { MEC_01_SLIDE_IR } from '../../../contracts/fixtures/mec-01.js';
import { createMec01InformationPlan } from '../../../source-ingestion/src/mec-01-semantic.js';
import { launchRenderBrowser } from '../browser.js';
import { loadSystemPretendard } from '../font.js';
import { validateLayout } from '../layout-validation.js';
import {
  buildMechanismRenderTree,
  mechanismMeasureRequests,
} from '../mechanism-layout.js';
import { measureTextBatch } from '../measure.js';
import { exportRenderPreview } from '../preview-export.js';

async function main(): Promise<void> {
  const brief = buildReferenceRetrievalBrief({
    slide: MEC_01_SLIDE_IR,
    corpus: SEED_REFERENCE_CORPUS,
    semanticShape: 'causal-chain',
    primaryArtifact: 'mechanism-flow',
    densityBand: 'balanced',
    readingPathCandidates: ['guided-sequence', 'left-to-right', 'center-out'],
    audience: 'game-design-reviewer',
    outputProfile: 'pdf-presentation',
    avoidSignatures: ['card-dashboard', 'node-box-chain'],
  });
  const referenceIndex = buildReferenceIndex(SEED_REFERENCE_CORPUS);
  const rankedReferences = searchReferenceIndex({
    brief,
    corpus: SEED_REFERENCE_CORPUS,
    index: referenceIndex,
    limit: 4,
  });
  const candidates = generateCompositionCandidates({
    slide: MEC_01_SLIDE_IR,
    informationPlan: createMec01InformationPlan(MEC_01_SLIDE_IR),
    brief,
    rankedReferences,
    fragments: SEED_PATTERN_FRAGMENTS,
    preferenceState: EMPTY_PREFERENCE_STATE,
    maximumCandidates: 2,
  });
  const fonts = await loadSystemPretendard();
  const browser = await launchRenderBrowser();
  const outputRoot = resolve('output', 'candidate-previews', 'mec-01');
  await mkdir(outputRoot, { recursive: true });
  try {
    const measures = await measureTextBatch(
      browser,
      fonts,
      mechanismMeasureRequests(
        MEC_01_SLIDE_IR,
        candidates.map((candidate) => candidate.plan),
      ),
    );
    const accepted = [];
    const rejected = [];
    for (const candidate of candidates) {
      const planIssues = validateCompositionPlan(
        candidate.plan,
        MEC_01_SLIDE_IR,
        createMec01InformationPlan(MEC_01_SLIDE_IR),
        SEED_PATTERN_FRAGMENTS,
        SEED_REFERENCE_CORPUS,
      );
      if (planIssues.length > 0) {
        rejected.push({
          planId: candidate.plan.planId,
          topologyFamily: candidate.signature.topologyFamily,
          reason: 'composition-contract',
          findings: planIssues,
        });
        continue;
      }
      const tree = buildMechanismRenderTree({
        slide: MEC_01_SLIDE_IR,
        plan: candidate.plan,
        measures,
        fonts,
      });
      const findings = [
        ...validateRenderTreeAgainstSlide(tree, MEC_01_SLIDE_IR),
        ...validateLayout(tree),
      ];
      if (hasSevereFindings(findings)) {
        rejected.push({
          planId: candidate.plan.planId,
          topologyFamily: candidate.signature.topologyFamily,
          reason: 'quality-floor',
          findings,
        });
        continue;
      }
      const candidateDir = join(outputRoot, candidate.signature.topologyFamily);
      const outputs = await exportRenderPreview({
        browser,
        tree,
        fonts,
        outputDir: candidateDir,
        basename: candidate.signature.topologyFamily,
      });
      accepted.push({
        plan: candidate.plan,
        signature: candidate.signature,
        rankingScore: candidate.rankingScore,
        outputs,
        findings,
      });
    }
    const topologyCount = new Set(
      accepted.map((candidate) => candidate.signature.topologyFamily),
    ).size;
    if (accepted.length > 1 && topologyCount !== accepted.length) {
      throw new Error('구조적으로 중복된 후보가 quality gate를 통과했습니다.');
    }
    const preferenceContext = {
      intent: brief.intent,
      semanticShape: brief.semanticShape,
      relationshipShape: brief.relationshipShape,
      primaryArtifact: brief.primaryArtifact,
      audience: brief.audience,
      outputProfile: brief.outputProfile,
    };
    const comparison = buildCandidateComparison({
      slideId: MEC_01_SLIDE_IR.slideId,
      sourceContentHash: MEC_01_SLIDE_IR.source.contentHash,
      context: preferenceContext,
      candidates: await Promise.all(
        accepted.map(async (candidate) => ({
          candidateId: candidate.signature.candidateId,
          signature: candidate.signature,
          compositionPlanHash: contentHash(candidate.plan),
          renderTreeHash: contentHash(
            JSON.parse(await readFile(candidate.outputs.renderTreePath, 'utf8')) as unknown,
          ),
          pngHash: sha256Bytes(await readFile(candidate.outputs.pngPath)),
          hardGate: 'passed' as const,
          nonSevereFindingCount: candidate.findings.length,
        })),
      ),
      presentationSeed: Number.parseInt(MEC_01_SLIDE_IR.source.contentHash.slice(0, 8), 16),
      createdAt: MEC_01_SLIDE_IR.source.createdAt,
    });
    const manifest = {
      schemaVersion: '0.1',
      slideId: MEC_01_SLIDE_IR.slideId,
      sourceContentHash: MEC_01_SLIDE_IR.source.contentHash,
      brief,
      rankedReferences,
      accepted,
      rejected,
      comparison,
      quotaPolicy: 'never-fill-with-failed-candidate',
    };
    const manifestPath = join(outputRoot, 'comparison-manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    process.stdout.write(
      JSON.stringify(
        {
          manifestPath,
          accepted: accepted.map((candidate) => ({
            topologyFamily: candidate.signature.topologyFamily,
            pngPath: candidate.outputs.pngPath,
            findings: candidate.findings.length,
          })),
          rejected: rejected.map((candidate) => ({
            topologyFamily: candidate.topologyFamily,
            reason: candidate.reason,
          })),
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    await browser.close();
  }
}

await main();
