# Phase 1 Program UI Round 2 Directions

작성일: 2026-08-28  
상태: prototype 코딩 전 UI/UX 방향 확정  
주제: 사용자가 프로그램에서 한 장의 게임 기획을 설계하고, 후보를 비교하고, 실제 렌더를 검수하는 방식

## 승인 경계

Round 2의 A/B/C는 새로 디자인하지 않는다. 다음 실제 fixture asset으로 재사용한다.

- A Editorial / Information Design
- B System / Mechanism Visualization
- C Professional Presentation

이 문서의 대상은 slide design이 아니라 프로그램 workflow다. React, Electron, Tauri, production renderer, PPTX exporter를 만들지 않는다.

## Program design read

게임 기획자가 한 장의 source와 semantic structure를 확인하고, 실제 slide를 직접 보며 후보 선택과 Critic 수정을 통제하는 desktop production tool이다. UI는 AI 실험실이나 관리자 dashboard가 아니라 밝은 편집 테이블, 교정 도구, slide stage에서 visual language를 가져온다.

공통 dials:

```text
DESIGN_VARIANCE 5
VISUAL_DENSITY 7
EDITORIALITY 4
TOOL_DENSITY 7
CANVAS_EMPHASIS 9
MOTION_INTENSITY 1
```

## 적용한 Skill과 Reference

### Skill rules

- Anthropic frontend-design: subject의 실제 artifact에서 visual language 도출, 명확한 point of view, 구조 장치는 실제 정보만 encode, boldness는 한 곳에 집중
- Taste Skill: dials 명시, generic dashboard/card grid와 AI-purple 회피, shape/accent/copy 일관성, visible copy self-audit
- UI UX Pro Max: heavy chrome 회피, neutral canvas, modular type scale, 4.5:1 본문 대비, color-only state 금지, 3개 viewport 무가로스크롤 검증
- Visualize Skill: 이 요청은 in-conversation widget이 아니라 기존 project의 독립 UI 화면 변경으로 처리, inspectable full-page mockup과 실제 상태 사용

### Reference responsibilities

| Reference | UI 책임 |
|---|---|
| Oh My PPT | presentation 중심 job, actual style preview, page revision/history continuity |
| PowerPoint | slide canvas, thumbnail/selection mental model, fit/zoom |
| Figma | canvas focus, selection, layers, panel hide/focus |
| Penpot | semantic/contextual inspector, progressive disclosure |
| Onlook | source/visual selection synchronization, checkpointed AI change |
| VS Code | findings/history drawer, compact all-day workbench density |
| Zed | restrained chrome, quick focus switching, command-first access |

UI가 reference와 충돌하면 slide visibility와 source fidelity를 우선한다. 어느 제품도 전체 shell로 복제하지 않는다.

## Shared visual system

### Palette

| Token | Value | Use |
|---|---:|---|
| Worktable | `#E7E5E0` | canvas 주변 desktop ground |
| Tool Surface | `#F7F7F4` | toolbar, drawer, inspector |
| Panel White | `#FFFFFF` | source/semantic panel |
| Carbon | `#20252B` | primary UI text |
| Steel | `#68717A` | secondary UI text |
| Work Blue | `#176B87` | selected/focus/action 한 가지 accent |
| Rule | `#C9CCD0` | 실제 영역 경계 |
| Finding Orange | `#C85F32` | Critic finding과 patch only |

### Typography and geometry

- UI: `Noto Sans KR`, 12/13/14/18/24px modular scale
- utility/data: `Bahnschrift`, 11/12px
- top chrome 48-50px, bottom status 34-38px
- panel radius 0-6px, slide는 실제 page boundary와 shadow 사용
- slide art direction의 font/color를 UI가 가져오지 않는다.
- icons보다 visible text label을 우선한다.

### Shared state model

모든 Workspace에 다음 전환이 한 줄로 보인다.

```text
Edit | Candidates | Critic
```

- 현재 state는 fill + label + underline 중 두 가지 이상으로 표시한다.
- Source와 Semantic Structure는 동일 authored fixture를 가리킨다.
- Findings/History는 필요할 때 여는 drawer나 dock이며 상시 열린 필수 chrome이 아니다.
- AI는 chat panel이 아니라 `해석됨`, `후보 생성됨`, `Critic 완료` 같은 provenance로만 나타난다.

