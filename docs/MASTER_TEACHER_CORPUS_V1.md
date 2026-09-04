# Master Teacher Corpus V1

## 1. 문서 상태와 목적

- 상태: 설계안
- 범위: 데이터 구조, 등록 절차, 검색 계약
- Source evidence: `external-master-2025-v1`의 6개 reference
- 구현 상태: 기반 계약, 6개 Teacher human curation, production용 deterministic Teacher 선택기 구현 완료
- 현재 usable curated Teacher: 6개 (사용자 승인일 2026-09-04)

현재 구현 완료:

- Controlled Vocabulary
- `TeacherPageRecord` Zod Schema
- External Master 6개 manual mapping
- Schema / Rights / Status validation test
- External Master 6개 human curation 및 `curated-teacher` 승격
- `SlideIR + InformationPlan` 기반 production Teacher 선택
- curated-only status hard filter, 구조적 금지 조건, 설명 가능한 1~3개 순위
- Teacher별 대표 예제와 오선택 방지 반례 테스트
- 선택 결과를 source-traced `TeacherDesignGuidance`로 변환하는 설계 단계 handoff
- Primary 구조 잠금, Secondary 보조 범위 제한, abstract-principles-only 복제 방지

현재 미구현:

- curation/benchmark용 범용 `TeacherRetrievalRequest` 실행 경로
- human-labelled retrieval benchmark corpus
- local reranker

Master Teacher Corpus는 좋은 게임 기획 장표의 **표면을 복제하는 저장소**가 아니다. 각 장표가 어떤 정보를 어떤 구조로 설명했고, 왜 그 구조가 효과적이었는지를 검색 가능한 지식으로 보존한다.

향후 무료·로컬 모델은 모델 자체에 이 지식을 학습시키지 않아도, 현재 작업의 `SlideIR + InformationPlan`과 맞는 Teacher Grammar만 작게 검색해 활용할 수 있어야 한다.

이 문서는 다음을 하지 않는다.

- 모델 fine-tuning
- Renderer 또는 PatternFragment 구현
- reference 원본의 좌표·색·IP·asset 복제
- Teacher를 Ready Positive 또는 Golden으로 자동 승격
- 사용자 취향을 품질 지식으로 일반화

## 2. 핵심 용어와 분리 원칙

| 구분 | 의미 | 생성 근거 | 결과 품질 승인 여부 |
| --- | --- | --- | --- |
| External Reference | 분석할 수 있는 외부 증거 | 출처와 권리 상태가 기록된 원본 | 승인과 무관 |
| Teacher Page | 정보 구조와 Visual Grammar가 구조화된 reference | External Reference 분석 | Ready를 의미하지 않음 |
| Teacher Grammar | 한 장 이상의 Teacher Page에서 추출한 재사용 원칙 | 근거 reference와 적용 경계 | Ready를 의미하지 않음 |
| PatternFragment | Renderer가 사용할 수 있도록 검증된 구현 계약 | Teacher Grammar, 중복 조사, 재사용성 테스트 | 출력 품질 승인을 보장하지 않음 |
| Ready Positive Fixture | 사용자가 실제 결과를 보고 제출 가능하다고 명시 승인한 결과 | 사용자 승인 기록 | Ready 기준으로 사용 가능 |
| User Preference | 사용자가 후보 중 무엇을 선호했는지에 대한 맥락적 기록 | 선택·거절 event | 품질 정답이 아님 |

반드시 지킬 경계는 다음과 같다.

1. `teacherStatus`와 `readyGolden`은 서로 다른 값이다.
2. Teacher는 좋은 판단의 근거지만, 그 자체가 우리 Renderer의 성공 사례는 아니다.
3. Ready Positive는 사용자 승인 기록 없이는 만들 수 없다.
4. User Preference는 별도 저장하며 Teacher Grammar를 직접 수정하지 않는다.
5. 하나의 reference를 곧바로 하나의 PatternFragment로 복사하지 않는다.
6. `seed-evidence`는 분석·benchmark 자료이며 production Visual Designer context에 들어갈 수 없다.
7. `readyGolden`은 legacy compatibility 값일 뿐 Teacher의 품질·승격·검색 점수에 사용할 수 없다.

## 3. 기존 Reference Engine 재사용 방침

V1에서는 새 package나 별도 검색 엔진을 만들지 않는다. 기존 `packages/reference-engine`과 `ReferenceRecord`를 유지한다.

현재 책임은 다음처럼 재사용한다.

