import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildSourceLedger,
  InformationPlanSchema,
  SlideIRSchema,
  type ContentRef,
  type InformationPlan,
  type SlideIR,
  type TeacherPageRecord,
} from '@game-presentation/contracts';
import { loadExternalMasterTeacherPageSet } from '../src/external-master.js';
import { buildTeacherDesignGuidance } from '../src/teacher-guidance.js';
import { selectCuratedTeachersForInformationPlan } from '../src/teacher-selection.js';

const referenceDir = fileURLToPath(new URL('../references/external-master-2025-v1/', import.meta.url));

type GroupInput = {
  role: InformationPlan['groups'][number]['role'];
  indexes: number[];
};

type RelationInput = {
  from: number;
  to: number;
  type: SlideIR['relations'][number]['type'];
};

function fixture(input: {
  id: string;
  texts: string[];
  intent: SlideIR['intent']['kind'];
  semanticShape: InformationPlan['semanticShape'];
  grammarId: string;
  groups: GroupInput[];
  relations: RelationInput[];
  withVisualAsset?: boolean;
}): { slide: SlideIR; informationPlan: InformationPlan } {
  const rawText = input.texts.join('\n');
  const segments = input.texts.map((text, index) => ({ id: `span-${index}`, text }));
  const source = buildSourceLedger({
    ledgerId: `ledger-${input.id}`,
    rawText,
    segments,
    createdAt: '2026-09-04T00:00:00.000Z',
  });
  const ref = (index: number): ContentRef => ({
    text: input.texts[index]!,
    sourceSpanIds: [`span-${index}`],
    locked: true,
    transform: { kind: 'exact' },
  });
  const blockId = (index: number) => `block-${index}`;
  const slide = SlideIRSchema.parse({
    schemaVersion: '0.1',
    slideId: input.id,
    locale: 'ko-KR',
    pagePreference: { mode: 'auto' },
    source,
    intent: {
      kind: input.intent,
      communicationGoal: ref(0),
      primaryMessage: ref(0),
      primaryFocusBlockId: blockId(0),
    },
    domain: { topic: input.texts[0]!, facets: ['content'] },
    blocks: input.texts.map((text, index) => ({
      id: blockId(index),
      kind: 'paragraph' as const,
      role: index === 0 ? 'primary' as const : 'evidence' as const,
      importance: index === 0 ? 5 as const : 3 as const,
      sourceSpanIds: [`span-${index}`],
      order: index,
      text: ref(index),
    })),
    relations: input.relations.map((relation, index) => ({
      id: `relation-${index}`,
      fromBlockId: blockId(relation.from),
      toBlockId: blockId(relation.to),
      type: relation.type,
      sourceSpanIds: [`span-${relation.from}`, `span-${relation.to}`],
    })),
    assetNeeds: input.withVisualAsset
      ? [{
          id: 'screen-asset',
          role: 'screenshot' as const,
          purpose: '주석할 실제 게임 화면',
          required: true,
          sourceUri: 'https://example.com/screen.png',
        }]
      : [],
    constraints: {
      maxSlideCount: 1,
      primaryOutput: 'pdf',
      selectableTextRequired: true,
      editablePptxRequired: false,
      contentPolicy: 'verbatim',
      numberPolicy: 'source-only',
      preserveOrder: false,
      lockedSpanIds: segments.map((segment) => segment.id),
    },
    interpretation: { author: 'user', confidence: 1, ambiguities: [] },
  });
  const informationPlan = InformationPlanSchema.parse({
    schemaVersion: '0.1',
    informationPlanId: `information-${input.id}`,
    slideId: slide.slideId,
    semanticShape: input.semanticShape,
    grammarId: input.grammarId,
    message: ref(0),
    primaryArtifactBlockId: blockId(0),
    readingOrder: input.texts.map((_, index) => blockId(index)),
    groups: input.groups.map((group, index) => ({
      groupId: `group-${index}`,
      role: group.role,
      order: index,
      blockIds: group.indexes.map(blockId),
    })),
    relationIds: input.relations.map((_, index) => `relation-${index}`),
    interpretation: { author: 'user', confidence: 1, ambiguityIds: [] },
  });
  return { slide, informationPlan };
}

