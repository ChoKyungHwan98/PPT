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
  pngSourcePath?: string;
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

  const roughPlan = withPlanId(thresholdBase, 'composition-critic-rough');
  const roughTree = await renderFromPlan({ browser: input.browser, fonts: input.fonts, slide, informationPlan, plan: roughPlan });

  const definitions = [
    {
      fixtureId: 'hierarchy-problem',
      title: '정보 위계 문제',
      labelCoverage: 'exhaustive' as const,
      plan: hierarchyPlan,
      tree: hierarchyTree,
      expectedFindings: [{
        issueType: 'hierarchy' as const,
        acceptableIssueTypes: [] as const,
        severity: 'error' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '모든 단계의 글자 크기와 굵기가 같고 buildup이 강조되어 BREAK 전환점과 +50% 결과가 핵심으로 읽히지 않는다.',
      }, {
        issueType: 'space-use' as const,
        acceptableIssueTypes: [] as const,
        severity: 'warning' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '정보는 가운데 한 줄에만 머물고 상하 공간이 크게 비어 있어 정보량 대비 화면 사용이 설득력 없고 임시 배치처럼 보인다.',
      }, {
        issueType: 'relation-clarity' as const,
        acceptableIssueTypes: [] as const,
        severity: 'warning' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '축적 단계, BREAK 전환점, 피해 결과의 역할 차이가 타이포와 영역 구분으로 충분히 드러나지 않는다.',
      }, {
        issueType: 'submission-readiness' as const,
        acceptableIssueTypes: [] as const,
        severity: 'error' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '핵심 메시지 위계와 화면 구성의 마감이 부족해 실제 제출 자료로 사용할 수준이 아니다.',
      }],
      expectedSubmissionReadiness: 'not-ready' as const,
    },
    {
      fixtureId: 'density-problem',
      title: '밀도·공간 활용 문제',
      labelCoverage: 'exhaustive' as const,
      plan: densePlan,
      tree: denseTree,
      expectedFindings: [{
        issueType: 'density' as const,
        acceptableIssueTypes: [] as const,
        severity: 'error' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '다섯 단계와 네 관계가 중앙의 좁은 덩어리에 큰 글자로 몰려 단계 간 숨 쉴 공간과 그룹 경계가 없다.',
      }, {
        issueType: 'space-use' as const,
        acceptableIssueTypes: [] as const,
        severity: 'error' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '세로로 좁은 중앙 열만 사용하고 좌우 대부분을 비워 16:9 화면과 정보 구조가 맞지 않는다.',
      }, {
        issueType: 'grouping' as const,
        acceptableIssueTypes: [] as const,
        severity: 'warning' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: 'buildup 세 단계, BREAK, 결과가 하나의 동일한 세로 목록처럼 보여 역할별 묶음이 약하다.',
      }, {
        issueType: 'submission-readiness' as const,
        acceptableIssueTypes: [] as const,
        severity: 'error' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '과도한 중앙 집중과 빈 좌우 공간 때문에 제출용 레이아웃으로 볼 수 없다.',
      }],
      expectedSubmissionReadiness: 'not-ready' as const,
    },
    {
      fixtureId: 'reading-order-problem',
      title: '읽는 순서 문제',
      labelCoverage: 'exhaustive' as const,
      plan: readingPlan,
      tree: readingTree,
      expectedFindings: [{
        issueType: 'reading-order' as const,
        acceptableIssueTypes: [] as const,
        severity: 'error' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '단계가 위아래로 크게 교차하고 연결선이 지그재그로 화면을 가로질러 좌→우 인과 흐름을 한 번에 따라가기 어렵다.',
      }, {
        issueType: 'relation-clarity' as const,
        acceptableIssueTypes: [] as const,
        severity: 'error' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '긴 대각선이 서로 다른 높이의 항목을 잇고 있어 축적→전환→결과 관계보다 선의 움직임이 먼저 보인다.',
      }, {
        issueType: 'grouping' as const,
        acceptableIssueTypes: [] as const,
        severity: 'warning' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '다섯 단계가 넓게 흩어져 buildup, threshold, consequence라는 의미 묶음을 공간적으로 확인하기 어렵다.',
      }, {
        issueType: 'submission-readiness' as const,
        acceptableIssueTypes: [] as const,
        severity: 'error' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '독자가 연결선을 해독해야 하므로 실제 제출용 정보 도식으로 사용할 수 없다.',
      }],
      expectedSubmissionReadiness: 'not-ready' as const,
    },
    {
      fixtureId: 'rough-but-readable',
      title: '읽히지만 미완성인 현재 V1 결과',
      labelCoverage: 'exhaustive' as const,
      plan: roughPlan,
      tree: roughTree,
      expectedFindings: [{
        issueType: 'space-use' as const,
        acceptableIssueTypes: [] as const,
        severity: 'warning' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '정보가 가운데의 얇은 가로 띠에만 배치되고 상하 대부분이 비어 정보량 대비 공간 활용이 약하다.',
      }, {
        issueType: 'hierarchy' as const,
        acceptableIssueTypes: [] as const,
        severity: 'warning' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '페이지의 핵심 주장이나 제목이 없고 BREAK와 +50%만 부분적으로 강조되어 전체 메시지의 위계가 완성되지 않았다.',
      }, {
        issueType: 'grouping' as const,
        acceptableIssueTypes: [] as const,
        severity: 'warning' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: 'buildup, threshold, result 영역은 구분되지만 세 buildup 단계의 축적감과 threshold 전후의 의미 차이가 충분히 응집되지 않는다.',
      }, {
        issueType: 'typography-hierarchy' as const,
        acceptableIssueTypes: [] as const,
        severity: 'warning' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '작은 보조 라벨과 단계 문구 외에 주장·단계·결과를 구분하는 완성된 타입 체계가 보이지 않는다.',
      }, {
        issueType: 'submission-readiness' as const,
        acceptableIssueTypes: [] as const,
        severity: 'warning' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '내용은 이해되지만 자동 배치 prototype 또는 wireframe 같은 인상이 남아 사람이 시각 마감을 해야 한다.',
      }],
      expectedSubmissionReadiness: 'needs-review' as const,
    },
    {
      fixtureId: 'intermediate-golden-case',
      title: '기존 Golden Case — 중간 품질 기준',
      labelCoverage: 'exhaustive' as const,
      plan: roughPlan,
      tree: roughTree,
      pngSourcePath: 'vertical-slice/break-mechanism/evidence/artifact-render.png',
      expectedFindings: [{
        issueType: 'submission-readiness' as const,
        acceptableIssueTypes: [] as const,
        severity: 'warning' as const,
        target: { kind: 'page' as const, ids: ['page'] },
        humanReason: '현재 이미지는 사용자가 최종 제출 가능한 품질 기준으로 승인하지 않았으므로 ready Positive가 아니라 추가 검토가 필요한 중간 기준이다.',
      }],
      expectedSubmissionReadiness: 'needs-review' as const,
    },
  ];

  return definitions.map((definition) => {
    const hardGate = ensureHardGate({ slide, informationPlan, tree: definition.tree, fixtureId: definition.fixtureId });
    return {
      fixture: fixtureDefinition({
        fixtureId: definition.fixtureId,
        title: definition.title,
        artifactId: definition.fixtureId === 'intermediate-golden-case'
          ? 'render-critic-intermediate-golden-case'
          : definition.tree.renderTreeId,
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
      ...('pngSourcePath' in definition ? { pngSourcePath: definition.pngSourcePath } : {}),
    };
  });
}

export const CRITIC_FIXTURE_PAGE_GOAL = '회피 ×3부터 받는 피해 +50%까지의 순서와 BREAK 전환점을 즉시 이해시키는 것';