| 현재 구조 | 계속 맡을 책임 | 보완이 필요한 부분 |
| --- | --- | --- |
| `ReferenceRecord` | 출처, 권리, 허용 사용, hash, 검색용 요약 tag | Teacher 상세 분석을 가리키는 연결 정보 |
| `ReferenceRetrievalBrief` | SlideIR/InformationPlan에서 만든 검색 brief | group 역할, cardinality, 금지 조건 등 정밀 검색 field |
| `retrieveReferences()` | deterministic 1차 검색 | applicability hard filter와 세부 score 설명 |
| `external-master-2025-v1/manifest.json` | 원본 목록, source, year, grammar, readyGolden=false | 변경 없이 source provenance로 사용 |
| `analysis.json` | 6개 장표의 현재 상세 분석 | Teacher schema로 정규화할 원천 자료 |
| `PatternFragment` | 구현 가능한 구조 계약 | Teacher와 자동 연결·자동 승격하지 않음 |

권장 저장 방식은 기존 reference 폴더 안의 sidecar이다.

```text
packages/reference-engine/references/
└─ external-master-2025-v1/
   ├─ manifest.json
   ├─ analysis.json
   ├─ teacher-pages.v1.json       # 구현된 TeacherPageRecord sidecar
   └─ images...
```

`ReferenceRecord`는 빠른 검색을 위한 얇은 index record로 유지한다. 상세 Teacher 분석을 모두 중복 저장하지 않고, `referenceId`로 sidecar의 `TeacherPageRecord`를 연결한다.

## 4. Schema 초안

### 4.1 TeacherPageRecord

아래는 구현 계약을 읽기 쉽게 축약한 TypeScript 표현이다. 실제 Zod Schema는 `packages/contracts/src/teacher-page.ts`, 6개 mapping은 `teacher-pages.v1.json`에 구현되어 있다.

```ts
type TeacherPageRecord = {
  schemaVersion: '1.0';

  provenance: {
    referenceId: string;                 // 기존 ReferenceRecord와 동일 ID
    source: {
      origin: string;
      sourceUrl?: string;
      authorOrOrganization?: string;
    };
    year: number | 'unknown';
    pageArtifact: {
      kind: 'slide-image' | 'pdf-page' | 'html-page' | 'other';
      pageLabel?: string;
      localAssetPath: string;
      sourceSha256?: string;
    };
    rights: {
      status: 'known-license' | 'public-domain' | 'user-owned' | 'unknown';
      licenseId?: string;
      licenseUrl?: string;
      analyzeAllowed: boolean;
      deriveAbstractPrincipleAllowed: boolean;
      reuseAssetAllowed: boolean;
      redistributeAssetAllowed: boolean;
    };
    teacherStatus: 'seed-evidence' | 'curated-teacher' | 'retired';
    compatibility: {
      legacyReadyGolden: boolean;        // 기존 manifest 호환용. 판단 입력 금지
    };
    curation: {
      analysisVersion: string;
      reviewedBy: 'human' | 'human-assisted';
      reviewedAt?: string;
      confidence: 'unassessed' | 'low' | 'medium' | 'high';
    };
  };

  informationStructure: {
    pageGoal: string;
    primaryClaim: string;
    semanticShape: string;
    informationGroups: Array<{
      groupId: string;
      groupRole: string;                 // before, after, evidence, process 등
      description: string;
      order: number;
      itemCount: number;
      required: boolean;
    }>;
    relationStructure: Array<{
      fromGroupId: string;
      toGroupId: string;
      relationType: string;
      direction: 'directed' | 'undirected' | 'bidirectional';
      scope: 'local' | 'group' | 'page';
      explanation: string;
    }>;
    readingPath: {
      primary: string;
      secondary?: string;
      startRole: string;
      endRole: string;
    };
    primaryArtifact: string;
  };

  visualGrammar: {
    pageOccupancy: {
      band: 'sparse' | 'balanced' | 'dense';
      occupiedZones: string[];
      measuredRatio?: number;            // 실제 측정값이 있을 때만 기록
    };
    dominantAxis: 'horizontal' | 'vertical' | 'radial' | 'diagonal' | 'mixed' | 'none';
    titleMessagePlacement: {
      titleZone: string;
      messageZone?: string;
      relationship: 'combined' | 'stacked' | 'separate' | 'absent';
    };
    hierarchyLevels: Array<{
      level: number;
      semanticRole: string;
      relativeStrength: 'primary' | 'secondary' | 'supporting' | 'annotation';
    }>;
    groupingStrategy: string[];
    whitespaceStrategy: string[];
    alignmentStrategy: string[];
    visualAnchor: {
      role: string;
      positionLogic: string;
      whyDominant: string;
    };
    evidencePlacement: string[];
    connectorSemantics: Array<{
      relationRole: string;
      carrier: string;
      scope: 'local' | 'group' | 'page';
      decorative: boolean;
    }>;
    accentStrategy: {
      semanticUses: string[];
      restraintRule: string;
    };
    imageTextRelationship: string;
    repetitionStrategy: string;
  };

  applicability: {
    fitsSemanticShapes: string[];
    requiredSignals: string[];
    forbiddenSignals: string[];
    useWhen: string[];
    doNotUseWhen: string[];
    densityRange: Array<'sparse' | 'balanced' | 'dense'>;
    blockCount: { min: number; max?: number; hardLimit: boolean };
    pairCount?: { min: number; max?: number; hardLimit: boolean };
    assetRequirements: string[];
  };

  qualityRationale: {
    whyStrong: string[];
    problemsSolved: string[];
    priorities: string[];                // 중요한 순서대로 기록
    tradeoffs: string[];
  };

  reuseBoundary: {
    reusableAbstractPrinciples: string[];
    prohibitedCopy: string[];
    exactGeometryReusable: false;
    sourcePaletteReusable: false;
    sourceIpReusable: false;
    sourceAssetReusable: false;
  };

  retrievalIndex: {
    intentTags: string[];
    semanticShapeTags: string[];
    relationTags: string[];
    groupRoleTags: string[];
    primaryArtifactTags: string[];
    readingPathTags: string[];
    densityTags: string[];
    compactRetrievalText: string;        // 작은 context용, 원본 전체 설명 금지
  };
};
```

