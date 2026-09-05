# Game PPT Designer Next — Canonical Product Architecture

상태: **R0 Canonical**  
적용일: 2026-09-05

이 문서는 Game PPT Designer Next의 최상위 제품·구조 기준이다. 하위 문서나 과거 실험 기록이 이 문서와 충돌하면, 현재 구현 범위에서는 이 문서를 우선한다. 이 문서는 UI 시안이나 특정 장표 스타일을 고정하지 않는다.

## 1. Product Identity

Game PPT Designer Next는 generic AI PPT generator가 아니다.

게임 기획자가 작성한 내용과 논리를 정확히 이해하고, 그 의미에 적절한 정보 구조를 선택한 뒤, 검증된 Visual Grammar·Teacher·사용자 Preference를 참고하여 전문적인 게임 기획서 또는 발표자료로 시각화하는 **Game Design Document Compiler / Authoring Workstation**이다.

PowerPoint는 HTML, PDF, PNG와 함께 지원하는 최종 output format 중 하나다. PPTX가 canonical source도, 제품의 UI mental model도 아니다.

## 2. Core Principles

1. 사용자가 내용과 논리를 결정한다.
2. AI는 판단을 제안한다.
3. deterministic program이 실행한다.
4. AI가 없어도 기본 pipeline은 동작해야 한다.
5. 원문·숫자·단위·조건·핵심 관계를 AI가 임의 변경하면 안 된다.
6. 품질 평가는 실제 render 결과를 기준으로 한다.
7. 최종 품질 판단은 사용자가 한다.
8. Teacher Quality와 User Preference를 혼합하지 않는다.
9. AI에 repository 전체나 전체 대화를 보내지 않는다. 단계별 작은 구조화 artifact만 전달한다.
10. 모델과 provider는 교체 가능해야 한다.
11. 동일한 semantic content를 Preview와 PPTX가 서로 다른 layout system으로 처리하면 안 된다. 모든 출력은 동일 RenderTree 의미를 보존한다.
12. 한 번의 사용자 선택을 영구적인 디자인 규칙으로 승격하지 않는다.

기본 해결 순서는 `Rule → Retrieval → AI → 중요한 Ambiguity만 User`다. Agent 수를 늘리는 방식으로 문제를 해결하지 않는다.

## 3. Canonical Artifacts

```text
Source
  → SlideIR
  → InformationPlan
  → CompositionPlan
  → RenderTree
```

| Artifact | 단 하나의 책임 | 포함하면 안 되는 것 |
| --- | --- | --- |
| Source | 사용자가 작성한 정본과 provenance | 생성된 주장 |
| SlideIR | 무엇을 말하는가 | 좌표·색·렌더 명령 |
| InformationPlan | 어떤 구조와 순서로 설명할 것인가 | 픽셀 배치·renderer 명령 |
| CompositionPlan | 어떤 시각 구조에 어디에 배치할 것인가 | source 재작성·출력 포맷별 별도 의미 |
| RenderTree | 실제 renderer가 무엇을 그릴 것인가 | semantic 재해석·Teacher 재선택 |

V1에서는 기존 `SlideIR`을 Semantic IR 역할로 재사용한다. 별도 `SemanticIR` 데이터 모델을 만들지 않는다. SlideIR에 남아 있는 export/layout 성격의 legacy field는 의미 판단에 사용하지 않으며, 대규모 IR 재작성 없이 기술 부채로 추적한다.

HTML Presentation, PDF, PNG, editable PPTX는 RenderTree의 독립 backend다. 출력 사이의 필수 parity는 문장·숫자·단위·정보 순서·중요 관계·강조 대상이며, renderer 차이로 인한 미세 줄바꿈과 간격 차이는 허용한다.

## 4. Mode Boundary

기획서와 발표자료는 Semantic Understanding까지 공유한다.

```text
Source
  → Semantic Understanding
  → SlideIR
  → mode
    ├─ Document Information Design
    └─ Presentation Information Design
```

Document mode가 우선하는 것:

- fidelity, detail, rules, states, numbers, exceptions, data, flows, implementation understanding

Presentation mode가 우선하는 것:

- message, persuasion, compression, hierarchy, readability, story

