# Phase 1 Core Workspace Proof Report

작성일: 2026-08-28  
상태: Core Workspace Proof 제출, DNA 선택 대기  
범위: 동일 편집 순간을 세 Design DNA로 구현한 browser-rendered proof 3개

## 1. 결과와 경계

- Core Workspace Proof 3개
- 실제 browser screenshot 9개
- viewport: 1920×1080, 1440×900, 1366×768
- 동일 B Mechanism actual render 사용
- 동일 source, semantic structure, BREAK selection, task purpose 사용
- DNA별 HTML/CSS, token namespace, component anatomy를 별도 구현
- 전체 Workspace/Candidate/Critic 세트, DNA 혼합, common component, production 구현 없음

Prototype과 screenshot index: [Phase 1 Design DNA Core Workspace Proof](../prototypes/phase1-dna-core-proof/README.md)

## 2. 동일 조건

| 조건 | 세 proof 공통값 |
|---|---|
| Project | Chrono Break / Combat Mechanism |
| Slide | B Mechanism actual 16:9 render |
| Source | 회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50% |
| Semantic | Trigger → Resource → Timed State → Transition → Outcome |
| Selection | BREAK / Transition / object 04 |
| Task | source와 relation을 유지하며 BREAK transition의 visual emphasis 편집 |
| Guard | Facts 5/5, Relations 4/4, source/order/value locked |

## 3. 동일 shell이 아님을 보여 주는 구조 증거

| 축 | Editorial Redline | Presentation Theatre | Mechanism Foundry |
|---|---|---|---|
| 기본 object | Page / Story / Tag | Slide / View / Selection | Mechanism Object / Render Target / Operation |
| Navigation | menu + contextual control + workspace | Outline / Slide / Light Table / Review view switch | Interpret / Compose / Validate job tabs |
| Source model | Story + Tags | revealed Outline peek | Mechanism Outliner |
| Property model | persistent Studio stack | one temporary Format sheet | typed Details region |
| Canvas | ruler와 guide가 있는 pasteboard | low-chrome presentation stage | tightly framed live render viewport |
| Selection | oxide editorial frame + guide | cobalt direct-manipulation handles + inline control | amber object bound synchronized to Outliner/Details |
| Validation | Preflight | content-fixed reveal | deterministic Guards + bounded operation |
| Density | high editorial | low focused | very high domain-technical |

세 prototype은 fixture image만 공유한다. stylesheet, layout tree, token 이름, control anatomy를 공유하지 않는다.

## 4. Editorial Redline

**Primary Reference:** Adobe InDesign  
**Secondary:** Affinity Publisher, Penpot

### 화면에서 드러나는 철학

- 상단 application menu와 contextual control strip
- `Pages`와 `Story + Tags`를 분리한 authored document model
- ruler, guide, pasteboard, actual page boundary
- persistent `Properties / Tags / Preflight` Studio
- bottom Preflight status와 Story 04 selection link

Interaction trace:

`Story 04 선택 → page의 BREAK frame 선택 → Transition Studio 속성 확인 → Preflight로 content/relation 보존 확인`

### 장점

- 게임 기획 문장을 편집물로 다룬다는 태도가 가장 직접적이다.
- source span, semantic tag, page object, preflight가 한 작업 흐름으로 연결된다.
- 정렬, typography, page geometry를 장시간 세밀하게 편집하기 좋다.

### 단점과 장시간 사용 위험

- 세 방향 중 persistent information이 많아 작은 화면에서 canvas 압박이 가장 크다.
- Story와 Studio를 모두 계속 열어 두면 초보 사용자에게 인지 부하가 높다.
- production에서는 workspace preset과 Studio collapse가 필요하다.

### Kill criteria 판정

- InDesign의 page/story/studio/preflight anatomy가 실제로 보인다: 통과
- warm palette만 적용한 기존 W1인가: 아님. menu/control strip, Pages/Story model, ruler/pasteboard, Studio/Preflight 구조가 다르다.
- Studio가 page보다 강한가: 아님. 세 viewport에서 actual slide가 가장 큰 단일 artifact다.
- 남은 위험: 기본 공간 배치가 좌·중·우이므로 interaction prototype에서 Studio collapse와 Story editing을 증명하지 못하면 다시 generic workbench로 수렴할 수 있다.

### Screenshot critique

- 1920×1080: page가 1120px 폭으로 유지되고 pasteboard 여백은 ruler와 page 작업 공간으로 읽힌다.
- 1440×900: slide, Story 5행, Transition Studio, Preflight가 동시에 보이며 overflow가 없다.
- 1366×768: side area를 194px/226px로 축소해 page 약 860px 폭을 유지한다. property와 bottom Preflight action이 잘리지 않는다.

