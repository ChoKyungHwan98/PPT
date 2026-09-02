import { describe, expect, it } from 'vitest';
import {
  SEED_PATTERN_FRAGMENTS,
  SEED_REFERENCE_CORPUS,
  InformationPlanSchema,
  SlideIRSchema,
  buildSourceLedger,
  type ContentRef,
  type InformationPlan,
  type SlideIR,
} from '@game-presentation/contracts';
import { createCompositionPlanFromInformationPlan } from '@game-presentation/composition-engine';
import { retrieveReferencesForInformationPlan } from '@game-presentation/reference-engine';
import {
  LONG_ACCUMULATION_FIXTURE,
  METRIC_CONSEQUENCE_FIXTURE,
  SHORT_ACCUMULATION_FIXTURE,
  WRAPPED_ACCUMULATION_FIXTURE,
} from '../../composition-engine/test/fixtures/phase-contract-fixtures.js';
import {
  classifyRelationVisualRole,
  resolveMessagePresentation,
} from '../src/render-contract.js';
import { buildInformationRenderTree, informationMeasureRequests } from '../src/information-layout.js';
import { runHardGate } from '../src/hard-gate.js';
import type { FontAsset } from '../src/font.js';
import type { TextMeasurement } from '../src/measure.js';

const createdAt = '2026-09-02T00:00:00.000Z';

function exact(text: string, sourceSpanId: string): ContentRef {
  return { text, sourceSpanIds: [sourceSpanId], locked: true, transform: { kind: 'exact' } };
}

function messageFixture(input: {
  fixtureId: string;
  rawText: string;
  messageText: string;
  messageSpanId: string;
  messageUsesSourceAll?: boolean;
  blockTexts: string[];
}): { slide: SlideIR; informationPlan: InformationPlan; message: ContentRef } {
  const blockSpanIds = input.blockTexts.map((_, index) => `${input.fixtureId}-block-span-${index + 1}`);
  const blockIds = input.blockTexts.map((_, index) => `${input.fixtureId}-block-${index + 1}`);
  const source = buildSourceLedger({
    ledgerId: `ledger-${input.fixtureId}`,
    rawText: input.rawText,
    createdAt,
    segments: [
      { id: `${input.fixtureId}-source-all`, text: input.rawText },
      ...(input.messageUsesSourceAll ? [] : [{ id: input.messageSpanId, text: input.messageText }]),
      ...input.blockTexts.map((text, index) => ({ id: blockSpanIds[index]!, text })),
    ],
  });
  const resolvedMessageSpanId = input.messageUsesSourceAll
    ? `${input.fixtureId}-source-all`
    : input.messageSpanId;
  const message = exact(input.messageText, resolvedMessageSpanId);
  const slide = SlideIRSchema.parse({
    schemaVersion: '0.1',
    slideId: `slide-${input.fixtureId}`,
    locale: 'ko-KR',
    pagePreference: { mode: 'auto', preferredProfile: 'screen-16:9' },
    source,
    intent: {
      kind: 'mechanism',
      communicationGoal: message,
      primaryMessage: message,
      primaryFocusBlockId: blockIds[1],
    },
    domain: { topic: '일반 message 분류 검증', facets: ['validation'] },
    blocks: input.blockTexts.map((text, index) => {
      const common = {
        id: blockIds[index]!,
        importance: index === 1 ? 5 as const : 3 as const,
        sourceSpanIds: [blockSpanIds[index]!],
        order: index,
        keepTogether: true,
      };
      return index === 1
        ? { ...common, kind: 'state' as const, role: 'primary' as const, name: exact(text, blockSpanIds[index]!) }
        : {
            ...common,
            kind: 'mechanic-step' as const,
            role: index === 0 ? 'trigger' as const : 'result' as const,
            label: exact(text, blockSpanIds[index]!),
          };
    }),
    relations: blockIds.slice(0, -1).map((blockId, index) => ({
      id: `${input.fixtureId}-relation-${index + 1}`,
      fromBlockId: blockId,
      toBlockId: blockIds[index + 1]!,
      type: index === 0 ? 'transitions-to' as const : 'causes' as const,
      sourceSpanIds: [blockSpanIds[index]!, blockSpanIds[index + 1]!],
    })),
    assetNeeds: [],
    constraints: {
      maxSlideCount: 1,
      primaryOutput: 'pdf',
      selectableTextRequired: true,
      editablePptxRequired: false,
      contentPolicy: 'verbatim',
      numberPolicy: 'source-only',
      preserveOrder: true,
      lockedSpanIds: blockSpanIds,
    },
    interpretation: { author: 'deterministic-parser', confidence: 1, ambiguities: [] },
  });
  const informationPlan = InformationPlanSchema.parse({
    schemaVersion: '0.1',
    informationPlanId: `information-${input.fixtureId}`,
    slideId: slide.slideId,
    semanticShape: 'causal-chain',
    grammarId: 'generic-message-presentation-test',
    message,
    primaryArtifactBlockId: blockIds[1]!,
    readingOrder: blockIds,
    groups: [
      { groupId: `${input.fixtureId}-accumulation`, role: 'setup', order: 0, blockIds: [blockIds[0]!] },
      { groupId: `${input.fixtureId}-threshold`, role: 'transition', order: 1, blockIds: [blockIds[1]!] },
      { groupId: `${input.fixtureId}-consequence`, role: 'consequence', order: 2, blockIds: [blockIds[2]!] },
    ],
    relationIds: slide.relations.map((relation) => relation.id),
    interpretation: { author: 'deterministic-planner', confidence: 1, ambiguityIds: [] },
  });
  return { slide, informationPlan, message };
}

