# V1 Accumulation → Threshold → Consequence Render Contract

상태: Message presentation/suppression 기반 계약 구현 완료. 시각 primitive 구현 전 사용자 승인 필요.

범위:

- 대상 Pattern은 `pattern-accumulation-threshold-consequence`다.
- PatternFragment와 CompositionPlan 계약은 변경하지 않는다.
- 이 문서는 `SlideIR + InformationPlan + CompositionPlan`을 RenderTree로 바꾸는 최소 계약만 정의한다.
- PNG 생성, Critic, 자동 수정은 범위 밖이다.

## 1. 설계 원칙

1. CompositionPlan의 네 region이 화면 구조의 authoritative input이다.
2. InformationPlan은 message 원문과 관계 보존의 근거로만 사용한다.
3. Renderer는 새로운 문장, 요약, 단계명, 수치를 만들지 않는다.
4. 전역 reading path는 region의 위치·정렬·간격으로 표현한다. 모든 관계를 하나의 전역 선으로 그리지 않는다.
5. 각 source relation은 의미에 맞는 relation primitive가 담당하고 `relationId`를 유지한다.
6. 카드 반복을 기본 표현으로 사용하지 않는다.
7. Threshold의 우선순위 5는 대비, 격리, 경계 표현으로 드러낸다. 화면 면적을 크게 점유하는 장식으로 표현하지 않는다.

## 2. 필요한 Visual Primitive

아래 primitive는 새로운 RenderTree node 종류가 아니다. 기존 `group`, `shape`, `text` node를 의미 단위로 묶은 composite primitive다.

| Primitive | 구성 | Semantic responsibility |
| --- | --- | --- |
| `message-context` | source-traced text 또는 suppression record | 사용자 원문 message를 표시하거나, 완전 중복이면 표시하지 않은 이유와 trace를 보존한다. 새 headline을 생성하지 않는다. |
| `accumulation-sequence` | group + shared track/field + ordered steps | 여러 준비·축적 block이 하나의 국소 과정임을 보여준다. |
| `ordered-step` | text + 선택적 geometric marker | accumulation 내부 block 하나를 표현하고 원문 순서를 유지한다. 기본값은 카드가 아니다. |
| `local-sequence-link` | short line/path 또는 track segment | accumulation 내부의 인접 relation을 표현한다. 각 segment가 source `relationId`를 가진다. |
| `threshold-boundary-event` | bounded divider + marker + source-traced text | accumulation과 consequence 사이의 상태 경계와 threshold block을 동시에 표현한다. |
| `phase-handoff` | short directional bridge/notch | 한 phase에서 다음 phase로 넘어가는 source relation을 표현한다. 긴 전역 화살표가 아니다. |
| `consequence-result` | group + result label + optional value emphasis | threshold 이후 적용되는 결과 block을 표현한다. 수치와 결과 의미를 함께 유지한다. |

## 3. Region / Binding → Primitive 변환

| Composition input | Render primitive | 변환 규칙 |
| --- | --- | --- |
| `message-context` region | `message-context` 또는 suppression | InformationPlan.message를 분류하여 표시하거나 완전 중복으로 명시적으로 억제한다. |
| `phase-accumulation` region | `accumulation-sequence` | 이 region의 binding을 readingOrder로 정렬한다. |
| `accumulation.*` binding | `ordered-step` | 각 semantic block의 ContentRef만 표시한다. |
| accumulation 내부 relation | `local-sequence-link` | 같은 accumulation region에 속한 인접 block relation만 연결한다. |
| `phase-threshold` region | `threshold-boundary-event` | region 자체는 좁은 경계 구역, binding은 경계 사건 label이 된다. |
| accumulation → threshold relation | `phase-handoff:threshold-entry` | 축적 track의 종료와 threshold marker를 짧게 연결한다. |
| `phase-consequence` region | consequence group | 경계 이후의 결과가 한 영역으로 읽히게 정렬한다. |
| `consequence.*` binding | `consequence-result` | label과 value를 같은 결과 단위 안에서 서로 다른 위계로 표현한다. |
| threshold → consequence relation | `phase-handoff:consequence-activation` | threshold에서 결과 영역으로 진입하는 짧은 방향 신호를 사용한다. |

## 4. Message Context 처리

### 4.1 현재 문제

CompositionPlan에는 `message-context` region이 있지만 block binding이 없다. InformationPlan.message는 ContentRef이므로 이미 다음 정보를 가진다.

- text
- sourceSpanIds
- exact/join transform
- locked 상태

별도의 SemanticBlock이나 AI headline을 추가할 필요가 없다.

### 4.2 최소 처리 방식

Renderer는 `role=message`인 region과 InformationPlan.message를 확인하고 다음 세 상태 중 하나를 deterministic하게 선택한다.

