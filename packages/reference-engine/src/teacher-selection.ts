import {
  validateInformationPlan,
  type InformationPlan,
  type SlideIR,
  type TeacherPageRecord,
} from '@game-presentation/contracts';

export const MAX_TEACHER_SELECTION_RESULTS = 3;

export type TeacherSelectionScoreBreakdown = {
  purpose: number;
  relations: number;
  groups: number;
  artifact: number;
  density: number;
  informationAmount: number;
};

export type SelectedTeacher = {
  rank: number;
  referenceId: string;
  semanticShape: TeacherPageRecord['informationStructure']['semanticShape'];
  totalScore: number;
  scoreBreakdown: TeacherSelectionScoreBreakdown;
  reason: string;
  matchedConditions: string[];
  mismatchedConditions: string[];
  applicabilityNotes: string[];
  prohibitedCopy: string[];
};

export type RejectedTeacher = {
  referenceId: string;
  semanticShape: TeacherPageRecord['informationStructure']['semanticShape'];
  reasons: string[];
};

export type TeacherSelectionResult = {
  schemaVersion: '1.0';
  slideId: string;
  informationPlanId: string;
  selected: SelectedTeacher[];
  rejected: RejectedTeacher[];
  noSelectionReason?: string;
  trace: {
    ruleVersion: 'teacher-selection-v1';
    requestedLimit: number;
    curatedCandidateCount: number;
    returnedCount: number;
  };
};

type Profile = {
  grammarId: string;
  semanticShape: InformationPlan['semanticShape'];
  intent: SlideIR['intent']['kind'];
  blockCount: number;
  pairCount: number;
  density: TeacherPageRecord['visualGrammar']['pageOccupancy']['band'];
  groupRoleCounts: Map<InformationPlan['groups'][number]['role'], number>;
  relationTypes: Set<SlideIR['relations'][number]['type']>;
  blockKinds: Set<SlideIR['blocks'][number]['kind']>;
  availablePrimaryArtifact: boolean;
};

type RuleEvaluation = {
  hardFailures: string[];
  matched: string[];
  mismatched: string[];
  scoreBreakdown: TeacherSelectionScoreBreakdown;
};

const GRAMMAR_ALIASES: Record<TeacherPageRecord['informationStructure']['semanticShape'], readonly string[]> = {
  'process-diagnosis': ['process-diagnosis', 'problem-diagnosis'],
  'artifact-annotation': ['artifact-annotation', 'feature-annotation'],
  hierarchy: ['hierarchy', 'organization-structure'],
  tradeoff: ['tradeoff', 'tradeoff-problem-framing'],
  'aligned-before-after-spec': ['aligned-before-after-spec', 'before-after-feature-spec'],
  'layered-countermeasure': ['layered-countermeasure'],
};

function countRole(profile: Profile, role: InformationPlan['groups'][number]['role']): number {
  return profile.groupRoleCounts.get(role) ?? 0;
}

function profileFor(slide: SlideIR, plan: InformationPlan): Profile {
  const groupRoleCounts = new Map<InformationPlan['groups'][number]['role'], number>();
  for (const group of plan.groups) {
    groupRoleCounts.set(group.role, (groupRoleCounts.get(group.role) ?? 0) + 1);
  }
  const pairCount = slide.relations.filter((relation) => relation.type === 'compares-with').length;
  const blockCount = slide.blocks.length;
  return {
    grammarId: plan.grammarId,
    semanticShape: plan.semanticShape,
    intent: slide.intent.kind,
    blockCount,
    pairCount,
    density: blockCount <= 3 ? 'sparse' : blockCount <= 8 ? 'balanced' : 'dense',
    groupRoleCounts,
    relationTypes: new Set(slide.relations.map((relation) => relation.type)),
    blockKinds: new Set(slide.blocks.map((block) => block.kind)),
    availablePrimaryArtifact: slide.assetNeeds.some((asset) =>
      (asset.role === 'source-image' || asset.role === 'screenshot') && asset.sourceUri !== undefined),
  };
}

