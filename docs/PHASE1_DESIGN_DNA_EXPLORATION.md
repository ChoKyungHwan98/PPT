# Phase 1 Design DNA Exploration

작성일: 2026-08-28  
상태: Design DNA 제안, UI 제작 전 승인 대기  
범위: 프로그램 UI의 시각·상호작용 철학 재탐색

## 1. 결정된 탐색 경계

- 기존 W1/W2/W3, C1/C2, K1/K2는 방향성 탐색 자료로만 보존한다.
- 기존 시안 중 어떤 안도 채택하지 않는다.
- `UI_DESIGN.md`와 `DESIGN_SYSTEM.md`의 visual direction, shared token, panel geometry는 이번 탐색에서 잠시 효력을 정지한다.
- W4/W5처럼 같은 shell과 component anatomy를 유지한 variation은 만들지 않는다.
- 다음 UI 제작 전 서로 공통 디자인 토큰을 공유하지 않는 세 개의 독립 Design DNA를 먼저 승인받는다.
- 이번 문서에서는 UI, HTML, screenshot, production code를 만들지 않는다.

## 2. 세 방향이 공유할 수 있는 것과 없는 것

### 공유 가능한 제품 불변조건

다음은 visual design이 아니라 제품의 안전성과 목적이므로 유지한다.

- 작성된 내용, 수치, 순서, 관계 보존
- 실제 16:9 slide가 핵심 작업 대상
- rendered slide와 editable PPTX의 연결
- Source, Semantic Structure, Inspector, Candidate, Critic에 접근 가능한 workflow
- 키보드 경로, focus visibility, 본문 contrast, overflow 방지
- AI는 해석·후보 제안·render critique만 담당하며 사용자 통제를 대체하지 않음

### 공유 금지 항목

세 DNA는 다음을 공통 base theme이나 component layer에서 상속하지 않는다.

- color token과 semantic accent
- type family, type scale, label casing
- spacing scale, radius, border, elevation
- top bar, side rail, inspector, drawer의 anatomy
- navigation position과 workspace switching model
- canvas stage 색과 page elevation
- selection handle, finding marker, button treatment
- 동일 DOM shell에 theme class만 바꾸는 구현

Reset CSS와 accessibility 검사만 기술적으로 공통 사용할 수 있다. 시각 component와 layout stylesheet는 DNA별 별도 root에서 시작한다.

## 3. Reference 규칙

Primary Reference는 각 DNA의 헌법 역할을 한다. 보조 Reference는 Primary가 다루지 못하는 한정된 문제만 보완하며 최대 두 개다. 어느 방향도 세 제품의 평균이나 hybrid moodboard가 되어서는 안 된다.

| DNA | Primary Reference | Secondary Reference 1 | Secondary Reference 2 |
|---|---|---|---|
| DNA-E Editorial Redline | Adobe InDesign | Affinity Publisher | Penpot |
| DNA-P Presentation Theatre | Apple Keynote | Microsoft PowerPoint | Figma |
| DNA-M Mechanism Foundry | Unreal Editor | Onlook | VS Code |

## 4. DNA-E: Editorial Redline

### 단일 관점

게임 기획 slide를 화면이 아니라 교정·출판 대상인 한 장의 편집물로 다룬다. UI의 중심 동사는 `생성`이 아니라 `구성`, `교정`, `preflight`, `승인`이다.

**Primary Reference: Adobe InDesign**

InDesign에서 가져오는 핵심은 pasteboard 위의 물리적 page, contextual control strip, docked studio, preflight 사고방식이다. InDesign의 모든 인쇄 기능이나 오래된 dialog는 가져오지 않는다.

Secondary의 역할:

- Affinity Publisher: 작업 목적에 따라 studio 구성을 바꾸는 workspace preset
- Penpot: semantic token과 selected object에 맞춰 바뀌는 contextual inspector

### Design DNA

| 축 | 정의 |
|---|---|
| Typography | Korean UI는 `Pretendard`, utility Latin은 `IBM Plex Sans`, document/story heading에만 `Noto Serif KR`. 12/13/15/19px 중심의 조밀한 editorial scale. |
| Density | 8/10. 빈 공간보다 baseline, rule, alignment로 위계를 만든다. |
| Navigation | 좌측 `Pages / Story / Assets`, 상단 contextual control strip, 우측 `Studios`. Edit/Candidate/Critic은 segmented control이 아니라 workspace preset이다. |
| Panel model | docked studio stack. 필요한 section을 접되 inspector 자체는 떠다니지 않는다. open state를 기억한다. |
| Canvas treatment | 밝은 page가 cool-gray pasteboard 위에 놓인다. ruler, guide, safe area, page boundary가 편집 정확도를 만든다. 과도한 shadow는 쓰지 않는다. |
| Color | paper, graphite, oxide red, muted brass. cyan, violet, AI gradient를 사용하지 않는다. |
| Interaction philosophy | `select → inspect → adjust → preflight`. 변경은 교정 mark와 typed property로 증명한다. |
| AI presence | Story 해석 provenance와 Preflight finding의 source로만 표시한다. 별도 AI panel이나 chat는 없다. |

