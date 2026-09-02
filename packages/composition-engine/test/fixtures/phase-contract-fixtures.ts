import {
  InformationPlanSchema,
  SlideIRSchema,
  buildSourceLedger,
  type ContentRef,
  type InformationPlan,
  type SlideIR,
} from '@game-presentation/contracts';

const createdAt = '2026-09-02T00:00:00.000Z';

function exact(text: string, sourceSpanId: string): ContentRef {
  return { text, sourceSpanIds: [sourceSpanId], locked: true, transform: { kind: 'exact' } };
}

function causalFixture(input: {
  fixtureId: string;
  accumulation: string[];
  threshold: string;
  consequence: string[];
  metricConsequence?: {
    consequenceIndex: number;
    label: string;
    value: string;
    unit?: string;
  };
}): { slide: SlideIR; informationPlan: InformationPlan } {
  const texts = [...input.accumulation, input.threshold, ...input.consequence];
  const blockIds = texts.map((_, index) => `${input.fixtureId}-block-${index + 1}`);
  const spanIds = texts.map((_, index) => `${input.fixtureId}-span-${index + 1}`);
  const rawText = texts.join(' → ');
  const thresholdIndex = input.accumulation.length;
  const thresholdBlockId = blockIds[thresholdIndex]!;
  const source = buildSourceLedger({
    ledgerId: `ledger-${input.fixtureId}`,
    rawText,
    createdAt,
    segments: [
      { id: `${input.fixtureId}-source-all`, text: rawText },
      ...texts.map((text, index) => ({ id: spanIds[index]!, text })),
      ...(input.metricConsequence === undefined ? [] : [
        { id: `${input.fixtureId}-metric-label`, text: input.metricConsequence.label },
        { id: `${input.fixtureId}-metric-value`, text: input.metricConsequence.value },
        ...(input.metricConsequence.unit === undefined
          ? []
          : [{ id: `${input.fixtureId}-metric-unit`, text: input.metricConsequence.unit }]),
      ]),
    ],
  });
  const slide = SlideIRSchema.parse({
    schemaVersion: '0.1',
    slideId: `slide-${input.fixtureId}`,
    locale: 'ko-KR',
    pagePreference: { mode: 'auto', preferredProfile: 'screen-16:9' },
    source,
    intent: {
      kind: 'mechanism',
      communicationGoal: exact(rawText, `${input.fixtureId}-source-all`),
      primaryMessage: exact(rawText, `${input.fixtureId}-source-all`),
      primaryFocusBlockId: thresholdBlockId,
    },
    domain: { topic: '일반 상태 전환 검증', facets: ['validation'] },
    blocks: texts.map((text, index) => {
      const common = {
        id: blockIds[index]!,
        importance: index === thresholdIndex ? 5 as const : 3 as const,
        sourceSpanIds: [spanIds[index]!],
        order: index,
        keepTogether: true,
      };
      if (index === thresholdIndex) {
        return { ...common, kind: 'state' as const, role: 'primary' as const, name: exact(text, spanIds[index]!) };
      }
      const consequenceIndex = index - thresholdIndex - 1;
      if (
        input.metricConsequence !== undefined &&
        consequenceIndex === input.metricConsequence.consequenceIndex
      ) {
        return {
          ...common,
          kind: 'metric' as const,
          role: 'modifier' as const,
          label: exact(input.metricConsequence.label, `${input.fixtureId}-metric-label`),
          value: exact(input.metricConsequence.value, `${input.fixtureId}-metric-value`),
          ...(input.metricConsequence.unit === undefined
            ? {}
            : { unit: exact(input.metricConsequence.unit, `${input.fixtureId}-metric-unit`) }),
        };
      }
      return {
        ...common,
        kind: 'mechanic-step' as const,
        role: index < thresholdIndex ? (index === 0 ? 'trigger' as const : 'process' as const) : 'result' as const,
        label: exact(text, spanIds[index]!),
      };
    }),
    relations: blockIds.slice(0, -1).map((blockId, index) => ({
      id: `${input.fixtureId}-relation-${index + 1}`,
      fromBlockId: blockId,
      toBlockId: blockIds[index + 1]!,
      type: index < thresholdIndex - 1
        ? 'sequence' as const
        : index === thresholdIndex - 1
          ? 'transitions-to' as const
          : index === thresholdIndex
            ? 'causes' as const
            : 'sequence' as const,
      sourceSpanIds: [spanIds[index]!, spanIds[index + 1]!],
    })),
    assetNeeds: [],
    constraints: {
      maxSlideCount: 1,
      primaryOutput: 'pdf',
      selectableTextRequired: true,
      editablePptxRequired: false,
      contentPolicy: 'verbatim',
      numberPolicy: 'source-only',
      preserveOrder: true,
      lockedSpanIds: spanIds,
    },
    interpretation: { author: 'deterministic-parser', confidence: 1, ambiguities: [] },
  });
  const relationIds = slide.relations.map((relation) => relation.id);
  const informationPlan = InformationPlanSchema.parse({
    schemaVersion: '0.1',
    informationPlanId: `information-${input.fixtureId}`,
    slideId: slide.slideId,
    semanticShape: 'causal-chain',
    grammarId: 'generic-accumulation-threshold-consequence-test',
    message: slide.intent.primaryMessage,
    primaryArtifactBlockId: thresholdBlockId,
    readingOrder: blockIds,
    groups: [
      {
        groupId: `${input.fixtureId}-accumulation`,
        role: 'setup',
        order: 0,
        blockIds: blockIds.slice(0, thresholdIndex),
      },
      {
        groupId: `${input.fixtureId}-threshold`,
        role: 'transition',
        order: 1,
        blockIds: [thresholdBlockId],
      },
      {
        groupId: `${input.fixtureId}-consequence`,
        role: 'consequence',
        order: 2,
        blockIds: blockIds.slice(thresholdIndex + 1),
      },
    ],
    relationIds,
    interpretation: { author: 'deterministic-planner', confidence: 1, ambiguityIds: [] },
  });
  return { slide, informationPlan };
}

