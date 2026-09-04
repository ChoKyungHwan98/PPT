# External Master Reference 2025 분석

## 등록 상태

- 저장 위치: `packages/reference-engine/references/external-master-2025-v1/`
- 원본 `manifest.json`, `README.md`, PNG 6장을 변경 없이 보존한다.
- `analysis.json`은 reference-engine이 검증할 수 있는 구조화 분석이다.
- 여섯 이미지의 SHA-256은 원본 manifest와 모두 일치한다.
- 전체 묶음과 개별 reference의 `readyGolden`은 모두 `false`다.
- 원본 이미지는 분석 증거이며 결과 장표의 asset이나 표면 template로 재사용하지 않는다.
- 권리 상태는 `unknown`으로 기록하고, 분석과 추상 원칙 도출만 허용한다. 원본 asset 재사용·재배포는 금지한다.

## 01 Pokémon — Problem / Diagnosis

### Information Structure

- 질문: 정상적으로 진행되는 것처럼 보인 작업이 왜 끝까지 완성되지 않았는가?
- Page goal: 기존 작업 전달 방식이 만든 인식 오류와 숨은 누락을 하나의 프로세스 안에서 진단한다.
- 핵심 주장: 연속된 작업 전달과 진행감만으로는 정합성이나 누락을 발견할 수 없으며, 겉보기 완료 뒤에 미완료가 남는다.
- 정보 단위: 문제 선언, 정상처럼 보이는 Task 1~6 흐름, 팀과 PM의 진행 인식, 실제 누락 작업.
- 관계: `expected process → perceived progress`, `perceived progress ↔ hidden omission`, `process → failure to surface omission`.
- Game Design Grammar: `process → perceived progress → hidden gap → diagnosed problem`.

### Visual Grammar

- 첫 시선: 문제 제목과 붉은 진단 문장.
- 위계: 문제 선언 → 정상 프로세스 → 구성원 인식 → 누락 경고.
- Reading path: 상단 설명에서 시작해 프로세스를 좌→우로 읽고 경계 이후의 경고로 내려간다.
- Grouping: 정상 프로세스와 인식은 한 덩어리, 실제 누락은 경계 밖 진단 영역.
- 공간 분할: 상단은 진단 문장, 하단은 프로세스와 실제 증거.
- 강조: 붉은색은 진단 문장, 경고, 누락에만 사용한다.
- 관계 표현: 화살표형 단계, 개발팀 범위 브래킷, 점선 경계, 누락 annotation이 서로 다른 의미를 맡는다.
- 이미지/텍스트: 인물 아이콘은 관점 식별, 텍스트는 각 관점의 판단과 실제 문제 설명.

### Why It Works / Applicability / Boundary

- 문제를 흐름 밖의 결론 상자에 적지 않고 실패한 프로세스 안에 놓아 원인과 결과를 동시에 보여준다.
- 기대 상태와 실제 상태의 차이가 핵심인 프로세스 진단, 누락, 병목 설명에 적합하다.
- 단순한 정상 메커니즘이나 실제 누락 근거가 없는 페이지에는 부적합하다.

## 02 Pokémon — Feature Concept / UI Annotation

### Information Structure

- 질문: 카드 포맷의 전체 콘셉트는 어떤 구체 요소로 구현되는가?
- Page goal: 실제 대상의 눈에 보이는 부분과 설계 의도를 직접 연결한다.
- 핵심 주장: 포즈, 표정, 홀로그램, 기술 효과가 결합되어 힘과 박진감을 표현한다.
- 정보 단위: 중앙 실제 카드, 네 개의 feature annotation, 하단 concept synthesis.
- 관계: `visible feature → anchored artifact part`, `features → support concept`.
- Game Design Grammar: `primary artifact → visible feature annotations → concept synthesis`.

### Visual Grammar

- 첫 시선: 중앙의 실제 대상.
- 위계: 실제 대상 → 주변 annotation → 하단 종합 문장.
- Reading path: center-out으로 세부를 확인한 뒤 하단 결론으로 이동한다.
- Grouping: 짧은 색 라벨과 하나의 anchor line이 한 annotation 단위가 된다.
- 공간 분할: 중앙은 증거물, 사방 여백은 설명, 하단은 종합.
- 강조: 대상이 가장 크고 annotation은 국소적으로만 강조한다.
- 관계 표현: 주석선은 설명과 실제 위치를 일대일로 연결하며 교차하지 않는다.
- 이미지/텍스트: 이미지는 1차 증거, 텍스트는 보이는 특징의 설계 의도.