### 4.2.1 `headline`

- 사용자가 별도로 작성한 message source span이 block source span과 겹치지 않는다.
- 실제 source-traced text node를 표시할 수 있다.
- Renderer가 새로운 headline 문장을 생성하지 않는다.

### 4.2.2 `context`

- message와 일부 block source span이 겹치지만 message에 별도의 원문 문맥이 남아 있다.
- 작은 source-traced context text로 표시할 수 있다.
- 줄바꿈은 허용하지만 축약, 재작성, 접두 라벨 추가는 금지한다.

### 4.2.3 `suppressed-duplicate`

- message가 모든 block source 내용을 포함한다.
- block에 포함되지 않은 message 문자가 공백·화살표·구분자뿐이다.
- 동일 원문 text node를 다시 만들지 않는다.
- message를 삭제하지 않고 sourceSpanIds, sourceTransform, suppression reason을 결과에 보존한다.

고정 suppression reason:

`all-message-content-is-already-presented-by-blocks`

세 상태의 감사 기록은 최종 `RenderTree.messagePresentation`에 저장한다. suppressed 상태는 text node를 만들지 않으며, 빈 text·투명 text·offscreen text로 우회하지 않는다.

`page-claim`은 원문에 별도 claim 문장이 있거나 사용자가 명시한 경우에만 향후 허용한다. V1 resolver가 claim을 추론하지 않는다.

### 4.3 원문 중복 처리

현재 Source Fidelity Validator는 message 전체와 block별 원문을 함께 표시하면 `duplicate-content`로 판정한다. 이를 우회하지 않고 용도를 명시적으로 구분한다.

- 일반 block text와 독립 headline: `sourceUsage=content`
- block 원문과 일부 겹치는 context: `sourceUsage=context-repeat`
- 완전 중복 message: text node를 만들지 않고 `suppressed-duplicate` record만 유지

`context-repeat`도 text와 source span의 exact 일치를 검증한다. 존재하지 않는 source span이나 변형된 text는 실패한다. 다만 locked source coverage의 소유권은 갖지 않으며 누락/중복 횟수에는 더하지 않는다.

추가 Hard Gate 규칙:

- message는 `headline`, `context`, `suppressed-duplicate` 중 정확히 하나로 처리되어야 한다.
- headline/context의 text/sourceSpanIds/sourceTransform은 InformationPlan.message와 같아야 한다.
- 표시되는 message text는 `compositionRegionId=message-context` 아래에 있어야 한다.
- source span이 일부 겹치면 `context-repeat`, 겹치지 않으면 `content`여야 한다.
- suppressed 결과에는 text가 없어야 하고 deterministic reason과 source trace가 있어야 한다.
- message node는 semantic block 누락을 대신 충족할 수 없다.

## 5. Accumulation Primitive

### `accumulation-sequence`

- 모든 accumulation binding을 하나의 group에 둔다.
- group 안에 하나의 shared track 또는 정렬축을 둔다.
- 각 step은 text와 작은 marker로 anchor된다.
- 개별 step에 반복 rect/round-rect 배경을 기본 적용하지 않는다.
- 단계 사이에는 source relation이 있는 구간만 `local-sequence-link`를 만든다.

Block 수 대응:

- 2~4개: 한 행의 shared track을 우선한다.
- 5개 이상 또는 측정 폭 부족: deterministic multi-lane sequence로 wrap한다.
- lane이 바뀌면 명확한 turn connector를 사용하고 readingOrder는 그대로 유지한다.
- font 축소보다 측정 기반 wrap을 우선한다.

각 `ordered-step`은 binding의 `semanticBlockId`, prominence, ContentRef source trace를 유지한다.

## 6. Threshold Primitive

### `threshold-boundary-event`

구성:

- content band 안에서만 작동하는 bounded divider
- divider에 결합된 marker 또는 notch
- threshold block의 source-traced text
- accumulation 종료와 consequence 시작 사이의 의도적인 간격

Prominence 5 반영:

- 세 phase 중 가장 강한 명도/색 대비
- 가장 높은 font weight
- 주변 간격을 통한 격리
- threshold marker와 text의 직접 결합

금지:

- 페이지 대부분을 덮는 원·사각형·배경 필드
- threshold text만 과도하게 확대
- 의미 없는 glow, gradient, 장식선
- accumulation이나 consequence를 가리는 overlay

Soft visual heuristic:

- threshold region은 content band 폭의 약 8~16% 범위에서 시작할 수 있다.
- divider는 content band 높이 안에 머문다.
- 이는 Hard Gate나 schema validation 범위가 아니다.
- 실제 text measurement와 page profile에 따라 8~16%를 벗어날 수 있다.
- 최종 값은 측정 결과로 결정하며 고정 좌표를 복사하지 않는다.

