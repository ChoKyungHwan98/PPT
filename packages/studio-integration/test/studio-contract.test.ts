import { describe, expect, it } from 'vitest';
import { DesignEvaluationEventSchema, StudioDesignInputSchema } from '@game-presentation/contracts';
import { buildCritiqueDataset, parseAuthoredComparison, parseAuthoredHierarchy } from '../src/index.js';

describe('Studio designer integration contracts', () => {
  it('parses authored before/after pairs without changing source text', () => {
    const parsed = parseAuthoredComparison('제목: 보상 구조 개선\n기존 보상 구조:\n- 상자 1개\n- 고정 보상\n개선 보상 구조:\n- 상자 2개\n- 선택 보상\n메시지: 목표에 맞는 보상을 선택한다');
    expect(parsed.pairs).toHaveLength(2);
    expect(parsed.segments.map((segment) => segment.text)).toContain('상자 1개');
    expect(parsed.segments.map((segment) => segment.text)).toContain('상자 2개');
  });

  it('uses indentation as explicit hierarchy instead of game words', () => {
    const parsed = parseAuthoredHierarchy('제목: 역할 구조\n메시지: 책임을 분리한다\n구조:\n상위\n  중간 A\n    하위 A\n  중간 B');
    expect(parsed.nodes.map((node) => node.parentSegmentId ?? null)).toEqual([null, 'node-1', 'node-2', 'node-1']);
  });

  it('keeps quality, preference and teacher state separated in evaluation data', () => {
    const event = DesignEvaluationEventSchema.parse({ schemaVersion: '0.1', eventId: 'e1', artifactId: 'a1', png: { path: 'a.png', sha256: 'a'.repeat(64) }, authoredContentHash: 'b'.repeat(64), semanticShape: 'hierarchy', selectedTeacherIds: ['teacher-3'], appliedGuidanceIds: ['guidance-3'], critic: null, userDecision: 'reject', reasonTags: ['space-use'], decidedAt: '2026-09-05T00:00:00.000Z', separation: { teacherQualityChanged: false, readyQualityRecorded: true, preferenceRecorded: false } });
    expect(buildCritiqueDataset([event])[0]?.human.decision).toBe('reject');
    expect(event.separation.teacherQualityChanged).toBe(false);
  });

  it('validates the public input contract', () => {
    expect(StudioDesignInputSchema.parse({ schemaVersion: '0.1', projectId: 'p', documentId: 'd', mode: 'document', authoredContent: 'text', authoredStructure: 'hierarchy', outputProfile: 'screen-16:9' }).projectId).toBe('p');
  });
});