### Why It Works / Applicability / Boundary

- 추상 콘셉트를 실제 결과물의 위치별 증거로 검증하게 한다.
- UI 화면, 카드, 아이템, 캐릭터 기능처럼 실제 artifact에 여러 설계 요소가 모이는 경우에 적합하다.
- 실제 이미지나 식별 가능한 anchor가 없거나 주석선이 교차할 정도로 항목이 많으면 부적합하다.

## 03 Pokémon — Organization / Structure

### Information Structure

- 질문: 이니셔티브형 개발 조직은 어떤 단위와 책임 관계로 구성되는가?
- Page goal: 운영 원칙을 문장으로 설명하고 보고·소속 구조를 도식으로 확인시킨다.
- 핵심 주장: 작은 기능 단위 팀과 팀별 오너십으로 책임을 명확하게 한다.
- 정보 단위: 조직 정의 bullet, 책임 hierarchy, 개선 이후 상태 라벨.
- 관계: `definition → explained by structure`, `state label → qualifies structure`.
- Game Design Grammar: `operating principle + responsibility hierarchy`.

### Visual Grammar

- 첫 시선: 큰 제목과 좌측 핵심 bullet.
- 위계: 조직 형태 이름 → 운영 원칙 → 책임 구조도 → 상태 라벨.
- Reading path: 좌측 설명을 읽은 뒤 우측 구조로 이동한다.
- Grouping: 설명과 구조도를 역할이 다른 두 영역으로 병치한다.
- 공간 분할: 설명 열과 구조도 열. 구조도에는 관계를 읽을 충분한 폭을 준다.
- 강조: 조직명과 책임자 라벨은 크고, 개별 구성원은 작다.
- 관계 표현: 조직선은 보고·소속만 나타내며 인과 화살표를 쓰지 않는다.
- 이미지/텍스트: 도식은 구조, 텍스트는 숫자와 운영 원칙을 담당한다.

### Why It Works / Applicability / Boundary

- 문장과 도식이 같은 말을 반복하지 않고 서로 부족한 정보를 보완한다.
- 조직, 역할, 책임, 시스템 모듈 hierarchy에 적합하다.
- 시간 순서나 인과가 핵심이거나 hierarchy가 한 단계뿐이면 부적합하다.

## 04 Shadowverse — Trade-off / Problem Framing

### Information Structure

- 질문: 신규 사용자의 접근성과 장기 경쟁성을 왜 동시에 만족시키기 어려운가?
- Page goal: 두 목표를 모두 정당한 요구로 보존하고 그 사이의 긴장을 문제로 정의한다.
- 핵심 주장: 쉬운 진입과 깊이·복잡성 유지는 서로 반대 방향으로 당기는 목표다.
- 정보 단위: 접근성 목표, 경쟁성 목표, 양립 어려움에 대한 종합 판단.
- 관계: `goal A ↔ goal B`, 두 목표가 모두 unresolved tension에 기여한다.
- Game Design Grammar: `legitimate goal A ↔ legitimate goal B → unresolved design tension`.

### Visual Grammar

- 첫 시선: 두 목표가 상충한다는 상단 문제 정의.
- 위계: trade-off 제목 → 두 관점의 발화 → 종합 판단.
- Reading path: 첫 관점 → 반대 관점 → 하단 결론의 대각선 흐름.
- Grouping: 각 목표는 관점 표식과 발화로 묶고 결론은 별도 층에 둔다.
- 공간 분할: 두 관점이 화면 양쪽을 점유하며 하단 결론이 묶는다.
- 강조: 양쪽의 핵심 목표어를 동등하게 강조한다.
- 관계 표현: 직접 화살표 대신 위치 대립과 발화 방향으로 긴장을 표현한다.
- 이미지/텍스트: 캐릭터는 관점 구분자이며 장식물이 아니다.

### Why It Works / Applicability / Boundary

- 어느 한쪽도 나쁜 선택으로 만들지 않고 두 요구를 보존한다.
- 초보자와 숙련자, 편의성과 깊이처럼 충돌하지만 중요한 목표를 정의할 때 적합하다.
- 한쪽이 명백히 정답이거나 정확한 사양 비교가 목적이면 부적합하다.

