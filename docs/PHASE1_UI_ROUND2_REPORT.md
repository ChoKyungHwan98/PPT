# Phase 1 Program UI Round 2 Report

작성일: 2026-08-28  
상태: 정적 prototype 제출, 사용자 승인 대기  
범위: Workspace 3안, Candidate Compare 2안, Critic 2안

## 1. 결과 요약

이번 결과는 PPT 시안 재설계가 아니라 사용자가 한 장의 게임 기획을 프로그램 안에서 편집하고, 후보를 비교하고, 실제 render를 검수하는 방법을 비교하기 위한 UI/UX prototype이다.

- 7개 독립 HTML/CSS 화면
- 각 화면 1920×1080, 1440×900, 1366×768 screenshot
- 총 21개 screenshot
- 실제 fixture와 Round 2 A/B/C slide render 재사용
- React, Electron, Tauri, production renderer, export logic, AI 호출 없음

Fixture:

> 회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%

프로토타입과 전체 screenshot index: [Phase 1 Program UI Round 2](../prototypes/phase1-ui-round2/README.md)

## 2. Skill과 Reference 적용

### 적용한 판단 규칙

- Anthropic frontend-design: 게임 기획자의 실제 작업 대상인 slide, authored source, semantic relation에서 visual language를 도출했다. generic dashboard, AI chat shell, 장식용 card grid를 피했다.
- Taste Skill: 각 방향의 variance와 density를 먼저 고정하고, canvas emphasis와 tool density가 충돌하지 않도록 화면별로 다른 working model을 만들었다.
- UI UX Pro Max: neutral canvas, compact type scale, visible state label, color-only state 회피, 3개 viewport 무가로스크롤을 검증했다.
- Visualize Skill: 새 대화형 artifact가 아니라 기존 프로젝트에 속한 독립 full-page mockup으로 라우팅했다. prototype은 inspect 가능한 HTML/CSS 파일로 남겼다.

공통 축은 `DESIGN_VARIANCE 5 / VISUAL_DENSITY 7 / EDITORIALITY 4 / TOOL_DENSITY 7 / CANVAS_EMPHASIS 9`다. 개별 화면의 값은 아래에 별도로 명시한다.

### Reference에서 가져온 책임

| Reference | 적용한 책임 |
|---|---|
| Oh My PPT | presentation 중심 workflow, 실제 style preview, page revision과 history continuity |
| Figma / Penpot | canvas, synchronized selection, contextual inspector, panel disclosure |
| Onlook | authored source와 rendered object의 연결, checkpointed AI change 개념 |
| VS Code / Zed | 장시간 작업 가능한 정보 밀도, 접히는 Findings/History, restrained chrome |
| PowerPoint | 실제 16:9 page boundary, slide selection mental model, fit/zoom, editable object 기대 |

특정 제품의 전체 shell이나 스타일을 복제하지 않았고, reference가 충돌하는 경우 slide visibility와 source fidelity를 우선했다.

## 3. 7개 화면의 작업 방식 비교

| 화면 | 중심 질문 | 실제 주인공 | Persistent UI | On-demand UI | 결정 지점 |
|---|---|---|---|---|---|
| W1 | context를 잃지 않고 직접 편집할 수 있는가 | C slide | Source, Semantic, Inspector | Findings/History dock | 선택 object의 속성 편집 |
| W2 | slide를 최대 크기로 직접 다룰 수 있는가 | A slide | canvas, slim rail | Source/Semantic sheet, Inspector sheet, dock | canvas selection |
| W3 | AI 해석과 시각 표현의 연결을 승인할 수 있는가 | source-to-render mapping | authored facts, B slide, proof band | Findings/History | semantic region 승인 |
| C1 | 첫 인상과 전체 composition을 공정하게 비교할 수 있는가 | A/B/C 동등 slide | 3개 equal column | rationale | 후보 1개 선택 |
| C2 | 한 후보의 세부를 충분히 읽고 선택할 수 있는가 | 선택한 B slide | large focus, filmstrip, decision lens | full critique | B 선택 후 Edit 이동 |
| K1 | 문제가 실제 render의 어디에 있는가 | marker가 고정된 B slide | finding inspector, open drawer | history | finding 선택 후 수정안 요청 |
| K2 | 제안 수정이 실제로 더 나은가 | before/after B slide | patch summary, fidelity proof | full findings | 수정 적용 또는 거부 |