### 4.2 필드 작성 규칙

- 관찰한 사실과 분석자의 해석을 혼동하지 않는다.
- `measuredRatio`처럼 정확성을 가장하는 수치는 실제 측정했을 때만 기록한다.
- `primaryClaim`은 reference가 전달하는 주장을 기록한다. 우리 fixture에 쓸 새 문장을 생성하는 필드가 아니다.
- `blockCount`와 `pairCount`는 대개 soft range다. 원본 한 장의 개수를 보편적 hard limit로 만들지 않는다.
- `assetRequirements`는 실제 스크린샷·도식이 있어야 grammar가 성립하는지를 검색 전에 판단하기 위한 필드다.
- `compactRetrievalText`는 위 구조를 짧게 직렬화한 검색용 설명이다. 전체 이미지 분석, 원본 문구, 전체 대화를 넣지 않는다.

### 4.3 Teacher status와 production 사용 경계

| `teacherStatus` | Curation 조회 | Retrieval benchmark | Production Teacher Retrieval |
| --- | --- | --- | --- |
| `seed-evidence` | 허용 | 허용 | 금지 |
| `curated-teacher` | 허용 | 허용 | 허용 |
| `retired` | 기록 확인만 허용 | 기본 제외 | 금지 |

`seed-evidence`는 분석되지 않은 원본이라는 뜻이 아니라, **production에서 사용할 만큼 review가 완료되지 않았다는 뜻**이다. 사람이 직접 분석했더라도 정해진 review와 validation이 끝나기 전에는 production context로 전달하지 않는다.

Production 차단은 prompt 지시가 아니라 Retrieval의 deterministic status filter가 수행한다. Visual Designer나 모델은 filter 이전 corpus에 접근하지 않으며, 반환된 후보의 status를 바꾸거나 우회할 수 없다.

`retired`는 자동 검색 대상이 아니다. 과거 기록 확인이 필요할 때만 curator가 `referenceId`로 직접 조회하며, 그 조회 결과도 production context로 전달하지 않는다.

### 4.4 `readyGolden` compatibility boundary

기존 manifest와 과거 proof가 사용하는 `readyGolden`은 V1에서 삭제하지 않고 `provenance.compatibility.legacyReadyGolden`으로 격리한다.

이 값에는 다음 금지를 적용한다.

- Teacher quality score 계산에 사용 금지
- Retrieval filter 또는 scoring에 사용 금지
- `seed-evidence → curated-teacher` 승격 근거로 사용 금지
- Ready Positive 또는 Golden 승격 근거로 사용 금지
- Visual Designer에 전달되는 `compactContext`에 포함 금지

이 값은 기존 자료를 읽고 상태를 감사하기 위한 호환 정보일 뿐이다. Teacher review는 `teacherStatus`와 `curation` 기록으로 판단하고, Ready Positive는 별도의 사용자 승인 기록으로만 판단한다.

### 4.5 TeacherGrammarRecord

Teacher Page와 구현 Pattern 사이에는 얇은 추상화 기록이 필요하다. 단, 새 실행 계층이 아니라 **근거와 경계를 정리하는 문서형 record**다.

