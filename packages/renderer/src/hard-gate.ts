import {
  FindingSchema,
  validateInformationPlan,
  validateRenderTreeAgainstSlide,
  type Finding,
  type InformationPlan,
  type RenderTree,
  type SlideIR,
} from '@game-presentation/contracts';
import { validateLayout } from './layout-validation.js';
import { messagePresentationRecord, resolveMessagePresentation } from './render-contract.js';
import { validateAlignedFeatureFidelity } from './aligned-feature-validation.js';

export type HardGateResult = {
  passed: boolean;
  programFindings: Finding[];
  sourceFidelityFindings: Finding[];
  findings: Finding[];
};

function numberOrUnitTokens(value: string): string[] {
  return value.match(/[+\-±×]?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|초|G|회|개|배|마리|시간|\/초))?/gu) ?? [];
}

function expectedText(input: { text: string; sourceSpanIds: string[]; sourceTransform: { kind: 'exact' } | { kind: 'join'; separator: string } }, slide: SlideIR): string | undefined {
  const spanMap = new Map(slide.source.spans.map((span) => [span.id, span.text]));
  const spans = input.sourceSpanIds.map((id) => spanMap.get(id));
  if (spans.some((span) => span === undefined)) return undefined;
  return input.sourceTransform.kind === 'exact' ? spans[0] : spans.join(input.sourceTransform.separator);
}

function numberAndUnitFindings(tree: RenderTree, slide: SlideIR): Finding[] {
  return tree.nodes.flatMap((node) => {
    if (node.kind !== 'text') return [];
    const expected = expectedText(node, slide);
    if (expected === undefined || expected === node.text) return [];
    const tokens = [...numberOrUnitTokens(expected), ...numberOrUnitTokens(node.text)];
    if (tokens.length === 0) return [];
    return [FindingSchema.parse({
      schemaVersion: '0.1',
      findingId: `number-unit-${node.nodeId}`,
      artifactId: tree.renderTreeId,
      stage: 'contract',
      severity: 'fatal',
      code: 'invented-number',
      nodeIds: [node.nodeId],
      message: '숫자 또는 단위가 원문과 일치하지 않습니다.',
      evidence: { expected, actual: node.text, tokens },
    })];
  });
}