Screenshots: [1920×1080](../prototypes/phase1-dna-core-proof/screenshots/editorial-redline/1920x1080.png) · [1440×900](../prototypes/phase1-dna-core-proof/screenshots/editorial-redline/1440x900.png) · [1366×768](../prototypes/phase1-dna-core-proof/screenshots/editorial-redline/1366x768.png)

## 5. Presentation Theatre

**Primary Reference:** Apple Keynote  
**Secondary:** Microsoft PowerPoint, Figma

### 화면에서 드러나는 철학

- `Outline / Slide / Light Table / Review`가 panel tab이 아니라 view navigation
- Slide view에서 actual slide가 넓은 stage의 중심
- Source/Semantic은 상시 tree가 아니라 현재 열어 본 `Outline peek`
- Format은 선택 때문에 나타난 단일 reveal sheet
- selected BREAK 가까이에 inline direct-manipulation control
- bottom drawer, status bar, persistent property grid 없음

Interaction trace:

`Slide view에서 BREAK 직접 선택 → inline emphasis control 확인 → 필요한 Format sheet만 reveal → Done으로 stage에 복귀`

### 장점

- 세 방향 중 slide dominance와 first-use clarity가 가장 강하다.
- 한 시점에 하나의 선택과 하나의 Format sheet만 보여 low-chrome 철학이 분명하다.
- PowerPoint/Keynote 사용자는 view와 slide filmstrip을 별도 학습 없이 이해하기 쉽다.

### 단점과 장시간 사용 위험

- hidden context 때문에 semantic relation을 반복 확인할 때 view switching 비용이 생긴다.
- 많은 property를 나란히 비교하거나 여러 object를 batch editing하기 어렵다.
- Outline peek와 Format을 함께 열어 둔 상태가 길어지면 low-chrome 장점이 줄어든다.

### Kill criteria 판정

- slide-first, focus/reveal 철학이 실제로 보인다: 통과
- W2에서 panel을 숨기고 radius만 키운 것인가: 아님. navigation이 view model로 바뀌고, Source가 Outline view/peek이며, Inspector는 temporary sheet다.
- stage가 의미 없는 landing-page whitespace인가: 아님. page가 viewport의 중심 대부분을 차지하고 selection action과 연결된다.
- 남은 위험: semantic confidence를 항상 요구하는 power user에게 Outline peek가 너무 얕을 수 있다.

### Screenshot critique

- 1920×1080: actual slide가 약 1260px 폭으로 가장 강한 주인공이며 sheet가 slide boundary 밖에 있다.
- 1440×900: left Outline peek와 right Format 사이에 slide가 크게 유지되고 selection control이 실제 BREAK 위치에 고정된다.
- 1366×768: slide 약 920px 폭, sheet와 slide 사이 최소 여백이 남으며 Done action과 source lock이 잘리지 않는다.

Screenshots: [1920×1080](../prototypes/phase1-dna-core-proof/screenshots/presentation-theatre/1920x1080.png) · [1440×900](../prototypes/phase1-dna-core-proof/screenshots/presentation-theatre/1440x900.png) · [1366×768](../prototypes/phase1-dna-core-proof/screenshots/presentation-theatre/1366x768.png)

## 6. Mechanism Foundry

**Primary Reference:** Unreal Editor  
**Secondary:** Onlook, VS Code

### 화면에서 드러나는 철학

- `Interpret / Compose / Validate` job navigation
- file tree가 아닌 semantic object flow를 가진 Mechanism Outliner
- actual slide를 live Render Target으로 취급
- BREAK selection이 Outliner, amber viewport bound, typed Details에 동기화
- content guard와 visual patch를 분리한 Bounded Operation
- bottom Content Drawer는 닫힌 상태이며 주 화면을 차지하지 않음

Interaction trace:

`Mechanism Object 04 선택 → Render Target 위치 확인 → Details에서 typed visual state 편집 → Bounded Operation preview → checkpoint`

### 장점

- game mechanism의 object와 transition 관계를 가장 빠르게 추적할 수 있다.
- deterministic guard와 수정 가능한 visual state의 경계가 명확하다.
- 복잡한 semantic object가 늘어날 때 selection synchronization 확장성이 좋다.

### 단점과 장시간 사용 위험

- 가장 높은 density와 대비 때문에 비전문 사용자에게 진입 장벽이 높다.
- object naming과 operation language가 지나치면 기획자가 엔진 tool을 쓰는 느낌을 받을 수 있다.
- dark viewport와 작은 utility type은 장시간 읽기 피로를 유발할 수 있다.

### Kill criteria 판정