## 05 Shadowverse — Before / After / Feature Spec

### Information Structure

- 질문: 기존 진화와 새 초진화는 같은 카드에서 무엇이 달라지는가?
- Page goal: 공통 출발점을 유지한 채 결과와 규칙 차이를 같은 기준으로 비교한다.
- 핵심 주장: 새 기능은 기존 기능보다 강한 결과와 추가 규칙을 제공한다.
- 정보 단위: 동일 baseline, 기존 결과, 신규 결과, 차이 표시.
- 관계: 동일 baseline에서 두 결과로 갈라지고, 이미지·수치·규칙을 같은 기준으로 비교한다.
- Game Design Grammar: `shared baseline → existing outcome vs new outcome → aligned spec difference`.

### Visual Grammar

- 첫 시선: 같은 크기의 기존/신규 두 열.
- 위계: 새 요소 선언 → 비교 열 제목 → 공통 기준 → 결과와 규칙.
- Reading path: 같은 높이의 요소를 좌우 왕복하며 비교한다.
- Grouping: 각 열 안의 이미지·화살표·설명을 같은 순서로 정렬한다.
- 공간 분할: 거의 같은 폭의 두 비교 영역과 최소한의 중앙 경계.
- 강조: 신규 결과를 선명하게 하되 비교 기준은 유지한다.
- 관계 표현: 각 열의 변환 화살표는 같은 의미를 가지고 중앙 표식은 차이를 뜻한다.
- 이미지/텍스트: 이미지는 수치와 상태 변화, 텍스트는 보이지 않는 규칙 차이를 설명한다.

### Why It Works / Applicability / Boundary

- 독자는 공통 기준을 다시 해석하지 않고 차이만 찾으면 된다.
- 기존/신규 기능, 패치 전후, 리워크 전후의 동일 기준 비교에 적합하다.
- 기준이 다른 대안이나 세 개 이상의 옵션 비교에는 부적합하다.

## 06 Shadowverse — System Comparison / Countermeasure

### Information Structure

- 질문: 하나의 밸런스 문제를 규칙과 카드 능력이라는 다른 레이어에서 어떻게 대응했는가?
- Page goal: 두 개입 레이어를 분리하고 각 레이어의 근거와 효과를 병렬로 설명한다.
- 핵심 주장: 기본 규칙 조정과 콘텐츠 능력을 함께 사용해 문제를 여러 층에서 완화했다.
- 정보 단위: 공통 문제, rule-level 대응, content-level 대응.
- 관계: 두 레이어가 같은 문제를 독립적으로 완화하며, 열 내부에는 근거 → 효과 인과가 있다.
- Game Design Grammar: `shared problem ← rule-level response + content-level response`.

### Visual Grammar

- 첫 시선: 규칙과 카드 능력 두 열의 제목.
- 위계: 대응 주제 → 개입 레이어 → 근거 → 효과 결론.
- Reading path: 각 열을 위→아래로 읽고 열 사이를 왕복해 역할 차이를 확인한다.
- Grouping: 레이어별 독립 영역, 내부에서는 근거 → 화살표 → 효과 반복.
- 공간 분할: 규칙 열은 복수 텍스트 근거, 카드 열은 실제 사례에 공간을 준다.
- 강조: 레이어 이름과 효과 문장을 강조한다.
- 관계 표현: 열 내부 화살표만 인과를 나타내며 열 사이에는 순서 화살표를 두지 않는다.
- 이미지/텍스트: 규칙 열은 수치·문장이 증거, 콘텐츠 열은 실제 카드 화면이 증거다.

### Why It Works / Applicability / Boundary

- 대응을 옵션 A/B가 아니라 개입 레이어로 명명해 역할 차이를 먼저 이해시킨다.
- 시스템·콘텐츠·UI처럼 같은 문제를 다른 층에서 해결할 때 적합하다.
- 실제 순차 단계나 기존/신규 비교에는 부적합하다.

## 기존 PatternFragment와 비교

