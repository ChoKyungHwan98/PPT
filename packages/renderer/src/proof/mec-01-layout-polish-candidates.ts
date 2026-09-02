import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { SEED_PATTERN_FRAGMENTS, SEED_REFERENCE_CORPUS } from '@game-presentation/contracts';
import { createCompositionPlanFromInformationPlan } from '@game-presentation/composition-engine';
import { retrieveReferencesForInformationPlan } from '@game-presentation/reference-engine';
import { createMec01InformationPlan, interpretMec01Source } from '../../../source-ingestion/src/mec-01-semantic.js';
import { launchRenderBrowser } from '../browser.js';
import { loadSystemPretendard } from '../font.js';
import { runHardGate } from '../hard-gate.js';
import {
  buildInformationRenderTree,
  informationMeasureRequests,
  type AccumulationLayoutPolishProfile,
} from '../information-layout.js';
import { measureTextBatch } from '../measure.js';
import { exportRenderPreview } from '../preview-export.js';

const rawText = '회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%';
const fixtureDir = resolve('packages', 'renderer', 'fixtures');

const candidates: Array<{
  id: 'final';
  profile: AccumulationLayoutPolishProfile;
}> = [
  { id: 'final', profile: 'balanced-runway-final' },
];

async function main(): Promise<void> {
  const slide = interpretMec01Source({ rawText, createdAt: '2026-08-29T00:00:00.000Z' });
  const informationPlan = createMec01InformationPlan(slide);
  const retrieval = retrieveReferencesForInformationPlan({
    slide,
    informationPlan,
    corpus: SEED_REFERENCE_CORPUS,
    audience: 'game-design-reviewer',
    outputProfile: 'pdf-presentation',
    avoidSignatures: ['card-dashboard'],
    limit: 4,
  });
  const plan = createCompositionPlanFromInformationPlan({
    slide,
    informationPlan,
    retrieval,
    fragments: SEED_PATTERN_FRAGMENTS.filter(
      (fragment) => fragment.fragmentId === 'pattern-accumulation-threshold-consequence',
    ),
  });
  const fonts = await loadSystemPretendard();
  const browser = await launchRenderBrowser();
  try {
    const measures = await measureTextBatch(
      browser,
      fonts,
      informationMeasureRequests({ slide, informationPlan, plan }),
    );
    const results = [];
    for (const candidate of candidates) {
      const tree = buildInformationRenderTree({
        slide,
        informationPlan,
        plan,
        measures,
        fonts,
        accumulationLayoutPolish: candidate.profile,
      });
      const hardGate = runHardGate({ slide, informationPlan, tree });
      if (!hardGate.passed) {
        throw new Error(`${candidate.profile} Hard Gate 실패: ${JSON.stringify(hardGate.findings)}`);
      }
      const basename = `mec-01-polish-${candidate.id}-${candidate.profile}`;
      const outputs = await exportRenderPreview({
        browser,
        tree,
        fonts,
        outputDir: fixtureDir,
        basename,
      });
      const pngBytes = await readFile(outputs.pngPath);
      const pngStat = await stat(outputs.pngPath);
      const metadata = await sharp(pngBytes).metadata();
      if (metadata.width !== 1920 || metadata.height !== 1080 || pngStat.size <= 0) {
        throw new Error(`${candidate.profile} PNG 검사 실패`);
      }
      results.push({
        candidate: candidate.id,
        profile: candidate.profile,
        outputs,
        width: metadata.width,
        height: metadata.height,
        fileSizeBytes: pngStat.size,
        pngSha256: createHash('sha256').update(pngBytes).digest('hex'),
        deterministicFingerprint: tree.deterministicFingerprint,
        hardGate: {
          passed: hardGate.passed,
          programFindingCount: hardGate.programFindings.length,
          sourceFidelityFindingCount: hardGate.sourceFidelityFindings.length,
        },
      });
    }
    process.stdout.write(JSON.stringify({
      compositionPlanId: plan.planId,
      fontHashes: fonts.map((font) => ({ weight: font.weight, hash: font.fileHash })),
      results,
    }, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}

await main();