```ts
type TeacherGrammarRecord = {
  schemaVersion: '1.0-draft';
  grammarId: string;
  status: 'candidate' | 'curated' | 'retired';
  supportingReferenceIds: string[];
  informationSignature: {
    semanticShapes: string[];
    requiredGroupRoles: string[];
    relationStructure: string[];
  };
  reusablePrinciples: string[];
  layoutGuidance: string[];
  applicability: TeacherPageRecord['applicability'];
  qualityRationale: TeacherPageRecord['qualityRationale'];
  reuseBoundary: TeacherPageRecord['reuseBoundary'];
  linkedPatternFragmentId?: string;
};
```

승격 순서는 다음과 같다.

```text
External Reference
→ TeacherPageRecord
→ 공통점·차이·경계 검토
→ TeacherGrammarRecord candidate
→ 기존 PatternFragment 중복 조사
→ 필요할 때만 PatternFragment 제안
→ 재사용성 및 실제 render 검증
```

Teacher Grammar가 만들어졌다는 사실은 Pattern 구현이나 Ready 품질을 의미하지 않는다.

## 5. Curated Teacher 6개 매핑

아래 6개 External Master는 human curation과 사용자 승인을 완료해 현재 모두 `curated-teacher`다. 이는 추출한 추상 디자인 원칙을 선택기가 참고할 수 있다는 뜻이며, Ready Positive·Golden·Renderer 품질 승인을 뜻하지 않는다. 6개 모두 `compatibility.legacyReadyGolden=false`를 유지한다.

| Reference | Information Structure | Visual Grammar 핵심 | Applicability | Boundary | 재사용 원칙 |
| --- | --- | --- | --- | --- | --- |
| `ext-2025-pokemon-problem-task-leak` | process → perceived progress → hidden gap → diagnosed problem | 좌→우 과정 안에서 누락 지점을 경계 사건으로 강조 | 정상처럼 보이는 과정 안의 누락·병목을 진단할 때 | 단순 순서 설명, 누락이나 진단이 없는 메커니즘 | 과정 내부의 중요한 경계를 별도 사건으로 드러낸다 |
| `ext-2025-pokemon-card-format-concept` | primary artifact → feature annotations → concept synthesis | 중앙 실제 대상, 주변 주석, center-out reading | 실제 UI·오브젝트의 여러 설계 요소를 설명할 때 | 중심 artifact가 없거나 텍스트만으로 완결되는 내용 | 설명을 artifact에 직접 귀속시켜 추적 비용을 줄인다 |
| `ext-2025-pokemon-initiative-team-structure` | operating explanation + responsibility hierarchy | 설명과 구조도를 병치하고 상호 보완 | 조직, 역할, 책임, 모듈 관계를 함께 설명할 때 | 단일 선형 과정이나 비교가 핵심일 때 | 설명은 원칙을, 구조도는 관계를 맡도록 역할을 분리한다 |
| `ext-2025-shadowverse-accessibility-vs-competitiveness` | goal A ↔ goal B → unresolved tension | 대립 축, 균형 잡힌 두 관점, 중심 긴장 | 동시에 만족하기 어려운 두 설계 목표를 보여줄 때 | 단순 Before/After, 한쪽이 명백히 정답인 경우 | 두 목표를 동등하게 보여준 뒤 충돌 지점을 중심에 둔다 |
| `ext-2025-shadowverse-super-evolution` | shared baseline → before vs after → aligned spec difference | 좌우 정렬, 같은 기준의 대응쌍, 제한된 변화 강조 | 동일 기준으로 기존·개선 사양을 비교할 때 | pairing이 없거나 인과 흐름이 핵심일 때 | 같은 기준의 항목을 같은 행에 맞춰 변화 추적 비용을 줄인다 |
| `ext-2025-shadowverse-rules-vs-card-ability` | rule evidence → rule effect ∥ content evidence → content effect | 서로 다른 해결 레이어 병렬화, 각 레이어 내부의 국소 인과 | 규칙·콘텐츠 등 서로 다른 해결 레이어의 근거와 효과를 나란히 설명할 때 | 순차 단계, Before/After, 한 레이어에 근거나 효과가 없는 경우 | 해결 레이어를 분리하고 각 레이어 안에서만 근거→효과 관계를 표현한다. 화면에 없는 공통 문제를 visible fact로 만들지 않는다 |

### 5.1 상세 매핑 예시: Before / After Feature Spec

