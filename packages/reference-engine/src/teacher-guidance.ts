import type { InformationPlan, SlideIR, TeacherPageRecord } from '@game-presentation/contracts';
import type { TeacherSelectionResult } from './teacher-selection.js';

export type TeacherGuidanceRole = 'primary' | 'secondary';

export type TeacherGuidanceItem = {
  text: string;
  sourceReferenceId: string;
  sourceField: string;
  teacherRole: TeacherGuidanceRole;
};

export type TeacherDesignGuidance = {
  schemaVersion: '1.0';
  slideId: string;
  informationPlanId: string;
  primaryTeacher: {
    referenceId: string;
    semanticShape: TeacherPageRecord['informationStructure']['semanticShape'];
  };
  secondaryTeachers: Array<{
    referenceId: string;
    semanticShape: TeacherPageRecord['informationStructure']['semanticShape'];
  }>;
  structureLock: {
    authority: 'primary-teacher-only';
    semanticShape: TeacherPageRecord['informationStructure']['semanticShape'];
    sourceReferenceId: string;
    rule: string;
  };
  guidance: {
    informationStructure: TeacherGuidanceItem[];
    firstPriority: TeacherGuidanceItem[];
    grouping: TeacherGuidanceItem[];
    readingDirection: TeacherGuidanceItem[];
    alignment: TeacherGuidanceItem[];
    whitespace: TeacherGuidanceItem[];
    relationAndAnnotation: TeacherGuidanceItem[];
    emphasis: TeacherGuidanceItem[];
    imageTextRoles: TeacherGuidanceItem[];
    rationale: TeacherGuidanceItem[];
    abstractPrinciples: TeacherGuidanceItem[];
  };
  secondarySupport: TeacherGuidanceItem[];
  copyBoundary: {
    policy: 'abstract-principles-only';
    exactGeometryReusable: false;
    sourcePaletteReusable: false;
    sourceIpReusable: false;
    sourceAssetReusable: false;
    prohibitedCopy: TeacherGuidanceItem[];
  };
  conflictPolicy: {
    primaryOwnedAreas: string[];
    secondaryAllowedAreas: string[];
    rule: string;
  };
};

export type TeacherGuidanceResolution =
  | { status: 'ready'; guidance: TeacherDesignGuidance }
  | { status: 'no-guidance'; reason: string };

function item(input: {
  text: string;
  teacher: TeacherPageRecord;
  sourceField: string;
  role: TeacherGuidanceRole;
}): TeacherGuidanceItem {
  return {
    text: input.text,
    sourceReferenceId: input.teacher.provenance.referenceId,
    sourceField: input.sourceField,
    teacherRole: input.role,
  };
}

function items(input: {
  values: string[];
  teacher: TeacherPageRecord;
  sourceField: string;
  role: TeacherGuidanceRole;
}): TeacherGuidanceItem[] {
  return input.values.map((text) => item({
    text,
    teacher: input.teacher,
    sourceField: input.sourceField,
    role: input.role,
  }));
}

function requireCuratedTeacher(
  selectedReferenceId: string,
  teachersById: Map<string, TeacherPageRecord>,
): TeacherPageRecord {
  const teacher = teachersById.get(selectedReferenceId);
  if (teacher === undefined) {
    throw new Error(`선택 결과가 존재하지 않는 Teacher를 참조합니다: ${selectedReferenceId}`);
  }
  if (teacher.provenance.teacherStatus !== 'curated-teacher') {
    throw new Error(`Guidance에는 curated-teacher만 사용할 수 있습니다: ${selectedReferenceId}`);
  }
  return teacher;
}

function primaryGuidance(teacher: TeacherPageRecord): TeacherDesignGuidance['guidance'] {
  const role: TeacherGuidanceRole = 'primary';
  const orderedGroups = [...teacher.informationStructure.informationGroups]
    .sort((left, right) => left.order - right.order)
    .map((group) => group.groupRole);
  const relationRules = teacher.informationStructure.relationStructure.map(
    (relation) => `${relation.fromGroupId} → ${relation.toGroupId}: ${relation.relationType} (${relation.direction}, ${relation.scope})`,
  );
  const hierarchyPrimary = teacher.visualGrammar.hierarchyLevels
    .filter((level) => level.relativeStrength === 'primary')
    .map((level) => `가장 먼저 보여줄 정보: ${level.semanticRole}`);
  const connectorRules = teacher.visualGrammar.connectorSemantics
    .filter((connector) => !connector.decorative)
    .map((connector) => `${connector.relationRole} 관계는 ${connector.carrier} 역할로 표현한다.`);

  return {
    informationStructure: items({
      values: [
        `semantic shape: ${teacher.informationStructure.semanticShape}`,
        `group order: ${orderedGroups.join(' → ')}`,
        ...relationRules,
      ],
      teacher,
      sourceField: 'informationStructure',
      role,
    }),
    firstPriority: items({
      values: [
        ...hierarchyPrimary,
        `${teacher.visualGrammar.visualAnchor.role}: ${teacher.visualGrammar.visualAnchor.whyDominant}`,
      ],
      teacher,
      sourceField: 'visualGrammar.hierarchyLevels+visualAnchor',
      role,
    }),
    grouping: items({
      values: teacher.visualGrammar.groupingStrategy,
      teacher,
      sourceField: 'visualGrammar.groupingStrategy',
      role,
    }),
    readingDirection: items({
      values: [
        `dominant axis: ${teacher.visualGrammar.dominantAxis}`,
        `${teacher.informationStructure.readingPath.startRole} → ${teacher.informationStructure.readingPath.endRole}`,
      ],
      teacher,
      sourceField: 'visualGrammar.dominantAxis+informationStructure.readingPath.roles',
      role,
    }),
    alignment: items({
      values: teacher.visualGrammar.alignmentStrategy,
      teacher,
      sourceField: 'visualGrammar.alignmentStrategy',
      role,
    }),
    whitespace: items({
      values: teacher.visualGrammar.whitespaceStrategy,
      teacher,
      sourceField: 'visualGrammar.whitespaceStrategy',
      role,
    }),
    relationAndAnnotation: items({
      values: connectorRules,
      teacher,
      sourceField: 'visualGrammar.connectorSemantics',
      role,
    }),
    emphasis: items({
      values: [
        ...teacher.visualGrammar.accentStrategy.semanticUses.map((value) => `강조 대상: ${value}`),
        teacher.visualGrammar.accentStrategy.restraintRule,
      ],
      teacher,
      sourceField: 'visualGrammar.accentStrategy',
      role,
    }),
    imageTextRoles: items({
      values: [teacher.visualGrammar.imageTextRelationship],
      teacher,
      sourceField: 'visualGrammar.imageTextRelationship',
      role,
    }),
    rationale: items({
      values: teacher.qualityRationale.whyStrong,
      teacher,
      sourceField: 'qualityRationale.whyStrong',
      role,
    }),
    abstractPrinciples: items({
      values: teacher.reuseBoundary.reusableAbstractPrinciples,
      teacher,
      sourceField: 'reuseBoundary.reusableAbstractPrinciples',
      role,
    }),
  };
}