### 독립 token seed

```text
redline.paper        #F7F4EE
redline.pasteboard   #C7C4BD
redline.ink          #27231F
redline.rule         #9E9A91
redline.selection    #A74632
redline.proof        #80672B
redline.spacing      3 / 6 / 9 / 15 / 24 / 36
redline.radius       0 / 2
```

### Candidate와 Critic의 해석

- Candidate는 gallery가 아니라 세 page proof를 spread처럼 놓는 `Proof Table`이다.
- Critic은 marker overlay보다 `Preflight`와 page annotation을 중심으로 한다.
- Source/Semantic은 tree가 아니라 `Story + Tags`로 표현한다.

### 장점

- 전문 기획서와 편집 디자인이라는 제품 정체성에 가장 직접적이다.
- information hierarchy, alignment, typography를 UI 자체가 중요하게 취급한다.
- Critic과 validation을 인쇄 전 preflight처럼 자연스럽게 설명할 수 있다.

### 위험과 kill criteria

- panel 수가 늘어 InDesign의 복잡성을 복제하면 실패다.
- page보다 studio가 강하게 보이면 실패다.
- 기존 W1 shell에 warm palette와 serif heading만 적용하면 즉시 폐기한다.

## 5. DNA-P: Presentation Theatre

### 단일 관점

사용자는 복잡한 제작 시스템을 조작하는 것이 아니라 한 장의 slide를 무대에 올리고, 보기 모드를 바꾸며, 필요한 순간에만 세부 도구를 부른다.

**Primary Reference: Apple Keynote**

Keynote에서 가져오는 핵심은 slide-only focus, Navigator/Outline/Light Table 같은 view 전환, 낮은 chrome, page를 직접 다루는 흐름이다. macOS glass styling이나 과도하게 느슨한 spacing은 복제하지 않는다.

Secondary의 역할:

- Microsoft PowerPoint: 기존 사용자의 thumbnail, selection, fit/zoom mental model
- Figma: 선택 object 주변의 inline affordance와 빠른 focus/command path

### Design DNA

| 축 | 정의 |
|---|---|
| Typography | `SUIT Variable` 단일 family. 13/15/18/24px의 넓고 명료한 scale, sentence case, 짧은 visible labels. condensed utility type을 쓰지 않는다. |
| Density | 4/10. 한 시점에 하나의 판단만 강하게 보인다. |
| Navigation | `Outline / Slide / Light Table / Review` view switch가 제품의 주 navigation이다. slide filmstrip은 Slide view에서만 보인다. |
| Panel model | selection 때만 열리는 하나의 Inspector sheet 또는 popover. Source와 Semantic은 상시 side panel이 아니라 Outline view 자체가 된다. bottom drawer는 없다. |
| Canvas treatment | 넓은 aluminum-gray stage 위에 slide가 크게 떠 있다. ruler와 guide는 요청할 때만 나타난다. page 주변 여백은 무대이지 빈 dashboard 공간이 아니다. |
| Color | porcelain, aluminum, near-black, cobalt action, coral review. warm editorial token과 dark workbench token을 공유하지 않는다. |
| Interaction philosophy | `focus → direct manipulate → reveal detail only when asked`. mode change는 공간 전환으로 이해된다. |
| AI presence | toolbar의 명시적 `Interpret`, `Suggest layouts`, `Review render` action으로만 진입한다. 실행 후에는 결과가 view에 나타나고 chat는 남지 않는다. |

### 독립 token seed

```text
theatre.room         #F6F5F2
theatre.apron        #D8DADF
theatre.page         #FFFFFF
theatre.ink          #171A20
theatre.action       #315FC7
theatre.review       #D46B55
theatre.spacing      6 / 12 / 18 / 28 / 40 / 56
theatre.radius       9 / 14
```

### Candidate와 Critic의 해석

- Candidate는 별도 `Light Table` view에서 실제 slide만 크게 배열한다.
- Critic은 `Review` view로 전환되며 하나의 finding만 page 위에 나타난다.
- Source/Semantic은 `Outline` view에서 문장과 semantic role의 순서를 편집한다.

### 장점

- slide가 가장 명백한 주인공이 된다.
- PowerPoint/Keynote 사용자의 mental model과 가깝지만 Office ribbon은 피한다.
- 작업 단계별 정보량이 낮아 학습 부담이 적다.

### 위험과 kill criteria

- hidden inspector 때문에 semantic confidence가 떨어지면 실패다.
- 넓은 stage가 의미 없는 빈 공간처럼 보이면 실패다.
- 기존 W2에서 panel을 숨기고 radius만 키운 결과라면 즉시 폐기한다.

## 6. DNA-M: Mechanism Foundry

### 단일 관점

게임 기획의 mechanism을 typed object와 state transition으로 다루고, slide는 그 시스템이 실제로 출력되는 live render target이다. 기획자에게 익숙한 game-production tool의 명료함을 목표로 한다.

**Primary Reference: Unreal Editor**