```json
{
  "provenance": {
    "referenceId": "ext-2025-shadowverse-super-evolution",
    "source": { "origin": "Shadowverse: Worlds Beyond / CEDEC 2025" },
    "year": 2025,
    "teacherStatus": "curated-teacher",
    "compatibility": { "legacyReadyGolden": false },
    "curation": {
      "reviewedBy": "human",
      "reviewedAt": "2026-09-04",
      "confidence": "medium"
    },
    "rights": {
      "status": "unknown",
      "analyzeAllowed": true,
      "deriveAbstractPrincipleAllowed": true,
      "reuseAssetAllowed": false,
      "redistributeAssetAllowed": false
    }
  },
  "informationStructure": {
    "pageGoal": "공통 출발점을 유지한 채 두 기능의 결과와 규칙 차이를 같은 기준으로 비교한다.",
    "primaryClaim": "새 기능은 기존 진화보다 더 강한 결과와 추가 규칙을 제공한다.",
    "semanticShape": "aligned-before-after-spec",
    "informationGroups": [
      { "groupId": "shared-baseline", "groupRole": "comparison-anchor", "order": 0, "itemCount": 1, "required": true },
      { "groupId": "existing-feature", "groupRole": "before", "order": 1, "itemCount": 1, "required": true },
      { "groupId": "new-feature", "groupRole": "after", "order": 2, "itemCount": 1, "required": true },
      { "groupId": "difference-marker", "groupRole": "contrast", "order": 3, "itemCount": 1, "required": true }
    ],
    "relationStructure": [
      {
        "fromGroupId": "existing-feature",
        "toGroupId": "new-feature",
        "relationType": "compared-on-same-criteria",
        "direction": "bidirectional",
        "scope": "page"
      }
    ],
    "readingPath": {
      "primary": "before-after",
      "startRole": "before",
      "endRole": "after"
    },
    "primaryArtifact": "aligned-comparison-field"
  },
  "applicability": {
    "fitsSemanticShapes": ["aligned-before-after-spec"],
    "requiredSignals": ["공통 비교 기준", "기존 상태", "신규 상태", "공통 비교 항목", "변경된 규칙 또는 수치"],
    "forbiddenSignals": ["서로 다른 비교 기준", "세 개 이상의 대안", "공통 기준이나 실제 차이 부재"],
    "densityRange": ["balanced", "dense"],
    "blockCount": { "min": 2, "hardLimit": false },
    "pairCount": { "min": 1, "hardLimit": false },
    "assetRequirements": []
  },
  "reuseBoundary": {
    "reusableAbstractPrinciples": [
      "동일 기준의 대응 항목을 같은 축에 정렬한다.",
      "변화 포인트만 제한적으로 강조한다."
    ],
    "prohibitedCopy": [
      "CEDEC frame",
      "Shadowverse IP",
      "원본 색상",
      "원본 좌표와 geometry",
      "원본 asset"
    ],
    "exactGeometryReusable": false,
    "sourcePaletteReusable": false,
    "sourceIpReusable": false,
    "sourceAssetReusable": false
  }
}
```

이 예시는 원본의 항목 수나 배치 수치를 hard rule로 만들지 않는다. 가져오는 것은 대응 정렬과 변화 강조의 원칙뿐이다.

## 6. Corpus 등록과 갱신 계약

Master Teacher Corpus에서 말하는 학습은 모델 parameter 학습이 아니라 다음의 **증거 기반 정리 과정**이다.

1. 원본과 provenance를 등록한다.
2. 권리와 허용 사용 범위를 확인한다.
3. Information Structure와 Visual Grammar를 구조화한다.
4. 사람 또는 사람의 검토를 받은 분석만 `curated-teacher`가 될 수 있다.
5. 검색용 tag와 compact text를 생성한다.
6. 기존 Teacher Grammar와 중복·차이를 확인한다.
7. 여러 결과에서 유효성이 확인된 원칙만 Teacher Grammar 후보로 묶는다.
8. PatternFragment 구현은 별도 승인과 재사용성 검증 후 진행한다.

자동으로 허용하지 않는 변화:

- `seed-evidence → curated-teacher` 무인 승격
- `readyGolden=false → true` 변경
- 한 번의 사용자 선택을 Quality Grammar로 반영
- 검색 횟수나 모델 선호만으로 원칙 강화
- 모델이 만든 분석을 human review 없이 정본화

Corpus version은 포함 record의 `referenceId`, source hash, analysis version, status를 정렬해 만든 `corpusSnapshotHash`로 고정한다. 같은 검색을 재현하려면 request와 snapshot hash를 함께 기록한다.

## 7. Retrieval 입력 계약

### 7.1 입력

검색 입력은 전체 원문이나 대화가 아니라 `SlideIR + InformationPlan`에서 만든 작은 구조화 artifact다.

```ts
type TeacherRetrievalRequest = {
  schemaVersion: '1.0-draft';
  requestId: string;
  slideId: string;
  sourceContentHash: string;
  corpusSnapshotHash: string;
  usageMode: 'curation' | 'benchmark' | 'production';

  informationNeed: {
    intent: string;
    semanticShape: string;
    groupRoles: Array<{ role: string; itemCount: number }>;
    relationTypes: string[];
    relationShape: string[];
    primaryArtifactNeed: string;
    readingPathCandidates: string[];
    densityBand: 'sparse' | 'balanced' | 'dense';
    blockCount: number;
    pairCount?: number;
    availableAssets: string[];
  };

  constraints: {
    outputProfile: 'pdf-document' | 'pdf-presentation' | 'html-presentation';
    avoidSignatures: string[];
    prohibitedAssetUse: string[];
    topK: number;                       // 최대 5
    contextBudgetTokens: number;
  };
};
```

