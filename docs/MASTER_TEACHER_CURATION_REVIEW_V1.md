# Master Teacher Corpus V1 — Human Curation Review

## 1. 검토 상태

- 검토 대상: `external-master-2025-v1` 6개 reference 이미지와 `teacher-pages.v1.json`
- 검토 방식: 실제 이미지 관찰과 기존 `analysis.json`·Teacher mapping 대조
- 결과 성격: curation 제안
- Teacher status 변경: 없음
- 현재 상태: 6개 모두 `seed-evidence`

이 문서의 `curate-ready`는 바로 `curated-teacher`로 승격한다는 뜻이 아니다. mapping correction 여부를 판정한 것이며, 실제 승격에는 사용자 승인이 별도로 필요하다.

판정 의미:

- `curate-ready`: 현재 mapping이 실제 이미지와 충분히 일치해 승격 심사에 올릴 수 있음
- `needs-correction`: Teacher 가치는 있으나 production 사용 전에 mapping 수정이 필요함
- `reject-as-teacher`: 재사용 가능한 정보 구조 근거가 부족해 Teacher로 사용하기 어려움

## 2. Workflow metadata 경계

`analysis.json.stageState`는 External Master 분석이 작성된 당시의 historical workflow snapshot이다. 현재 프로젝트 상태를 뜻하지 않는다.

근거:

- 실제 사용처는 source schema와 보존 테스트뿐이다.
- Renderer, Critic, pipeline control, Teacher Retrieval에서 읽지 않는다.
- 현재 프로젝트에서는 MEC-01 Stage 7 단일 revision cycle이 이미 완료되었다.
- `TeacherPageRecord`에는 이 값이 복사되지 않았다.

따라서 원본 값은 evidence 호환을 위해 보존하되, 현재 workflow 판단·Teacher scoring·production context·승격 근거로 사용할 수 없다.

## 3. Reference별 검토

### 01 Pokémon — Problem / Diagnosis

Reference ID: `ext-2025-pokemon-problem-task-leak`

| 검토 항목 | 판정 |
| --- | --- |
| Information Structure | 일치. 상단 문제 규정, 정상처럼 보이는 작업 흐름, 팀의 진행 인식, 실제 누락 경고가 이미지에 모두 보인다. |
| Visual Grammar 근거 | 충분함. 좌→우 단계, 하단 인식, 점선 경계, 붉은 누락 경고가 관찰된다. |
| 과잉 해석 | `nominal-process → team-perception`은 직접 화살표가 아니라 위치와 발화로 표현되지만, 이미지가 뒷받침하는 합리적 해석이다. |
| Applicability / Boundary | 합리적. 숨은 누락이나 인식 오류가 없는 단순 순서에는 사용하지 않는 경계가 중요하다. |
| Abstract Principle | 충분히 추상적이다. 프로세스 안의 경계를 사건으로 드러낸다는 원칙은 원본 좌표·색과 분리되어 있다. |
| Prohibited Copy | 충분함. 로고, IP, 브랜드 색, 인물 아이콘, 정확한 좌표를 제외한다. |
| 다른 장표 재사용 가치 | 높음. 제작 과정 병목, 요구사항 누락, QA gap, 검수 실패 설명에 재사용 가능하다. |
| Confidence | `medium → high` 상향 제안. 정보 구조와 시각 근거가 명확하다. |

최종 제안: `curate-ready`

### 02 Pokémon — Feature Concept / UI Annotation

Reference ID: `ext-2025-pokemon-card-format-concept`

| 검토 항목 | 판정 |
| --- | --- |
| Information Structure | 일치. 중앙 카드, 네 개의 국소 annotation, 하단 concept synthesis가 분명하다. |
| Visual Grammar 근거 | 충분함. center-out 구조와 일대일 leader line이 실제 이미지에서 확인된다. |
| 과잉 해석 | annotation이 전체 concept을 `supports`한다는 관계는 직접 선으로 연결되지는 않지만 페이지의 하단 종합 문장이 이를 뒷받침한다. |
| Applicability / Boundary | 합리적. 실제 artifact와 식별 가능한 anchor 위치가 없으면 사용할 수 없다는 제한이 정확하다. |
| Abstract Principle | 충분히 추상적이다. 실제 대상을 증거로 두고 설명을 위치에 귀속한다는 원칙만 남겼다. |
| Prohibited Copy | 충분함. 카드·캐릭터 IP, 라벨 형태, 색, 좌표와 선 길이를 제외한다. |
| 다른 장표 재사용 가치 | 높음. 전투 UI, HUD, 아이템, 스킬 화면, 보스 패턴 screenshot 설명에 유용하다. |
| Confidence | `medium → high` 상향 제안. 촬영 원본의 원근 왜곡은 있으나 구조 판독에는 영향이 없다. |

