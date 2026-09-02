import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { SEED_PATTERN_FRAGMENTS, SEED_REFERENCE_CORPUS, validateCompositionPlan } from '@game-presentation/contracts';
import { createCompositionPlanFromInformationPlan } from '@game-presentation/composition-engine';
import { externalComparisonReferenceRecords, loadExternalMasterReferenceSet, retrieveReferencesForInformationPlan } from '@game-presentation/reference-engine';
import { interpretAuthoredFeatureComparison, type AuthoredFeatureComparison } from '../../../source-ingestion/src/authored-feature-comparison.js';
import { launchRenderBrowser } from '../browser.js';
import { loadSystemPretendard } from '../font.js';
import { measureTextBatch } from '../measure.js';
import { informationMeasureRequests, buildInformationRenderTree } from '../information-layout.js';
import { runHardGate } from '../hard-gate.js';
import { exportRenderPreview } from '../preview-export.js';

async function main() {
  const basename = 'dodge-feature-spec-01';
  const outputDir = resolve('packages/renderer/fixtures');
  const pngPath = resolve(outputDir, `${basename}.png`);
  let exists = false;
  try { await access(pngPath); exists = true; } catch { /* New candidate only. */ }
  if (exists) throw new Error('First candidate PNG already exists. No automatic second render or polish.');
  const sourcePath = resolve('packages/source-ingestion/fixtures/dodge-feature-spec.source.json');
  const source = JSON.parse(await readFile(sourcePath, 'utf8')) as AuthoredFeatureComparison;
  const { slide, informationPlan } = interpretAuthoredFeatureComparison(source);
  const referenceDir = resolve('packages/reference-engine/references/external-master-2025-v1');
  const references = await loadExternalMasterReferenceSet(referenceDir);
  const corpus = [...SEED_REFERENCE_CORPUS, ...externalComparisonReferenceRecords(references, referenceDir)];
  const retrieval = retrieveReferencesForInformationPlan({
    slide, informationPlan, corpus, audience: 'game-design-reviewer', outputProfile: 'pdf-presentation', limit: 4,
  });
  const plan = createCompositionPlanFromInformationPlan({ slide, informationPlan, retrieval, fragments: SEED_PATTERN_FRAGMENTS });
  const contractIssues = validateCompositionPlan(plan, slide, informationPlan, SEED_PATTERN_FRAGMENTS, corpus);
  if (contractIssues.length) throw new Error(JSON.stringify(contractIssues));
  const fonts = await loadSystemPretendard();
  const browser = await launchRenderBrowser();
  try {
    const measures = await measureTextBatch(browser, fonts, informationMeasureRequests({ slide, informationPlan, plan }), { requireLoadedFonts: true });
    const tree = buildInformationRenderTree({ slide, informationPlan, plan, measures, fonts });
    const hardGate = runHardGate({ slide, informationPlan, tree });
    if (!hardGate.passed) throw new Error(`PNG blocked by Hard Gate: ${JSON.stringify(hardGate)}`);
    const second = buildInformationRenderTree({ slide, informationPlan, plan, measures, fonts });
    if (JSON.stringify(tree) !== JSON.stringify(second)) throw new Error('RenderTree is not deterministic.');
    await mkdir(outputDir, { recursive: true });
    for (const [suffix, artifact] of Object.entries({ 'slide-ir': slide, 'information-plan': informationPlan, retrieval, 'composition-plan': plan })) {
      await writeFile(resolve(outputDir, `${basename}.${suffix}.json`), JSON.stringify(artifact, null, 2) + '\n');
    }
    const outputs = await exportRenderPreview({ browser, tree, fonts, outputDir, basename });
    const bytes = await readFile(outputs.pngPath);
    const metadata = await sharp(bytes).metadata();
    const size = (await stat(outputs.pngPath)).size;
    if (metadata.width !== 1920 || metadata.height !== 1080 || size === 0) throw new Error('PNG output verification failed.');
    const proof = {
      artifactId: basename, status: 'candidate-awaiting-user-review',
      readyPositiveFixture: false, readyPromotionApproval: null,
      criticCalled: false, polishIterations: 0, pngRenderCount: 1,
      sourcePath: 'packages/source-ingestion/fixtures/dodge-feature-spec.source.json',
      selectedPattern: plan.patternFragmentIds, selectedReferences: plan.referenceIds,
      semantic: { kind: informationPlan.semanticShape, blocks: slide.blocks.length, authoredPairs: slide.relations },
      renderTree: { fingerprint: tree.deterministicFingerprint, nodes: tree.nodes.length,
        regions: tree.nodes.filter((node) => node.kind === 'group').map((node) => ({ id: node.compositionRegionId, box: node.box })) },
      hardGate, deterministic: true,
      png: { path: `packages/renderer/fixtures/${basename}.png`, width: metadata.width, height: metadata.height, bytes: size, sha256: createHash('sha256').update(bytes).digest('hex') },
      fontHashes: fonts.map((font) => ({ family: font.family, weight: font.weight, sha256: font.fileHash })),
      renderer: 'RenderTree → renderTreeToHtml / SVG → Chromium screenshot',
    };
    await writeFile(resolve(outputDir, `${basename}.proof.json`), JSON.stringify(proof, null, 2) + '\n');
    process.stdout.write(JSON.stringify(proof, null, 2) + '\n');
  } finally { await browser.close(); }
}

await main();
