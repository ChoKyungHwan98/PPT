import { describe, expect, it } from 'vitest';
import {
  InformationPlanSchema,
  SlideIRSchema,
  validateInformationPlan,
} from '@game-presentation/contracts';
import { MEC_01_RAW_SOURCE, MEC_01_SLIDE_IR } from '../../contracts/fixtures/mec-01.js';
import { createMec01InformationPlan, interpretMec01Source } from '../src/mec-01-semantic.js';

const createdAt = '2026-08-29T00:00:00.000Z';

function mec01Slide() {
  return interpretMec01Source({ rawText: MEC_01_RAW_SOURCE, createdAt });
}

describe('MEC-01 deterministic semantic interpretation', () => {
  it('creates the existing SlideIR fixture without adding a SemanticIR model', () => {
    const slide = mec01Slide();

    expect(slide).toEqual(MEC_01_SLIDE_IR);
    expect(SlideIRSchema.parse(slide)).toEqual(slide);
  });

  it('preserves every authored source segment, number, and unit', () => {
    const slide = mec01Slide();
    const spans = new Map(slide.source.spans.map((span) => [span.id, span.text]));

    expect(slide.source.rawText).toBe(MEC_01_RAW_SOURCE);
    expect(spans.get('dodge')).toBe('회피 ×3');
    expect(spans.get('freeze')).toBe('시간 정지 5초');
    expect(spans.get('damage-value')).toBe('+50%');
    expect(slide.blocks.map((block) => block.order)).toEqual([0, 1, 2, 3, 4]);
    expect(slide.relations.map((relation) => relation.type)).toEqual([
      'produces',
      'enables',
      'transitions-to',
      'causes',
    ]);
  });

  it('fails closed when the fixed fixture text, number, unit, or order changes', () => {
    expect(() => interpretMec01Source({ rawText: MEC_01_RAW_SOURCE.replace('5초', '6초'), createdAt })).toThrow();
    expect(() => interpretMec01Source({ rawText: MEC_01_RAW_SOURCE.replace('+50%', '+60%'), createdAt })).toThrow();
    expect(() => interpretMec01Source({ rawText: '회피 ×3 → 시간 정지 5초 → 시간 파편 획득 → BREAK → 받는 피해 +50%', createdAt })).toThrow();
  });
});

describe('MEC-01 Information Plan', () => {
  it('keeps explanation structure separate from visual composition', () => {
    const plan = createMec01InformationPlan(mec01Slide());

    expect(InformationPlanSchema.parse(plan)).toEqual(plan);
    expect(plan.semanticShape).toBe('causal-chain');
    expect(plan.readingOrder).toEqual([
      'dodge-step',
      'fragment-resource',
      'freeze-step',
      'break-state',
      'damage-modifier',
    ]);
    expect(plan.groups.map((group) => group.role)).toEqual(['setup', 'transition', 'consequence']);
    expect(plan).not.toHaveProperty('regions');
    expect(plan).not.toHaveProperty('styleIntent');
    expect(plan).not.toHaveProperty('pageProfile');
  });

  it('preserves the authored relationship chain and source-backed message', () => {
    const slide = mec01Slide();
    const plan = createMec01InformationPlan(slide);

    expect(plan.relationIds).toEqual(slide.relations.map((relation) => relation.id));
    expect(plan.message.text).toBe(MEC_01_RAW_SOURCE);
    expect(validateInformationPlan(plan, slide)).toEqual([]);
  });

  it('rejects omitted relations, altered source text, and changed reading order', () => {
    const slide = mec01Slide();
    const plan = createMec01InformationPlan(slide);

    const missingRelation = structuredClone(plan);
    missingRelation.relationIds = missingRelation.relationIds.slice(0, -1);
    expect(validateInformationPlan(missingRelation, slide).some((issue) => issue.path === 'relationIds')).toBe(true);

    const alteredMessage = structuredClone(plan);
    alteredMessage.message.text = MEC_01_RAW_SOURCE.replace('5초', '6초');
    expect(validateInformationPlan(alteredMessage, slide).some((issue) => issue.path === 'message')).toBe(true);

    const changedOrder = structuredClone(plan);
    [changedOrder.readingOrder[1], changedOrder.readingOrder[2]] = [changedOrder.readingOrder[2]!, changedOrder.readingOrder[1]!];
    expect(validateInformationPlan(changedOrder, slide).some((issue) => issue.path === 'readingOrder')).toBe(true);
  });
});
