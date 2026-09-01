import { createHash } from 'node:crypto';
import {
  VisualCritiqueReportSchema,
  contentHash,
  type AIProvider,
  type InformationPlan,
  type ProviderRunRecord,
  type SemanticBlock,
  type SlideIR,
  type VisualCriticFixture,
  type VisualCriticFinding,
  type VisualCritiqueReport,
} from '@game-presentation/contracts';
import type { HardGateResult } from './hard-gate.js';

export const VISUAL_CRITIC_RUBRIC = [
  { id: 'hierarchy', question: '핵심 정보와 보조 정보의 위계가 분명한가?' },
  { id: 'first-fixation', question: '첫 시선이 메시지의 핵심으로 향하는가?' },
  { id: 'reading-order', question: '의도한 읽는 순서를 바로 따라갈 수 있는가?' },
  { id: 'grouping', question: '관련 정보가 하나의 덩어리로 이해되는가?' },
  { id: 'space-use', question: '여백이 정보 이해를 돕고 화면이 비거나 답답하지 않은가?' },
  { id: 'density', question: '정보가 지나치게 빽빽하거나 성기지 않은가?' },
  { id: 'typography-hierarchy', question: '글자 크기·굵기·정렬이 역할 차이를 보여주는가?' },
  { id: 'relation-clarity', question: '원인·전환·결과 관계가 선명한가?' },
  { id: 'decorative-interference', question: '장식이 정보보다 강하게 보이지 않는가?' },
  { id: 'submission-readiness', question: '실제 제출물에 넣을 수 있는 완성도인가?' },
] as const;

const SYSTEM_INSTRUCTION = `당신은 게임 기획서의 실제 렌더 화면만 검수하는 Visual Critic이다.
주어진 PNG를 반드시 직접 보고, 함께 제공된 작은 의미 요약과 설명 구조는 의도 확인에만 사용한다.
Hard Gate는 이미 통과했다. 원문, 숫자, 단위, 관계를 고치거나 새 내용을 쓰지 않는다.
각 finding은 화면에서 확인되는 구체적인 문제, 그 이유, 내용 변경 없이 가능한 시각 수정 방향을 적는다.
"예쁘게 만든다", "개선한다" 같은 추상적인 조언은 금지한다.
문제가 제출을 막을 정도가 아니면 severity를 과장하지 않는다. 제출 가능한 정상 결과라면 findings를 비워도 된다.
target에는 제공된 block/group ID를 우선 사용하고, 특정할 수 없으면 kind=page, ids=["page"]를 사용한다.`;

function blockTexts(block: SemanticBlock): string[] {
  switch (block.kind) {
    case 'heading':
    case 'paragraph': return [block.text.text];
    case 'bullet-group': return block.items.map((item) => item.text);
    case 'metric': return [block.label.text, block.value.text, ...(block.unit === undefined ? [] : [block.unit.text])];
    case 'key-value': return [block.key.text, block.value.text];
    case 'table': return [...block.columns, ...block.rows.flat()].map((item) => item.text);
    case 'mechanic-step': return [block.label.text, ...(block.detail === undefined ? [] : [block.detail.text])];
    case 'state': return [block.name.text, ...(block.description === undefined ? [] : [block.description.text])];
    case 'timeline-event': return [block.label.text, ...(block.time === undefined ? [] : [block.time.text])];
    case 'boss-phase': return [block.label.text, block.threshold.text, ...block.behaviors.map((item) => item.text)];
    case 'resource-node': return [block.label.text, ...(block.amount === undefined ? [] : [block.amount.text])];
    case 'hierarchy-node': return [block.label.text];
    case 'ui-region': return [block.regionLabel.text, block.explanation.text];
    case 'exception': return [block.condition.text, block.outcome.text];
    case 'test-criterion': return [block.criterion.text, ...(block.target === undefined ? [] : [block.target.text])];
  }
}

function semanticSummary(slide: SlideIR) {
  return {
    slideId: slide.slideId,
    blocks: slide.blocks.map((block) => ({
      id: block.id,
      kind: block.kind,
      role: block.role,
      importance: block.importance,
      text: blockTexts(block),
    })),
    relations: slide.relations.map((relation) => ({
      id: relation.id,
      from: relation.fromBlockId,
      to: relation.toBlockId,
      type: relation.type,
    })),
  };
}