const HEADLINE_FIXTURE = messageFixture({
  fixtureId: 'message-headline',
  rawText: '사용자가 작성한 별도 제목\n준비 행동 → 상태 전환 → 결과 적용',
  messageText: '사용자가 작성한 별도 제목',
  messageSpanId: 'message-headline-span',
  blockTexts: ['준비 행동', '상태 전환', '결과 적용'],
});

const CONTEXT_FIXTURE = messageFixture({
  fixtureId: 'message-context',
  rawText: '준비 행동은 자원 확인 뒤 시작한다 → 상태 전환 → 결과 적용',
  messageText: '준비 행동은 자원 확인 뒤 시작한다',
  messageSpanId: 'message-context-span',
  blockTexts: ['준비 행동', '상태 전환', '결과 적용'],
});

const SUPPRESSED_FIXTURE = messageFixture({
  fixtureId: 'message-suppressed',
  rawText: '준비 행동 → 상태 전환 → 결과 적용',
  messageText: '준비 행동 → 상태 전환 → 결과 적용',
  messageSpanId: 'unused',
  messageUsesSourceAll: true,
  blockTexts: ['준비 행동', '상태 전환', '결과 적용'],
});

function compositionFor(fixture: typeof SHORT_ACCUMULATION_FIXTURE) {
  const retrieval = retrieveReferencesForInformationPlan({
    slide: fixture.slide,
    informationPlan: fixture.informationPlan,
    corpus: SEED_REFERENCE_CORPUS,
    audience: 'game-design-reviewer',
    outputProfile: 'pdf-presentation',
    avoidSignatures: ['card-dashboard'],
    limit: 4,
  });
  return createCompositionPlanFromInformationPlan({
    ...fixture,
    retrieval,
    fragments: SEED_PATTERN_FRAGMENTS.filter(
      (fragment) => fragment.fragmentId === 'pattern-accumulation-threshold-consequence',
    ),
  });
}

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
    width: Math.max(request.size, request.text.length * request.size * 0.58),
    actualBoundingBoxAscent: request.size * 0.78,
    actualBoundingBoxDescent: request.size * 0.22,
  }]));
}

function renderMessageFixture(fixture: typeof HEADLINE_FIXTURE) {
  const plan = compositionFor(fixture);
  const tree = buildInformationRenderTree({
    slide: fixture.slide,
    informationPlan: fixture.informationPlan,
    plan,
    measures: measurements(informationMeasureRequests({
      slide: fixture.slide,
      informationPlan: fixture.informationPlan,
      plan,
    })),
    fonts,
  });
  return {
    plan,
    tree,
    gate: runHardGate({ slide: fixture.slide, informationPlan: fixture.informationPlan, tree }),
  };
}

