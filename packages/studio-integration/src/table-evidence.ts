import { z } from 'zod';
import {
  GameDataEvidenceSchema,
  contentHash,
  type GameDataEvidence,
} from '@game-presentation/contracts';

const PublishedTableArtifactSchema = z.strictObject({
  artifactId: z.string().min(1),
  kind: z.literal('data-table'),
  title: z.string().min(1),
  revision: z.union([z.string().min(1), z.number().int().nonnegative()]),
  fingerprint: z.string().min(1),
  summary: z.string().optional(),
  data: z.strictObject({
    projectId: z.string().min(1),
    projectName: z.string().min(1),
    tableId: z.string().min(1),
    name: z.string().min(1),
    displayName: z.string().optional(),
    description: z.string().optional(),
    columns: z.array(
      z.strictObject({
        columnId: z.string().min(1),
        name: z.string().min(1),
        displayName: z.string().optional(),
        description: z.string().optional(),
        dataType: z.string().min(1),
        nullable: z.boolean(),
      }),
    ).min(1),
    rows: z.array(z.record(z.string(), z.unknown())).max(20),
  }),
});

export function ingestPublishedTableArtifact(input: {
  record: unknown;
  capturedAt: string;
}): GameDataEvidence {
  const record = PublishedTableArtifactSchema.parse(input.record);
  return GameDataEvidenceSchema.parse({
    schemaVersion: '0.1',
    evidenceId: 'evidence-' + contentHash({
      artifactId: record.artifactId,
      revision: record.revision,
      fingerprint: record.fingerprint,
    }).slice(0, 20),
    sourceTool: 'table-designer',
    artifactId: record.artifactId,
    kind: record.kind,
    title: record.title,
    ...(record.summary === undefined ? {} : { summary: record.summary }),
    revision: record.revision,
    fingerprint: record.fingerprint,
    capturedAt: input.capturedAt,
    data: record.data,
    permissions: {
      localRender: true,
      remoteAI: 'blocked-until-explicit-approval',
    },
  });
}