function secondarySupport(teacher: TeacherPageRecord): TeacherGuidanceItem[] {
  const role: TeacherGuidanceRole = 'secondary';
  return [
    ...items({
      values: teacher.visualGrammar.whitespaceStrategy,
      teacher,
      sourceField: 'visualGrammar.whitespaceStrategy',
      role,
    }),
    item({
      text: teacher.visualGrammar.accentStrategy.restraintRule,
      teacher,
      sourceField: 'visualGrammar.accentStrategy.restraintRule',
      role,
    }),
    ...items({
      values: teacher.qualityRationale.priorities.map((priority) => `품질 확인 항목: ${priority}`),
      teacher,
      sourceField: 'qualityRationale.priorities',
      role,
    }),
  ];
}

/**
 * Teacher 선택 결과를 실제 설계 단계가 소비할 수 있는 source-traced guidance로 바꾼다.
 * Primary만 구조를 소유하며 Secondary의 구조·축·reading path는 전달하지 않는다.
 */
export function buildTeacherDesignGuidance(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  selection: TeacherSelectionResult;
  teachers: TeacherPageRecord[];
}): TeacherGuidanceResolution {
  if (input.selection.slideId !== input.slide.slideId
    || input.selection.informationPlanId !== input.informationPlan.informationPlanId) {
    throw new Error('Teacher 선택 결과가 다른 SlideIR 또는 InformationPlan을 참조합니다.');
  }
  if (input.selection.selected.length === 0) {
    return {
      status: 'no-guidance',
      reason: input.selection.noSelectionReason ?? '선택된 curated Teacher가 없어 Guidance를 만들지 않았다.',
    };
  }

  const orderedSelection = [...input.selection.selected]
    .sort((left, right) => left.rank - right.rank)
    .slice(0, 3);
  const teachersById = new Map(input.teachers.map((teacher) => [teacher.provenance.referenceId, teacher]));
  const primary = requireCuratedTeacher(orderedSelection[0]!.referenceId, teachersById);
  const secondaries = orderedSelection.slice(1).map((selected) =>
    requireCuratedTeacher(selected.referenceId, teachersById));
  const allSelected = [primary, ...secondaries];

  return {
    status: 'ready',
    guidance: {
      schemaVersion: '1.0',
      slideId: input.slide.slideId,
      informationPlanId: input.informationPlan.informationPlanId,
      primaryTeacher: {
        referenceId: primary.provenance.referenceId,
        semanticShape: primary.informationStructure.semanticShape,
      },
      secondaryTeachers: secondaries.map((teacher) => ({
        referenceId: teacher.provenance.referenceId,
        semanticShape: teacher.informationStructure.semanticShape,
      })),
      structureLock: {
        authority: 'primary-teacher-only',
        semanticShape: primary.informationStructure.semanticShape,
        sourceReferenceId: primary.provenance.referenceId,
        rule: '정보 구조, 그룹, reading path, 정렬 축은 Primary Teacher만 결정한다.',
      },
      guidance: primaryGuidance(primary),
      secondarySupport: secondaries.flatMap(secondarySupport),
      copyBoundary: {
        policy: 'abstract-principles-only',
        exactGeometryReusable: false,
        sourcePaletteReusable: false,
        sourceIpReusable: false,
        sourceAssetReusable: false,
        prohibitedCopy: allSelected.flatMap((teacher, index) => items({
          values: teacher.reuseBoundary.prohibitedCopy,
          teacher,
          sourceField: 'reuseBoundary.prohibitedCopy',
          role: index === 0 ? 'primary' : 'secondary',
        })),
      },
      conflictPolicy: {
        primaryOwnedAreas: ['information structure', 'first priority', 'grouping', 'reading direction', 'alignment'],
        secondaryAllowedAreas: ['whitespace restraint', 'accent restraint', 'quality-check priorities'],
        rule: 'Secondary Teacher는 Primary의 semantic shape, 그룹 구조, 비교 축, 관계 방향을 변경할 수 없다.',
      },
    },
  };
}