- Mechanism Object / Render Target / Details / Bounded Operation이 실제로 연결된다: 통과
- 기존 Graphite Workbench의 amber theme인가: 아님. Source panel 대신 object flow, generic Inspector 대신 typed Details, status drawer 대신 operation pipeline을 사용한다.
- IDE나 관리자 dashboard인가: 현재 proof에서는 file tab, code, metrics, card dashboard, AI activity가 없고 game mechanism object가 navigation을 지배하므로 통과.
- dark empty stage가 slide보다 강한가: 아님. viewport apron을 좁히고 operation shelf가 남는 높이를 사용해 slide가 중심을 채운다.
- 남은 위험: 용어와 density가 조금만 늘어도 Unreal clone 또는 IDE 감각으로 넘어갈 수 있으므로 이후 proof에서도 가장 엄격한 kill gate가 필요하다.

### Screenshot critique

- 1920×1080: render target이 center viewport의 대부분을 채우며 dark apron이 장식적 빈 공간으로 커지지 않는다.
- 1440×900: Outliner, actual render, Details, bounded operation의 object ID 연결이 한 시선에 보인다.
- 1366×768: panel을 208px/232px로 줄여 slide 약 900px 폭을 확보했다. Preview Operation과 Reset Visual State가 모두 viewport 안에 남는다.

Screenshots: [1920×1080](../prototypes/phase1-dna-core-proof/screenshots/mechanism-foundry/1920x1080.png) · [1440×900](../prototypes/phase1-dna-core-proof/screenshots/mechanism-foundry/1440x900.png) · [1366×768](../prototypes/phase1-dna-core-proof/screenshots/mechanism-foundry/1366x768.png)

## 7. 일곱 기준의 동일 조건 비교

아래는 winner 점수가 아니라 screenshot에서 확인되는 상대적 강점과 tradeoff다.

| 기준 | Editorial Redline | Presentation Theatre | Mechanism Foundry |
|---|---|---|---|
| 1. Slide가 얼마나 강한 주인공인가 | page가 중심이지만 Story/Studio가 지속적으로 경쟁한다 | 가장 강함. 큰 stage와 한 개 reveal sheet만 존재 | 강함. tight viewport 덕분에 dark chrome이 slide를 밀어내지 않음 |
| 2. 처음 보는 사용자의 행동 이해 | Story 선택과 Studio 편집은 명료하지만 용어 학습 필요 | 가장 쉬움. slide 선택, Format, Done 흐름이 익숙함 | 가장 어려움. Outliner/Details/Operation 개념을 배워야 함 |
| 3. 게임 기획 구조 확인 | Story/Tags와 relation guard로 강함 | Outline peek에서 확인 가능하나 깊이는 가장 얕음 | 가장 강함. object flow와 typed relation이 작업의 중심 |
| 4. 장시간 사용 편의 | 정밀 편집에 강하지만 persistent density가 높음 | 시각 피로가 가장 낮지만 반복 reveal 비용이 있음 | power user에게 빠르지만 density와 dark contrast 피로가 큼 |
| 5. 전문 제작도구 인상 | editorial production tool로 매우 강함 | polished presentation studio로 강함 | domain production tool로 강하지만 숙련자 지향 |
| 6. AI SaaS / 관리자 / IDE에서 이탈 | AI 흔적과 dashboard 문법 없음 | 세 방향 중 가장 멀리 벗어남 | AI/admin은 피했지만 IDE 인접 위험은 계속 감시 필요 |
| 7. Primary Reference 철학의 interaction 체감 | Page/Story/Studio/Preflight chain이 체감됨 | View switch/focus/reveal/direct selection이 체감됨 | Outliner/Viewport/Details/bounded operation sync가 체감됨 |

## 8. QA

- independent prototype HTML: 3개
- screenshot PNG: 9개
- 모든 PNG 실제 pixel dimension과 filename 일치
- 모든 prototype에 동일 다섯 source facts 포함
- 모든 prototype에 동일 BREAK / Transition selection 포함
- broken local image path: 0
- external script와 HTTP dependency: 0
- Lorem Ipsum: 0
- 3개 viewport에서 horizontal overflow와 clipped primary action 없음

## 9. 다음 결정 전 유지할 제한

- 현재 비교만으로 winner를 자동 선택하지 않는다.
- DNA를 섞지 않는다.
- shared component나 common Design System을 추출하지 않는다.
- 전체 Workspace/Candidate/Critic 화면 세트를 만들지 않는다.
- production UI, renderer, exporter, AI provider 구현을 시작하지 않는다.

사용자가 어떤 DNA를 발전시킬지 결정할 때까지 proof 상태로 보존한다.

