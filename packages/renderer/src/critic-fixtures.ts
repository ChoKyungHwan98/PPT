import {
  CompositionPlanSchema,
  RenderTreeSchema,
  SEED_PATTERN_FRAGMENTS,
  SEED_REFERENCE_CORPUS,
  VisualCriticFixtureSchema,
  contentHash,
  type CompositionPlan,
  type InformationPlan,
  type RenderNode,
  type RenderTree,
  type SlideIR,
  type VisualCriticFixture,
} from '@game-presentation/contracts';
import { createCompositionPlanFromInformationPlan } from '@game-presentation/composition-engine';
import { retrieveReferencesForInformationPlan } from '@game-presentation/reference-engine';
import { createMec01InformationPlan, interpretMec01Source } from '../../source-ingestion/src/mec-01-semantic.js';
import type { Browser } from 'playwright';
import type { FontAsset } from './font.js';
import { runHardGate, type HardGateResult } from './hard-gate.js';
import { buildInformationRenderTree, informationMeasureRequests } from './information-layout.js';
import { measureTextBatch } from './measure.js';

const RAW_TEXT = '회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%';

export type CriticFixtureArtifact = {
  fixture: VisualCriticFixture;
  slide: SlideIR;
  informationPlan: InformationPlan;
  compositionPlan: CompositionPlan;
  tree: RenderTree;
  hardGate: HardGateResult;
};

function fixtureDefinition(input: {
  fixtureId: string;
  title: string;
  artifactId: string;
  labelCoverage: VisualCriticFixture['labelCoverage'];
  expectedFindings: VisualCriticFixture['expectedFindings'];
  expectedSubmissionReadiness: VisualCriticFixture['expectedSubmissionReadiness'];
}): VisualCriticFixture {
  return VisualCriticFixtureSchema.parse({ schemaVersion: '0.1', ...input });
}

function withPlanId(plan: CompositionPlan, planId: string): CompositionPlan {
  return CompositionPlanSchema.parse({ ...plan, planId });
}

async function renderFromPlan(input: {
  browser: Browser;
  fonts: FontAsset[];
  slide: SlideIR;
  informationPlan: InformationPlan;
  plan: CompositionPlan;
}): Promise<RenderTree> {
  const measures = await measureTextBatch(
    input.browser,
    input.fonts,
    informationMeasureRequests({
      slide: input.slide,
      informationPlan: input.informationPlan,
      plan: input.plan,
    }),
  );
  return buildInformationRenderTree({
    slide: input.slide,
    informationPlan: input.informationPlan,
    plan: input.plan,
    measures,
    fonts: input.fonts,
  });
}

function textNodesForBlock(tree: RenderTree, blockId: string): Array<Extract<RenderNode, { kind: 'text' }>> {
  return tree.nodes
    .filter((node): node is Extract<RenderNode, { kind: 'text' }> =>
      node.kind === 'text' && node.semanticBlockId === blockId)
    .sort((left, right) => left.box.y - right.box.y);
}

function moveBlock(tree: RenderTree, blockId: string, targetX: number, firstBaselineY: number): void {
  const texts = textNodesForBlock(tree, blockId);
  const first = texts[0];
  if (first === undefined) throw new Error(`Critic fixture block을 찾을 수 없습니다: ${blockId}`);
  const dx = targetX - first.lines[0]!.x;
  const dy = firstBaselineY - first.lines[0]!.baselineY;
  for (const node of tree.nodes) {
    if (node.semanticBlockId !== blockId) continue;
    node.box.x += dx;
    node.box.y += dy;
    if (node.kind === 'text') {
      node.lines = node.lines.map((line) => ({ ...line, x: line.x + dx, baselineY: line.baselineY + dy }));
    }
  }
}

function blockAnchor(tree: RenderTree, blockId: string): { left: number; right: number; centerY: number } {
  const texts = textNodesForBlock(tree, blockId);
  if (texts.length === 0) throw new Error(`Critic fixture anchor를 찾을 수 없습니다: ${blockId}`);
  return {
    left: Math.min(...texts.map((node) => node.box.x)),
    right: Math.max(...texts.map((node) => node.box.x + node.box.width)),
    centerY: texts.reduce((sum, node) => sum + node.box.y + node.box.height / 2, 0) / texts.length,
  };
}

