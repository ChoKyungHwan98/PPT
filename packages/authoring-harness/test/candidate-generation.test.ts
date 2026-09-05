import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SEED_REFERENCE_CORPUS, buildReferenceRetrievalBrief } from '@game-presentation/contracts';
import { buildReferenceIndex, searchReferenceIndex } from '@game-presentation/reference-engine';
import { MEC_01_SLIDE_IR } from '../../contracts/fixtures/mec-01.js';
import { createMec01InformationPlan } from '../../source-ingestion/src/mec-01-semantic.js';
import { candidateComparisonFromArtifacts, generateValidatedCandidateArtifacts } from '../src/candidate-generation.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('R5 validated A/B/C generation', () => {
  it('renders up to three structurally distinct, Hard-Gate-passing candidates from the same semantics', { timeout: 90_000 }, async () => {
    const outputRoot = await mkdtemp(resolve(tmpdir(), 'abc-candidates-'));
    const informationPlan = createMec01InformationPlan(MEC_01_SLIDE_IR);
    const brief = buildReferenceRetrievalBrief({
      slide: MEC_01_SLIDE_IR, corpus: SEED_REFERENCE_CORPUS, semanticShape: 'causal-chain', primaryArtifact: 'mechanism-flow', densityBand: 'balanced',
      readingPathCandidates: ['guided-sequence', 'left-to-right', 'center-out'], audience: 'game-design-reviewer', outputProfile: 'pdf-presentation', avoidSignatures: ['card-dashboard'],
    });
    const results = searchReferenceIndex({ brief, corpus: SEED_REFERENCE_CORPUS, index: buildReferenceIndex(SEED_REFERENCE_CORPUS), limit: 6 });
    try {
      const generated = await generateValidatedCandidateArtifacts({ slide: MEC_01_SLIDE_IR, informationPlan, retrieval: { brief, results }, outputRoot, maximumCandidates: 3 });
      expect(generated.accepted).toHaveLength(3);
      expect(new Set(generated.accepted.map((candidate) => candidate.provenance.layoutFamily)).size).toBe(3);
      expect(generated.accepted.every((candidate) => candidate.validation.hardGatePassed)).toBe(true);
      expect(new Set(generated.accepted.map((candidate) => candidate.renderTree.slideId))).toEqual(new Set([MEC_01_SLIDE_IR.slideId]));
      expect(new Set(generated.accepted.map((candidate) => candidate.compositionPlan.informationPlanId))).toEqual(new Set([informationPlan.informationPlanId]));
      const comparison = candidateComparisonFromArtifacts({
        slide: MEC_01_SLIDE_IR,
        context: { intent: brief.intent, semanticShape: brief.semanticShape, relationshipShape: brief.relationshipShape, primaryArtifact: brief.primaryArtifact, audience: brief.audience, outputProfile: brief.outputProfile },
        artifacts: generated.accepted,
        createdAt: '2026-09-06T00:00:00.000Z',
      });
      expect(comparison.mode).toBe('triple');
    } finally { await rm(outputRoot, { recursive: true, force: true }); }
  });
});
