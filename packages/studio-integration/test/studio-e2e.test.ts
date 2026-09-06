import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { PreferenceEvidenceEvent, StudioDesignOutput } from '@game-presentation/contracts';
import { recordStudioCandidatePreference, runStudioDesignJob } from '../src/design-job.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const source = '제목: 보상 구조 개선\n기존 보상 구조:\n- 보상 상자 1개\n- 주간 보상 고정\n개선 보상 구조:\n- 보상 상자 2개\n- 주간 보상 선택\n메시지: 플레이 목표에 맞는 보상을 선택할 수 있는 보상 구조';

function preference(output: StudioDesignOutput, sequence: number, decision: 'choose-A' | 'reject-all'): PreferenceEvidenceEvent {
  const selected = decision === 'choose-A' ? output.candidates[0]! : null;
  return {
    schemaVersion: '0.1', eventId: `preference-e2e-${sequence}`, artifactId: output.artifactId, comparisonId: output.comparisonId,
    candidateIds: output.candidates.map((candidate) => candidate.candidateId), decision, selectedCandidateId: selected?.candidateId ?? null,
    selectedCandidateHash: selected?.pngSha256 ?? null, semanticShape: output.trace.semanticShape, mode: 'document',
    chosenPatternId: selected?.provenance.patternFragmentIds[0] ?? null, density: 'balanced',
    designSignature: selected === null ? null : {
      candidateId: selected.candidateId,
      referenceClusterIds: selected.provenance.referenceIds.length > 0 ? selected.provenance.referenceIds : output.trace.selectedTeacherIds,
      topologyFamily: selected.provenance.layoutFamily, readingPath: selected.provenance.readingPath,
      featureTags: selected.provenance.patternFragmentIds,
    },
    reasonTags: [], approved: selected !== null, projectId: output.projectId, domain: output.trace.domain,
    occurredAt: `2026-09-06T00:00:0${sequence}.000Z`,
    separation: { teacherQualityChanged: false, readyQualityChanged: false, criticFindingsChanged: false },
  };
}

describe('Studio candidate product flow', () => {
  it('creates real validated PNG candidates and stores choose/reject preference evidence without changing Ready', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'ppt-studio-e2e-'));
    try {
      const job = await runStudioDesignJob({ schemaVersion: '0.1', projectId: 'project-e2e', documentId: 'document-e2e', mode: 'document', authoredContent: source, authoredStructure: 'aligned-before-after-spec', outputProfile: 'screen-16:9' }, { repositoryRoot, publicBaseUrl: 'http://127.0.0.1:8766', outputRoot: root, artifactId: 'slide-1700000000000-e2eproof' });
      expect(job.output.candidates.length).toBeGreaterThanOrEqual(1);
      expect(job.output.candidates.length).toBeLessThanOrEqual(3);
      expect(job.output.candidates.every((candidate) => candidate.validation.hardGatePassed && candidate.validation.programFindingCount === 0 && candidate.validation.sourceFidelityFindingCount === 0)).toBe(true);
      expect(job.output.previewPngUrl).toBe(job.output.candidates[0]!.previewPngUrl);
      expect(new Set(job.output.candidates.map((candidate) => `${candidate.provenance.layoutFamily}:${candidate.provenance.readingPath}`)).size).toBe(job.output.candidates.length);

      const metadata = JSON.parse(await readFile(job.metadataPath, 'utf8')) as { candidates: Array<{ pngPath: string; renderTree: { sourceSlideId: string } }> };
      expect(new Set(metadata.candidates.map((candidate) => candidate.renderTree.sourceSlideId)).size).toBe(1);
      for (const candidate of metadata.candidates) expect((await stat(candidate.pngPath)).size).toBeGreaterThan(0);

      const preferenceRoot = resolve(root, 'preference-memory');
      const first = await recordStudioCandidatePreference({ metadataPath: job.metadataPath, event: preference(job.output, 1, 'choose-A'), preferenceRoot });
      expect(first.patterns[0]?.strength).toBe('weak');
      expect(first.output.readiness).toBe('not-reviewed');
      await recordStudioCandidatePreference({ metadataPath: job.metadataPath, event: preference(job.output, 2, 'choose-A'), preferenceRoot });
      const third = await recordStudioCandidatePreference({ metadataPath: job.metadataPath, event: preference(job.output, 3, 'choose-A'), preferenceRoot });
      expect(third.patterns[0]?.strength).toBe('emerging');
      const rejected = await recordStudioCandidatePreference({ metadataPath: job.metadataPath, event: preference(job.output, 4, 'reject-all'), preferenceRoot });
      expect(rejected.event.selectedCandidateId).toBeNull();
      expect(rejected.output.readiness).toBe('not-reviewed');

      const invalid = preference(job.output, 5, 'choose-A');
      invalid.candidateIds = ['candidate-does-not-exist'];
      await expect(recordStudioCandidatePreference({ metadataPath: job.metadataPath, event: invalid, preferenceRoot })).rejects.toThrow(/candidate/u);
    } finally { await rm(root, { recursive: true, force: true }); }
  }, 120_000);
});
