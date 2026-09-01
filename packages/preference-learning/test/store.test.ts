import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PairwisePreferenceRecordSchema,
  preferenceContextHash,
  type CandidateSignature,
  type PreferenceContext,
} from '@game-presentation/contracts';
import { VersionedPreferenceStore } from '../src/store.js';

const context: PreferenceContext = {
  intent: 'mechanism',
  semanticShape: 'causal-chain',
  relationshipShape: ['produces', 'enables', 'transitions-to', 'causes'],
  primaryArtifact: 'mechanism-flow',
  audience: 'game-design-reviewer',
  outputProfile: 'pdf-presentation',
};

const candidateA: CandidateSignature = {
  candidateId: 'candidate-a',
  referenceClusterIds: ['cluster-a'],
  topologyFamily: 'editorial-spine',
  readingPath: 'left-to-right',
  featureTags: ['quiet'],
};

const candidateB: CandidateSignature = {
  candidateId: 'candidate-b',
  referenceClusterIds: ['cluster-b'],
  topologyFamily: 'threshold-field',
  readingPath: 'center-out',
  featureTags: ['focus'],
};

function preference(preferenceId = 'preference-1') {
  return PairwisePreferenceRecordSchema.parse({
    schemaVersion: '0.1',
    preferenceId,
    contextHash: preferenceContextHash(context),
    context,
    candidateA,
    candidateB,
    winner: 'B',
    reasons: ['break-focus-is-clearer'],
    createdAt: '2026-08-29T01:00:00.000Z',
  });
}

describe('versioned preference store', () => {
  it('stores immutable records and rebuilds the same contextual state', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'game-presentation-preferences-'));
    const store = new VersionedPreferenceStore(directory);
    const saved = await store.append(preference());
    const loaded = await store.loadLatest();
    expect(loaded).toEqual(saved.snapshot);
    expect(loaded.state.observationCount).toBe(1);
    expect(loaded.state.contextualWeights[preferenceContextHash(context)]).toBeDefined();
  });

  it('does not silently apply the same decision twice', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'game-presentation-preferences-'));
    const store = new VersionedPreferenceStore(directory);
    await store.append(preference());
    await expect(store.append(preference())).rejects.toThrow('이미 저장된 선택 기록');
  });
});
