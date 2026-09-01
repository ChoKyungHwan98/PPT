import { buildSourceLedger } from '../src/source-ledger.js';
import { SlideIRSchema, type ContentRef, type SlideIR } from '../src/slide-ir.js';

export const MEC_01_RAW_SOURCE =
  '회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%';

export const MEC_01_LEDGER = buildSourceLedger({
  ledgerId: 'ledger-mec-01',
  rawText: MEC_01_RAW_SOURCE,
  createdAt: '2026-08-29T00:00:00.000Z',
  segments: [
    { id: 'source-all', text: MEC_01_RAW_SOURCE },
    { id: 'dodge', text: '회피 ×3' },
    { id: 'fragment', text: '시간 파편 획득' },
    { id: 'freeze', text: '시간 정지 5초' },
    { id: 'break', text: 'BREAK' },
    { id: 'damage', text: '받는 피해 +50%' },
    { id: 'damage-label', text: '받는 피해' },
    { id: 'damage-value', text: '+50%' },
  ],
});

function exact(text: string, sourceSpanId: string): ContentRef {
  return { text, sourceSpanIds: [sourceSpanId], locked: true, transform: { kind: 'exact' } };
}

export const MEC_01_SLIDE_IR: SlideIR = SlideIRSchema.parse({
  schemaVersion: '0.1',
  slideId: 'mec-01-time-break',
  locale: 'ko-KR',
  pagePreference: {
    mode: 'auto',
    preferredProfile: 'a4-landscape',
  },
  source: MEC_01_LEDGER,
  intent: {
    kind: 'mechanism',
    communicationGoal: exact(MEC_01_RAW_SOURCE, 'source-all'),
    primaryMessage: exact(MEC_01_RAW_SOURCE, 'source-all'),
    primaryFocusBlockId: 'break-state',
  },
  domain: {
    topic: '시간 파편 BREAK 메커니즘',
    facets: ['combat', 'balance'],
  },
  blocks: [
    {
      id: 'dodge-step',
      kind: 'mechanic-step',
      role: 'trigger',
      importance: 3,
      sourceSpanIds: ['dodge'],
      order: 0,
      keepTogether: true,
      label: exact('회피 ×3', 'dodge'),
    },
    {
      id: 'fragment-resource',
      kind: 'resource-node',
      role: 'input',
      importance: 3,
      sourceSpanIds: ['fragment'],
      order: 1,
      keepTogether: true,
      label: exact('시간 파편 획득', 'fragment'),
    },
    {
      id: 'freeze-step',
      kind: 'mechanic-step',
      role: 'process',
      importance: 4,
      sourceSpanIds: ['freeze'],
      order: 2,
      keepTogether: true,
      label: exact('시간 정지 5초', 'freeze'),
    },
    {
      id: 'break-state',
      kind: 'state',
      role: 'primary',
      importance: 5,
      sourceSpanIds: ['break'],
      order: 3,
      keepTogether: true,
      name: exact('BREAK', 'break'),
    },
    {
      id: 'damage-modifier',
      kind: 'metric',
      role: 'modifier',
      importance: 4,
      sourceSpanIds: ['damage'],
      order: 4,
      keepTogether: true,
      label: exact('받는 피해', 'damage-label'),
      value: exact('+50%', 'damage-value'),
    },
  ],
  relations: [
    {
      id: 'r-dodge-fragment',
      fromBlockId: 'dodge-step',
      toBlockId: 'fragment-resource',
      type: 'produces',
      sourceSpanIds: ['dodge', 'fragment'],
    },
    {
      id: 'r-fragment-freeze',
      fromBlockId: 'fragment-resource',
      toBlockId: 'freeze-step',
      type: 'enables',
      sourceSpanIds: ['fragment', 'freeze'],
    },
    {
      id: 'r-freeze-break',
      fromBlockId: 'freeze-step',
      toBlockId: 'break-state',
      type: 'transitions-to',
      sourceSpanIds: ['freeze', 'break'],
    },
    {
      id: 'r-break-damage',
      fromBlockId: 'break-state',
      toBlockId: 'damage-modifier',
      type: 'causes',
      sourceSpanIds: ['break', 'damage'],
    },
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
  interpretation: {
    author: 'deterministic-parser',
    confidence: 1,
    ambiguities: [],
  },
});
