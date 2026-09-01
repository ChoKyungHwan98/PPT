import { resolve } from 'node:path';
import { SEED_PATTERN_FRAGMENTS, SEED_REFERENCE_CORPUS } from '@game-presentation/contracts';
import { createCompositionPlanFromInformationPlan } from '@game-presentation/composition-engine';
import { retrieveReferencesForInformationPlan } from '@game-presentation/reference-engine';
import { createMec01InformationPlan, interpretMec01Source } from '../../../source-ingestion/src/mec-01-semantic.js';
import { launchRenderBrowser } from '../browser.js';
import { exportRenderTree } from '../export.js';
import { loadSystemPretendard } from '../font.js';
import { runHardGate } from '../hard-gate.js';
import { buildInformationRenderTree, informationMeasureRequests } from '../information-layout.js';
import { measureTextBatch } from '../measure.js';

const rawText = '회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%';

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
    limit: 3,
  });
  const plan = createCompositionPlanFromInformationPlan({
    slide,
    informationPlan,
    retrieval,
    fragments: SEED_PATTERN_FRAGMENTS,
  });
  const fonts = await loadSystemPretendard();
  const browser = await launchRenderBrowser();
  try {
    const measures = await measureTextBatch(
      browser,
      fonts,
      informationMeasureRequests({ slide, informationPlan, plan }),
    );
    const tree = buildInformationRenderTree({ slide, informationPlan, plan, measures, fonts });
    const hardGate = runHardGate({ slide, informationPlan, tree });
    if (!hardGate.passed) {
      throw new Error(`Hard Gate 실패: ${JSON.stringify(hardGate.findings)}`);
    }
    const outputs = await exportRenderTree({
      browser,
      tree,
      fonts,
      outputDir: resolve('output', 'v1-information-flow'),
      basename: 'mec-01-generic-flow',
    });
    process.stdout.write(JSON.stringify({ retrieval, plan, hardGate, outputs }, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}

await main();