function blockBounds(tree: RenderTree, blockId: string): { top: number; bottom: number; centerX: number } {
  const texts = textNodesForBlock(tree, blockId);
  if (texts.length === 0) throw new Error(`Critic fixture bounds를 찾을 수 없습니다: ${blockId}`);
  return {
    top: Math.min(...texts.map((node) => node.box.y)),
    bottom: Math.max(...texts.map((node) => node.box.y + node.box.height)),
    centerX: texts.reduce((sum, node) => sum + node.box.x + node.box.width / 2, 0) / texts.length,
  };
}

function arrowPath(toX: number, toY: number, fromX: number, fromY: number): { pathData: string; box: RenderNode['box'] } {
  const length = Math.max(1, Math.hypot(toX - fromX, toY - fromY));
  const ux = (toX - fromX) / length;
  const uy = (toY - fromY) / length;
  const px = -uy;
  const py = ux;
  const backX = toX - ux * 16;
  const backY = toY - uy * 16;
  const first = { x: backX + px * 8, y: backY + py * 8 };
  const second = { x: backX - px * 8, y: backY - py * 8 };
  const xs = [first.x, toX, second.x];
  const ys = [first.y, toY, second.y];
  return {
    pathData: `M ${first.x} ${first.y} L ${toX} ${toY} L ${second.x} ${second.y}`,
    box: {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
      height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
    },
  };
}

function rebuildRelationPaths(tree: RenderTree, slide: SlideIR): void {
  for (const relation of slide.relations) {
    const from = blockAnchor(tree, relation.fromBlockId);
    const to = blockAnchor(tree, relation.toBlockId);
    const fromX = from.right + 12;
    const fromY = from.centerY;
    const toX = to.left - 12;
    const toY = to.centerY;
    const lineNode = tree.nodes.find((node) => node.nodeId === `relation-${relation.id}`);
    const arrowNode = tree.nodes.find((node) => node.nodeId === `relation-${relation.id}-arrow`);
    if (lineNode?.kind !== 'shape' || arrowNode?.kind !== 'shape') {
      throw new Error(`Critic fixture relation node를 찾을 수 없습니다: ${relation.id}`);
    }
    lineNode.shape = 'path';
    lineNode.box = {
      x: Math.min(fromX, toX),
      y: Math.min(fromY, toY),
      width: Math.max(1, Math.abs(toX - fromX)),
      height: Math.max(1, Math.abs(toY - fromY)),
    };
    lineNode.pathData = `M ${fromX} ${fromY} L ${toX} ${toY}`;
    const arrow = arrowPath(toX, toY, fromX, fromY);
    arrowNode.shape = 'path';
    arrowNode.box = arrow.box;
    arrowNode.pathData = arrow.pathData;
  }
}

function rebuildVerticalRelationPaths(tree: RenderTree, slide: SlideIR): void {
  for (const relation of slide.relations) {
    const from = blockBounds(tree, relation.fromBlockId);
    const to = blockBounds(tree, relation.toBlockId);
    const fromX = from.centerX;
    const fromY = from.bottom + 10;
    const toX = to.centerX;
    const toY = to.top - 10;
    const lineNode = tree.nodes.find((node) => node.nodeId === `relation-${relation.id}`);
    const arrowNode = tree.nodes.find((node) => node.nodeId === `relation-${relation.id}-arrow`);
    if (lineNode?.kind !== 'shape' || arrowNode?.kind !== 'shape') {
      throw new Error(`Critic fixture relation node를 찾을 수 없습니다: ${relation.id}`);
    }
    lineNode.shape = 'path';
    lineNode.box = {
      x: Math.min(fromX, toX),
      y: Math.min(fromY, toY),
      width: Math.max(1, Math.abs(toX - fromX)),
      height: Math.max(1, Math.abs(toY - fromY)),
    };
    lineNode.pathData = `M ${fromX} ${fromY} L ${toX} ${toY}`;
    const arrow = arrowPath(toX, toY, fromX, fromY);
    arrowNode.shape = 'path';
    arrowNode.box = arrow.box;
    arrowNode.pathData = arrow.pathData;
  }
}

