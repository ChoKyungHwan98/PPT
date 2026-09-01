import { z } from 'zod';

export const FindingSchema = z.strictObject({
  schemaVersion: z.literal('0.1'),
  findingId: z.string().min(1),
  artifactId: z.string().min(1),
  stage: z.enum(['contract', 'layout', 'render', 'pdf', 'visual-critic']),
  severity: z.enum(['info', 'warning', 'error', 'fatal']),
  code: z.enum([
    'untraceable-content',
    'missing-source-content',
    'duplicate-content',
    'invented-number',
    'missing-block',
    'missing-relation',
    'out-of-bounds',
    'collision',
    'text-overflow',
    'font-missing',
    'low-contrast',
    'rasterized-page',
    'reference-rights',
    'quality-floor',
  ]),
  nodeIds: z.array(z.string().min(1)),
  message: z.string().min(1),
  evidence: z.record(z.string(), z.unknown()),
  suggestedAction: z.string().min(1).optional(),
});

export type Finding = z.infer<typeof FindingSchema>;

export function hasSevereFindings(findings: Finding[]): boolean {
  return findings.some((finding) => finding.severity === 'error' || finding.severity === 'fatal');
}