원칙:

- 원문 text는 source fidelity 단계에 남겨두고 Teacher 검색에는 기본적으로 보내지 않는다.
- group 역할, 관계, 항목 수, 필요한 artifact처럼 디자인 판단에 필요한 구조만 보낸다.
- 검색 결과를 AI에 전달할 때도 선택된 Teacher의 compact context만 전달한다.
- Reference 원본 이미지가 꼭 필요한 후속 판단은 별도 명시적 단계로 분리한다.
- `usageMode=production`이면 status filter가 `curated-teacher`만 통과시킨다.
- 호출자나 모델이 별도의 status 목록을 넘겨 production 허용 범위를 넓힐 수 없다.

### 7.2 검색 순서

```text
usageMode별 status policy
→ 권리·금지 조건 Hard Filter
→ 기존 deterministic tag scoring
→ 상세 applicability/cardinality scoring
→ 중복 reference diversity 조정
→ 상위 1~3개 compact Teacher Context 반환
→ 점수가 비슷한 경우에만 optional local reranker
```

V1의 기본은 deterministic retrieval이다. Local model reranker는 필수 Agent가 아니며, 규칙만으로 구분하기 어려운 동점 후보가 있을 때만 사용할 수 있다.

### 7.3 Hard Filter

다음 중 하나면 후보에서 제외한다.

- `usageMode=production`인데 `teacherStatus`가 `curated-teacher`가 아님
- `usageMode=benchmark`인데 `teacherStatus`가 `seed-evidence` 또는 `curated-teacher`가 아님
- `usageMode=curation`인데 자동 검색 대상으로 `retired`가 포함됨
- `analyzeAllowed=false` 또는 `deriveAbstractPrincipleAllowed=false`
- request가 `forbiddenSignals`에 해당
- 필수 group/relation signal 부재
- 실제 artifact가 필요한 grammar인데 input에 해당 asset이 없음
- 권리 범위를 넘는 asset 재사용이 필요

`readyGolden` 호환 값은 포함·제외 조건 자체가 아니다. Retrieval은 이 값을 읽지 않는다. Teacher 검색과 Ready 품질 승인은 서로 다른 문제다.

이 status policy는 scoring보다 먼저 실행되는 일반 코드 계약이다. production request가 직접 reference ID를 지정해도 status filter를 우회할 수 없으며, 차단된 record의 분석문이나 compact text는 모델 입력을 구성하는 단계까지 전달되지 않는다.

### 7.4 Scoring 기준

Hard Filter를 통과한 후보만 100점 기준으로 비교한다.

| 항목 | 점수 | 판단 근거 |
| --- | ---: | --- |
| semantic shape 적합성 | 30 | 설명 구조가 같은가 |
| relation structure 적합성 | 25 | 비교·인과·계층 등 관계가 같은가 |
| primary artifact 적합성 | 15 | 필요한 시각 주체가 같은가 |
| group role 및 cardinality | 10 | before/after, evidence 등 역할과 개수가 맞는가 |
| reading path | 10 | 의도한 읽는 순서가 맞는가 |
| density 및 공간 전략 | 10 | 정보량과 page density가 맞는가 |

점수는 품질 점수가 아니라 **현재 정보에 대한 적용 적합도**다. 높은 점수가 Ready 결과를 보장하지 않는다.

같은 원본·같은 grammar의 유사 페이지가 상위 결과를 독점하지 않도록 source/grammar cluster당 반환 수를 제한한다. 기존 index는 최대 5개까지 유지할 수 있지만, 모델 context에는 보통 1~3개만 전달한다.

## 8. Retrieval 출력 계약

```ts
type TeacherRetrievalResult = {
  schemaVersion: '1.0-draft';
  requestId: string;
  corpusSnapshotHash: string;
  candidates: Array<{
    referenceId: string;
    teacherStatus: 'seed-evidence' | 'curated-teacher';
    compatibility?: {
      legacyReadyGolden: boolean;        // audit 전용, score/context 사용 금지
    };
    grammarIds: string[];
    totalScore: number;
    scoreBreakdown: Record<string, number>;
    matchedSignals: string[];
    mismatchedSignals: string[];
    applicabilityNotes: string[];
    reusablePrinciples: string[];
    prohibitedCopy: string[];
    compactContext: {
      informationStructure: string;
      visualGrammar: string[];
      qualityRationale: string[];
      boundary: string[];
    };
  }>;
  rejected: Array<{
    referenceId: string;
    reasons: string[];
  }>;
  trace: {
    retrievalRuleVersion: string;
    requestedTopK: number;
    returnedCount: number;
    contextTokenEstimate: number;
  };
};
```