## Workspace W1: Persistent Context Workbench

### Working model

Source, Semantic Structure, actual slide, Inspector를 동시에 보면서 편집하는 power-user workspace다. 모든 context를 유지하고 bottom dock만 필요할 때 연다.

```text
┌ top: Edit | Candidates | Critic · Fit · Export ┐
├ Source/Semantic ┬──── actual 16:9 slide ────┬ Inspector ┤
│ authored facts  │ selected object on canvas │ object    │
│ relation chain  │                           │ layout    │
├─────────────────┴ Findings / History dock ──┴───────────┤
```

### Dials

`VARIANCE 4 / DENSITY 8 / TOOL_DENSITY 9 / CANVAS 7`

### Reference blend

Figma/Penpot tri-pane, Onlook source selection sync, VS Code bottom problems dock, PowerPoint central slide.

### Quality risk

panel persistence가 slide를 압박할 수 있다. 1366에서는 source/inspector 폭을 줄이되 실제 label을 숨기지 않고, slide는 최소 720×405 equivalent를 유지한다.

## Workspace W2: Canvas Focus Studio

### Working model

slide를 가장 크게 유지하고 Source/Semantic과 Inspector를 contextual sheet로 연다. 이번 static state는 두 sheet가 열려 있어 요구 요소를 검증하지만, underlying workflow는 direct manipulation과 progressive disclosure다.

```text
┌ top: state switch · candidate status · Fit ┐
├ rail ┬──────────── large slide ─────────────┤
│ SRC  │ source sheet floats from left        │
│ SEM  │ selected object inspector floats     │
│ HIS  │                           near right  │
├──────┴ Findings 2 · History 6 collapsed ────┤
```

### Dials

`VARIANCE 6 / DENSITY 5 / TOOL_DENSITY 4 / CANVAS 10`

### Reference blend

Figma focus mode, Onlook direct manipulation, Penpot contextual inspector, Zed restrained chrome, PowerPoint fit-to-window.

### Quality risk

overlay가 slide content를 가릴 수 있다. sheet는 slide page 밖 worktable 영역에 우선 배치하고, 1366에서는 source를 compact summary로 줄인다.

## Workspace W3: Argument Mapping Desk

### Working model

source와 semantic relation을 먼저 검토하고 그 오른쪽에서 slide가 그 논리를 어떻게 편집했는지 확인한다. object inspector는 slide 아래 proof band로 연결한다. AI 해석 승인과 content fidelity가 중요한 stage용이다.

```text
┌ top: Edit | Candidates | Critic · interpretation approved ┐
├ authored source + semantic map ┬──── actual slide ─────────┤
│ 5 source rows                  │ selected semantic region  │
│ 4 relation handoffs            │                           │
├ semantic selection proof ──────┴ contextual Inspector ─────┤
└ Findings / History tabs, closed by default ────────────────┘
```

### Dials

`VARIANCE 7 / DENSITY 7 / EDITORIALITY 7 / TOOL_DENSITY 6 / CANVAS 7`

### Reference blend

Onlook source-to-render mapping, Penpot semantic inspector, PowerPoint slide page, VS Code split editor, InDesign editorial workspace.

### Quality risk

semantic review가 끝난 뒤에도 split이 남으면 비효율적이다. production에서는 `Interpretation` preset으로 제한하고 Canvas Focus로 전환할 수 있어야 한다.

## Candidate Compare C1: Equal Proof Board

### Working model

A/B/C를 같은 zoom과 page size로 동시에 놓는다. 각 candidate 아래에는 title, provenance, hard-gate state만 두고 긴 rationale는 숨긴다.

```text
┌ A full slide ┬ B full slide ┬ C full slide ┐
│ facts 5/5    │ facts 5/5    │ facts 5/5    │
└ equal zoom · source fixed · select one ─────┘
```

### Dials

`VARIANCE 5 / DENSITY 6 / TOOL_DENSITY 4 / CANVAS 9`