const examples = {
  diagnosis: () => fixture({
    id: 'teacher-diagnosis-example',
    texts: ['기존 전달 절차', '진행 중인 완료 인식', '누락된 검수', '발견된 문제'],
    intent: 'timeline', semanticShape: 'sequence', grammarId: 'process-diagnosis',
    groups: [
      { role: 'setup', indexes: [0] },
      { role: 'context', indexes: [1] },
      { role: 'evidence', indexes: [2] },
      { role: 'consequence', indexes: [3] },
    ],
    relations: [
      { from: 0, to: 1, type: 'sequence' },
      { from: 1, to: 2, type: 'causes' },
      { from: 2, to: 3, type: 'causes' },
    ],
  }),
  annotation: (withVisualAsset = true) => fixture({
    id: withVisualAsset ? 'teacher-annotation-example' : 'teacher-annotation-no-asset',
    texts: ['전투 화면', '체력 표시 설명', '스킬 슬롯 설명', '전체 UI 의도'],
    intent: 'ui-annotation', semanticShape: 'hybrid', grammarId: 'artifact-annotation',
    groups: [{ role: 'context', indexes: [0] }, { role: 'evidence', indexes: [1, 2, 3] }],
    relations: [
      { from: 1, to: 0, type: 'annotates' },
      { from: 2, to: 0, type: 'annotates' },
    ],
    withVisualAsset,
  }),
  organization: () => fixture({
    id: 'teacher-organization-example',
    texts: ['전투 시스템 책임자', '플레이어 전투 모듈', '보스 전투 모듈'],
    intent: 'hierarchy', semanticShape: 'hierarchy', grammarId: 'organization-structure',
    groups: [{ role: 'context', indexes: [0] }, { role: 'evidence', indexes: [1, 2] }],
    relations: [
      { from: 1, to: 0, type: 'part-of' },
      { from: 2, to: 0, type: 'part-of' },
    ],
  }),
  tradeoff: () => fixture({
    id: 'teacher-tradeoff-example',
    texts: ['쉬운 조작', '깊은 숙련도', '두 목표의 충돌'],
    intent: 'comparison', semanticShape: 'comparison', grammarId: 'tradeoff',
    groups: [
      { role: 'context', indexes: [0] },
      { role: 'context', indexes: [1] },
      { role: 'context', indexes: [2] },
    ],
    relations: [{ from: 0, to: 1, type: 'compares-with' }],
  }),
  beforeAfter: () => fixture({
    id: 'teacher-before-after-example',
    texts: ['기존 입력 제한', '개선된 입력 허용', '기존 방향 고정', '개선된 방향 선택'],
    intent: 'comparison', semanticShape: 'comparison', grammarId: 'before-after-feature-spec',
    groups: [{ role: 'before', indexes: [0, 2] }, { role: 'after', indexes: [1, 3] }],
    relations: [
      { from: 0, to: 1, type: 'compares-with' },
      { from: 2, to: 3, type: 'compares-with' },
    ],
  }),
  layered: (sequential = false) => fixture({
    id: sequential ? 'teacher-layered-sequential' : 'teacher-layered-example',
    texts: ['규칙 근거', '규칙 효과', '콘텐츠 근거', '콘텐츠 효과'],
    intent: 'mechanism', semanticShape: 'hybrid', grammarId: 'layered-countermeasure',
    groups: [
      { role: 'evidence', indexes: [0] },
      { role: 'consequence', indexes: [1] },
      { role: 'evidence', indexes: [2] },
      { role: 'consequence', indexes: [3] },
    ],
    relations: sequential
      ? [
          { from: 0, to: 1, type: 'sequence' },
          { from: 1, to: 2, type: 'sequence' },
          { from: 2, to: 3, type: 'sequence' },
        ]
      : [
          { from: 0, to: 1, type: 'produces' },
          { from: 2, to: 3, type: 'produces' },
        ],
  }),
  plainSequence: () => fixture({
    id: 'plain-sequence-example',
    texts: ['준비', '실행', '완료'],
    intent: 'timeline', semanticShape: 'sequence', grammarId: 'simple-sequence',
    groups: [{ role: 'setup', indexes: [0, 1] }, { role: 'consequence', indexes: [2] }],
    relations: [{ from: 0, to: 1, type: 'sequence' }, { from: 1, to: 2, type: 'sequence' }],
  }),
  generalRelation: () => fixture({
    id: 'general-relation-example',
    texts: ['전투 규칙', '플레이 결과', '검증 기준'],
    intent: 'mechanism', semanticShape: 'hybrid', grammarId: 'general-relation',
    groups: [{ role: 'context', indexes: [0] }, { role: 'evidence', indexes: [1, 2] }],
    relations: [{ from: 0, to: 1, type: 'causes' }, { from: 1, to: 2, type: 'depends-on' }],
  }),
};