function informationPlanFindings(tree: RenderTree, plan: InformationPlan, slide: SlideIR): Finding[] {
  return validateInformationPlan(plan, slide).map((issue, index) => {
    const code = issue.path.includes('relation')
      ? 'missing-relation'
      : issue.path.includes('message')
        ? 'untraceable-content'
        : 'missing-block';
    return FindingSchema.parse({
      schemaVersion: '0.1',
      findingId: `information-plan-${index}-${issue.path.replaceAll('.', '-')}`,
      artifactId: tree.renderTreeId,
      stage: 'contract',
      severity: 'fatal',
      code,
      nodeIds: [],
      message: issue.message,
      evidence: { path: issue.path },
    });
  });
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** 새 layout family의 message가 표시 또는 억제 중 정확히 한 방식으로 처리됐는지 검사한다. */
export function validateMessagePresentationHardGate(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  tree: RenderTree;
}): Finding[] {
  if (input.tree.layoutFamily !== 'accumulation-threshold-consequence') return [];
  const findings: Finding[] = [];
  const add = (suffix: string, message: string, nodeIds: string[], evidence: Record<string, unknown>): void => {
    findings.push(FindingSchema.parse({
      schemaVersion: '0.1',
      findingId: `message-presentation-${suffix}`,
      artifactId: input.tree.renderTreeId,
      stage: 'contract',
      severity: 'fatal',
      code: 'untraceable-content',
      nodeIds,
      message,
      evidence,
    }));
  };
  const expected = resolveMessagePresentation({
    message: input.informationPlan.message,
    slide: input.slide,
  });
  const expectedRecord = messagePresentationRecord(expected);
  if (!sameJson(input.tree.messagePresentation, expectedRecord)) {
    add('record', 'RenderTree의 message presentation 기록이 deterministic resolver 결과와 다릅니다.', [], {
      expected: expectedRecord,
      actual: input.tree.messagePresentation,
    });
  }
  const messageNodes = input.tree.nodes.filter(
    (node): node is Extract<RenderTree['nodes'][number], { kind: 'text' }> =>
      node.kind === 'text' && node.visualRole === 'message-context',
  );
  if (expected.presentationKind === 'suppressed-duplicate') {
    if (messageNodes.length > 0) {
      add(
        'suppressed-text-present',
        '완전 중복 message는 text node로 표시할 수 없습니다.',
        messageNodes.map((node) => node.nodeId),
        { presentationKind: expected.presentationKind },
      );
    }
    return findings;
  }

  if (messageNodes.length !== 1) {
    add(
      'node-count',
      'headline/context message는 정확히 하나의 text node로 표시해야 합니다.',
      messageNodes.map((node) => node.nodeId),
      { expectedCount: 1, actualCount: messageNodes.length },
    );
    return findings;
  }
  const node = messageNodes[0]!;
  if (
    node.text !== input.informationPlan.message.text ||
    !sameJson(node.sourceSpanIds, input.informationPlan.message.sourceSpanIds) ||
    !sameJson(node.sourceTransform, input.informationPlan.message.transform)
  ) {
    add('source', 'message text와 source trace가 InformationPlan.message와 다릅니다.', [node.nodeId], {
      expectedText: input.informationPlan.message.text,
      actualText: node.text,
      expectedSourceSpanIds: input.informationPlan.message.sourceSpanIds,
      actualSourceSpanIds: node.sourceSpanIds,
    });
  }
  if (
    node.compositionRegionId !== 'message-context' ||
    node.visualRole !== 'message-context' ||
    node.sourceUsage !== expected.sourceUsage ||
    !node.visible
  ) {
    add('metadata', 'message text node의 region, visual role, source usage 또는 visibility가 계약과 다릅니다.', [node.nodeId], {
      compositionRegionId: node.compositionRegionId,
      visualRole: node.visualRole,
      expectedSourceUsage: expected.sourceUsage,
      actualSourceUsage: node.sourceUsage,
      visible: node.visible,
    });
  }
  return findings;
}

/** 프로그램이 확정적으로 판단할 수 있는 배치 오류 검사. */
export function validateProgramHardGate(tree: RenderTree, slide: SlideIR): Finding[] {
  const contractFindings = validateRenderTreeAgainstSlide(tree, slide)
    .filter((finding) => finding.code === 'out-of-bounds');
  const layoutFindings = validateLayout(tree)
    .filter((finding) => finding.code === 'text-overflow' || finding.code === 'collision');
  return [...contractFindings, ...layoutFindings];
}

/** 원문·숫자·단위·관계·필수 내용의 보존 검사. */
export function validateSourceFidelityHardGate(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  tree: RenderTree;
}): Finding[] {
  const treeFindings = validateRenderTreeAgainstSlide(input.tree, input.slide)
    .filter((finding) => finding.code !== 'out-of-bounds');
  return [
    ...informationPlanFindings(input.tree, input.informationPlan, input.slide),
    ...validateMessagePresentationHardGate(input),
    ...validateAlignedFeatureFidelity(input),
    ...treeFindings,
    ...numberAndUnitFindings(input.tree, input.slide),
  ];
}

/** Hard Gate 하나라도 실패하면 다음 Critic 단계로 넘어갈 수 없다. */
export function runHardGate(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  tree: RenderTree;
}): HardGateResult {
  const programFindings = validateProgramHardGate(input.tree, input.slide);
  const sourceFidelityFindings = validateSourceFidelityHardGate(input);
  const findings = [...programFindings, ...sourceFidelityFindings];
  return {
    passed: findings.length === 0,
    programFindings,
    sourceFidelityFindings,
    findings,
  };
}