function finalizeMutatedTree(tree: RenderTree, fixtureId: string): RenderTree {
  return RenderTreeSchema.parse({
    ...tree,
    renderTreeId: `render-critic-${fixtureId}`,
    deterministicFingerprint: contentHash({ fixtureId, nodes: tree.nodes, source: tree.deterministicFingerprint }),
  });
}

async function basePlan(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  fragmentId: string;
}): Promise<CompositionPlan> {
  const retrieval = retrieveReferencesForInformationPlan({
    slide: input.slide,
    informationPlan: input.informationPlan,
    corpus: SEED_REFERENCE_CORPUS,
    audience: 'game-design-reviewer',
    outputProfile: 'pdf-presentation',
    avoidSignatures: ['card-dashboard'],
    limit: 3,
  });
  return createCompositionPlanFromInformationPlan({
    slide: input.slide,
    informationPlan: input.informationPlan,
    retrieval,
    fragments: SEED_PATTERN_FRAGMENTS.filter((fragment) => fragment.fragmentId === input.fragmentId),
  });
}

function ensureHardGate(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  tree: RenderTree;
  fixtureId: string;
}): HardGateResult {
  const hardGate = runHardGate(input);
  if (!hardGate.passed) {
    throw new Error(`Critic fixture가 Hard Gate를 통과하지 못했습니다 (${input.fixtureId}): ${JSON.stringify(hardGate.findings)}`);
  }
  return hardGate;
}