### Best use

첫 인상, topology, hierarchy, palette 비교. 1366에서 세부 문구 판독은 focus mode로 넘긴다.

## Candidate Compare C2: Focus and Filmstrip

### Working model

선택 후보 하나를 크게 읽고, 다른 후보는 bottom filmstrip에서 즉시 전환한다. 오른쪽 decision lens는 source fidelity와 후보 간 실제 구조 차이만 보여 준다.

```text
┌──────────── selected large slide ─────────┬ decision lens ┐
│                                          │ facts 5/5     │
│                                          │ reading path  │
├──── A thumbnail ─ B selected ─ C thumbnail ┴──────────────┤
```

### Dials

`VARIANCE 6 / DENSITY 5 / TOOL_DENSITY 5 / CANVAS 10`

### Best use

본문 판독과 선택 확정. initial selection bias와 전환 기억 부담이 단점이다.

## Critic K1: Anchored Findings

### Working model

실제 rendered B slide 위에 finding marker와 target outline을 놓고, bottom drawer에서 evidence와 proposed patch를 읽는다. selected finding은 marker, row, inspector가 동기화된다.

```text
┌ actual B slide with marker 01/02 ┬ selected finding ┐
├ Findings list ─ evidence ─ typed patch ─ decision ──┤
```

### Dials

`VARIANCE 4 / DENSITY 8 / TOOL_DENSITY 8 / CANVAS 8`

### Best use

문제가 어디에 있는지 발견하고 한 finding을 고르는 단계. 상시 사용하면 defect fatigue가 생기므로 Critic state에서만 marker를 표시한다.

## Critic K2: Before and After Decision

### Working model

선택 finding의 before render와 patched render를 같은 zoom으로 나란히 놓는다. 아래 content-fidelity proof와 오른쪽 patch summary를 보고 적용/거부/되돌리기를 결정한다.

```text
┌ BEFORE actual render ┬ AFTER patched render ┬ patch summary ┐
├ facts 5/5 · relations 4/4 · only style patch changed ──────┤
```

### Dials

`VARIANCE 5 / DENSITY 7 / TOOL_DENSITY 7 / CANVAS 7`

### Best use

수정 여부 결정. finding 발견용이 아니라 bounded revision 후 승인용이며, zoom 동기화가 필수다.

## Seven-screen diversity gate

| Screen | Primary workflow | Persistent areas | Hidden/on-demand area | Main risk |
|---|---|---|---|---|
| W1 | simultaneous editing | source, canvas, inspector | findings/history | chrome pressure |
| W2 | direct canvas editing | canvas, context rail | source, semantic, inspector sheets | overlay occlusion |
| W3 | interpretation approval | source/semantic, canvas, proof inspector | findings/history | review-stage specialization |
| C1 | unbiased first-pass compare | three equal slides | rationale | text too small |
| C2 | focused decision | one large slide, filmstrip | detailed critique | selection bias |
| K1 | defect localization | slide markers, findings dock | history | defect fatigue |
| K2 | revision approval | before/after, patch summary | full findings | small slide pair |

단순 palette variation이 아니라 persistent region, reading order, state transition, hidden context, decision point가 다르다.

## UI Quality Floor

- W1/W2/W3 각각 Source, Semantic Structure, 16:9 Slide Canvas, Inspector, Edit/Candidates/Critic 전환, Findings/History 진입점을 실제 visible state로 보여 준다.
- C1/C2는 실제로 다른 comparison interaction model을 보여 준다.
- K1/K2는 실제 rendered slide의 위치와 수정 결정을 연결한다.
- 1920×1080, 1440×900, 1366×768에서 가로 스크롤, panel overlap, clipped primary action이 없다.
- slide가 각 화면의 가장 큰 단일 visual artifact다.
- 설명 copy, score, AI provenance가 slide보다 강한 대비/크기로 보이지 않는다.
- dark UI shell, generic dashboard metric cards, fake chat panel을 사용하지 않는다.
- A/B/C fixture의 다섯 사실과 네 관계를 새로 작성하거나 변형하지 않는다.
- production code와 dependency를 추가하지 않는다.