이 차이는 palette가 아니라 reading order, persistent region, disclosure timing, selection model, decision point의 차이다.

## 4. Workspace W1: Persistent Context Workbench

**Dials:** `DESIGN_VARIANCE 4 / VISUAL_DENSITY 8 / TOOL_DENSITY 9 / CANVAS_EMPHASIS 7`

- 핵심 의도: Source, Semantic Structure, 실제 16:9 slide, Inspector를 한 화면에 고정해 selection context를 잃지 않는 power-user workbench다.
- 참고한 reference: Figma/Penpot의 tri-pane과 contextual inspector, Onlook의 source-selection sync, VS Code의 Problems dock, PowerPoint의 중앙 slide.
- 장점: authored fact, semantic role, canvas object, property가 동시에 보인다. 장시간 편집에서 panel 전환 비용이 가장 낮다.
- 단점: 세로·가로 panel이 계속 존재해 slide가 W2보다 작다. 초보자에게는 초기에 정보가 많다.
- 장시간 작업 시 예상 문제: source와 inspector를 계속 열어 두면 작은 노트북에서 chrome pressure가 누적된다. production에서는 저장 가능한 workspace preset과 panel collapse가 필요하다.
- Screenshot critique: 1920에서는 slide max width를 1000에서 1200으로 수정해 canvas의 빈 worktable을 줄였다. 1440과 1366에서는 각각 220px side panel을 유지하면서 slide 선택 영역과 Inspector가 겹치지 않는다. 1366에서도 Findings/History entry와 주요 action이 잘리지 않는다.

Screenshots: [1920×1080](../prototypes/phase1-ui-round2/screenshots/w1/1920x1080.png) · [1440×900](../prototypes/phase1-ui-round2/screenshots/w1/1440x900.png) · [1366×768](../prototypes/phase1-ui-round2/screenshots/w1/1366x768.png)

## 5. Workspace W2: Canvas Focus Studio

**Dials:** `DESIGN_VARIANCE 6 / VISUAL_DENSITY 5 / TOOL_DENSITY 4 / CANVAS_EMPHASIS 10`

- 핵심 의도: 실제 slide를 최대한 크게 유지하고 필요한 context만 sheet로 불러오는 direct-manipulation workspace다. 이번 정적 state는 요구 요소 검증을 위해 양쪽 sheet가 열린 순간을 보여 준다.
- 참고한 reference: Figma focus mode, Onlook direct manipulation, Penpot contextual panel, Zed의 restrained chrome, PowerPoint fit-to-window.
- 장점: 세 Workspace 중 slide가 가장 강한 visual focus다. Source와 Inspector가 modal dialog가 아니라 canvas 위의 비차단 sheet로 동작한다.
- 단점: sheet가 열려 있는 동안 slide의 주변부를 가릴 수 있다. 한 화면에서 많은 property를 비교하기에는 W1보다 느리다.
- 장시간 작업 시 예상 문제: sheet를 반복해서 열고 닫는 조작이 누적되고, 사용자가 열린 panel 상태를 놓칠 수 있다. 자동 닫힘보다 명확한 pinned/unpinned 상태가 필요하다.
- Screenshot critique: 1920에서는 1320px slide가 중심이고 sheet가 page 바깥 worktable에 놓인다. 1440과 1366에서는 source와 inspector 폭을 줄였으며 BREAK 선택 영역, slide edge, 하단 dock가 서로 겹치지 않는다. 가장 작은 viewport에서는 sheet가 page margin에 가까워지는 것이 남은 risk다.