async function teachers(): Promise<TeacherPageRecord[]> {
  return (await loadExternalMasterTeacherPageSet(referenceDir)).pages;
}

async function select(example: { slide: SlideIR; informationPlan: InformationPlan }) {
  return selectCuratedTeachersForInformationPlan({ ...example, teachers: await teachers(), limit: 3 });
}

async function guidance(example: { slide: SlideIR; informationPlan: InformationPlan }) {
  const corpus = await teachers();
  const selection = selectCuratedTeachersForInformationPlan({ ...example, teachers: corpus, limit: 3 });
  const resolution = buildTeacherDesignGuidance({ ...example, selection, teachers: corpus });
  if (resolution.status !== 'ready') throw new Error(resolution.reason);
  return resolution.guidance;
}

describe('deterministic curated Teacher selection', () => {
  it.each([
    ['Problem / Diagnosis', examples.diagnosis, 'process-diagnosis'],
    ['Feature Annotation', examples.annotation, 'artifact-annotation'],
    ['Organization / Structure', examples.organization, 'hierarchy'],
    ['Trade-off', examples.tradeoff, 'tradeoff'],
    ['Before / After', examples.beforeAfter, 'aligned-before-after-spec'],
    ['Layered Countermeasure', examples.layered, 'layered-countermeasure'],
  ] as const)('ranks the intended Teacher first for %s', async (_name, makeExample, expectedShape) => {
    const result = await select(makeExample());
    expect(result.selected[0]?.semanticShape).toBe(expectedShape);
    expect(result.selected[0]?.matchedConditions.length).toBeGreaterThan(0);
    expect(result.selected[0]?.reason.length).toBeGreaterThan(0);
    expect(result.selected.length).toBeLessThanOrEqual(3);
  });

  it('does not confuse Before/After with a Trade-off', async () => {
    const beforeAfter = await select(examples.beforeAfter());
    expect(beforeAfter.selected[0]?.semanticShape).toBe('aligned-before-after-spec');
    expect(beforeAfter.rejected.find((item) => item.semanticShape === 'tradeoff')?.reasons)
      .toContain('목표 충돌이 아니라 기존/개선 비교 구조다.');

    const tradeoff = await select(examples.tradeoff());
    expect(tradeoff.selected[0]?.semanticShape).toBe('tradeoff');
    expect(tradeoff.rejected.find((item) => item.semanticShape === 'aligned-before-after-spec')?.reasons)
      .toContain('기존 상태와 개선 상태가 모두 존재하지 않는다.');
  });

  it('does not treat a plain sequence as Problem/Diagnosis', async () => {
    const result = await select(examples.plainSequence());
    expect(result.selected).toHaveLength(0);
    expect(result.rejected.find((item) => item.semanticShape === 'process-diagnosis')?.reasons)
      .toContain('누락·오판·진단 구조가 Information Plan에 명시되지 않았다.');
    expect(result.noSelectionReason).toMatch(/찾지 못했다/);
  });

  it('rejects Feature Annotation when no actual screen or mockup is available', async () => {
    const result = await select(examples.annotation(false));
    expect(result.selected.some((item) => item.semanticShape === 'artifact-annotation')).toBe(false);
    expect(result.rejected.find((item) => item.semanticShape === 'artifact-annotation')?.reasons)
      .toContain('설명할 실제 화면·이미지·mockup이 준비되지 않았다.');
  });

  it('rejects a sequential flow as Layered Countermeasure', async () => {
    const result = await select(examples.layered(true));
    expect(result.selected.some((item) => item.semanticShape === 'layered-countermeasure')).toBe(false);
    expect(result.rejected.find((item) => item.semanticShape === 'layered-countermeasure')?.reasons)
      .toContain('병렬 해결 레이어가 아니라 순차 단계 구조다.');
  });

  it('does not over-select Organization for a general relation graph', async () => {
    const result = await select(examples.generalRelation());
    expect(result.selected.some((item) => item.semanticShape === 'hierarchy')).toBe(false);
    expect(result.rejected.find((item) => item.semanticShape === 'hierarchy')?.reasons)
      .toContain('상위·하위 단위가 있는 계층 구조가 아니다.');
  });

  it('cannot bypass production status policy with a direct reference ID', async () => {
    const corpus = await teachers();
    const approved = corpus.find((teacher) => teacher.informationStructure.semanticShape === 'aligned-before-after-spec')!;
    const example = examples.beforeAfter();
    for (const teacherStatus of ['seed-evidence', 'retired'] as const) {
      const blocked: TeacherPageRecord = {
        ...approved,
        provenance: { ...approved.provenance, teacherStatus },
      };
      const result = selectCuratedTeachersForInformationPlan({
        ...example,
        teachers: [blocked],
        requestedReferenceIds: [blocked.provenance.referenceId],
        limit: 1,
      });
      expect(result.selected).toHaveLength(0);
      expect(result.rejected[0]?.reasons).toEqual(['production 선택에서는 curated-teacher만 사용할 수 있다.']);
    }
  });

  it('returns readable mismatch notes without treating them as hard failures', async () => {
    const result = await select(examples.tradeoff());
    expect(result.selected[0]?.mismatchedConditions).toEqual(expect.any(Array));
    expect(result.rejected.every((item) => item.reasons.length > 0)).toBe(true);
  });
});

