import { describe, expect, it } from 'vitest';
import { ingestPublishedTableArtifact } from '../src/table-evidence.js';

const published = {
  artifactId: 'damage-rule',
  kind: 'data-table',
  title: '피해 규칙',
  revision: 12,
  fingerprint: '12:3:1',
  summary: '3개 열 · 1개 행',
  data: {
    projectId: 'project-1', projectName: '전투 시스템', tableId: 'damage-rule', name: 'DamageRule',
    columns: [
      { columnId: 'state-id', name: 'state', displayName: '상태', dataType: 'string', nullable: false },
      { columnId: 'damage-rate-id', name: 'damageRate', displayName: '받는 피해', dataType: 'number', nullable: false },
    ],
    rows: [{ 'state-id': 'BREAK', 'damage-rate-id': 50 }],
  },
};

describe('Studio table artifact ingestion', () => {
  it('converts the existing table-designer publication into local-only evidence', () => {
    const evidence = ingestPublishedTableArtifact({
      record: published,
      capturedAt: '2026-08-29T03:10:00.000Z',
    });
    expect(evidence.sourceTool).toBe('table-designer');
    expect(evidence.data.rows[0]?.['damage-rate-id']).toBe(50);
    expect(evidence.permissions.remoteAI).toBe('blocked-until-explicit-approval');
  });

  it('fails closed when the publisher sends a value under an unknown column ID', () => {
    const invalid: { data: { rows: Array<Record<string, unknown>> } } = structuredClone(published);
    invalid.data.rows = [{ unknown: 50 }];
    expect(() => ingestPublishedTableArtifact({ record: invalid, capturedAt: '2026-08-29T03:10:00.000Z' })).toThrow();
  });
});
