import { describe, expect, it } from 'vitest';
import { AuthoredDocumentSchema } from '@game-presentation/contracts';
import { buildBalanceStory } from '../src/balance-story.js';

const document = AuthoredDocumentSchema.parse({
  schemaVersion: '0.1',
  documentId: 'doc-test',
  locale: 'ko-KR',
  source: { kind: 'docx', path: 'test.docx', contentHash: 'a'.repeat(64) },
  blocks: [
    { id: 'p-1', kind: 'paragraph', order: 1, text: '게임 -도로시아- 전투 밸런스', styleId: '', styleName: '' },
    { id: 'p-goal', kind: 'paragraph', order: 2, text: '밸런스 설계 목표', styleId: 'Heading2', styleName: 'Heading 2', headingLevel: 2 },
    { id: 't-goal', kind: 'table', order: 3, rows: [
      ['설계축', '목표', '구현 방식'],
      ['속도감', '빠른 일반 몬스터 처치', 'TTK 1.35초 고정'],
      ['성장 만족감', '수치 성장이 눈에 보임', '캐릭터 ×134, 장비 ×76, 승급 ×2.60'],
      ['보스 긴장감', '위협적인 보스', '생존 15 ~ 35 초 범위, 보스 ATK 290'],
    ] },
    { id: 'p-overview', kind: 'paragraph', order: 4, text: '검증 개요', styleId: 'Heading2', styleName: 'Heading 2', headingLevel: 2 },
    { id: 'p-monte', kind: 'paragraph', order: 5, text: 'Monte Carlo 시뮬레이션(N=5,000) 기준 통과율 약 81% — 37개 파라미터를 ±20% 범위에서 무작위 샘플링하였다.', styleId: '', styleName: '' },
    { id: 'p-validation', kind: 'paragraph', order: 6, text: '기본값 계산 결과', styleId: 'Heading2', styleName: 'Heading 2', headingLevel: 2 },
    { id: 't-validation', kind: 'table', order: 7, rows: [
      ['검증 항목', '기준', '결과', '판정'],
      ['장비:캐릭터 비율', '×1.0 ~ ×5.0', '×2.00', 'Pass'],
      ['보스 생존', '15 ~ 35초', '29.6초', 'Pass'],
      ['초반 TTK', '<= 13.5초', '1.32초', 'Pass'],
      ['60일 골드', '>= 5,000,000G', '19,000,000G', 'Pass'],
    ] },
    { id: 'p-tuning', kind: 'paragraph', order: 8, text: '튜닝 이력', styleId: 'Heading2', styleName: 'Heading 2', headingLevel: 2 },
    { id: 't-tuning', kind: 'table', order: 9, rows: [
      ['파라미터', 'Ver10', 'Ver11', 'Ver12', '변경 사유'],
      ['char_base_atk', '200', '280', '280', '초반 DPS 부족 해소'],
      ['equip_base', '70', '110', '180', 'eq:char ×2.0 복원'],
      ['mon_boss_atk', '200', '250', '290', '생존 29.6초 달성'],
    ] },
  ],
  sections: [
    { id: 's-goal', title: '밸런스 설계 목표', level: 2, headingBlockId: 'p-goal', blockIds: ['p-goal', 't-goal'] },
    { id: 's-overview', title: '검증 개요', level: 2, headingBlockId: 'p-overview', blockIds: ['p-overview', 'p-monte'] },
    { id: 's-validation', title: '기본값 계산 결과', level: 2, headingBlockId: 'p-validation', blockIds: ['p-validation', 't-validation'] },
    { id: 's-tuning', title: '튜닝 이력', level: 2, headingBlockId: 'p-tuning', blockIds: ['p-tuning', 't-tuning'] },
  ],
});

describe('balance story planner', () => {
  it('turns target, tuning, and validation evidence into a traceable three-slide plan', () => {
    const result = buildBalanceStory({ document, createdAt: '2026-08-31T00:00:00.000Z' });
    expect(result.plan.projectTitle).toBe('도로시아');
    expect(result.plan.slides.map((slide) => slide.role)).toEqual([
      'goal-definition',
      'tuning-ledger',
      'validation-summary',
    ]);
    const validation = result.plan.slides[2];
    expect(validation?.role).toBe('validation-summary');
    if (validation?.role === 'validation-summary') {
      expect(validation.monteCarlo.runs).toBe('5,000');
      expect(validation.monteCarlo.passRate).toBe('약 81%');
      expect(validation.checks[0]?.result).toBe('×2.00');
    }
    expect(result.inventory.items.some((item) => item.sourceText === '290')).toBe(true);
  });
});