function informationStructure(plan: InformationPlan) {
  return {
    informationPlanId: plan.informationPlanId,
    semanticShape: plan.semanticShape,
    primaryArtifactBlockId: plan.primaryArtifactBlockId,
    readingOrder: plan.readingOrder,
    groups: plan.groups.map((group) => ({
      id: group.groupId,
      role: group.role,
      order: group.order,
      blockIds: group.blockIds,
    })),
    relationIds: plan.relationIds,
  };
}

export type VisualCriticInputTrace = {
  requestId: string;
  artifactId: string;
  imageSha256: string;
  imageBytes: number;
  compactContextBytes: number;
  contextBudgetBytes: number;
  contextArtifactIds: string[];
  includedFields: string[];
};

export type VisualCriticRun = {
  report: VisualCritiqueReport;
  run: ProviderRunRecord;
  inputTrace: VisualCriticInputTrace;
  guardrailIssues: string[];
};

const VisualCritiqueModelOutputSchema = VisualCritiqueReportSchema.omit({ schemaVersion: true });

export function criticGuardrailIssues(report: VisualCritiqueReport): string[] {
  const issues: string[] = [];
  if (report.sourceChangeSuggested) issues.push('Critic이 원문 변경을 제안한다고 표시했습니다.');
  const forbidden = [
    /원문.{0,8}(바꾸|변경|수정|삭제|추가)/u,
    /(문구|문장|카피|내용).{0,8}(바꾸|변경|수정|삭제|추가)/u,
    /(수치|숫자|단위).{0,8}(바꾸|변경|수정|삭제|추가)/u,
  ];
  const generic = [/예쁘게/u, /더 좋게/u, /전반적으로 개선/u];
  for (const finding of report.findings) {
    if (forbidden.some((pattern) => pattern.test(finding.revisionDirection))) {
      issues.push(`${finding.findingId}: 원문 또는 수치 변경 제안`);
    }
    if (generic.some((pattern) => pattern.test(finding.revisionDirection))) {
      issues.push(`${finding.findingId}: 구체적이지 않은 수정 제안`);
    }
  }
  return issues;
}

export async function runVisualCritic(input: {
  provider: AIProvider;
  pngBytes: Uint8Array;
  artifactId: string;
  goal: string;
  slide: SlideIR;
  informationPlan: InformationPlan;
  hardGate: HardGateResult;
  contextBudgetBytes?: number;
}): Promise<VisualCriticRun> {
  if (!input.hardGate.passed) {
    throw new Error('Hard Gate FAIL 결과는 Visual Critic으로 보낼 수 없습니다.');
  }
  const capabilities = await input.provider.capabilities();
  if (!capabilities.vision || !capabilities.structuredOutput) {
    throw new Error('선택한 provider는 vision과 structured output을 모두 지원해야 합니다.');
  }

  const compactState = {
    artifactId: input.artifactId,
    pageGoal: input.goal,
    semanticSummary: semanticSummary(input.slide),
    informationPlan: informationStructure(input.informationPlan),
    rubric: VISUAL_CRITIC_RUBRIC,
    hardGate: {
      status: 'passed',
      programFindingCount: 0,
      sourceFidelityFindingCount: 0,
    },
  };
  const imageSha256 = createHash('sha256').update(input.pngBytes).digest('hex');
  const requestId = `visual-critic-${contentHash({
    artifactId: input.artifactId,
    imageSha256,
    compactState,
    model: input.provider.model,
  }).slice(0, 20)}`;
  const contextArtifactIds = [
    input.slide.slideId,
    input.informationPlan.informationPlanId,
    input.artifactId,
    `png:${imageSha256}`,
  ];
  const compactContextBytes = Buffer.byteLength(JSON.stringify(compactState), 'utf8');
  const contextBudgetBytes = input.contextBudgetBytes ?? 5_000_000;
  const result = await input.provider.generateStructured(
    {
      requestId,
      task: 'visual-critique',
      contextHash: contentHash({ compactState, imageSha256 }),
      systemInstruction: SYSTEM_INSTRUCTION,
      compactState,
      imageEvidence: { mimeType: 'image/png', bytes: input.pngBytes },
      contextArtifactIds,
      contextBudgetBytes,
      maxOutputTokens: 2_000,
    },
    VisualCritiqueModelOutputSchema,
  );
  const report = VisualCritiqueReportSchema.parse({ schemaVersion: '0.1', ...result.value });
  if (report.artifactId !== input.artifactId) {
    throw new Error('Critic 응답이 다른 artifact를 가리킵니다.');
  }
  return {
    report,
    run: result.run,
    inputTrace: {
      requestId,
      artifactId: input.artifactId,
      imageSha256,
      imageBytes: input.pngBytes.byteLength,
      compactContextBytes,
      contextBudgetBytes,
      contextArtifactIds,
      includedFields: ['actual PNG', 'page goal', 'semantic summary', 'InformationPlan core', 'rubric', 'Hard Gate PASS'],
    },
    guardrailIssues: criticGuardrailIssues(report),
  };
}