function renderPhaseFixture(fixture: typeof SHORT_ACCUMULATION_FIXTURE) {
  const plan = compositionFor(fixture);
  const tree = buildInformationRenderTree({
    slide: fixture.slide,
    informationPlan: fixture.informationPlan,
    plan,
    measures: measurements(informationMeasureRequests({
      slide: fixture.slide,
      informationPlan: fixture.informationPlan,
      plan,
    })),
    fonts,
  });
  return {
    plan,
    tree,
    gate: runHardGate({ slide: fixture.slide, informationPlan: fixture.informationPlan, tree }),
  };
}

describe('deterministic message presentation contract', () => {
  it('classifies an independent user-authored message as headline without rewriting it', () => {
    const result = resolveMessagePresentation(HEADLINE_FIXTURE);
    expect(result).toEqual({
      presentationKind: 'headline',
      text: HEADLINE_FIXTURE.message.text,
      sourceSpanIds: HEADLINE_FIXTURE.message.sourceSpanIds,
      sourceTransform: HEADLINE_FIXTURE.message.transform,
      sourceUsage: 'content',
    });
  });

  it('classifies a partially overlapping authored message as context without rewriting it', () => {
    const result = resolveMessagePresentation(CONTEXT_FIXTURE);
    expect(result).toEqual({
      presentationKind: 'context',
      text: CONTEXT_FIXTURE.message.text,
      sourceSpanIds: CONTEXT_FIXTURE.message.sourceSpanIds,
      sourceTransform: CONTEXT_FIXTURE.message.transform,
      sourceUsage: 'context-repeat',
    });
  });

  it('suppresses a full duplicate while preserving source trace and a deterministic reason', () => {
    const result = resolveMessagePresentation(SUPPRESSED_FIXTURE);
    expect(result).toEqual({
      presentationKind: 'suppressed-duplicate',
      sourceSpanIds: SUPPRESSED_FIXTURE.message.sourceSpanIds,
      sourceTransform: SUPPRESSED_FIXTURE.message.transform,
      suppressionReason: 'all-message-content-is-already-presented-by-blocks',
    });
    expect(result).not.toHaveProperty('text');
  });
});

describe('relation visual-role classifier', () => {
  it('classifies the generic four-block relation endpoints without reading text or IDs', () => {
    const plan = compositionFor(SHORT_ACCUMULATION_FIXTURE);
    expect(SHORT_ACCUMULATION_FIXTURE.slide.relations.map((relation) =>
      classifyRelationVisualRole({ relation, plan })?.visualRole,
    )).toEqual([
      'accumulation-local',
      'threshold-entry',
      'consequence-activation',
    ]);
  });

  it('also identifies consequence-local in the generic seven-block structure', () => {
    const plan = compositionFor(LONG_ACCUMULATION_FIXTURE);
    expect(LONG_ACCUMULATION_FIXTURE.slide.relations.map((relation) =>
      classifyRelationVisualRole({ relation, plan })?.visualRole,
    )).toEqual([
      'accumulation-local',
      'accumulation-local',
      'accumulation-local',
      'threshold-entry',
      'consequence-activation',
      'consequence-local',
    ]);
  });
});