Unreal Editor에서 가져오는 핵심은 Outliner ↔ Viewport ↔ Details의 강한 selection synchronization, job별 workspace, transient Content Drawer다. 3D 도구, 수많은 toolbar icon, engine mode complexity는 가져오지 않는다.

Secondary의 역할:

- Onlook: authored source와 live rendered selection의 양방향 연결, checkpointed changes
- VS Code: 접히는 Findings/History drawer, command-first diagnostics

### Design DNA

| 축 | 정의 |
|---|---|
| Typography | utility와 number는 `Bahnschrift SemiCondensed`, Korean body는 `Noto Sans KR`. 11/12/13/16px의 고밀도 technical scale과 tabular number. |
| Density | 9/10. 모든 표시가 semantic state, selection, validation, provenance 중 하나를 encode해야 한다. |
| Navigation | 상단 job tabs `Interpret / Compose / Validate`, 좌측 Mechanism Outliner, 중앙 Render Viewport, 우측 Details. document view가 아니라 작업 mode가 navigation을 지배한다. |
| Panel model | resizable docked regions와 transient bottom Drawer. floating sheet나 editorial studio는 없다. |
| Canvas treatment | deep iron viewport가 slide를 24~32px의 좁은 apron으로 감싼다. stage가 검은 빈 공간으로 커지지 않으며 safe-area와 object bounds는 viewport overlay로 표시한다. |
| Color | obsidian, iron, cold text, signal amber selection, electric-lime pass, coral error. 기존 restrained cyan selection을 사용하지 않는다. |
| Interaction philosophy | `select object → inspect typed state → execute bounded operation → checkpoint`. 모든 AI 수정도 operation log와 reversible patch를 남긴다. |
| AI presence | provider나 chat보다 operation provenance, checkpoint, diff로 보인다. AI finding과 deterministic finding은 source label로 구분한다. |

### 독립 token seed

```text
foundry.void         #10161D
foundry.iron         #1C252E
foundry.panel        #26313B
foundry.text         #E6EDF3
foundry.selection    #F0A23A
foundry.pass         #A5D64A
foundry.error        #ED6A5A
foundry.spacing      2 / 5 / 10 / 14 / 20 / 30
foundry.radius       0 / 3
```

### Candidate와 Critic의 해석

- Candidate는 각 CompositionPlan의 구조와 actual render를 함께 보는 `Render Variants` workspace다.
- Critic은 Viewport marker, Details finding, Message Log가 object ID로 연결된다.
- Source/Semantic은 폴더 tree가 아니라 mechanism object와 transition을 가진 `Outliner`다.

### 장점

- 게임 시스템 기획이라는 domain과 가장 강하게 연결된다.
- source, semantic object, render region, typed patch를 추적하기 쉽다.
- deterministic core와 optional AI layer의 경계를 UI에서 명시적으로 보여 준다.

### 위험과 kill criteria

- slide보다 dark viewport와 technical chrome이 강하면 실패다.
- 관리자 도구, IDE, AI 실험실처럼 보이면 실패다.
- 기존 Graphite W1에 Unreal 용어와 amber accent만 적용한 결과라면 즉시 폐기한다.

## 7. 공통 Workbench 변형이 아님을 확인하는 Diversity Gate

| 축 | DNA-E Editorial Redline | DNA-P Presentation Theatre | DNA-M Mechanism Foundry |
|---|---|---|---|
| 기본 은유 | 출판 교정실 | slide 무대 | 게임 시스템 제작소 |
| 핵심 object | Page / Story | Slide / View | Mechanism Object / Render Target |
| 기본 navigation | Pages + Studios | Outline/Slide/Light Table/Review | Interpret/Compose/Validate job tabs |
| Inspector | persistent studio stack | one transient sheet | typed Details region |
| Source/Semantic | Story + Tags | Outline view | Mechanism Outliner |
| Candidate | proof spread | Light Table | Render Variants |
| Critic | Preflight annotation | Review view | Viewport finding + Message Log |
| Canvas | ruler가 있는 pasteboard | 큰 밝은 presentation stage | close-cropped dark viewport |
| Density | high editorial | low focused | very high technical |
| Selection color | oxide red | cobalt | signal amber |
| Interaction | proof and preflight | focus and reveal | bounded operation and checkpoint |

세 방향을 같은 wireframe 위에 올렸을 때 자연스럽게 보인다면 diversity에 실패한 것이다. 각 DNA는 다른 information architecture와 component anatomy를 요구해야 한다.

## 8. 다음 승인 게이트

이번 단계에서 결정할 것은 최종 UI가 아니다.

1. 세 Primary Reference와 Design DNA가 충분히 독립적인지 평가한다.
2. 제거하거나 교체할 DNA가 있는지 결정한다.
3. 승인된 DNA만 각각 완전히 분리된 prototype root에서 시각화한다.
4. 다음 prototype은 W4/W5가 아니며, 동일 fixture와 동일 task moment를 서로 다른 제품 철학으로 해결하는 독립 proof가 된다.
5. DNA proof를 보기 전에는 token 병합, hybrid, production component 추출을 금지한다.

현재 production 구현과 UI prototype 제작은 시작하지 않는다.