## 7. Consequence Primitive

### `consequence-result`

- 결과 block 전체가 하나의 의미 단위로 읽혀야 한다.
- metric block은 label, value, unit을 분리 측정하되 같은 semantic block group 안에 둔다.
- `+50%` 같은 value는 label보다 강하게 표시할 수 있다.
- value만 고립시키지 않고 결과명과 threshold 이후 관계를 함께 보이게 한다.
- consequence가 여러 개면 같은 결과 field 안에서 readingOrder에 따라 정렬한다.
- consequence도 기본적으로 카드가 아니다. 필요하면 얇은 side rule 또는 제한된 tonal field만 사용한다.

## 8. Relation 표현 분리

| Relation class | 판별 방식 | 화면 표현 | Trace |
| --- | --- | --- | --- |
| Global reading path | Composition region order | phase 위치, 정렬, 여백 | 별도 relationId 없음. source relation으로 위장하지 않는다. |
| Accumulation local sequence | from/to binding이 모두 accumulation | shared track의 짧은 segment | 각 segment에 원본 relationId |
| Accumulation → Threshold | accumulation에서 threshold로 진입 | track 종료 + threshold entry handoff | 원본 relationId |
| Threshold → Consequence | threshold에서 consequence로 진입 | boundary에서 결과 field로 이어지는 activation bridge | 원본 relationId |
| Consequence local sequence | from/to binding이 모두 consequence | 결과 field 내부의 낮은 강도 connector | 원본 relationId |

분류는 block 문구나 fixture ID가 아니라 `binding.regionId`와 source relation endpoint로 deterministic하게 수행한다.

모든 relation은 최소 하나의 visible relation carrier를 가져야 한다. 하나의 composite connector가 line과 arrowhead 두 node로 구성되면 두 node가 같은 relationId를 가질 수 있다.

## 9. Source / Relation Trace 계약

### Text

- 기존 `sourceSpanIds`, `sourceTransform`을 그대로 사용한다.
- block text는 기존 `semanticBlockId`를 유지한다.
- message text는 semanticBlockId를 만들지 않고 InformationPlan.message와 직접 대조한다.

### Visual block primitive

- ordered-step marker, threshold marker, consequence emphasis shape는 담당 block의 `semanticBlockId`를 가질 수 있다.
- 장식 전용 배경은 semanticBlockId를 갖지 않는다.

### Relation primitive

- source relation을 표현하는 visible shape/path에 `relationId`를 둔다.
- 순수 정렬축이나 phase background는 relationId를 갖지 않는다.
- Hard Gate는 모든 SlideIR relationId가 최소 한 번 visible하게 표현됐는지 확인한다.

## 10. 기존 RenderTree로 가능한 것

현재 타입으로 다음은 이미 가능하다.

- group으로 phase와 composite primitive 구성
- rect, line, ellipse, path로 track, divider, marker, bridge 표현
- text node의 정확한 source trace
- semanticBlockId와 relationId 연결
- parentId를 통한 primitive 계층
- zIndex, box, paint를 통한 시각 위계
- 기존 overflow, collision, bounds, contrast 검사

따라서 `ordered-step`, `threshold-boundary-event` 같은 새 node kind를 추가할 필요는 없다.

## 11. 필요한 최소 RenderTree 확장

기존 node ID 문자열을 해석해 의미를 추측하지 않도록 NodeBase에 다음 optional metadata를 추가한다.

```ts
compositionRegionId?: string
visualRole?:
  | 'message-context'
  | 'phase-container'
  | 'ordered-step'
  | 'threshold-boundary'
  | 'threshold-event'
  | 'consequence-result'
  | 'relation-carrier'

relationVisualRole?:
  | 'accumulation-local'
  | 'threshold-entry'
  | 'consequence-activation'
  | 'consequence-local'
```

TextNode에만 다음을 추가한다.

```ts
sourceUsage?: 'content' | 'context-repeat'
```

RenderTree root에는 감사와 Hard Gate 판별을 위한 다음 optional field를 추가한다.

```ts
layoutFamily?: string
messagePresentation?:
  | { presentationKind: 'headline' | 'context'; sourceSpanIds; sourceTransform }
  | {
      presentationKind: 'suppressed-duplicate'
      sourceSpanIds
      sourceTransform
      suppressionReason: 'all-message-content-is-already-presented-by-blocks'
    }
```

기존 node는 optional field가 없어도 유효해야 한다. 별도의 Primitive IR, 새 package, 새 RenderTree node kind는 추가하지 않는다.

## 12. 최소 변경안