describe('message presentation in RenderTree and Hard Gate', () => {
  it('renders one source-owned headline node with auditable presentation metadata', () => {
    const { tree, gate } = renderMessageFixture(HEADLINE_FIXTURE);
    const messageNodes = tree.nodes.filter((node) => node.kind === 'text' && node.visualRole === 'message-context');
    expect(messageNodes).toHaveLength(1);
    expect(messageNodes[0]).toMatchObject({
      compositionRegionId: 'message-context',
      visualRole: 'message-context',
      sourceUsage: 'content',
      text: HEADLINE_FIXTURE.message.text,
      sourceSpanIds: HEADLINE_FIXTURE.message.sourceSpanIds,
      sourceTransform: HEADLINE_FIXTURE.message.transform,
    });
    expect(tree.messagePresentation).toEqual({
      presentationKind: 'headline',
      sourceSpanIds: HEADLINE_FIXTURE.message.sourceSpanIds,
      sourceTransform: HEADLINE_FIXTURE.message.transform,
    });
    expect(gate.passed).toBe(true);
  });

  it('renders one exact context-repeat node without claiming source coverage ownership', () => {
    const { tree, gate } = renderMessageFixture(CONTEXT_FIXTURE);
    const messageNodes = tree.nodes.filter((node) => node.kind === 'text' && node.visualRole === 'message-context');
    expect(messageNodes).toHaveLength(1);
    expect(messageNodes[0]).toMatchObject({
      compositionRegionId: 'message-context',
      visualRole: 'message-context',
      sourceUsage: 'context-repeat',
      text: CONTEXT_FIXTURE.message.text,
    });
    expect(tree.messagePresentation?.presentationKind).toBe('context');
    expect(gate.sourceFidelityFindings.some((finding) => finding.code === 'duplicate-content')).toBe(false);
    expect(gate.passed).toBe(true);
  });

  it('stores suppression audit metadata without creating any message text node', () => {
    const { tree, gate } = renderMessageFixture(SUPPRESSED_FIXTURE);
    expect(tree.nodes.filter((node) => node.kind === 'text' && node.visualRole === 'message-context')).toHaveLength(0);
    expect(tree.messagePresentation).toEqual({
      presentationKind: 'suppressed-duplicate',
      sourceSpanIds: SUPPRESSED_FIXTURE.message.sourceSpanIds,
      sourceTransform: SUPPRESSED_FIXTURE.message.transform,
      suppressionReason: 'all-message-content-is-already-presented-by-blocks',
    });
    expect(gate.sourceFidelityFindings.some((finding) =>
      finding.code === 'missing-source-content' || finding.code === 'duplicate-content',
    )).toBe(false);
    expect(gate.passed).toBe(true);
  });

  it('fails Source Fidelity when a rendered message is changed from the authored source', () => {
    const { tree } = renderMessageFixture(HEADLINE_FIXTURE);
    const changed = structuredClone(tree);
    const message = changed.nodes.find((node) => node.kind === 'text' && node.visualRole === 'message-context');
    if (message?.kind !== 'text') throw new Error('fixture error');
    message.text = '원문에 없는 제목';
    message.lines[0]!.text = '원문에 없는 제목';
    const gate = runHardGate({
      slide: HEADLINE_FIXTURE.slide,
      informationPlan: HEADLINE_FIXTURE.informationPlan,
      tree: changed,
    });
    expect(gate.passed).toBe(false);
    expect(gate.sourceFidelityFindings.some((finding) => finding.code === 'untraceable-content')).toBe(true);
  });
});

