import { describe, expect, it } from 'vitest';
import { MEC_01_LEDGER, MEC_01_RAW_SOURCE, MEC_01_SLIDE_IR } from '../fixtures/mec-01.js';
import { SlideIRSchema } from '../src/slide-ir.js';
import { SourceLedgerSchema } from '../src/source-ledger.js';

describe('MEC-01 source fidelity', () => {
  it('keeps the exact authored mechanism chain', () => {
    expect(MEC_01_LEDGER.rawText).toBe(MEC_01_RAW_SOURCE);
    expect(MEC_01_SLIDE_IR.blocks).toHaveLength(5);
    expect(MEC_01_SLIDE_IR.relations.map((relation) => relation.type)).toEqual([
      'produces',
      'enables',
      'transitions-to',
      'causes',
    ]);
  });

  it('rejects an invented number', () => {
    const changed = structuredClone(MEC_01_SLIDE_IR);
    const freeze = changed.blocks.find((block) => block.id === 'freeze-step');
    if (freeze?.kind !== 'mechanic-step') throw new Error('fixture error');
    freeze.label.text = '시간 정지 6초';
    expect(SlideIRSchema.safeParse(changed).success).toBe(false);
  });

  it('rejects renderer or layout fields inside SlideIR', () => {
    const changed = { ...structuredClone(MEC_01_SLIDE_IR), format: { aspectRatio: '16:9' } };
    expect(SlideIRSchema.safeParse(changed).success).toBe(false);
  });

  it('rejects a changed source span checksum', () => {
    const changed = structuredClone(MEC_01_LEDGER);
    changed.spans[0]!.checksum = '0'.repeat(64);
    expect(SourceLedgerSchema.safeParse(changed).success).toBe(false);
  });

  it('rejects a missing relation endpoint', () => {
    const changed = structuredClone(MEC_01_SLIDE_IR);
    changed.relations[0]!.toBlockId = 'missing-block';
    expect(SlideIRSchema.safeParse(changed).success).toBe(false);
  });
});