출력에는 단순 ID와 점수만 주지 않는다. 왜 맞았고, 무엇은 맞지 않으며, 무엇을 복제하면 안 되는지가 함께 있어야 Visual Designer가 reference의 표면만 흉내 내는 일을 막을 수 있다.

Production Visual Designer에 전달되는 view에서는 `compatibility`를 제거한다. 이 값은 curator/debug trace에서만 확인할 수 있다.

## 9. Quality Knowledge와 User Preference 분리

| 항목 | Teacher Corpus | Preference Memory |
| --- | --- | --- |
| 질문 | 이 정보에 어떤 구조가 효과적인가 | 이 사용자는 어떤 표현을 더 선호하는가 |
| 근거 | 검토된 외부 reference와 quality rationale | 사용자 선택·거절 event |
| 사용 시점 | Composition 후보를 만들기 전 | 품질 하한을 통과한 후보의 순위 조정 |
| 금지 | 취향을 품질 정답으로 간주 | Hard Gate나 Teacher boundary를 무시 |
| 저장 | Reference Engine corpus | 기존 preference-learning/memory 구조 |

적용 순서는 다음과 같다.

```text
Hard constraints
→ Teacher applicability / quality knowledge
→ Composition candidates
→ Hard/Soft quality validation
→ User Preference로 후보 순위 보정
```

사용자가 화려한 안을 선호했다는 기록은 `accentStrategy`의 품질 원칙을 바꾸지 않는다. 반대로 Teacher가 효과적이라고 분석된 구조도 사용자의 명시적인 거절을 무시하는 근거가 되지 않는다.

## 10. 20~50개로 확장할 때 예상 병목

| 병목 | 위험 | V1 대응 |
| --- | --- | --- |
| 용어 분산 | 같은 구조가 `comparison`, `before-after`, `delta`로 갈라짐 | controlled vocabulary와 alias table 유지 |
| 분석자 간 label 차이 | 같은 page를 서로 다른 semantic shape로 기록 | 필수 field별 짧은 annotation guide와 human review |
| 한 장의 과잉 일반화 | 원본의 우연한 배치를 보편 규칙으로 오인 | soft cardinality, reuse boundary, supporting evidence 기록 |
| 유사 source 편중 | 같은 행사·회사 장표가 검색 상위를 독점 | hash 중복 검사와 source/grammar diversity cap |
| 권리 불명확 | 원본 asset을 실수로 output에 사용 | allowedUse hard filter, prohibitedCopy를 결과에 항상 포함 |
| asset 전제 누락 | screenshot 중심 grammar를 text-only 입력에 추천 | `assetRequirements`를 Hard Filter에 사용 |
| context 팽창 | 50장 분석 전체를 모델에 전달 | top 1~3 compact context, token budget, trace 기록 |
| 검색 품질 검증 부재 | 그럴듯하지만 부적합한 Teacher가 선택 | 대표 query 10~20개의 human-labelled retrieval benchmark |
| schema 변경 | 초기 record와 신규 record의 field 불일치 | schemaVersion, migration, corpusSnapshotHash |
| 다국어 tag 불일치 | 한국어 설명과 영어 enum이 분리 | enum은 고정하고 설명문만 다국어 허용 |
| Quality와 Preference 혼합 | 많이 선택된 스타일이 품질 원칙으로 승격 | 별도 저장소와 별도 promotion rule 유지 |

20~50개 규모에서는 외부 vector database가 필수는 아니다. 현재 deterministic index와 hash 기반 corpus snapshot으로 시작하고, retrieval benchmark에서 실제 한계가 확인된 경우에만 embedding 또는 reranker를 추가한다.

## 11. V5/V6/기존 Architecture와의 충돌 검토

