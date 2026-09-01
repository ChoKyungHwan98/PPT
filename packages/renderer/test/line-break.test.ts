import { describe, expect, it } from 'vitest';
import { breakKoreanLines } from '../src/line-break.js';

const fixedMeasure = (text: string): number => [...text].length * 10;

describe('Korean line breaking', () => {
  it('wraps Korean phrases deterministically', () => {
    const lines = breakKoreanLines({
      text: '시간 파편을 획득하면 시간이 정지됩니다',
      maxWidth: 100,
      measure: fixedMeasure,
    });
    expect(lines.map((line) => line.text)).toEqual(['시간 파편을', '획득하면 시간이', '정지됩니다']);
    expect(lines.every((line) => line.width <= 100)).toBe(true);
  });

  it('does not begin a line with closing punctuation', () => {
    const lines = breakKoreanLines({
      text: '시간 정지(5초), BREAK',
      maxWidth: 70,
      measure: fixedMeasure,
    });
    expect(lines.some((line) => /^[,)]/u.test(line.text))).toBe(false);
  });

  it('respects authored hard breaks', () => {
    const lines = breakKoreanLines({
      text: '시간 파편\nBREAK',
      maxWidth: 200,
      measure: fixedMeasure,
    });
    expect(lines.map((line) => line.text)).toEqual(['시간 파편', 'BREAK']);
  });
});
