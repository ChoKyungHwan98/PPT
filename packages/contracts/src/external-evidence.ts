import { z } from 'zod';

const TableColumnEvidenceSchema = z.strictObject({
  columnId: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().optional(),
  description: z.string().optional(),
  dataType: z.string().min(1),
  nullable: z.boolean(),
});

export const GameDataEvidenceSchema = z
  .strictObject({
    schemaVersion: z.literal('0.1'),
    evidenceId: z.string().min(1),
    sourceTool: z.literal('table-designer'),
    artifactId: z.string().min(1),
    kind: z.literal('data-table'),
    title: z.string().min(1),
    summary: z.string().optional(),
    revision: z.union([z.string().min(1), z.number().int().nonnegative()]),
    fingerprint: z.string().min(1),
    capturedAt: z.iso.datetime(),
    data: z.strictObject({
      projectId: z.string().min(1),
      projectName: z.string().min(1),
      tableId: z.string().min(1),
      name: z.string().min(1),
      displayName: z.string().optional(),
      description: z.string().optional(),
      columns: z.array(TableColumnEvidenceSchema).min(1),
      rows: z.array(z.record(z.string(), z.unknown())).max(20),
    }),
    permissions: z.strictObject({
      localRender: z.literal(true),
      remoteAI: z.literal('blocked-until-explicit-approval'),
    }),
  })
  .superRefine((evidence, context) => {
    if (evidence.artifactId !== evidence.data.tableId) {
      context.addIssue({ code: 'custom', path: ['data', 'tableId'], message: '발행 artifact와 table ID가 다릅니다.' });
    }
    const columnIds = new Set<string>();
    for (const [index, column] of evidence.data.columns.entries()) {
      if (columnIds.has(column.columnId)) {
        context.addIssue({ code: 'custom', path: ['data', 'columns', index, 'columnId'], message: '열 ID가 중복됩니다.' });
      }
      columnIds.add(column.columnId);
    }
    for (const [rowIndex, row] of evidence.data.rows.entries()) {
      for (const key of Object.keys(row)) {
        if (!columnIds.has(key)) {
          context.addIssue({ code: 'custom', path: ['data', 'rows', rowIndex, key], message: '알 수 없는 열 ID의 값입니다.' });
        }
      }
    }
  });

export type GameDataEvidence = z.infer<typeof GameDataEvidenceSchema>;