describe('accumulation-sequence render branch', () => {
  function expectSequenceContract(fixture: typeof SHORT_ACCUMULATION_FIXTURE) {
    const { plan, tree, gate } = renderPhaseFixture(fixture);
    const accumulationBindings = plan.bindings
      .filter((binding) => binding.regionId === 'phase-accumulation')
      .sort((left, right) => left.readingOrder - right.readingOrder);
    const expectedBlockIds = accumulationBindings.map((binding) => binding.blockId);
    const expectedRelationIds = fixture.slide.relations
      .filter((relation) =>
        expectedBlockIds.includes(relation.fromBlockId) && expectedBlockIds.includes(relation.toBlockId),
      )
      .map((relation) => relation.id);
    const thresholdBindings = plan.bindings
      .filter((binding) => binding.regionId === 'phase-threshold')
      .sort((left, right) => left.readingOrder - right.readingOrder);
    const thresholdBlockIds = thresholdBindings.map((binding) => binding.blockId);
    const consequenceBindings = plan.bindings
      .filter((binding) => binding.regionId === 'phase-consequence')
      .sort((left, right) => left.readingOrder - right.readingOrder);
    const consequenceBlockIds = consequenceBindings.map((binding) => binding.blockId);
    const expectedThresholdEntryIds = fixture.slide.relations
      .filter((relation) =>
        expectedBlockIds.includes(relation.fromBlockId) && thresholdBlockIds.includes(relation.toBlockId),
      )
      .map((relation) => relation.id);
    const expectedConsequenceActivationIds = fixture.slide.relations
      .filter((relation) =>
        thresholdBlockIds.includes(relation.fromBlockId) && consequenceBlockIds.includes(relation.toBlockId),
      )
      .map((relation) => relation.id);
    const expectedConsequenceLocalIds = fixture.slide.relations
      .filter((relation) =>
        consequenceBlockIds.includes(relation.fromBlockId) && consequenceBlockIds.includes(relation.toBlockId),
      )
      .map((relation) => relation.id);
    const phase = tree.nodes.find((node) => node.nodeId === 'region-phase-accumulation');
    expect(phase).toMatchObject({
      kind: 'group',
      compositionRegionId: 'phase-accumulation',
      visualRole: 'phase-container',
    });
    expect(phase?.box.width).toBeLessThan(tree.pageProfile.width);
    expect(phase?.box.height).toBeLessThan(tree.pageProfile.height);

    const orderedText = tree.nodes.filter(
      (node): node is Extract<typeof tree.nodes[number], { kind: 'text' }> =>
        node.kind === 'text' && node.visualRole === 'ordered-step',
    );
    expect(orderedText.map((node) => node.semanticBlockId)).toEqual(expectedBlockIds);
    expect(orderedText.every((node) => node.compositionRegionId === 'phase-accumulation')).toBe(true);
    expect(orderedText.every((node) => node.parentId === `ordered-step-${node.semanticBlockId}`)).toBe(true);

    const tracks = tree.nodes.filter((node) => node.nodeId.startsWith('accumulation-shared-track-'));
    expect(tracks.length).toBeGreaterThan(0);
    expect(tracks.every((node) => node.relationId === undefined)).toBe(true);

    const carriers = tree.nodes.filter(
      (node) => node.visualRole === 'relation-carrier' && node.relationVisualRole === 'accumulation-local',
    );
    expect(carriers.map((node) => node.relationId)).toEqual(expectedRelationIds);
    expect(carriers.every((node) => node.compositionRegionId === 'phase-accumulation')).toBe(true);
    expect(carriers.every((node) => node.visible)).toBe(true);

    const thresholdPhase = tree.nodes.find((node) => node.nodeId === 'region-phase-threshold');
    expect(thresholdPhase).toMatchObject({
      kind: 'group',
      compositionRegionId: 'phase-threshold',
      visualRole: 'phase-container',
    });
    const thresholdText = tree.nodes.filter(
      (node): node is Extract<typeof tree.nodes[number], { kind: 'text' }> =>
        node.kind === 'text' && node.visualRole === 'threshold-event',
    );
    expect(thresholdText.map((node) => node.semanticBlockId)).toEqual(thresholdBlockIds);
    expect(thresholdText.every((node) => node.compositionRegionId === 'phase-threshold')).toBe(true);
    expect(thresholdText.every((node) => node.parentId === `threshold-event-${node.semanticBlockId}`)).toBe(true);
    expect(Math.min(...thresholdText.map((node) => node.font.size))).toBeGreaterThan(
      Math.max(...orderedText.map((node) => node.font.size)),
    );
    const eventMarkers = tree.nodes.filter((node) => node.nodeId.startsWith('threshold-event-marker-'));
    expect(eventMarkers.map((node) => node.semanticBlockId)).toEqual(thresholdBlockIds);
    expect(eventMarkers.every((node) =>
      node.kind === 'shape' &&
      node.shape === 'ellipse' &&
      node.visualRole === 'threshold-event' &&
      node.compositionRegionId === 'phase-threshold',
    )).toBe(true);
    expect(eventMarkers.every((node) => node.box.width < (thresholdPhase?.box.width ?? 0) * 0.25)).toBe(true);

    const boundary = tree.nodes.filter((node) => node.visualRole === 'threshold-boundary');
    expect(boundary).toHaveLength(1);
    expect(boundary[0]).toMatchObject({
      nodeId: 'threshold-boundary-rule',
      compositionRegionId: 'phase-threshold',
    });
    expect(boundary[0]?.relationId).toBeUndefined();
    const thresholdEntry = tree.nodes.filter(
      (node) => node.visualRole === 'relation-carrier' && node.relationVisualRole === 'threshold-entry',
    );
    expect(thresholdEntry.map((node) => node.relationId)).toEqual(expectedThresholdEntryIds);
    expect(thresholdEntry.every((node) =>
      node.compositionRegionId === 'phase-threshold' && node.parentId === 'region-phase-threshold',
    )).toBe(true);

    const consequencePhase = tree.nodes.find((node) => node.nodeId === 'region-phase-consequence');
    expect(consequencePhase).toMatchObject({
      kind: 'group',
      compositionRegionId: 'phase-consequence',
      visualRole: 'phase-container',
    });
    const consequenceGroups = tree.nodes
      .filter((node) => node.kind === 'group' && node.visualRole === 'consequence-result')
      .sort((left, right) => left.box.y - right.box.y);
    expect(consequenceGroups.map((node) => node.semanticBlockId)).toEqual(consequenceBlockIds);
    const consequenceText = tree.nodes.filter(
      (node): node is Extract<typeof tree.nodes[number], { kind: 'text' }> =>
        node.kind === 'text' && node.visualRole === 'consequence-result',
    );
    expect(new Set(consequenceText.map((node) => node.semanticBlockId))).toEqual(new Set(consequenceBlockIds));
    expect(consequenceText.every((node) =>
      node.compositionRegionId === 'phase-consequence' &&
      node.parentId === `consequence-result-${node.semanticBlockId}`,
    )).toBe(true);
    expect(Math.max(...consequenceText.map((node) => node.font.size))).toBeLessThan(
      Math.min(...thresholdText.map((node) => node.font.size)),
    );
    expect(Math.min(...consequenceText.map((node) => node.font.size))).toBeGreaterThan(
      Math.min(...orderedText.map((node) => node.font.size)),
    );

    const consequenceAxis = tree.nodes.find((node) => node.nodeId === 'consequence-alignment-axis');
    expect(consequenceAxis).toMatchObject({ compositionRegionId: 'phase-consequence' });
    expect(consequenceAxis?.relationId).toBeUndefined();
    const consequenceActivation = tree.nodes.filter(
      (node) => node.visualRole === 'relation-carrier' && node.relationVisualRole === 'consequence-activation',
    );
    expect(consequenceActivation.map((node) => node.relationId)).toEqual(expectedConsequenceActivationIds);
    const consequenceLocal = tree.nodes.filter(
      (node) => node.visualRole === 'relation-carrier' && node.relationVisualRole === 'consequence-local',
    );
    expect(consequenceLocal.map((node) => node.relationId)).toEqual(expectedConsequenceLocalIds);
    expect([...consequenceActivation, ...consequenceLocal].every((node) =>
      node.compositionRegionId === 'phase-consequence' && node.parentId === 'region-phase-consequence',
    )).toBe(true);

    expect(tree.nodes.some((node) =>
      node.kind === 'shape' &&
      node.compositionRegionId === 'phase-accumulation' &&
      (node.shape === 'rect' || node.shape === 'round-rect'),
    )).toBe(false);
    expect(tree.nodes.some((node) => node.nodeId.startsWith('phase-placeholder-relation-'))).toBe(false);
    expect(tree.nodes.some((node) =>
      node.kind === 'shape' &&
      node.compositionRegionId === 'phase-consequence' &&
      (node.shape === 'rect' || node.shape === 'round-rect'),
    )).toBe(false);

    expect(tree.nodes.some((node) => node.nodeId.startsWith('motif-'))).toBe(false);
    expect(tree.nodes.some((node) => node.nodeId.startsWith('connector-marker-'))).toBe(false);
    expect(tree.nodes.some((node) => fixture.slide.relations.some(
      (relation) => node.nodeId === `relation-${relation.id}`,
    ))).toBe(false);
    expect(gate.passed).toBe(true);
    expect(gate.programFindings).toEqual([]);
    expect(gate.sourceFidelityFindings).toEqual([]);
    return { tree, expectedBlockIds, thresholdBlockIds, consequenceBlockIds };
  }

  it('keeps two accumulation steps on one measured shared track', () => {
    const { tree } = expectSequenceContract(SHORT_ACCUMULATION_FIXTURE);
    expect(tree.nodes.filter((node) => node.nodeId.startsWith('accumulation-shared-track-'))).toHaveLength(1);
    const stepGroups = tree.nodes.filter(
      (node) => node.kind === 'group' && node.visualRole === 'ordered-step',
    );
    expect(new Set(stepGroups.map((node) => node.box.y))).toHaveProperty('size', 1);
    expect(tree.nodes.filter((node) => node.kind === 'group' && node.visualRole === 'consequence-result')).toHaveLength(1);
    expect(tree.nodes.filter((node) => node.relationVisualRole === 'consequence-activation')).toHaveLength(1);
    expect(tree.nodes.filter((node) => node.relationVisualRole === 'consequence-local')).toHaveLength(0);
  });

  it('keeps four fitting accumulation steps in source order on one lane', () => {
    const { tree, expectedBlockIds } = expectSequenceContract(LONG_ACCUMULATION_FIXTURE);
    expect(tree.nodes.filter((node) => node.nodeId.startsWith('accumulation-shared-track-'))).toHaveLength(1);
    const anchors = tree.nodes
      .filter((node) => node.nodeId.startsWith('ordered-step-anchor-'))
      .sort((left, right) => left.box.x - right.box.x);
    expect(anchors.map((node) => node.semanticBlockId)).toEqual(expectedBlockIds);
    expect(tree.nodes.filter((node) => node.kind === 'group' && node.visualRole === 'consequence-result')).toHaveLength(2);
    expect(tree.nodes.filter((node) => node.relationVisualRole === 'consequence-activation')).toHaveLength(1);
    expect(tree.nodes.filter((node) => node.relationVisualRole === 'consequence-local')).toHaveLength(1);
  });

  it('wraps five or more accumulation steps deterministically without changing reading order', () => {
    const { tree, expectedBlockIds } = expectSequenceContract(WRAPPED_ACCUMULATION_FIXTURE);
    expect(tree.nodes.filter((node) => node.nodeId.startsWith('accumulation-shared-track-'))).toHaveLength(2);
    const stepGroups = tree.nodes.filter(
      (node) => node.kind === 'group' && node.visualRole === 'ordered-step',
    );
    const laneYs = [...new Set(stepGroups.map((node) => node.box.y))].sort((left, right) => left - right);
    expect(laneYs).toHaveLength(2);
    const rowMajorOrder = [...stepGroups]
      .sort((left, right) => left.box.y - right.box.y || left.box.x - right.box.x)
      .map((node) => node.semanticBlockId);
    expect(rowMajorOrder).toEqual(expectedBlockIds);
  });

  it('renders generic threshold wording from source bindings without fixture-specific interpretation', () => {
    const short = expectSequenceContract(SHORT_ACCUMULATION_FIXTURE);
    const long = expectSequenceContract(LONG_ACCUMULATION_FIXTURE);
    expect(short.thresholdBlockIds).not.toEqual(long.thresholdBlockIds);
    expect(short.tree.nodes.find(
      (node) => node.kind === 'text' && node.visualRole === 'threshold-event',
    )).toMatchObject({ text: '상태 전환' });
    expect(long.tree.nodes.find(
      (node) => node.kind === 'text' && node.visualRole === 'threshold-event',
    )).toMatchObject({ text: '상태 경계' });
  });

  it('applies value hierarchy only to authored metric fields and keeps them in one result group', () => {
    const { tree } = expectSequenceContract(METRIC_CONSEQUENCE_FIXTURE);
    const resultText = tree.nodes.filter(
      (node): node is Extract<typeof tree.nodes[number], { kind: 'text' }> =>
        node.kind === 'text' && node.visualRole === 'consequence-result',
    );
    expect(resultText.map((node) => node.text)).toEqual(['받는 영향', '+25%']);
    expect(resultText[0]?.parentId).toBe(resultText[1]?.parentId);
    expect(resultText[1]!.font.size).toBeGreaterThan(resultText[0]!.font.size);
    expect(resultText[1]!.font.weight).toBeGreaterThanOrEqual(resultText[0]!.font.weight);
  });
});