| 대상 | 판정 | 설명 |
| --- | --- | --- |
| V5 Semantic IR / Information Plan | 충돌 없음 | Retrieval request는 기존 SlideIR을 Semantic IR로 재사용하고 InformationPlan의 구조만 받는다 |
| V5 Context/Token 원칙 | 일치 | 전체 corpus·대화 대신 top 1~3 compact artifact만 전달하고 token estimate를 trace한다 |
| V5 Memory Promotion | 일치 | evidence → analysis → grammar → 충분한 검증 → pattern 순서를 유지한다 |
| Quality Knowledge / Preference 분리 | 일치 | Teacher Corpus와 Pairwise Preference Record를 합치지 않는다 |
| V6 Provider/Model 교체 | 충돌 없음 | Corpus와 retrieval 계약은 특정 모델 ID나 provider를 모른다 |
| V6 Benchmark/Registry | 충돌 없음 | 향후 reranker/model을 쓸 경우 역할별 benchmark 결과만 Registry에 기록한다 |
| 기존 `ReferenceRecord` | 부분 확장 필요 | provenance·rights·기본 검색 tag는 재사용하고 상세 Teacher 분석은 sidecar로 둔다 |
| 기존 `ReferenceRetrievalBrief` | 부분 확장 필요 | usageMode, groupRoles, block/pair count, asset availability, forbidden signal을 추가해야 안전하고 정밀한 검색 가능 |
| 기존 `retrieveReferences()` | 호환 가능 | 현재 score를 1차 검색으로 유지하고 Hard Filter·세부 breakdown을 후속 보완한다 |
| 기존 External Master `analysis.json` | 중복 아님 | 새 schema를 채울 seed 분석이다. workflow `stageState`는 Teacher 지식이 아니므로 corpus schema에서 제외한다 |
| 기존 `PatternFragment` | 경계 유지 | Teacher 검색 결과가 PatternFragment를 자동 생성하거나 선택 확정하지 않는다 |

핵심 충돌은 없다. 필요한 것은 새로운 Architecture가 아니라 기존 Reference Engine의 **검색용 얇은 record**와 **분석용 상세 record**의 책임을 명확히 나누는 일이다.

주의할 이름 충돌이 하나 있다. 기존 자료의 `readyGolden`은 호환을 위해 유지할 수 있지만, Teacher 여부를 나타내는 값으로 사용하면 안 된다. `compatibility.legacyReadyGolden`으로 격리하고, `teacherStatus` 및 별도의 사용자 승인 기록과 독립적으로 검증해야 한다.

## 12. 구현 현황과 다음 순서

첫 구현 묶음은 완료되었다.

1. Controlled Vocabulary
2. `TeacherPageRecord` Zod Schema
3. External Master 6개 manual mapping
4. Schema / Rights / Status validation test

Human Curation Review와 03·05·06 correction은 완료되었다. 2026-09-04 사용자 승인으로 6개 모두 `curated-teacher`이며, 현재 production Teacher 선택기의 정식 후보로 사용할 수 있다. 이 상태는 Ready Positive·Golden·Renderer 품질 승인과 독립적이다.

현재 구현된 production 선택기는 `curated-teacher`만 허용하며, 직접 reference ID를 지정해도 `seed-evidence`와 `retired`를 반환하지 않는다. 목적·관계·그룹·실제 artifact·정보량·금지 조건을 순서대로 판정하고 최대 1~3개의 설명 가능한 결과를 반환한다.

다음 구현 단계는 별도 승인 후 아래 순서로 진행한다.

1. 실제 pipeline에서 선택 결과를 소비할 위치 결정
2. human-labelled retrieval benchmark 확장
3. curation/benchmark mode가 필요할 때만 범용 `usageMode` 계약 구현
4. benchmark에서 필요성이 확인될 때만 local reranker
5. corpus 확장 시 새 Teacher의 개별 검토 및 사용자 승격 승인

현재는 Renderer 연결, Teacher Grammar 자동 생성, embedding/vector DB, local reranker를 구현하지 않는다.

## 13. V1 완료 기준

Master Teacher Corpus V1의 향후 구현 완료 기준은 다음과 같다.

- 6개 curated Teacher가 schema validation을 통과한다.
- 모든 Teacher에 provenance, rights, applicability, reuse boundary가 있다.
- 6개 모두 `compatibility.legacyReadyGolden=false`이며 Teacher status와 분리되어 있다.
- production mode에서 `seed-evidence`와 `retired`가 모델 context에 도달하지 않는다.
- SlideIR + InformationPlan만으로 검색 request를 만들 수 있다.
- 검색 결과가 matched reason과 boundary를 함께 반환한다.
- 전체 corpus 대신 제한된 compact context만 전달된다.
- 같은 corpus snapshot과 request에서 deterministic 결과가 재현된다.
- User Preference가 Teacher score나 quality rationale을 직접 변경하지 않는다.
- legacy `readyGolden` 값이 filter, score, 승격 판단에 사용되지 않는다.
- PatternFragment와 Ready Positive의 자동 승격 경로가 없다.

현재 단계에서는 6개 Teacher의 human curation·사용자 승인·정식 등록, 기획 내용 기반 자동 선택, 선택 원칙의 설계 단계 Guidance 전달까지 완료되었다. Guidance를 사용한 실제 배치·장표 재생성·품질 검증은 아직 진행하지 않았다.