Screenshots: [1920×1080](../prototypes/phase1-ui-round2/screenshots/w2/1920x1080.png) · [1440×900](../prototypes/phase1-ui-round2/screenshots/w2/1440x900.png) · [1366×768](../prototypes/phase1-ui-round2/screenshots/w2/1366x768.png)

## 6. Workspace W3: Argument Mapping Desk

**Dials:** `DESIGN_VARIANCE 7 / VISUAL_DENSITY 7 / EDITORIALITY 7 / TOOL_DENSITY 6 / CANVAS_EMPHASIS 7`

- 핵심 의도: 사용자가 AI가 만든 semantic interpretation과 실제 slide 표현의 연결을 먼저 검토하는 interpretation-approval workspace다.
- 참고한 reference: Onlook의 source-to-render mapping, Penpot의 semantic inspector, VS Code split editor, PowerPoint page, editorial proofing workspace.
- 장점: 다섯 authored fact와 다섯 semantic role이 일대일로 보이고, 선택한 `Timed state / 5초`가 slide region과 proof band에 동시에 강조된다.
- 단점: geometry를 계속 편집하는 상태에는 좌측 mapping 영역이 과하다. W1보다 object property의 범위가 작다.
- 장시간 작업 시 예상 문제: interpretation 승인이 끝난 뒤에도 split을 유지하면 canvas 효율이 떨어진다. 별도의 transient workspace preset으로 제한해야 한다.
- Screenshot critique: 세 viewport 모두 좌측 40% mapping과 우측 slide가 명확히 분리된다. 1366에서도 5개 source row, selected region, Inspector, Findings/History 진입점이 모두 보이며 수직 overflow가 없다.

Screenshots: [1920×1080](../prototypes/phase1-ui-round2/screenshots/w3/1920x1080.png) · [1440×900](../prototypes/phase1-ui-round2/screenshots/w3/1440x900.png) · [1366×768](../prototypes/phase1-ui-round2/screenshots/w3/1366x768.png)

## 7. Candidate Compare C1: Equal Proof Board

**Dials:** `DESIGN_VARIANCE 5 / VISUAL_DENSITY 6 / TOOL_DENSITY 4 / CANVAS_EMPHASIS 9`

- 핵심 의도: A/B/C를 동일 page size와 동일 zoom으로 동시에 보여 첫 인상, topology, hierarchy를 selection bias 없이 비교한다.
- 참고한 reference: PowerPoint slide sorter의 동등 page mental model, Canva의 preview-first 비교, Oh My PPT의 실제 style preview.
- 장점: 세 후보의 전체 composition을 한 시선에서 비교한다. 각 후보의 primary artifact를 별도 확대해 3열 비교의 작은 글자 문제를 보완한다.
- 단점: 1366에서 전체 slide의 작은 본문은 직접 읽기 어렵다. focus를 잃지 않는 대신 개별 후보의 세부 판단은 C2보다 약하다.
- 장시간 작업 시 예상 문제: 많은 후보를 같은 방식으로 늘리면 수평 압축과 비교 피로가 생긴다. 첫 3안의 unbiased compare에만 적합하다.
- Screenshot critique: 최초 캡처에서 상단 비활성 여백이 컸고 primary artifact가 작은 strip이었다. 수정 후 전체 slide를 즉시 상단에 붙이고 남은 공간을 실제 slide 내부 artifact 확대에 사용했다. 확대는 원본 screenshot의 프로그램 chrome가 아니라 실제 16:9 slide region만 재크롭한다. 세 viewport에서 동일한 column 폭과 zoom 규칙이 유지된다.

Screenshots: [1920×1080](../prototypes/phase1-ui-round2/screenshots/c1/1920x1080.png) · [1440×900](../prototypes/phase1-ui-round2/screenshots/c1/1440x900.png) · [1366×768](../prototypes/phase1-ui-round2/screenshots/c1/1366x768.png)