export async function createCriticFixtureArtifacts(input: {
  browser: Browser;
  fonts: FontAsset[];
}): Promise<CriticFixtureArtifact[]> {
  const slide = interpretMec01Source({ rawText: RAW_TEXT, createdAt: '2026-08-29T00:00:00.000Z' });
  const informationPlan = createMec01InformationPlan(slide);
  const thresholdBase = await basePlan({
    slide,
    informationPlan,
    fragmentId: 'pattern-break-threshold-field',
  });
  const spineBase = await basePlan({
    slide,
    informationPlan,
    fragmentId: 'pattern-editorial-causal-spine',
  });

  const hierarchyPlan = CompositionPlanSchema.parse({
    ...thresholdBase,
    planId: 'composition-critic-hierarchy',
    styleIntent: {
      ...thresholdBase.styleIntent,
      hierarchy: {
        primaryTextSize: 34,
        supportTextSize: 34,
        evidenceTextSize: 34,
        primaryWeight: 500,
        supportWeight: 500,
      },
      accent: {
        ...thresholdBase.styleIntent.accent,
        targetRole: 'support',
      },
    },
  });
  const hierarchyTreeDraft = await renderFromPlan({ browser: input.browser, fonts: input.fonts, slide, informationPlan, plan: hierarchyPlan });
  for (const node of hierarchyTreeDraft.nodes) {
    if (node.nodeId.startsWith('motif-') || node.nodeId.startsWith('connector-marker-')) node.visible = false;
  }
  const hierarchyTree = finalizeMutatedTree(hierarchyTreeDraft, 'hierarchy');

  const densePlan = CompositionPlanSchema.parse({
    ...thresholdBase,
    planId: 'composition-critic-density',
    styleIntent: {
      ...thresholdBase.styleIntent,
      hierarchy: {
        primaryTextSize: 54,
        supportTextSize: 54,
        evidenceTextSize: 54,
        primaryWeight: 700,
        supportWeight: 700,
      },
    },
  });
  const denseTreeDraft = await renderFromPlan({ browser: input.browser, fonts: input.fonts, slide, informationPlan, plan: densePlan });
  moveBlock(denseTreeDraft, 'dodge-step', 960, 350);
  moveBlock(denseTreeDraft, 'fragment-resource', 960, 455);
  moveBlock(denseTreeDraft, 'freeze-step', 960, 560);
  moveBlock(denseTreeDraft, 'break-state', 960, 665);
  moveBlock(denseTreeDraft, 'damage-modifier', 960, 770);
  for (const node of denseTreeDraft.nodes) {
    if (node.nodeId.startsWith('motif-') || node.nodeId.startsWith('connector-marker-')) node.visible = false;
  }
  rebuildVerticalRelationPaths(denseTreeDraft, slide);
  const denseTree = finalizeMutatedTree(denseTreeDraft, 'density');

  const readingPlan = withPlanId(spineBase, 'composition-critic-reading-order');
  const readingTreeDraft = await renderFromPlan({ browser: input.browser, fonts: input.fonts, slide, informationPlan, plan: readingPlan });
  moveBlock(readingTreeDraft, 'dodge-step', 270, 330);
  moveBlock(readingTreeDraft, 'fragment-resource', 650, 760);
  moveBlock(readingTreeDraft, 'freeze-step', 1_000, 360);
  moveBlock(readingTreeDraft, 'break-state', 1_330, 780);
  moveBlock(readingTreeDraft, 'damage-modifier', 1_650, 390);
  for (const node of readingTreeDraft.nodes) {
    if (node.nodeId.startsWith('motif-') || node.nodeId.startsWith('connector-marker-')) node.visible = false;
  }
  rebuildRelationPaths(readingTreeDraft, slide);
  const readingTree = finalizeMutatedTree(readingTreeDraft, 'reading-order');

  const cleanPlan = withPlanId(thresholdBase, 'composition-critic-clean');
  const cleanTree = await renderFromPlan({ browser: input.browser, fonts: input.fonts, slide, informationPlan, plan: cleanPlan });

  const definitions = [
    {
      fixtureId: 'hierarchy-problem',
      title: '정보 위계 문제',
      labelCoverage: 'core-only' as const,
      plan: hierarchyPlan,
      tree: hierarchyTree,
      expectedFindings: [{
        issueType: 'hierarchy' as const,
        acceptableIssueTypes: ['first-fixation', 'typography-hierarchy'] as const,
        severity: 'error' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '모든 단계의 글자 크기와 굵기가 같고 buildup이 강조되어 BREAK 전환점과 +50% 결과가 핵심으로 읽히지 않는다.',
      }],
      expectedSubmissionReadiness: 'not-ready' as const,
    },
    {
      fixtureId: 'density-problem',
      title: '정보 과밀',
      labelCoverage: 'core-only' as const,
      plan: densePlan,
      tree: denseTree,
      expectedFindings: [{
        issueType: 'density' as const,
        acceptableIssueTypes: ['grouping', 'space-use'] as const,
        severity: 'error' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '다섯 단계와 네 관계가 중앙의 좁은 덩어리에 큰 글자로 몰려 단계 간 숨 쉴 공간과 그룹 경계가 없다.',
      }],
      expectedSubmissionReadiness: 'not-ready' as const,
    },
    {
      fixtureId: 'reading-order-problem',
      title: '읽는 순서 문제',
      labelCoverage: 'core-only' as const,
      plan: readingPlan,
      tree: readingTree,
      expectedFindings: [{
        issueType: 'reading-order' as const,
        acceptableIssueTypes: ['relation-clarity'] as const,
        severity: 'error' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '단계가 위아래로 크게 교차하고 연결선이 지그재그로 화면을 가로질러 좌→우 인과 흐름을 한 번에 따라가기 어렵다.',
      }],
      expectedSubmissionReadiness: 'not-ready' as const,
    },
    {
      fixtureId: 'clean-result',
      title: '정상 결과',
      labelCoverage: 'exhaustive' as const,
      plan: cleanPlan,
      tree: cleanTree,
      expectedFindings: [],
      expectedSubmissionReadiness: 'ready' as const,
    },
  ];

  return definitions.map((definition) => {
    const hardGate = ensureHardGate({ slide, informationPlan, tree: definition.tree, fixtureId: definition.fixtureId });
    return {
      fixture: fixtureDefinition({
        fixtureId: definition.fixtureId,
        title: definition.title,
        artifactId: definition.tree.renderTreeId,
        labelCoverage: definition.labelCoverage,
        expectedFindings: definition.expectedFindings.map((finding) => ({
          ...finding,
          acceptableIssueTypes: [...finding.acceptableIssueTypes],
        })),
        expectedSubmissionReadiness: definition.expectedSubmissionReadiness,
      }),
      slide,
      informationPlan,
      compositionPlan: definition.plan,
      tree: definition.tree,
      hardGate,
    };
  });
}

export const CRITIC_FIXTURE_PAGE_GOAL = '회피 ×3부터 받는 피해 +50%까지의 순서와 BREAK 전환점을 즉시 이해시키는 것';