function emptyScore(): TeacherSelectionScoreBreakdown {
  return { purpose: 0, relations: 0, groups: 0, artifact: 0, density: 0, informationAmount: 0 };
}

function evaluateStructuralRule(
  teacher: TeacherPageRecord,
  profile: Profile,
): RuleEvaluation {
  const shape = teacher.informationStructure.semanticShape;
  const scoreBreakdown = emptyScore();
  const hardFailures: string[] = [];
  const matched: string[] = [];
  const mismatched: string[] = [];
  const grammarMatches = GRAMMAR_ALIASES[shape].includes(profile.grammarId);
  const hasRelation = (type: SlideIR['relations'][number]['type']) => profile.relationTypes.has(type);

  switch (shape) {
    case 'process-diagnosis': {
      if (!grammarMatches) hardFailures.push('누락·오판·진단 구조가 Information Plan에 명시되지 않았다.');
      if (profile.semanticShape !== 'sequence' && profile.semanticShape !== 'causal-chain' && profile.semanticShape !== 'hybrid') {
        hardFailures.push('프로세스 또는 인과 흐름 구조가 아니다.');
      }
      if (grammarMatches) {
        matched.push('정상처럼 보이는 과정 안의 문제 또는 누락을 설명한다.');
        scoreBreakdown.purpose = 30;
      }
      if (hasRelation('sequence') || hasRelation('causes') || hasRelation('exception-of')) {
        matched.push('과정과 진단 결과를 연결하는 관계가 있다.');
        scoreBreakdown.relations = 25;
      }
      if (countRole(profile, 'evidence') + countRole(profile, 'context') >= 1) {
        matched.push('진단 근거 또는 실제 상태를 담는 정보 묶음이 있다.');
        scoreBreakdown.groups = 20;
      }
      scoreBreakdown.artifact = 10;
      break;
    }
    case 'artifact-annotation': {
      const hasAnnotationStructure = profile.intent === 'ui-annotation'
        || profile.blockKinds.has('ui-region')
        || hasRelation('annotates');
      if (!hasAnnotationStructure) hardFailures.push('실제 대상의 위치를 설명하는 annotation 구조가 없다.');
      if (!profile.availablePrimaryArtifact) hardFailures.push('설명할 실제 화면·이미지·mockup이 준비되지 않았다.');
      if (hasAnnotationStructure) {
        matched.push('실제 대상의 구체 위치에 설명을 귀속하는 구조다.');
        scoreBreakdown.purpose = 30;
        scoreBreakdown.relations = hasRelation('annotates') ? 25 : 15;
        scoreBreakdown.groups = 20;
      }
      if (profile.availablePrimaryArtifact) {
        matched.push('주석의 기준이 되는 실제 화면 또는 mockup이 있다.');
        scoreBreakdown.artifact = 10;
      }
      break;
    }
    case 'hierarchy': {
      const hierarchyStructure = profile.semanticShape === 'hierarchy'
        || profile.intent === 'hierarchy'
        || profile.blockKinds.has('hierarchy-node');
      if (!hierarchyStructure) hardFailures.push('상위·하위 단위가 있는 계층 구조가 아니다.');
      if (!hasRelation('part-of')) hardFailures.push('책임·소속을 표현할 part-of 관계가 없다.');
      if (hierarchyStructure) {
        matched.push('역할·책임·소속을 구조로 설명한다.');
        scoreBreakdown.purpose = 30;
        scoreBreakdown.groups = 20;
      }
      if (hasRelation('part-of')) {
        matched.push('상위·하위 소속 관계가 명시되어 있다.');
        scoreBreakdown.relations = 25;
      }
      scoreBreakdown.artifact = 10;
      break;
    }
    case 'tradeoff': {
      if (!grammarMatches) hardFailures.push('서로 중요하지만 충돌하는 두 목표가 명시되지 않았다.');
      if (!hasRelation('compares-with')) hardFailures.push('두 목표의 대립 관계가 없다.');
      if (countRole(profile, 'before') > 0 || countRole(profile, 'after') > 0) {
        hardFailures.push('목표 충돌이 아니라 기존/개선 비교 구조다.');
      }
      if (grammarMatches) {
        matched.push('둘 다 중요한 설계 목표의 충돌을 설명한다.');
        scoreBreakdown.purpose = 30;
      }
      if (hasRelation('compares-with')) {
        matched.push('두 관점의 대립 관계가 명시되어 있다.');
        scoreBreakdown.relations = 25;
      }
      if (countRole(profile, 'context') >= 2) {
        matched.push('두 목표와 종합 판단을 분리할 정보 묶음이 있다.');
        scoreBreakdown.groups = 20;
      }
      scoreBreakdown.artifact = 10;
      break;
    }
    case 'aligned-before-after-spec': {
      const hasBeforeAfter = countRole(profile, 'before') > 0 && countRole(profile, 'after') > 0;
      if (!hasBeforeAfter) hardFailures.push('기존 상태와 개선 상태가 모두 존재하지 않는다.');
      if (profile.pairCount < 1) hardFailures.push('동일 기준으로 연결된 비교 항목이 없다.');
      if (hasBeforeAfter) {
        matched.push('기존 상태와 개선 상태가 분리되어 있다.');
        scoreBreakdown.purpose = 30;
        scoreBreakdown.groups = 20;
      }
      if (profile.pairCount >= 1) {
        matched.push(`공통 기준으로 대응하는 비교쌍이 ${profile.pairCount}개 있다.`);
        scoreBreakdown.relations = 25;
      }
      scoreBreakdown.artifact = 10;
      break;
    }
    case 'layered-countermeasure': {
      const evidenceGroups = countRole(profile, 'evidence');
      const effectGroups = countRole(profile, 'consequence');
      const localEffects = [...profile.relationTypes].some((type) =>
        type === 'causes' || type === 'produces' || type === 'enables');
      if (!grammarMatches) hardFailures.push('서로 다른 해결 레이어를 병렬로 설명하는 구조가 아니다.');
      if (evidenceGroups < 2 || effectGroups < 2) hardFailures.push('각 해결 레이어의 근거와 효과가 분리되어 있지 않다.');
      if (!localEffects) hardFailures.push('레이어 내부의 근거→효과 관계가 없다.');
      if (hasRelation('sequence') || hasRelation('transitions-to')) {
        hardFailures.push('병렬 해결 레이어가 아니라 순차 단계 구조다.');
      }
      if (grammarMatches) {
        matched.push('서로 다른 해결 레이어를 병렬로 설명한다.');
        scoreBreakdown.purpose = 30;
      }
      if (localEffects) {
        matched.push('각 레이어 안에 근거에서 효과로 이어지는 관계가 있다.');
        scoreBreakdown.relations = 25;
      }
      if (evidenceGroups >= 2 && effectGroups >= 2) {
        matched.push('두 개 이상의 근거군과 결과군이 분리되어 있다.');
        scoreBreakdown.groups = 20;
      }
      scoreBreakdown.artifact = 10;
      break;
    }
  }

  if (teacher.applicability.densityRange.includes(profile.density)) {
    matched.push(`정보 밀도 ${profile.density}가 Teacher 적용 범위와 맞는다.`);
    scoreBreakdown.density = 10;
  } else {
    mismatched.push(`정보 밀도 ${profile.density}는 Teacher 권장 범위 밖이다.`);
  }

  const { blockCount, pairCount } = teacher.applicability;
  if (profile.blockCount < blockCount.min) {
    hardFailures.push(`정보 block ${profile.blockCount}개는 최소 ${blockCount.min}개보다 적다.`);
  } else if (blockCount.hardLimit && blockCount.max !== undefined && profile.blockCount > blockCount.max) {
    hardFailures.push(`정보 block ${profile.blockCount}개는 허용 최대 ${blockCount.max}개를 넘는다.`);
  } else {
    matched.push(`정보 block ${profile.blockCount}개를 수용할 수 있다.`);
    scoreBreakdown.informationAmount = 5;
  }

  if (pairCount !== undefined && profile.pairCount < pairCount.min) {
    hardFailures.push(`비교쌍 ${profile.pairCount}개는 최소 ${pairCount.min}개보다 적다.`);
  }

  return { hardFailures, matched, mismatched, scoreBreakdown };
}

