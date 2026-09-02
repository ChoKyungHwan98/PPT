import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  SEED_PATTERN_FRAGMENTS,
  SEED_REFERENCE_CORPUS,
  type RenderNode,
  type RenderTree,
} from '@game-presentation/contracts';
import { createCompositionPlanFromInformationPlan } from '@game-presentation/composition-engine';
import { retrieveReferencesForInformationPlan } from '@game-presentation/reference-engine';
import { createMec01InformationPlan, interpretMec01Source } from '../../../source-ingestion/src/mec-01-semantic.js';
import { launchRenderBrowser } from '../browser.js';
import { loadSystemPretendard } from '../font.js';
import { runHardGate } from '../hard-gate.js';
import { buildInformationRenderTree, informationMeasureRequests } from '../information-layout.js';
import { measureTextBatch } from '../measure.js';

const rawText = '회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%';
const outputPath = resolve(
  'packages',
  'renderer',
  'fixtures',
  'mec-01-accumulation-threshold-consequence.render-tree.json',
);

function textNodesByRole(tree: RenderTree, role: RenderNode['visualRole']) {
  return tree.nodes.filter(
    (node): node is Extract<RenderNode, { kind: 'text' }> =>
      node.kind === 'text' && node.visualRole === role,
  );
}

function requireProofContract(tree: RenderTree): void {
  if (tree.messagePresentation?.presentationKind !== 'suppressed-duplicate') {
    throw new Error('MEC-01 message는 suppressed-duplicate여야 합니다.');
  }
  if (textNodesByRole(tree, 'message-context').length !== 0) {
    throw new Error('억제된 MEC-01 message TextNode가 생성되었습니다.');
  }

  const accumulation = textNodesByRole(tree, 'ordered-step');
  if (
    JSON.stringify(accumulation.map((node) => node.text)) !==
    JSON.stringify(['회피 ×3', '시간 파편 획득', '시간 정지 5초'])
  ) {
    throw new Error('MEC-01 accumulation 원문 또는 순서가 다릅니다.');
  }
  const threshold = textNodesByRole(tree, 'threshold-event');
  if (threshold.length !== 1 || threshold[0]?.text !== 'BREAK') {
    throw new Error('MEC-01 threshold event가 정확히 렌더되지 않았습니다.');
  }
  if (tree.nodes.filter((node) => node.visualRole === 'threshold-boundary').length !== 1) {
    throw new Error('MEC-01 threshold boundary가 정확히 하나여야 합니다.');
  }
  const consequence = textNodesByRole(tree, 'consequence-result');
  if (JSON.stringify(consequence.map((node) => node.text)) !== JSON.stringify(['받는 피해', '+50%'])) {
    throw new Error('MEC-01 metric consequence 원문 구조가 다릅니다.');
  }

  const expectedRelations = new Map([
    ['r-dodge-fragment', 'accumulation-local'],
    ['r-fragment-freeze', 'accumulation-local'],
    ['r-freeze-break', 'threshold-entry'],
    ['r-break-damage', 'consequence-activation'],
  ] as const);
  for (const [relationId, visualRole] of expectedRelations) {
    const carriers = tree.nodes.filter(
      (node) => node.visible && node.relationId === relationId && node.visualRole === 'relation-carrier',
    );
    if (carriers.length !== 1 || carriers[0]?.relationVisualRole !== visualRole) {
      throw new Error(`relation carrier 계약이 다릅니다: ${relationId}`);
    }
  }

  const forbiddenPrefixes = ['motif-', 'connector-marker-', 'phase-placeholder-relation-'];
  if (tree.nodes.some((node) => forbiddenPrefixes.some((prefix) => node.nodeId.startsWith(prefix)))) {
    throw new Error('새 layout RenderTree에 legacy node가 포함되었습니다.');
  }
  if (tree.nodes.some((node) => [...expectedRelations.keys()].some(
    (relationId) => node.nodeId === `relation-${relationId}`,
  ))) {
    throw new Error('새 layout RenderTree에 generic relation node가 포함되었습니다.');
  }
  if (tree.nodes.some((node) => node.kind === 'shape' && (node.shape === 'rect' || node.shape === 'round-rect'))) {
    throw new Error('새 layout RenderTree에 card/giant field fallback이 포함되었습니다.');
  }
}

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
    const first = buildInformationRenderTree({ slide, informationPlan, plan, measures, fonts });
    const second = buildInformationRenderTree({ slide, informationPlan, plan, measures, fonts });
    requireProofContract(first);
    requireProofContract(second);

    const hardGate = runHardGate({ slide, informationPlan, tree: first });
    if (!hardGate.passed) {
      throw new Error(`MEC-01 Hard Gate 실패: ${JSON.stringify(hardGate.findings)}`);
    }
    if (
      first.deterministicFingerprint !== second.deterministicFingerprint ||
      JSON.stringify(first.nodes) !== JSON.stringify(second.nodes)
    ) {
      throw new Error('동일 입력의 RenderTree가 결정적이지 않습니다.');
    }

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(first, null, 2) + '\n', 'utf8');
    process.stdout.write(JSON.stringify({
      outputPath,
      planId: plan.planId,
      layoutFamily: plan.layout.layoutFamily,
      fontHashes: fonts.map((font) => ({ weight: font.weight, hash: font.fileHash })),
      nodeCount: first.nodes.length,
      deterministicFingerprint: first.deterministicFingerprint,
      hardGate: {
        passed: hardGate.passed,
        programFindingCount: hardGate.programFindings.length,
        sourceFidelityFindingCount: hardGate.sourceFidelityFindings.length,
      },
    }, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}

await main();