describe('selected Teacher to design guidance bridge', () => {
  it.each([
    [
      'Problem / Diagnosis', examples.diagnosis, 'ext-2025-pokemon-problem-task-leak',
      ['프로세스 내부의 중요한 경계를 사건처럼 드러낸다.', '기대 상태와 실제 상태를 같은 화면에서 대비한다.'],
    ],
    [
      'Feature Annotation', examples.annotation, 'ext-2025-pokemon-card-format-concept',
      ['실제 대상을 중심 증거로 두고 설명을 구체 위치에 귀속한다.'],
    ],
    [
      'Organization / Structure', examples.organization, 'ext-2025-pokemon-initiative-team-structure',
      ['설명은 원칙을, 구조도는 관계를 맡도록 역할을 분리한다.'],
    ],
    [
      'Trade-off', examples.tradeoff, 'ext-2025-shadowverse-accessibility-vs-competitiveness',
      ['두 목표를 동등하게 보여준 뒤 충돌 지점을 하나의 문제로 묶는다.'],
    ],
    [
      'Before / After', examples.beforeAfter, 'ext-2025-shadowverse-super-evolution',
      ['동일 기준의 항목을 같은 축에 정렬한다.', '변화 포인트만 제한적으로 강조한다.'],
    ],
    [
      'Layered Countermeasure', examples.layered, 'ext-2025-shadowverse-rules-vs-card-ability',
      ['서로 다른 해결 레이어를 분리해 각 레이어의 근거와 효과를 보여준다.', '각 레이어 안에서만 국소 인과를 표현하고 열 사이에는 순서를 만들지 않는다.'],
    ],
  ] as const)('delivers source-traced %s principles', async (_name, makeExample, referenceId, expectedPrinciples) => {
    const result = await guidance(makeExample());
    expect(result.primaryTeacher.referenceId).toBe(referenceId);
    expect(result.structureLock).toMatchObject({
      authority: 'primary-teacher-only',
      sourceReferenceId: referenceId,
    });
    expect(result.guidance.abstractPrinciples.map((entry) => entry.text))
      .toEqual(expect.arrayContaining([...expectedPrinciples]));
    for (const section of Object.values(result.guidance)) {
      expect(section.length).toBeGreaterThan(0);
      expect(section.every((entry) =>
        entry.teacherRole === 'primary' && entry.sourceReferenceId === referenceId)).toBe(true);
    }
  });

  it('locks structure to the Primary Teacher and limits Secondary guidance to support fields', async () => {
    const corpus = await teachers();
    const beforeAfter = examples.beforeAfter();
    const tradeoff = examples.tradeoff();
    const primarySelection = selectCuratedTeachersForInformationPlan({
      ...beforeAfter, teachers: corpus, limit: 1,
    });
    const secondarySelection = selectCuratedTeachersForInformationPlan({
      ...tradeoff, teachers: corpus, limit: 1,
    });
    const primary = primarySelection.selected[0]!;
    const secondary = secondarySelection.selected[0]!;
    const mixedSelection = {
      ...primarySelection,
      selected: [primary, { ...secondary, rank: 2 }],
      trace: { ...primarySelection.trace, returnedCount: 2 },
    };
    const resolution = buildTeacherDesignGuidance({
      ...beforeAfter,
      selection: mixedSelection,
      teachers: corpus,
    });
    if (resolution.status !== 'ready') throw new Error(resolution.reason);

    expect(resolution.guidance.primaryTeacher.semanticShape).toBe('aligned-before-after-spec');
    expect(resolution.guidance.secondaryTeachers[0]?.semanticShape).toBe('tradeoff');
    expect(Object.values(resolution.guidance.guidance).flat().every((entry) =>
      entry.teacherRole === 'primary' && entry.sourceReferenceId === primary.referenceId)).toBe(true);
    expect(resolution.guidance.secondarySupport.every((entry) =>
      entry.teacherRole === 'secondary' && entry.sourceReferenceId === secondary.referenceId)).toBe(true);
    expect(resolution.guidance.conflictPolicy.primaryOwnedAreas).toEqual(expect.arrayContaining([
      'information structure', 'grouping', 'reading direction', 'alignment',
    ]));
  });

  it('passes only abstract design knowledge and keeps source surface details in the copy boundary', async () => {
    const corpus = await teachers();
    for (const makeExample of [
      examples.diagnosis,
      examples.annotation,
      examples.organization,
      examples.tradeoff,
      examples.beforeAfter,
      examples.layered,
    ]) {
      const result = await guidance(makeExample());
      expect(result.copyBoundary).toMatchObject({
        policy: 'abstract-principles-only',
        exactGeometryReusable: false,
        sourcePaletteReusable: false,
        sourceIpReusable: false,
        sourceAssetReusable: false,
      });
      const source = corpus.find((teacher) =>
        teacher.provenance.referenceId === result.primaryTeacher.referenceId)!;
      const usableGuidance = JSON.stringify({ guidance: result.guidance, secondarySupport: result.secondarySupport });
      expect(usableGuidance).not.toContain(source.provenance.source.origin);
      expect(usableGuidance).not.toContain(source.provenance.pageArtifact.localAssetPath);
      expect(usableGuidance).not.toContain(source.provenance.pageArtifact.sourceSha256);
      expect(usableGuidance).not.toMatch(/CEDEC|Shadowverse|Pokemon|Pokémon|초진화|후공|\.png|[a-f0-9]{64}/u);
      expect(result.copyBoundary.prohibitedCopy.length).toBeGreaterThan(0);
    }
  });

  it('does not invent guidance when no Teacher was safely selected', async () => {
    const corpus = await teachers();
    const example = examples.plainSequence();
    const selection = selectCuratedTeachersForInformationPlan({ ...example, teachers: corpus, limit: 3 });
    const resolution = buildTeacherDesignGuidance({ ...example, selection, teachers: corpus });
    expect(resolution).toEqual({
      status: 'no-guidance',
      reason: '현재 정보 구조에 안전하게 적용할 curated Teacher를 찾지 못했다.',
    });
  });
});
