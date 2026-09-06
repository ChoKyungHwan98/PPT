import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PreferenceEvidenceEvent } from '@game-presentation/contracts';
import { PreferenceEvidenceStore, buildDesignProfile, exportPairwisePreferenceDataset, promotePreferencePatterns } from '../src/index.js';

function event(index: number, pattern = 'pattern-a'): PreferenceEvidenceEvent {
  return {
    schemaVersion: '0.1', eventId: `event-${index}`, artifactId: `artifact-${index}`, comparisonId: `comparison-${index}`,
    candidateIds: ['candidate-a', 'candidate-b', 'candidate-c'], decision: 'choose-A', selectedCandidateId: 'candidate-a', selectedCandidateHash: 'a'.repeat(64), semanticShape: 'comparison', mode: 'presentation', chosenPatternId: pattern,
    density: 'balanced', designSignature: { candidateId: 'candidate-a', referenceClusterIds: ['teacher-1'], topologyFamily: 'aligned-before-after-spec', readingPath: 'before-after', featureTags: ['balanced'] },
    reasonTags: ['clearer-pairing'], approved: true, projectId: 'project-1', domain: 'combat', occurredAt: `2026-09-0${index}T00:00:00.000Z`,
    separation: { teacherQualityChanged: false, readyQualityChanged: false, criticFindingsChanged: false },
  };
}

describe('R6 preference evidence and promotion', () => {
  it('keeps immutable events and rejects duplicate event ids', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'preference-evidence-'));
    try {
      const store = new PreferenceEvidenceStore(root);
      await store.append(event(1));
      await expect(store.append(event(1))).rejects.toThrow(/이미/u);
      expect(await store.load()).toEqual([event(1)]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('does not establish a pattern before five sufficiently consistent observations', () => {
    expect(promotePreferencePatterns([event(1)])[0]?.strength).toBe('weak');
    expect(promotePreferencePatterns([event(1), event(2), event(3)])[0]?.strength).toBe('emerging');
    const established = promotePreferencePatterns([event(1), event(2), event(3), event(4), event(5)]);
    expect(established[0]).toMatchObject({ strength: 'established', confidence: 1, evidenceCount: 5 });
    expect(buildDesignProfile(established, '2026-09-06T00:00:00.000Z')).toMatchObject({
      preferredPatternIds: ['pattern-a'], boundaries: { hardGateOverride: false, sourceFidelityOverride: false, teacherQualityOverride: false },
    });
  });

  it('exports one chosen-vs-rejected training pair per unchosen candidate without altering events', () => {
    const source = event(1);
    const dataset = exportPairwisePreferenceDataset([source]);
    expect(dataset).toHaveLength(2);
    expect(dataset.every((record) => record.chosenCandidateId === 'candidate-a')).toBe(true);
    expect(source.candidateIds).toEqual(['candidate-a', 'candidate-b', 'candidate-c']);
  });
});