1. PatternFragment와 CompositionPlan은 변경하지 않는다.
2. RenderTree에 optional semantic metadata만 추가한다.
3. InformationPlan.message를 `headline | context | suppressed-duplicate`로 분류하는 deterministic resolver를 Renderer 내부에 둔다.
4. 새 layout family 전용 region placement와 composite primitive builder를 추가한다.
5. source relation endpoint의 region으로 relation visual role을 분류한다.
6. message `context-repeat`를 Source Fidelity coverage에서 분리하되 exact trace 검증은 유지한다.
7. 기존 Hard Gate의 block/relation/source/overflow/collision 원칙은 유지한다.

새로운 중간 IR은 만들지 않는다.

## 13. 구현 순서

1. 완료: RenderTree optional metadata와 message sourceUsage contract 추가
2. 완료: message resolver 세 상태와 suppression trace 테스트
3. 완료: relation visual-role classifier 테스트
4. 완료: message measurement, 실제 RenderTree node/suppression 기록, Message Hard Gate 연결
5. 승인 후 accumulation sequence placement와 2/3/4+ block 구조 테스트
6. 승인 후 threshold boundary event primitive 테스트
7. 승인 후 consequence label/value primitive 테스트
8. generic 4-block/7-block fixture로 RenderTree 구조·trace 테스트
9. MEC-01 RenderTree 생성 및 Hard Gate 확인
10. 그 이후에만 실제 PNG 생성과 screenshot inspection
11. PNG 승인 후 Critic 단계 재검토

## 14. 더 이상 authoritative 하지 않아야 하는 기존 Renderer 로직

다음 로직은 기존 Pattern 지원을 위해 남길 수 있지만 새 layout family의 디자인을 결정해서는 안 된다.

1. `placeRegions()`의 generic horizontal fallback
   - 새 family는 accumulation / threshold / consequence 전용 placement를 사용한다.
2. `placementsInRegion()`의 모든 binding 동일 간격 배치
   - accumulation, threshold, consequence는 서로 다른 composite primitive builder가 담당한다.
3. `styleForBinding()`의 `fragmentRole === 'modifier'` 문자열 검사
   - 현재 새 binding은 `consequence.modifier`다. primitive와 ContentRef 역할로 위계를 결정한다.
4. `motifNodes()`의 motif family 기반 대형 배경 도형
   - threshold primitive가 경계 의미와 면적 제한을 직접 책임진다.
5. 모든 SlideIR relation을 동일한 `relationNodes()`로 변환하는 로직
   - relation visual role별 builder로 분리한다.
6. 모든 block에 같은 `connectorMarkers()`를 추가하는 로직
   - accumulation marker, threshold marker, consequence emphasis의 의미를 구분한다.
7. layout family별 고정 `sharedConnectorY`
   - 전역 reading path와 국소 relation을 하나의 선에 강제로 합치지 않는다.
8. nodeId 문자열로 region/primitive 의미를 추정하는 방식
   - optional `compositionRegionId`, `visualRole`, `relationVisualRole` metadata를 사용한다.

계속 authoritative한 기존 로직:

- CompositionPlan의 region, binding, layout family
- ContentRef 추출과 text measurement
- semanticBlockId / relationId / sourceSpanIds trace
- Source Fidelity Hard Gate
- overflow, collision, bounds, contrast 검사

## 15. External Master Principle 적용 경계

적용:

- 01 Pokémon: 프로세스 내부의 중요한 경계를 별도 boundary primitive로 드러낸다.
- 01 Pokémon: ordered step, boundary, consequence가 서로 다른 의미 primitive를 사용한다.
- 05 Shadowverse: 경계 양쪽 phase를 명확히 정렬하고 grouping한다.
- 05 Shadowverse: 같은 맥락 안에서 경계 전후 상태를 빠르게 구분한다.

적용하지 않음:

- CEDEC frame
- 회사·게임 브랜드 색상과 IP
- 원본 좌표와 exact geometry
- Before/After comparison 의미
- hidden omission 또는 diagnosis 의미

## 16. 승인 후 구현 완료 조건

- message가 source-traced presentation 또는 deterministic suppression 중 하나로 명시적으로 처리된다.
- headline/context는 InformationPlan.message와 exact trace된다.
- suppressed-duplicate는 원문을 다시 표시하지 않고 reason과 source trace를 유지한다.
- 2/3/4+ accumulation이 같은 primitive contract로 동작한다.
- threshold가 가장 강한 위계지만 과도한 면적을 점유하지 않는다.
- consequence label과 value가 함께 유지된다.
- 모든 authored block과 relation이 trace된다.
- 전역 reading path와 relation connector가 분리된다.
- 새 Renderer 코드에 MEC-01 block ID나 문구가 없다.
- RenderTree 구조 테스트와 Hard Gate 통과 전에는 PNG를 만들지 않는다.