최종 제안: `curate-ready`

### 03 Pokémon — Organization / Structure

Reference ID: `ext-2025-pokemon-initiative-team-structure`

| 검토 항목 | 판정 |
| --- | --- |
| Information Structure | 대체로 일치. 좌측 운영 설명, 우측 조직 구조, 개선 이후 상태 라벨이 모두 보인다. |
| Visual Grammar 근거 | 설명과 구조도의 병치, 상하 계층선, 책임자 강조는 실제로 관찰된다. |
| 과잉 해석 | `membership-and-reporting` 중 `reporting`은 이미지에서 명시적으로 확정하기 어렵다. 구조선은 소속·책임 묶음으로 읽는 편이 안전하다. |
| Applicability / Boundary | 합리적. 계층·책임 설명에 적합하고 시간 순서나 인과에는 부적합하다. |
| Abstract Principle | 충분히 추상적이다. 텍스트는 운영 원칙, 도식은 구조 관계를 맡는 역할 분리가 핵심이다. |
| Prohibited Copy | 충분함. 행사 프레임, 발표자 영상, 로고, IP, 아이콘, 정확한 2열 비율을 제외한다. |
| 다른 장표 재사용 가치 | 높음. 조직뿐 아니라 시스템 모듈, 담당 영역, 기능 소유권 설명에도 적용 가능하다. |
| Confidence | `medium` 유지. connector 의미를 수정한 뒤 상향 여부를 다시 판단한다. |

필요한 correction:

- `connectorSemantics.relationRole`의 `membership-and-reporting`을 관찰 가능한 `responsibility-and-membership` 수준으로 제한한다.
- 구조선이 보고 체계라는 단정은 source에 명시된 경우에만 사용한다.

최종 제안: `needs-correction`

### 04 Shadowverse — Trade-off / Problem Framing

Reference ID: `ext-2025-shadowverse-accessibility-vs-competitiveness`

| 검토 항목 | 판정 |
| --- | --- |
| Information Structure | 일치. 접근성 목표, 경쟁성·복잡성 목표, 양립의 어려움이라는 종합 판단이 세 발화로 분리되어 있다. |
| Visual Grammar 근거 | 충분함. 두 관점이 화면 양쪽과 서로 다른 높이에 놓이고 마지막 판단이 하단에서 묶는다. |
| 과잉 해석 | 직접 화살표 없이 위치와 발화 방향을 relation carrier로 본 해석은 실제 composition과 맞는다. |
| Applicability / Boundary | 합리적. 한쪽이 정답인 비교나 정량 Before/After에는 사용하지 않는 것이 맞다. |
| Abstract Principle | 충분히 추상적이다. 캐릭터나 말풍선이 아니라 동등한 두 관점과 중심 긴장만 재사용한다. |
| Prohibited Copy | 충분함. 캐릭터·IP·말풍선 외형·브랜드 색·행사 프레임을 제외한다. exact geometry도 schema에서 금지된다. |
| 다른 장표 재사용 가치 | 높음. 접근성 대 깊이, 리스크 대 보상, 편의성 대 숙련도 같은 게임 설계 trade-off에 적합하다. |
| Confidence | `medium → high` 상향 제안. 제목과 세 발화가 semantic relation을 명시적으로 뒷받침한다. |

최종 제안: `curate-ready`

### 05 Shadowverse — Before / After / Feature Spec

Reference ID: `ext-2025-shadowverse-super-evolution`

| 검토 항목 | 판정 |
| --- | --- |
| Information Structure | 일치. 동일한 기준 카드에서 기존 진화와 신규 초진화가 갈라지고 수치·규칙 차이를 병렬 비교한다. |
| Visual Grammar 근거 | 좌우 열, 같은 높이의 결과 이미지, 열 내부 변환, 중앙 차이 표식이 실제로 확인된다. |
| 과잉 해석 | 별도의 message/claim이 화면에 없는데 `titleMessagePlacement.relationship=combined`로 기록한 것은 과하다. 제목은 기능명이고 primary claim은 분석자가 비교 결과를 종합한 값이다. |
| Applicability / Boundary | 합리적. 동일 기준과 pairing이 없는 비교, 세 개 이상의 대안에는 적합하지 않다. |
| Abstract Principle | 충분히 추상적이다. 동일 기준 정렬과 제한적 변화 강조만 남겼다. |
| Prohibited Copy | 충분함. 카드·캐릭터 IP, 행사 프레임, 색, 정확한 열 geometry를 제외한다. |
| 다른 장표 재사용 가치 | 매우 높음. 리워크, 패치, 기능 개선, 전후 수치·규칙 비교에 직접 적용 가능하다. |
| Confidence | `medium` 유지. message placement와 density correction 후 재검토한다. |