R1은 이 경계를 trace에 기록하지만 mode별 Information Design 분기를 새로 구현하지 않는다. 실제 분기는 별도 승인 뒤 확장한다.

## 5. AI Roles

장기 역할은 세 가지다.

- Interpreter / Information Designer: 원문을 SlideIR과 InformationPlan 제안으로 구조화한다.
- Visual Designer: Visual Composition 후보를 제안한다.
- Visual Critic: 실제 렌더 PNG를 보고 진단한다.

AI 출력은 언제나 schema validation과 deterministic Hard Gate의 통제를 받는다. Critic은 Hard Gate를 뒤집지 못하며 원문을 새로 쓰지 않는다. Local, OpenRouter, OpenAI, Anthropic은 같은 역할 계약 뒤에서 교체 가능한 실행 엔진이다. R1은 새 Provider·Registry·Router를 만들지 않는다.

## 6. Memory Boundary

Teacher Quality와 User Preference는 서로 다른 지식이다.

Teacher는 어떤 정보 구조에 어떤 시각 원칙이 효과적인지 알려 주지만, 우리 출력의 Ready 품질이나 사용자의 취향을 뜻하지 않는다.

Preference 승격은 다음 증거 사슬을 따른다.

```text
User decision
  → Preference Event
  → repeated evidence
  → Pattern / Design Profile
```

단일 approval·reject·A/B 선택은 영구 규칙이 아니다. Preference는 source fidelity, Hard Gate, Teacher reuse boundary를 덮어쓸 수 없다.

## 7. Authoring Harness Boundary

`authoring-harness`는 conductor다. 해석·검색·선택·배치·렌더·검사·Critic·export의 실제 규칙은 기존 domain package가 소유한다.

```text
Studio / CLI / future UI adapter
  → Authoring Harness
    → source-ingestion
    → reference-engine
    → composition-engine
    → renderer
    → pptx-exporter
    → preference-learning (승인된 기록 단계에서만)
```

Canonical run states:

```text
INGEST
→ INTERPRET
→ SEMANTIC_VALIDATE
→ MODE_RESOLVE
→ INFORMATION_DESIGN
→ REFERENCE_RETRIEVAL
→ TEACHER_SELECTION
→ COMPOSITION
→ RENDER
→ HARD_GATE
→ CRITIC_OPTIONAL
→ REVISION_OPTIONAL
→ USER_DECISION
→ EXPORT
→ EVALUATION
```

구현되지 않았거나 요청되지 않은 optional 단계는 fake 결과를 만들지 않는다. `skipped` 또는 `awaiting-external-input`으로 명시하고 extension point만 유지한다. 자동 revision은 없으며 run당 `revisionCount <= 1`이다.

각 run은 입력 hash와 모든 canonical artifact의 ID/hash, Teacher 선택, RenderTree fingerprint, PNG hash, Hard Gate, optional Critic, revision, 사용자 판단, export, 시간, 실패 상태를 추적한다.

## 8. Product Shell

장기 제품 shell은 다음 Project 구조를 갖는다.

```text
Project
├─ 기획서
├─ 발표자료
├─ AI 학습
└─ 모델 관리
```

이는 제품 정보 구조의 장기 경계다. R0/R1에서 Dashboard나 Workbench UI를 새로 구현하지 않는다.

## 9. R1 Scope Boundary

R1은 기존 V1 동작을 Harness 경유로 정리하는 architecture extraction이다. Teacher data, Visual Grammar, layout, renderer 미감, Critic prompt/calibration, Preference 계산, UI를 변경하지 않는다.

R1 이후에도 다음 동작은 그대로 유지한다.

- curated Teacher retrieval/selection과 guidance
- CompositionPlan 생성과 계약 검사
- RenderTree 생성과 실제 font measurement
- Program Validator와 Source Fidelity Hard Gate
- PNG, HTML, PDF, editable PPTX
- Local Critic과 OpenRouter Critic

다음은 R1에서 구현하지 않는다.

- AI Usage Manager, Model Registry, Model Router, token/cost manager
- mode별 실제 Information Design 분기
- 자동 revision loop
- 새로운 Teacher·Pattern·Visual Grammar
- Ready Positive 승격
- Product shell UI
