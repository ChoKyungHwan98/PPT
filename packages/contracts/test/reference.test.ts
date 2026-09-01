import { describe, expect, it } from 'vitest';
import { FakeReferenceAdapter } from '../src/reference-adapter.js';
import {
  ReferenceRecordSchema,
  buildReferenceRetrievalBrief,
  corpusSnapshotHash,
  retrieveReferences,
} from '../src/reference.js';
import { SEED_REFERENCE_CORPUS } from '../src/seed-corpus.js';
import { MEC_01_SLIDE_IR } from '../fixtures/mec-01.js';

describe('reference provenance and retrieval', () => {
  it('validates every seed reference and produces a stable snapshot', () => {
    SEED_REFERENCE_CORPUS.forEach((record) => expect(ReferenceRecordSchema.parse(record)).toEqual(record));
    expect(corpusSnapshotHash(SEED_REFERENCE_CORPUS)).toBe(
      corpusSnapshotHash([...SEED_REFERENCE_CORPUS].reverse()),
    );
  });

  it('blocks asset reuse when rights are unknown', () => {
    const unsafe = structuredClone(SEED_REFERENCE_CORPUS[0]!);
    unsafe.referenceId = 'unsafe';
    unsafe.rights = { status: 'unknown' };
    unsafe.allowedUse.reuseAsset = true;
    expect(ReferenceRecordSchema.safeParse(unsafe).success).toBe(false);
  });

  it('builds the same brief from the same source and corpus', () => {
    const input = {
      slide: MEC_01_SLIDE_IR,
      corpus: SEED_REFERENCE_CORPUS,
      semanticShape: 'causal-chain',
      primaryArtifact: 'mechanism-flow',
      densityBand: 'balanced' as const,
      readingPathCandidates: ['guided-sequence' as const, 'left-to-right' as const],
      audience: 'game-design-reviewer',
      outputProfile: 'pdf-document' as const,
      avoidSignatures: ['card-dashboard'],
    };
    const first = buildReferenceRetrievalBrief(input);
    const second = buildReferenceRetrievalBrief(input);
    expect(second).toEqual(first);
    expect(retrieveReferences(first, SEED_REFERENCE_CORPUS)[0]?.referenceId).toBe('ref-oh-my-ppt-layout');
  });

  it('paginates through the fake adapter contract', async () => {
    const adapter = new FakeReferenceAdapter(SEED_REFERENCE_CORPUS);
    const first = await adapter.discover({ limit: 2 });
    if (first.nextCursor === undefined) throw new Error('fixture pagination error');
    const second = await adapter.discover({ limit: 2, cursor: first.nextCursor });
    expect(first.records).toHaveLength(2);
    expect(second.records).toHaveLength(2);
    expect(second.nextCursor).toBeUndefined();
  });
});
