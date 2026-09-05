import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contentHash, type StudioDesignInput } from '@game-presentation/contracts';
import { interpretAuthoredFeatureComparison, parseAuthoredComparison } from '@game-presentation/source-ingestion';
import { runV1StudioAuthoring } from '../src/index.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('V1 Studio behavior preservation', () => {
  it('keeps the existing fixture semantic artifacts and all output backends through the Harness', { timeout: 60_000 }, async () => {
    const authoredContent = '제목: 보상 구조 개선\n기존 보상 구조:\n- 보상 상자 1개\n- 주간 보상 고정\n개선 보상 구조:\n- 보상 상자 2개\n- 주간 보상 선택\n메시지: 플레이 목표에 맞는 보상을 선택할 수 있는 보상 구조';
    const input: StudioDesignInput = {
      schemaVersion: '0.1', projectId: 'parity-project', documentId: 'parity-document', mode: 'presentation',
      authoredContent, authoredStructure: 'aligned-before-after-spec', outputProfile: 'screen-16:9',
    };
    const previousSemanticPath = interpretAuthoredFeatureComparison(parseAuthoredComparison(authoredContent));
    const temporaryRoot = await mkdtemp(resolve(tmpdir(), 'game-ppt-harness-'));
    try {
      const result = await runV1StudioAuthoring(input, {
        repositoryRoot,
        outputRoot: temporaryRoot,
        publicBaseUrl: 'http://127.0.0.1:8766',
        artifactId: 'slide-1000-parity01',
      });
      const metadata = JSON.parse(await readFile(result.metadataPath, 'utf8')) as Record<string, unknown>;
      expect(contentHash(metadata.slide)).toBe(contentHash(previousSemanticPath.slide));
      expect(contentHash(metadata.informationPlan)).toBe(contentHash(previousSemanticPath.informationPlan));
      expect(result.output.exports.map((item) => item.kind)).toEqual(['png', 'html', 'pdf', 'pptx']);
      expect(result.output.validation).toEqual({ hardGatePassed: true, programFindingCount: 0, sourceFidelityFindingCount: 0 });
      expect(result.trace.renderedPng?.hash).toBe(result.output.trace.pngSha256);
      expect(result.trace.exportArtifacts).toHaveLength(4);
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});