function issueMatches(expected: VisualCriticFixture['expectedFindings'][number], actual: VisualCriticFinding): boolean {
  const allowedTypes = new Set([expected.issueType, ...expected.acceptableIssueTypes]);
  if (!allowedTypes.has(actual.issueType)) return false;
  if (expected.target.kind === 'page' || actual.target.kind === 'page') return true;
  return expected.target.ids.some((id) => actual.target.ids.includes(id));
}

function specificSuggestion(finding: VisualCriticFinding): boolean {
  if (finding.revisionDirection.length < 18) return false;
  if (/예쁘게|더 좋게|전반적으로 개선/u.test(finding.revisionDirection)) return false;
  return /(크기|굵기|간격|정렬|위치|이동|축소|확대|분리|묶|대비|선|여백|영역|순서|연결|강조|스케일|가로형|세로형|외곽선)/u.test(
    finding.revisionDirection,
  );
}

export type CriticBenchmarkResult = {
  fixtureId: string;
  expectedCount: number;
  actualActionableCount: number;
  matchedExpectedCount: number;
  problemRecall: number | null;
  unmatchedActionableCount: number;
  falsePositiveCount: number | null;
  falsePositiveRate: number | null;
  severityExactCount: number;
  severityAppropriateCount: number;
  specificSuggestionCount: number;
  normalFixturePassed: boolean | null;
  guardrailIssues: string[];
  matches: Array<{
    expectedIssueType: string;
    actualFindingId: string | null;
    severityExact: boolean;
    suggestionSpecific: boolean;
  }>;
};

export function benchmarkCriticReport(
  fixture: VisualCriticFixture,
  report: VisualCritiqueReport,
): CriticBenchmarkResult {
  const actionable = report.findings.filter((finding) => finding.severity !== 'info');
  const consumed = new Set<string>();
  const matches = fixture.expectedFindings.map((expected) => {
    const actual = report.findings.find((candidate) => !consumed.has(candidate.findingId) && issueMatches(expected, candidate));
    if (actual !== undefined) consumed.add(actual.findingId);
    return {
      expectedIssueType: expected.issueType,
      actualFindingId: actual?.findingId ?? null,
      severityExact: actual?.severity === expected.severity,
      suggestionSpecific: actual === undefined ? false : specificSuggestion(actual),
    };
  });
  const unmatchedActionableCount = actionable.filter((finding) => !consumed.has(finding.findingId)).length;
  const falsePositiveCount = fixture.labelCoverage === 'exhaustive' ? unmatchedActionableCount : null;
  const expectedCount = fixture.expectedFindings.length;
  return {
    fixtureId: fixture.fixtureId,
    expectedCount,
    actualActionableCount: actionable.length,
    matchedExpectedCount: matches.filter((match) => match.actualFindingId !== null).length,
    problemRecall: expectedCount === 0 ? null : matches.filter((match) => match.actualFindingId !== null).length / expectedCount,
    unmatchedActionableCount,
    falsePositiveCount,
    falsePositiveRate: falsePositiveCount === null
      ? null
      : actionable.length === 0 ? 0 : falsePositiveCount / actionable.length,
    severityExactCount: matches.filter((match) => match.severityExact).length,
    severityAppropriateCount: matches.filter((match) => {
      if (match.actualFindingId === null) return false;
      const expected = fixture.expectedFindings.find((finding) => finding.issueType === match.expectedIssueType);
      const actual = report.findings.find((finding) => finding.findingId === match.actualFindingId);
      if (expected === undefined || actual === undefined) return false;
      const ranks = { info: 0, warning: 1, error: 2 } as const;
      return Math.abs(ranks[expected.severity] - ranks[actual.severity]) <= 1;
    }).length,
    specificSuggestionCount: matches.filter((match) => match.suggestionSpecific).length,
    normalFixturePassed: expectedCount === 0
      ? actionable.length === 0 && report.submissionReadiness !== 'not-ready'
      : null,
    guardrailIssues: criticGuardrailIssues(report),
    matches,
  };
}