## 8. Candidate Compare C2: Focus and Filmstrip

**Dials:** `DESIGN_VARIANCE 6 / VISUAL_DENSITY 5 / TOOL_DENSITY 5 / CANVAS_EMPHASIS 10`

- 핵심 의도: 선택 후보 하나를 실제 읽기 크기로 보고 A/B/C thumbnail을 즉시 전환하며 결정하는 focus workflow다.
- 참고한 reference: PowerPoint thumbnail navigator, Keynote의 slide-only view, Figma canvas focus, Oh My PPT style preview.
- 장점: B Mechanism의 실제 구조와 수치를 충분히 읽을 수 있다. decision lens는 score가 아니라 semantic fit, content fidelity, hard findings, editability만 보여 준다.
- 단점: 현재 선택된 B가 시선을 선점하므로 C1보다 initial selection bias가 크다. 후보 간 미세 차이를 기억에 의존한다.
- 장시간 작업 시 예상 문제: A/B/C를 반복 전환하면 comparison memory 비용이 생긴다. hold-to-peek 또는 split preview가 보조 기능으로 필요할 수 있다.
- Screenshot critique: 1920에서는 slide가 약 1180px 폭으로 UI의 확실한 주인공이다. 1440과 1366에서도 filmstrip과 decision lens가 slide보다 강해지지 않으며 primary action이 화면 안에 남는다.

Screenshots: [1920×1080](../prototypes/phase1-ui-round2/screenshots/c2/1920x1080.png) · [1440×900](../prototypes/phase1-ui-round2/screenshots/c2/1440x900.png) · [1366×768](../prototypes/phase1-ui-round2/screenshots/c2/1366x768.png)

## 9. Critic K1: Anchored Findings

**Dials:** `DESIGN_VARIANCE 4 / VISUAL_DENSITY 8 / TOOL_DENSITY 8 / CANVAS_EMPHASIS 8`

- 핵심 의도: Visual Critic의 finding이 실제 rendered pixel의 어느 영역을 가리키는지 marker, target outline, finding row, inspector로 동기화한다.
- 참고한 reference: Figma selection overlay, VS Code Problems panel, Onlook의 visual/source sync, PowerPoint object selection.
- 장점: 추상적인 critique 문장이 아니라 하단 auxiliary phase label region을 실제 위치에서 확인한다. 제안은 `14→18px`, `32→42px`, contrast token처럼 bounded typed patch로 표현된다.
- 단점: marker와 drawer가 동시에 열리면 시각적 밀도가 높다. 여러 finding이 겹치는 slide에서는 marker 충돌이 생길 수 있다.
- 장시간 작업 시 예상 문제: 상시 marker 노출은 defect fatigue를 만든다. Critic state 진입 시에만 표시하고 severity/filter가 필요하다.
- Screenshot critique: 세 viewport에서 marker 01/02와 orange target이 같은 slide region에 고정된다. 1366에서도 right inspector의 action과 bottom finding 2개가 잘리지 않는다. slide가 drawer와 inspector보다 더 큰 단일 artifact로 남는다.

Screenshots: [1920×1080](../prototypes/phase1-ui-round2/screenshots/k1/1920x1080.png) · [1440×900](../prototypes/phase1-ui-round2/screenshots/k1/1440x900.png) · [1366×768](../prototypes/phase1-ui-round2/screenshots/k1/1366x768.png)

## 10. Critic K2: Revision Proof

**Dials:** `DESIGN_VARIANCE 5 / VISUAL_DENSITY 7 / TOOL_DENSITY 7 / CANVAS_EMPHASIS 7`