| Reference grammar | 기존 Pattern 중복 | 핵심 차이 | Pattern 후보 |
|---|---|---|---|
| Problem / Diagnosis | causal-spine, threshold-field와 부분 중복 | 기대 흐름과 실제 누락의 모순, 인식/현실 대비가 없음 | `pattern-diagnostic-process-gap` |
| Feature Concept / UI Annotation | 없음 | 실제 artifact 위치에 연결되는 annotation anchor가 없음 | `pattern-annotated-primary-artifact` |
| Organization / Structure | 없음 | 설명과 hierarchy artifact의 병치가 없음 | `pattern-explanation-structure-pair` |
| Trade-off / Problem Framing | 없음 | 동등한 두 목표의 긴장과 미해결 상태를 표현하지 못함 | `pattern-opposed-goals-tension` |
| Before / After / Feature Spec | 없음 | 공통 기준을 두 열에 정렬하는 비교 계약이 없음 | `pattern-aligned-before-after-spec` |
| System Comparison / Countermeasure | 없음 | 독립 해결 레이어와 열 내부 국소 인과를 함께 표현하지 못함 | `pattern-layered-countermeasure-comparison` |

개별 Reference에서 제안한 이름들은 계속 `candidate-only`다. 다만 사용자 승인에 따라 V1 결합 후보인 `pattern-accumulation-threshold-consequence`만 추상 PatternFragment로 승격했다. External Reference 원본은 활성 asset corpus나 ready Golden으로 승격하지 않았다.

## 현재 V1 적합도

현재 V1은 `buildup 3단계 → BREAK threshold → damage consequence`인 단일 인과 체인이다.

1. 01 Problem / Diagnosis — 부분 적합. 프로세스 내부에서 경계를 사건으로 드러내는 원리는 유효하지만 숨은 누락은 없다.
2. 05 Before / After — 부분 적합. BREAK 전후 대비를 보조적으로 사용할 수 있지만 buildup 순서를 삭제하면 안 된다.
3. 02 UI Annotation — 낮은 적합. 실제 게임 화면이나 BREAK artifact가 제공될 때만 유효하다.
4. 06 Layered Countermeasure — 부적합. 서로 다른 해결 레이어가 아니다.
5. 03 Organization / Structure — 부적합. hierarchy가 아니다.
6. 04 Trade-off — 부적합. 충돌하는 두 목표가 없다.

따라서 6개 중 하나를 그대로 적용하지 않는다. 사용자 승인에 따라 V1에는 `pattern-accumulation-threshold-consequence`를 구현했다. 세 단계의 축적, 상태 경계, 규칙 결과를 서로 다른 phase region으로 구성하며, 원본 이미지의 좌표·색·브랜드는 사용하지 않는다.

## 기존 Renderer가 선형 flow로 수렴하는 이유

1. InformationPlan의 세 그룹이 Composition에서 `support / primary-artifact / evidence`와 weight로 축약된다.
2. 활성 Pattern이 `threshold-field`와 `editorial-causal-spine` 두 개뿐이다.
3. Renderer의 primary artifact가 실제 도식·이미지·표가 아니라 텍스트 block이다.
4. 모든 relation을 선 또는 화살표로 만들기 때문에 관계 종류보다 connector 반복이 강해진다.
5. annotation anchor, aligned comparison, hierarchy map, opposed viewpoint, 열 내부 국소 인과 primitive가 없다.
6. `message-context` region에 message binding이 없어 질문이나 주장형 headline이 실제 렌더에 나타나지 않는다.
7. `styleIntent`가 layout family별 고정 타입·색·motif로 끝나며, reference 분석이 primary artifact 선택과 국소 구성으로 전달되지 않는다.

## 분석 당시 Historical Workflow Snapshot

아래 값은 이 External Master 분석을 등록하던 시점의 역사적 기록이다. 현재 프로젝트 workflow 상태를 뜻하지 않는다. 원본 evidence 호환을 위해 `analysis.json.stageState` 값은 보존하지만 다음 용도로 사용할 수 없다.

- 현재 Stage 완료 여부 판단
- TeacherPageRecord 복사
- Teacher Retrieval 또는 scoring
- Visual Designer의 production context
- Teacher 또는 Ready Positive 승격 근거

현재 프로젝트에서는 MEC-01 Stage 7 단일 revision cycle이 이미 완료되었다. 현재 상태는 `V1_IMPLEMENTATION_PLAN`과 revision proof 문서를 기준으로 판단한다.

분석 당시 기록:

- 단계 0: 부분 완료
- 단계 6: 미완료
- ready Positive Fixture: 없음
- 단계 7: 미시작
- Gemini Critic: 호출하지 않음
