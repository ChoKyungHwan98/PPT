import { describe, expect, it } from 'vitest';
import { GameDataEvidenceSchema } from '../src/external-evidence.js';

const valid = {
  schemaVersion: '0.1',
  evidenceId: 'table-designer:combat-rule:7',
  sourceTool: 'table-designer',
  artifactId: 'combat-rule',
  kind: 'data-table',
  title: '전투 규칙',
  summary: '5개 열 · 2개 행',
  revision: 7,
  fingerprint: '7:5:2',
  capturedAt: '2026-08-29T03:00:00.000Z',
  data: {
    projectId: 'project-1', projectName: '전투 기획', tableId: 'combat-rule', name: 'CombatRule',
    columns: [
      { columnId: 'trigger', name: 'trigger', dataType: 'string', nullable: false },
      { columnId: 'value', name: 'value', dataType: 'number', nullable: false },
    ],
    rows: [{ trigger: 'BREAK', value: 50 }],
  },
  permissions: { localRender: true, remoteAI: 'blocked-until-explicit-approval' },
} as const;

describe('table designer evidence boundary', () => {
  it('keeps immutable IDs and blocks remote AI by default', () => {
    const parsed = GameDataEvidenceSchema.parse(valid);
    expect(parsed.data.columns.map((column) => column.columnId)).toEqual(['trigger', 'value']);
    expect(parsed.permissions.remoteAI).toBe('blocked-until-explicit-approval');
  });

  it('rejects row values that cannot be traced to a published column ID', () => {
    const invalid = structuredClone(valid) as Record<string, unknown>;
    const data = invalid.data as { rows: Record<string, unknown>[] };
    data.rows = [{ inventedColumn: 100 }];
    expect(GameDataEvidenceSchema.safeParse(invalid).success).toBe(false);
  });
});
