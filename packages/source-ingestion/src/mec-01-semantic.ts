import {
  InformationPlanSchema,
  SlideIRSchema,
  buildSourceLedger,
  type ContentRef,
  type InformationPlan,
  type SlideIR,
} from '@game-presentation/contracts';

const EXPECTED_STEPS = [
  '회피 ×3',
  '시간 파편 획득',
  '시간 정지 5초',
  'BREAK',
  '받는 피해 +50%',
] as const;

function exact(text: string, sourceSpanId: string): ContentRef {
  return { text, sourceSpanIds: [sourceSpanId], locked: true, transform: { kind: 'exact' } };
}

function assertMec01Source(rawText: string): void {
  const steps = rawText.split('→').map((step) => step.trim());
  if (steps.length !== EXPECTED_STEPS.length || steps.some((step, index) => step !== EXPECTED_STEPS[index])) {
    throw new Error('MEC-01 기준 fixture의 원문·숫자·단위·순서가 달라졌습니다.');
  }
}

/**
 * V1의 고정 MEC-01 원문을 기존 SlideIR(Semantic IR 역할)로 구조화한다.
 * 별도의 SemanticIR 모델을 만들지 않으며, 원문에 없는 문장이나 수치를 만들지 않는다.
 */
export function interpretMec01Source(input: {
  rawText: string;
  slideId?: string;
  ledgerId?: string;
  createdAt?: string;
}): SlideIR {
  assertMec01Source(input.rawText);
  const ledger = buildSourceLedger({
    ledgerId: input.ledgerId ?? 'ledger-mec-01',
    rawText: input.rawText,
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
    segments: [
      { id: 'source-all', text: input.rawText },
      { id: 'dodge', text: '회피 ×3' },
      { id: 'fragment', text: '시간 파편 획득' },
      { id: 'freeze', text: '시간 정지 5초' },
      { id: 'break', text: 'BREAK' },
      { id: 'damage', text: '받는 피해 +50%' },
      { id: 'damage-label', text: '받는 피해' },
      { id: 'damage-value', text: '+50%' },
    ],
  });

  return SlideIRSchema.parse({
    schemaVersion: '0.1',
    slideId: input.slideId ?? 'mec-01-time-break',
    locale: 'ko-KR',
    pagePreference: { mode: 'auto', preferredProfile: 'a4-landscape' },
    source: ledger,
    intent: {
      kind: 'mechanism',
      communicationGoal: exact(input.rawText, 'source-all'),
      primaryMessage: exact(input.rawText, 'source-all'),
      primaryFocusBlockId: 'break-state',
    },
    domain: { topic: '시간 파편 BREAK 메커니즘', facets: ['combat', 'balance'] },
    blocks: [
      {
        id: 'dodge-step', kind: 'mechanic-step', role: 'trigger', importance: 3,
        sourceSpanIds: ['dodge'], order: 0, keepTogether: true, label: exact('회피 ×3', 'dodge'),
      },
      {
        id: 'fragment-resource', kind: 'resource-node', role: 'input', importance: 3,
        sourceSpanIds: ['fragment'], order: 1, keepTogether: true, label: exact('시간 파편 획득', 'fragment'),
      },
      {
        id: 'freeze-step', kind: 'mechanic-step', role: 'process', importance: 4,
        sourceSpanIds: ['freeze'], order: 2, keepTogether: true, label: exact('시간 정지 5초', 'freeze'),
      },
      {
        id: 'break-state', kind: 'state', role: 'primary', importance: 5,
        sourceSpanIds: ['break'], order: 3, keepTogether: true, name: exact('BREAK', 'break'),
      },
      {
        id: 'damage-modifier', kind: 'metric', role: 'modifier', importance: 4,
        sourceSpanIds: ['damage'], order: 4, keepTogether: true,
        label: exact('받는 피해', 'damage-label'), value: exact('+50%', 'damage-value'),
      },
    ],
    relations: [
      { id: 'r-dodge-fragment', fromBlockId: 'dodge-step', toBlockId: 'fragment-resource', type: 'produces', sourceSpanIds: ['dodge', 'fragment'] },
      { id: 'r-fragment-freeze', fromBlockId: 'fragment-resource', toBlockId: 'freeze-step', type: 'enables', sourceSpanIds: ['fragment', 'freeze'] },
      { id: 'r-freeze-break', fromBlockId: 'freeze-step', toBlockId: 'break-state', type: 'transitions-to', sourceSpanIds: ['freeze', 'break'] },
      { id: 'r-break-damage', fromBlockId: 'break-state', toBlockId: 'damage-modifier', type: 'causes', sourceSpanIds: ['break', 'damage'] },
    ],
    assetNeeds: [],
    constraints: {
      maxSlideCount: 1,
      primaryOutput: 'pdf',
      selectableTextRequired: true,
      editablePptxRequired: false,
      contentPolicy: 'verbatim',
      numberPolicy: 'source-only',
      preserveOrder: true,
      lockedSpanIds: ['dodge', 'fragment', 'freeze', 'break', 'damage'],
    },
    interpretation: { author: 'deterministic-parser', confidence: 1, ambiguities: [] },
  });
}

/**
 * MEC-01의 설명 구조만 정한다. 색상, 좌표, 영역, 글꼴 같은 화면 배치 정보는 포함하지 않는다.
 */
export function createMec01InformationPlan(slide: SlideIR): InformationPlan {
  if (slide.intent.kind !== 'mechanism' || slide.intent.primaryFocusBlockId !== 'break-state') {
    throw new Error('MEC-01 Information Plan에는 MEC-01 mechanism SlideIR이 필요합니다.');
  }
  const requiredBlockIds = ['dodge-step', 'fragment-resource', 'freeze-step', 'break-state', 'damage-modifier'];
  const requiredRelationIds = ['r-dodge-fragment', 'r-fragment-freeze', 'r-freeze-break', 'r-break-damage'];
  const blockIds = new Set(slide.blocks.map((block) => block.id));
  const relationIds = new Set(slide.relations.map((relation) => relation.id));
  if (requiredBlockIds.some((id) => !blockIds.has(id)) || requiredRelationIds.some((id) => !relationIds.has(id))) {
    throw new Error('MEC-01 SlideIR의 필수 원문 block 또는 관계가 빠졌습니다.');
  }

  return InformationPlanSchema.parse({
    schemaVersion: '0.1',
    informationPlanId: `information-${slide.slideId}`,
    slideId: slide.slideId,
    semanticShape: 'causal-chain',
    grammarId: 'mechanism-causal-chain-v1',
    message: slide.intent.primaryMessage,
    primaryArtifactBlockId: 'break-state',
    readingOrder: requiredBlockIds,
    groups: [
      { groupId: 'accumulation', role: 'setup', order: 0, blockIds: ['dodge-step', 'fragment-resource', 'freeze-step'] },
      { groupId: 'break-transition', role: 'transition', order: 1, blockIds: ['break-state'] },
      { groupId: 'damage-consequence', role: 'consequence', order: 2, blockIds: ['damage-modifier'] },
    ],
    relationIds: requiredRelationIds,
    interpretation: { author: 'deterministic-planner', confidence: 1, ambiguityIds: [] },
  });
}