필요한 correction:

- `titleMessagePlacement.relationship`을 `combined`가 아니라 별도 message가 없음을 뜻하는 `absent`로 수정한다.
- slide content만 기준으로 보면 `pageOccupancy.band=dense`는 과한 분류다. `balanced`가 더 적절하다.
- `primaryClaim`은 화면에 표시된 headline이 아니라 curator synthesis임을 curation note에서 분명히 한다.

최종 제안: `needs-correction`

### 06 Shadowverse — System Comparison / Countermeasure

Reference ID: `ext-2025-shadowverse-rules-vs-card-ability`

| 검토 항목 | 판정 |
| --- | --- |
| Information Structure | 두 대응 레이어와 각 열의 근거→효과는 일치한다. 그러나 별도 `shared-problem` block은 현재 이미지에 보이지 않는다. |
| Visual Grammar 근거 | 규칙/카드 능력 두 열, 열 내부 하향 화살표, 서로 다른 증거 형식은 명확히 관찰된다. |
| 과잉 해석 | `shared-problem`을 required visible group으로 두고 두 레이어가 그 group을 직접 완화한다고 기록한 부분은 이전 문맥을 추론한 것이다. `readingPath.endRole=target`도 화면에 있는 종착점이 아니다. |
| Applicability / Boundary | 레이어별 대응이라는 적용 범위와 순차 단계·Before/After 금지는 합리적이다. |
| Abstract Principle | 충분히 추상적이지만, 공통 문제를 반드시 화면에 표시해야 한다는 의미로 사용하면 원본보다 강한 규칙이 된다. |
| Prohibited Copy | 충분함. 행사 프레임, 발표자 영상, 로고, 카드·IP, 색, 정확한 표 geometry를 제외한다. |
| 다른 장표 재사용 가치 | 높음. 시스템 규칙/콘텐츠 데이터/UI 피드백처럼 서로 다른 해결 레이어를 설명할 때 유용하다. |
| Confidence | `medium → low` 하향 제안. 관찰된 구조와 이전 문맥에서 추론한 문제를 분리한 뒤 다시 평가한다. |

필요한 correction:

- `shared-problem`을 이미지에 직접 표시된 required group으로 취급하지 않는다.
- 화면에서 관찰되는 핵심을 `rule-layer evidence → rule effect`와 `content-layer evidence → content effect`의 두 국소 인과로 다시 구조화한다.
- 공통 문제는 source 문맥이 추가로 확인될 때만 context 또는 inferred relation로 기록한다.
- `readingPath.endRole`을 화면에 실제 존재하는 effect 역할로 수정한다.
- 별도 주장형 message가 없으므로 `titleMessagePlacement.relationship=combined`를 재검토한다.

최종 제안: `needs-correction`

## 4. Curation 제안 요약

| Reference | 제안 | Confidence 제안 | 핵심 판단 |
| --- | --- | --- | --- |
| 01 Problem / Diagnosis | `curate-ready` | medium → high | 구조와 진단 경계가 명확함 |
| 02 Feature Annotation | `curate-ready` | medium → high | artifact와 annotation 귀속이 명확함 |
| 03 Organization / Structure | `needs-correction` | medium 유지 | reporting 의미를 관찰 범위로 제한 필요 |
| 04 Trade-off | `curate-ready` | medium → high | 두 목표와 긴장이 명시적임 |
| 05 Before / After | `needs-correction` | medium 유지 | message 부재와 density 수정 필요 |
| 06 Layered Countermeasure | `needs-correction` | medium → low | 화면에 없는 shared-problem을 visible group으로 추론함 |

`reject-as-teacher` 제안은 없다. 여섯 장 모두 재사용 가치가 있으나 03·05·06은 correction 후에만 승격 심사를 진행해야 한다.

## 5. 다음 판단 지점

이번 검토에서는 mapping이나 status를 변경하지 않는다. 다음 단계에서 사용자가 curation 제안을 승인하면 다음 작업을 별도로 진행할 수 있다.

1. 03·05·06 mapping correction
2. correction validation
3. 01·02·04 및 수정 완료 Teacher의 개별 승격 심사

승격이 승인되기 전까지 6개 모두 production Retrieval 대상이 아니다.