function totalScore(score: TeacherSelectionScoreBreakdown): number {
  return Object.values(score).reduce((sum, value) => sum + value, 0);
}

/**
 * SlideIR + InformationPlan의 구조만으로 production에서 사용할 Teacher를 고른다.
 * status filter와 금지 조건은 점수 계산보다 먼저 적용되며 direct ID도 이를 우회하지 못한다.
 */
export function selectCuratedTeachersForInformationPlan(input: {
  slide: SlideIR;
  informationPlan: InformationPlan;
  teachers: TeacherPageRecord[];
  limit?: number;
  requestedReferenceIds?: string[];
}): TeacherSelectionResult {
  const limit = input.limit ?? 3;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_TEACHER_SELECTION_RESULTS) {
    throw new Error(`Teacher 선택 결과는 1~${MAX_TEACHER_SELECTION_RESULTS}개여야 합니다.`);
  }
  const informationIssues = validateInformationPlan(input.informationPlan, input.slide);
  if (informationIssues.length > 0) {
    throw new Error(`유효하지 않은 InformationPlan으로 Teacher를 선택할 수 없습니다: ${informationIssues[0]!.message}`);
  }

  const profile = profileFor(input.slide, input.informationPlan);
  const requested = input.requestedReferenceIds === undefined
    ? undefined
    : new Set(input.requestedReferenceIds);
  const rejected: RejectedTeacher[] = [];
  const eligible: Omit<SelectedTeacher, 'rank'>[] = [];
  let curatedCandidateCount = 0;

  for (const teacher of input.teachers) {
    const referenceId = teacher.provenance.referenceId;
    const semanticShape = teacher.informationStructure.semanticShape;
    if (teacher.provenance.teacherStatus !== 'curated-teacher') {
      rejected.push({
        referenceId,
        semanticShape,
        reasons: ['production 선택에서는 curated-teacher만 사용할 수 있다.'],
      });
      continue;
    }
    curatedCandidateCount += 1;
    if (requested !== undefined && !requested.has(referenceId)) {
      rejected.push({ referenceId, semanticShape, reasons: ['직접 지정된 검색 범위에 포함되지 않았다.'] });
      continue;
    }
    if (!teacher.provenance.rights.analyzeAllowed
      || !teacher.provenance.rights.deriveAbstractPrincipleAllowed) {
      rejected.push({ referenceId, semanticShape, reasons: ['분석 또는 추상 원칙 활용 권리가 허용되지 않는다.'] });
      continue;
    }

    const evaluation = evaluateStructuralRule(teacher, profile);
    if (evaluation.hardFailures.length > 0) {
      rejected.push({ referenceId, semanticShape, reasons: evaluation.hardFailures });
      continue;
    }
    const score = totalScore(evaluation.scoreBreakdown);
    eligible.push({
      referenceId,
      semanticShape,
      totalScore: score,
      scoreBreakdown: evaluation.scoreBreakdown,
      reason: evaluation.matched[0] ?? '구조화된 적용 조건이 일치한다.',
      matchedConditions: evaluation.matched,
      mismatchedConditions: evaluation.mismatched,
      applicabilityNotes: teacher.applicability.useWhen,
      prohibitedCopy: teacher.reuseBoundary.prohibitedCopy,
    });
  }

  const selected = eligible
    .sort((left, right) => right.totalScore - left.totalScore || left.referenceId.localeCompare(right.referenceId))
    .slice(0, limit)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  return {
    schemaVersion: '1.0',
    slideId: input.slide.slideId,
    informationPlanId: input.informationPlan.informationPlanId,
    selected,
    rejected,
    ...(selected.length === 0
      ? { noSelectionReason: '현재 정보 구조에 안전하게 적용할 curated Teacher를 찾지 못했다.' }
      : {}),
    trace: {
      ruleVersion: 'teacher-selection-v1',
      requestedLimit: limit,
      curatedCandidateCount,
      returnedCount: selected.length,
    },
  };
}
