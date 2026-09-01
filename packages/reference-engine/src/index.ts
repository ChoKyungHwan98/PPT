import { createHash } from 'node:crypto';
import {
  corpusSnapshotHash,
  retrieveReferences,
  type ReferenceRecord,
  type ReferenceRetrievalBrief,
} from '@game-presentation/contracts';

export type ReferenceIndexEntry = {
  referenceId: string;
  vector: number[];
};

export type ReferenceIndex = {
  schemaVersion: '0.1';
  corpusSnapshotHash: string;
  dimensions: number;
  entries: ReferenceIndexEntry[];
};

function referenceTokens(record: ReferenceRecord): string[] {
  return [
    ...record.analysis.intentTags.map((value) => 'intent:' + value),
    ...record.analysis.semanticShapes.map((value) => 'semantic:' + value),
    ...record.analysis.relationshipShapes.map((value) => 'relation:' + value),
    ...record.analysis.primaryArtifacts.map((value) => 'artifact:' + value),
    'density:' + record.analysis.densityBand,
    ...record.analysis.readingPaths.map((value) => 'reading:' + value),
    ...record.analysis.graphicLanguages.map((value) => 'graphic:' + value),
  ];
}

function briefTokens(brief: ReferenceRetrievalBrief): string[] {
  return [
    'intent:' + brief.intent,
    'semantic:' + brief.semanticShape,
    ...brief.relationshipShape.map((value) => 'relation:' + value),
    'artifact:' + brief.primaryArtifact,
    'density:' + brief.densityBand,
    ...brief.readingPathCandidates.map((value) => 'reading:' + value),
  ];
}

function featureVector(tokens: string[], dimensions: number): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (const token of tokens) {
    const hash = createHash('sha256').update(token, 'utf8').digest();
    const index = hash.readUInt32BE(0) % dimensions;
    const sign = hash[4]! % 2 === 0 ? 1 : -1;
    vector[index] = (vector[index] ?? 0) + sign;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude === 0 ? vector : vector.map((value) => value / magnitude);
}

function cosine(left: number[], right: number[]): number {
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

export function buildReferenceIndex(
  records: ReferenceRecord[],
  dimensions = 256,
): ReferenceIndex {
  if (dimensions < 32) throw new Error('reference index dimensions must be at least 32.');
  return {
    schemaVersion: '0.1',
    corpusSnapshotHash: corpusSnapshotHash(records),
    dimensions,
    entries: [...records]
      .filter((record) => record.allowedUse.analyze && record.allowedUse.deriveAbstractPattern)
      .sort((left, right) => left.referenceId.localeCompare(right.referenceId))
      .map((record) => ({
        referenceId: record.referenceId,
        vector: featureVector(referenceTokens(record), dimensions),
      })),
  };
}

export type ReferenceSearchResult = {
  referenceId: string;
  score: number;
  semanticScore: number;
  exactRuleScore: number;
  matched: string[];
};

export function searchReferenceIndex(input: {
  brief: ReferenceRetrievalBrief;
  corpus: ReferenceRecord[];
  index: ReferenceIndex;
  limit: number;
}): ReferenceSearchResult[] {
  if (input.index.corpusSnapshotHash !== input.brief.corpusSnapshotHash) {
    throw new Error('retrieval brief와 reference index의 corpus snapshot이 다릅니다.');
  }
  if (input.limit <= 0) return [];
  const query = featureVector(briefTokens(input.brief), input.index.dimensions);
  const exact = new Map(
    retrieveReferences(input.brief, input.corpus).map((result) => [result.referenceId, result]),
  );
  return input.index.entries
    .map((entry) => {
      const semanticScore = Math.max(-1, Math.min(1, cosine(query, entry.vector)));
      const exactMatch = exact.get(entry.referenceId);
      const exactRuleScore = Math.min(1, (exactMatch?.score ?? 0) / 16);
      const score = semanticScore * 0.65 + exactRuleScore * 0.35;
      return {
        referenceId: entry.referenceId,
        score: Math.round(score * 10000) / 10000,
        semanticScore: Math.round(semanticScore * 10000) / 10000,
        exactRuleScore: Math.round(exactRuleScore * 10000) / 10000,
        matched: exactMatch?.matched ?? [],
      };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.referenceId.localeCompare(right.referenceId))
    .slice(0, input.limit);
}