export const SHORT_ACCUMULATION_FIXTURE = causalFixture({
  fixtureId: 'generic-short',
  accumulation: ['준비 행동', '자원 활성화'],
  threshold: '상태 전환',
  consequence: ['결과 적용'],
});

export const LONG_ACCUMULATION_FIXTURE = causalFixture({
  fixtureId: 'generic-long',
  accumulation: ['입력 확인', '조건 충족', '자원 축적', '효과 준비'],
  threshold: '상태 경계',
  consequence: ['결과 적용', '추가 효과 유지'],
});

export const WRAPPED_ACCUMULATION_FIXTURE = causalFixture({
  fixtureId: 'generic-wrapped',
  accumulation: ['입력 확인', '조건 확인', '자원 준비', '대상 지정', '효과 대기', '실행 준비'],
  threshold: '상태 경계',
  consequence: ['결과 적용'],
});

export const METRIC_CONSEQUENCE_FIXTURE = causalFixture({
  fixtureId: 'generic-metric-result',
  accumulation: ['준비 행동', '자원 활성화'],
  threshold: '상태 전환',
  consequence: ['받는 영향 +25%'],
  metricConsequence: {
    consequenceIndex: 0,
    label: '받는 영향',
    value: '+25%',
  },
});

export const BEFORE_AFTER_NEGATIVE_FIXTURE = (() => {
  const fixtureId = 'generic-before-after';
  const rawText = '기존 방식 ↔ 변경 방식';
  const source = buildSourceLedger({
    ledgerId: `ledger-${fixtureId}`,
    rawText,
    createdAt,
    segments: [
      { id: `${fixtureId}-source-all`, text: rawText },
      { id: `${fixtureId}-before`, text: '기존 방식' },
      { id: `${fixtureId}-after`, text: '변경 방식' },
    ],
  });
  const slide = SlideIRSchema.parse({
    schemaVersion: '0.1',
    slideId: `slide-${fixtureId}`,
    locale: 'ko-KR',
    pagePreference: { mode: 'auto', preferredProfile: 'screen-16:9' },
    source,
    intent: {
      kind: 'comparison',
      communicationGoal: exact(rawText, `${fixtureId}-source-all`),
      primaryMessage: exact(rawText, `${fixtureId}-source-all`),
      primaryFocusBlockId: `${fixtureId}-after-block`,
    },
    domain: { topic: '일반 전후 비교 검증', facets: ['validation'] },
    blocks: [
      {
        id: `${fixtureId}-before-block`, kind: 'mechanic-step', role: 'context', importance: 3,
        sourceSpanIds: [`${fixtureId}-before`], order: 0, keepTogether: true,
        label: exact('기존 방식', `${fixtureId}-before`),
      },
      {
        id: `${fixtureId}-after-block`, kind: 'mechanic-step', role: 'result', importance: 4,
        sourceSpanIds: [`${fixtureId}-after`], order: 1, keepTogether: true,
        label: exact('변경 방식', `${fixtureId}-after`),
      },
    ],
    relations: [{
      id: `${fixtureId}-comparison`,
      fromBlockId: `${fixtureId}-before-block`,
      toBlockId: `${fixtureId}-after-block`,
      type: 'compares-with',
      sourceSpanIds: [`${fixtureId}-before`, `${fixtureId}-after`],
    }],
    assetNeeds: [],
    constraints: {
      maxSlideCount: 1,
      primaryOutput: 'pdf',
      selectableTextRequired: true,
      editablePptxRequired: false,
      contentPolicy: 'verbatim',
      numberPolicy: 'source-only',
      preserveOrder: true,
      lockedSpanIds: [`${fixtureId}-before`, `${fixtureId}-after`],
    },
    interpretation: { author: 'deterministic-parser', confidence: 1, ambiguities: [] },
  });
  const informationPlan = InformationPlanSchema.parse({
    schemaVersion: '0.1',
    informationPlanId: `information-${fixtureId}`,
    slideId: slide.slideId,
    semanticShape: 'comparison',
    grammarId: 'generic-before-after-test',
    message: slide.intent.primaryMessage,
    primaryArtifactBlockId: `${fixtureId}-after-block`,
    readingOrder: slide.blocks.map((block) => block.id),
    groups: [
      { groupId: `${fixtureId}-before-group`, role: 'context', order: 0, blockIds: [`${fixtureId}-before-block`] },
      { groupId: `${fixtureId}-after-group`, role: 'evidence', order: 1, blockIds: [`${fixtureId}-after-block`] },
    ],
    relationIds: slide.relations.map((relation) => relation.id),
    interpretation: { author: 'deterministic-planner', confidence: 1, ambiguityIds: [] },
  });
  return { slide, informationPlan };
})();
