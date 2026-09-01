import { z } from 'zod';
import { sha256Text } from './hash.js';

export const SourceSpanSchema = z.strictObject({
  id: z.string().min(1),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  text: z.string().min(1),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});

export type SourceSpan = z.infer<typeof SourceSpanSchema>;

export const SourceLedgerSchema = z
  .strictObject({
    schemaVersion: z.literal('0.1'),
    ledgerId: z.string().min(1),
    locale: z.literal('ko-KR'),
    kind: z.literal('user-authored'),
    rawText: z.string().min(1),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    spans: z.array(SourceSpanSchema).min(1),
    createdAt: z.iso.datetime(),
  })
  .superRefine((ledger, context) => {
    if (sha256Text(ledger.rawText) !== ledger.contentHash) {
      context.addIssue({ code: 'custom', path: ['contentHash'], message: '원문 해시가 일치하지 않습니다.' });
    }

    const ids = new Set<string>();
    for (const [index, span] of ledger.spans.entries()) {
      if (ids.has(span.id)) {
        context.addIssue({ code: 'custom', path: ['spans', index, 'id'], message: 'span id가 중복됩니다.' });
      }
      ids.add(span.id);

      if (span.start >= span.end || span.end > ledger.rawText.length) {
        context.addIssue({ code: 'custom', path: ['spans', index], message: 'span 범위가 원문을 벗어났습니다.' });
        continue;
      }

      const actual = ledger.rawText.slice(span.start, span.end);
      if (actual !== span.text) {
        context.addIssue({ code: 'custom', path: ['spans', index, 'text'], message: 'span 내용이 원문과 다릅니다.' });
      }
      if (sha256Text(span.text) !== span.checksum) {
        context.addIssue({ code: 'custom', path: ['spans', index, 'checksum'], message: 'span 해시가 일치하지 않습니다.' });
      }
    }
  });

export type SourceLedger = z.infer<typeof SourceLedgerSchema>;

export type SourceSegment = {
  id: string;
  text: string;
  occurrence?: number;
};

function findOccurrence(rawText: string, text: string, occurrence: number): number {
  let from = 0;
  let found = -1;
  for (let index = 0; index <= occurrence; index += 1) {
    found = rawText.indexOf(text, from);
    if (found < 0) return -1;
    from = found + text.length;
  }
  return found;
}

export function buildSourceLedger(input: {
  ledgerId: string;
  rawText: string;
  segments: SourceSegment[];
  createdAt?: string;
}): SourceLedger {
  const spans = input.segments.map((segment) => {
    const start = findOccurrence(input.rawText, segment.text, segment.occurrence ?? 0);
    if (start < 0) {
      throw new Error('원문에서 찾을 수 없는 구절입니다: ' + segment.text);
    }
    return {
      id: segment.id,
      start,
      end: start + segment.text.length,
      text: segment.text,
      checksum: sha256Text(segment.text),
    };
  });

  return SourceLedgerSchema.parse({
    schemaVersion: '0.1',
    ledgerId: input.ledgerId,
    locale: 'ko-KR',
    kind: 'user-authored',
    rawText: input.rawText,
    contentHash: sha256Text(input.rawText),
    spans,
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
}
