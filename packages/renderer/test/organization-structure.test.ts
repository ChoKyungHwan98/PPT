import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SEED_PATTERN_FRAGMENTS, SEED_REFERENCE_CORPUS } from '@game-presentation/contracts';
import { createCompositionPlanFromInformationPlan } from '@game-presentation/composition-engine';
import {
  buildTeacherDesignGuidance,
  externalOrganizationReferenceRecords,
  loadExternalMasterReferenceSet,
  loadExternalMasterTeacherPageSet,
  retrieveReferencesForInformationPlan,
  selectCuratedTeachersForInformationPlan,
} from '@game-presentation/reference-engine';
import {
  interpretAuthoredHierarchy,
  type AuthoredHierarchy,
} from '../../source-ingestion/src/authored-hierarchy.js';
import type { FontAsset } from '../src/font.js';
import { runHardGate } from '../src/hard-gate.js';
import { buildInformationRenderTree, informationMeasureRequests } from '../src/information-layout.js';
import type { TextMeasurement } from '../src/measure.js';

const referenceDir = fileURLToPath(new URL('../../reference-engine/references/external-master-2025-v1/', import.meta.url));
const referenceSet = await loadExternalMasterReferenceSet(referenceDir);
const teachers = (await loadExternalMasterTeacherPageSet(referenceDir)).pages;
const corpus = [...SEED_REFERENCE_CORPUS, ...externalOrganizationReferenceRecords(referenceSet, referenceDir)];
const source = JSON.parse(await readFile(
  new URL('../../source-ingestion/fixtures/combat-system-organization.source.json', import.meta.url),
  'utf8',
)) as AuthoredHierarchy;
const fonts: FontAsset[] = [400, 700, 800].map((weight) => ({
  family: 'Pretendard',
  weight,
  path: `fixture-${weight}.ttf`,
  bytes: new Uint8Array(),
  fileHash: String(weight).padStart(64, '0'),
  dataUrl: 'data:font/ttf;base64,',
}));

function measurements(requests: ReturnType<typeof informationMeasureRequests>): Map<string, TextMeasurement> {
  return new Map(requests.map((request) => [request.key, {
    ...request,
    width: Math.max(request.size, request.text.length * request.size * 0.62),
    actualBoundingBoxAscent: request.size * 0.78,
    actualBoundingBoxDescent: request.size * 0.22,
  }]));
}

function prepare() {
  const { slide, informationPlan } = interpretAuthoredHierarchy(source);
  const retrieval = retrieveReferencesForInformationPlan({
    slide,
    informationPlan,
    corpus,
    audience: 'game-design-reviewer',
    outputProfile: 'pdf-presentation',
    limit: 4,
  });
  const selection = selectCuratedTeachersForInformationPlan({ slide, informationPlan, teachers, limit: 3 });
  const resolution = buildTeacherDesignGuidance({ slide, informationPlan, selection, teachers });
  if (resolution.status !== 'ready') throw new Error(resolution.reason);
  const plan = createCompositionPlanFromInformationPlan({
    slide,
    informationPlan,
    retrieval,
    fragments: SEED_PATTERN_FRAGMENTS,
    teacherGuidance: resolution.guidance,
  });
  const measures = measurements(informationMeasureRequests({ slide, informationPlan, plan }));
  return { slide, informationPlan, plan, measures };
}

describe('Organization single targeted revision', () => {
  it('tightens title/body spacing without changing source or hierarchy relations', () => {
    const prepared = prepare();
    const baseline = buildInformationRenderTree({ ...prepared, fonts });
    const revised = buildInformationRenderTree({
      ...prepared,
      fonts,
      organizationPresentationRevision: 'critic-revision-1',
    });
    const node = (tree: typeof baseline, id: string) => {
      const found = tree.nodes.find((candidate) => candidate.nodeId === id);
      if (found === undefined) throw new Error(`missing test node: ${id}`);
      return found;
    };
    const baselineMessage = node(baseline, 'text-block-message-0');
    const revisedMessage = node(revised, 'text-block-message-0');
    const baselineBody = node(baseline, 'region-organization-body');
    const revisedBody = node(revised, 'region-organization-body');
    expect(revisedMessage.box.y).toBeLessThan(baselineMessage.box.y);
    expect(revisedBody.box.y).toBeLessThan(baselineBody.box.y);
    expect(revisedBody.box.height).toBeGreaterThan(baselineBody.box.height);
    expect(revised.deterministicFingerprint).not.toBe(baseline.deterministicFingerprint);
    expect(revised.nodes.filter((item) => item.kind === 'text').map((item) => item.text))
      .toEqual(baseline.nodes.filter((item) => item.kind === 'text').map((item) => item.text));
    expect(revised.nodes.flatMap((item) => item.relationId === undefined ? [] : [item.relationId]).sort())
      .toEqual(baseline.nodes.flatMap((item) => item.relationId === undefined ? [] : [item.relationId]).sort());
    expect(runHardGate({
      slide: prepared.slide,
      informationPlan: prepared.informationPlan,
      tree: revised,
    })).toMatchObject({ passed: true, programFindings: [], sourceFidelityFindings: [] });
  });
});