- 핵심 의도: finding 발견이 아니라 수정 적용 여부를 결정한다. before와 after를 같은 zoom과 위치로 나란히 놓고 하나의 bounded patch만 비교한다.
- 참고한 reference: design review의 before/after proof, Onlook checkpoint, VS Code diff의 동일 조건 비교, Oh My PPT revision history.
- 장점: 수정의 visual effect와 content guard를 동시에 판단한다. after의 밝고 큰 phase label이 실제 render 위에서 바로 비교되며 source, 순서, 수치, relation이 그대로임을 proof bar가 보여 준다.
- 단점: 두 slide를 나란히 놓아 각 slide가 C2보다 작다. finding을 처음 발견하거나 여러 문제를 탐색하기에는 K1이 낫다.
- 장시간 작업 시 예상 문제: 작은 차이의 반복 검수는 눈의 피로를 유발한다. linked zoom/pan, blink compare, pixel diff를 선택적으로 제공해야 한다.
- Screenshot critique: 1920에서는 각 render가 약 790px 폭, 1366에서도 약 530px 폭으로 유지된다. 세 viewport 모두 before/after page size가 같고 patch summary와 Apply/Reject가 잘리지 않는다. after label 대비가 가장 작은 viewport에서도 구분된다.

Screenshots: [1920×1080](../prototypes/phase1-ui-round2/screenshots/k2/1920x1080.png) · [1440×900](../prototypes/phase1-ui-round2/screenshots/k2/1440x900.png) · [1366×768](../prototypes/phase1-ui-round2/screenshots/k2/1366x768.png)

## 11. Screenshot QA와 Quality Floor

### 기계 검증

- prototype HTML: 7개
- screenshot PNG: 21개
- 모든 PNG 실제 pixel dimension과 filename 일치
- 모든 HTML에 다섯 fixture fact 포함
- 깨진 local image path 0
- Lorem Ipsum 0
- external script와 external HTTP dependency 0
- 3개 viewport에서 가로 scrollbar 0

### Visual self-check

| 기준 | 결과 | 근거 |
|---|---|---|
| Slide가 visual focus인가 | 통과 | 모든 화면에서 slide가 가장 큰 단일 artifact이며 light neutral chrome을 사용 |
| W1/W2/W3 필수 영역이 보이는가 | 통과 | Source, Semantic, 16:9 Canvas, Inspector, state switch, Findings/History entry 확인 |
| Workspace가 다른 작업 방식인가 | 통과 | persistent tri-pane, contextual canvas focus, interpretation mapping으로 구분 |
| C1/C2 비교 UX가 다른가 | 통과 | equal simultaneous proof와 focus/filmstrip으로 구분 |
| K1/K2 검수 UX가 다른가 | 통과 | defect localization과 revision approval로 구분 |
| Fixture fidelity가 보이는가 | 통과 | 모든 prototype에 Facts 5/5, Relations 4/4 또는 authored source를 visible state로 유지 |
| 저해상도 action clipping이 없는가 | 통과 | 1366×768에서 panel, drawer, action, status가 viewport 내부에 존재 |

이 통과는 이번 prototype의 내부 제출 기준에 대한 판정이며, 제품 방향 승인이나 production 착수 승인을 의미하지 않는다.

## 12. 승인 전 결정해야 할 비교 포인트

다음 단계로 넘어가기 전에 하나의 단일 winner를 먼저 고를 필요는 없다. Workspace, Compare, Critic은 서로 다른 조합으로 선택할 수 있다.

- Workspace: W1의 context persistence, W2의 canvas dominance, W3의 interpretation approval 중 기본 진입점과 보조 preset을 구분할 것
- Compare: C1을 first-pass, C2를 focused decision으로 연속 사용하거나 하나만 유지할 것
- Critic: K1의 finding localization에서 K2의 before/after approval로 이어지는 2단 workflow를 유지할 것
- Density: 1366 기준의 compact panel을 기본으로 할지, 1440 기준을 기본으로 하고 focus mode를 제공할지 결정할 것

현재 상태에서는 production 구현을 시작하지 않고 사용자 승인을 기다린다.

