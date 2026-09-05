import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { InformationPlan, SlideIR, StudioDesignInput } from '@game-presentation/contracts';
import { runV1StudioAuthoring } from '../src/v1-studio.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const authoredContent = '제목: 보상 구조 개선\n기존 보상 구조:\n- 보상 상자 1개\n- 주간 보상 고정\n개선 보상 구조:\n- 보상 상자 2개\n- 주간 보상 선택\n메시지: 플레이 목표에 맞는 보상을 선택할 수 있는 보상 구조';

describe('R4 production mode split', () => {
  it('creates different information order while both production runs preserve the same source facts and relations', { timeout: 90_000 }, async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'mode-proof-'));
    const base = { schemaVersion: '0.1' as const, projectId: 'mode-project', documentId: 'mode-document', authoredContent, authoredStructure: 'aligned-before-after-spec' as const, outputProfile: 'screen-16:9' as const };
    try {
      const document = await runV1StudioAuthoring({ ...base, mode: 'document' } satisfies StudioDesignInput, { repositoryRoot, outputRoot: root, publicBaseUrl: 'http://localhost', artifactId: 'slide-2000-document' });
      const presentation = await runV1StudioAuthoring({ ...base, mode: 'presentation' } satisfies StudioDesignInput, { repositoryRoot, outputRoot: root, publicBaseUrl: 'http://localhost', artifactId: 'slide-2001-presentation' });
      const documentMetadata = JSON.parse(await readFile(document.metadataPath, 'utf8')) as { slide: SlideIR; informationPlan: InformationPlan };
      const presentationMetadata = JSON.parse(await readFile(presentation.metadataPath, 'utf8')) as { slide: SlideIR; informationPlan: InformationPlan };
      expect(documentMetadata.informationPlan.readingOrder).not.toEqual(presentationMetadata.informationPlan.readingOrder);
      expect(documentMetadata.slide.blocks).toEqual(presentationMetadata.slide.blocks);
      expect(documentMetadata.slide.relations).toEqual(presentationMetadata.slide.relations);
      expect(document.output.validation).toEqual({ hardGatePassed: true, programFindingCount: 0, sourceFidelityFindingCount: 0 });
      expect(presentation.output.validation).toEqual({ hardGatePassed: true, programFindingCount: 0, sourceFidelityFindingCount: 0 });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
