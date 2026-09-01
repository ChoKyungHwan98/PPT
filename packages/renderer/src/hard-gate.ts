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
