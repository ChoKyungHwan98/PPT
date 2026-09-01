# UX Architecture Exploration

## Gate status

이 문서는 UI direction을 선택하지 않는다. Typography, color, radius, visual theme도 결정하지 않는다. Presentation Theatre의 색감에 대한 사용자 선호는 이후 visual design input으로 보존하지만, UX architecture 평가에는 사용하지 않는다.

기존 `Left Sidebar + Center Canvas + Right Inspector`와 Workspace/Panel/Inspector 전제는 중지한다. 이전 Core Workspace Proof는 방향성 evidence로만 남는다. 이번 네 architecture는 같은 shell의 variation이 아니며, 무엇을 primary artifact로 보는지부터 다르다.

## Shared product task

네 안 모두 같은 canonical state와 같은 task를 다뤄야 한다.

```text
Authored source
  → SlideIR
  → CompositionPlan candidates
  → RenderTree candidates
  → actual render observation
  → critique / bounded revision
  → selected artifact
  → HTML / PDF / PPTX / PNG output profile
```

Fixture moment:

```text
회피 ×3
→ 시간 파편 획득
→ 시간 정지 5초
→ BREAK
→ 받는 피해 +50%
```

사용 목적은 `BREAK` semantic object를 선택하고, 앞의 trigger/state transition과 뒤의 damage modifier 관계를 보존하면서 visual emphasis를 조정하는 것이다.

## Architecture A — Manuscript to Proof

### Mental model

**“기획 문서를 먼저 읽고, 각 의미 단위를 visual proof로 발전시킨다.”**

Primary artifact는 slide canvas가 아니라 사용자가 작성한 game-planning document다. Slide는 document section에 연결된 proof이자 publication view다.

Persistent left/right sidebar: **없음**.

### 기본 화면

- 중앙의 continuous document가 화면 대부분을 차지한다.
- 각 section은 source text, normalized semantic statement, relation summary를 가진다.
- Visualized section에는 현재 선택된 page proof가 문단 아래에 inline으로 붙는다.
- 상단에는 project/title/current publication만 있고, section navigation은 search/outline overlay로 호출한다.

### 사용자가 내용을 입력하는 방식

- 사용자는 문서 본문을 그대로 paste하거나 section 단위로 입력한다.
- Parser가 구조화한 문장을 원문 아래에 보여주되, 원문을 바꾸지 않는다.
- condition, action, state, duration, modifier 같은 role은 inline semantic chip 또는 underline으로 표시한다.
- 사용자는 문장을 직접 재작성하기보다 role, relation, scope를 교정한다.

### Semantic structure 확인 방법

- 기본 상태에서는 document reading flow를 방해하지 않는 얇은 role mark만 보인다.
- `Logic View`를 켜면 현재 section이 compact relation diagram으로 펼쳐진다.
- Source span을 hover/focus하면 연결된 semantic object와 page artifact가 동시에 강조된다.
- 전체 deck semantic map은 full-screen overlay로 열리고 닫힌다.

### Slide/page 디자인 방법

- Section의 `Visualize` action이 CompositionPlan 후보를 만든다.
- 현재 proof 아래의 “message / reading path / grouping / emphasis” control로 high-level intent만 바꾼다.
- 자유 좌표 편집 대신 semantic role과 composition decision을 조정하고 재-render한다.
- 상세 visual tweak가 필요하면 proof를 focus view로 확대하지만 document로 돌아오는 경로를 유지한다.

### 요소 선택/수정 방법

- Proof의 `BREAK`를 선택하면 대응 source span과 semantic row가 문서 안에서 강조된다.
- Selection에 붙는 small action strip에서 `Emphasis`, `Role`, `Relation`, `Group`, `Lock content`만 제공한다.
- Geometry/typography value는 기본적으로 노출하지 않고 advanced details sheet에서만 본다.

### 후보 비교 방법

- 같은 section 아래에 A/B/C proof strip을 sibling으로 보존한다.
- 각 proof 위에는 차이를 설명하는 한 줄만 둔다: reading path, dominant artifact, grouping.
- 하나를 선택하면 나머지는 접히지만 삭제되지 않는다.
- Document scroll context를 유지한 채 compare할 수 있어 source와 결과 사이의 추적성이 강하다.

### Critic/review 방법

- `Review`는 document redline처럼 작동한다.
- Finding은 rendered proof의 anchored mark와 source/semantic evidence를 한 쌍으로 보여준다.
- 수정 제안은 “source 변경”과 “visual-only patch”를 명확히 분리한다.
- Accept/ignore 후 proof가 다시 render되고 before/after가 section 안에 남는다.

### Navigation

- Document scroll, heading outline overlay, search, semantic object jump.
- Page 순서 변경은 document section reorder 또는 publication outline에서 수행한다.
- Slide number보다 source section identity가 우선한다.

### Export

- `Publish` sheet에서 document 전체, selected sections, selected proof를 고른다.
- Output profile은 HTML presentation, PDF document/deck, PPTX compatibility, PNG page/image로 분리한다.
- Export 전 publication order와 missing proof를 document outline에서 확인한다.

### 장점

- 사용자의 기존 내용과 논리 보존이 가장 직접적으로 보인다.
- Source → semantic → visual의 trace가 분리되지 않는다.
- 게임 기획서가 slide deck과 document 사이를 오가는 제품 정의에 잘 맞는다.
- Arbitrary object editor scope를 억제한다.

### 단점

- 발표용 한 장을 크게 보며 미세 조정하는 속도는 떨어질 수 있다.
- Long document 안에서 proof가 많아지면 scroll이 길어지고 visual rhythm이 끊긴다.
- PowerPoint mental model에 익숙한 사용자는 “슬라이드가 어디에 있는가”를 처음에 물을 수 있다.

### 초보 사용자 학습 난도

**낮음–중간.** Source를 먼저 다루므로 진입은 자연스럽다. 다만 semantic mark와 proof lifecycle을 가르쳐야 한다.

### 장시간 작업 적합성

**높음.** 내용 검토와 시각 설계를 함께 오래 수행하기 좋다. 단, focus view와 document position restore가 정확해야 한다.

### Kill criteria

- Document가 단순 prompt form과 result card list처럼 보이면 실패.
- Slide proof가 작은 thumbnail로만 남아 실제 design 판단이 불가능하면 실패.
- AI가 원문을 재작성하는 authoring product로 바뀌면 실패.

## Architecture B — Live Stage

### Mental model

**“결과를 크게 보고, 필요한 순간에만 의미와 도구를 reveal한다.”**

Primary artifact는 현재 presentation page다. Presentation Theatre의 visual 취향과는 별개로, UX 철학만 slide-first/focus/reveal이다.

Persistent left/right sidebar: **없음**.

### 기본 화면

- 실제 16:9 page가 가능한 한 크게 보인다.
- 상단에는 project breadcrumb, current page identity, Present, Publish만 남긴다.
- 하단 page scrubber/filmstrip은 pointer movement, keyboard command, page change 때만 나타나고 다시 사라진다.
- Empty stage margin은 selection feedback와 zoom을 위한 최소량만 둔다.

### 사용자가 내용을 입력하는 방식

- `Source` command를 실행하면 full-width sheet가 stage 위를 덮고 원문/semantic summary를 편집한다.
- Paste/new content는 modal form이 아니라 stage를 잠시 대체하는 source room이다.
- 저장 후 sheet가 닫히고 page가 다시 render된다.

### Semantic structure 확인 방법

- `Meaning` toggle을 누르면 page 위에 semantic overlay가 나타난다.
- `BREAK` 같은 object와 relation path가 rendered object 위에 직접 표시된다.
- Overlay는 inspect 중에만 존재하고, 닫으면 presentation-clean view로 돌아간다.
- 전체 semantic structure는 command로 stage를 대체하는 map view다.

### Slide/page 디자인 방법

- Page background click은 page-level contextual capsule을 띄운다: `Change composition`, `Regenerate candidates`, `Reading path`, `Density`.
- Object click은 object-bound capsule을 띄운다.
- Complex choices는 하단 action sheet로 확장되며, 선택이 끝나면 자동으로 사라진다.
- Freeform geometry는 V1 default가 아니며 keyboard nudge 또는 advanced sheet에 제한한다.

### 요소 선택/수정 방법

- `BREAK` 선택 시 selection frame과 작은 semantic label만 page 위에 나타난다.
- Floating actions는 current role에서 가능한 bounded operations만 보여준다.
- Source content, visual emphasis, relation visibility를 서로 다른 command로 구분한다.
- Escape를 누르면 모든 chrome이 사라지고 clean page만 남는다.

### 후보 비교 방법

- `Compare`가 현재 stage를 임시 compare stage로 전환한다.
- Equal-size 3-up, 1+2 focus, flicker compare를 즉시 전환할 수 있다.
- Candidate를 선택하면 해당 후보가 full stage로 확대되고, 이전 후보로 돌아가는 filmstrip이 잠시 남는다.
- Candidate 설명은 hover/focus 시에만 보인다.

### Critic/review 방법

- Actual render 위에 numbered finding pins를 얹는다.
- 한 finding을 선택하면 하단 review sheet에 evidence, severity, proposed typed patch, before/after toggle이 열린다.
- `Apply`, `Ignore`, `Show source`가 같은 decision line에 있다.
- Review를 종료하면 pins와 sheet가 모두 사라진다.

### Navigation

- Arrow/PageUp/PageDown, transient bottom filmstrip, `O` overview, goto command.
- Page list를 항상 보지 않으며 현재 page identity는 상단에 남긴다.
- Overview는 full-screen contact sheet다.

### Export

- `Publish`는 stage를 output preview room으로 전환한다.
- Output별 preview와 capability/downgrade summary를 보여주고 export한다.
- Present는 chrome을 완전히 제거한 runtime으로 바로 진입한다.

### 장점

- Slide가 가장 강한 주인공이다.
- 초보자도 선택한 대상과 다음 action을 공간적으로 이해하기 쉽다.
- Presentation/visual review 전환이 빠르다.
- 불필요한 panel fatigue를 줄인다.

### 단점

- Source와 semantic structure를 자주 대조하는 사용자에게 mode switching cost가 생긴다.
- 많은 page를 장시간 관리할 때 위치 감각을 잃을 수 있다.
- 숨겨진 command의 discoverability를 세심하게 설계해야 한다.

### 초보 사용자 학습 난도

**낮음.** Direct selection과 contextual action은 이해하기 쉽다. Hover/keyboard 없이도 핵심 command를 찾을 수 있어야 한다.

### 장시간 작업 적합성

**중간–높음.** 한 장 집중에는 매우 좋고 chrome fatigue가 낮다. Deck-scale 구조 작업에는 overview 전환 품질이 관건이다.

### Kill criteria

- Tool discoverability 때문에 결국 persistent left/right rails를 복구하면 실패.
- Floating controls가 slide content를 가리거나 web page builder처럼 보이면 실패.
- Compare와 Critic 설명이 stage보다 더 강해지면 실패.

## Architecture C — Light Table

### Mental model

**“기획 문서의 흐름과 여러 visual proof를 한 번에 펼쳐 놓고 편집한다.”**

Primary artifact는 active slide 한 장이 아니라 page들의 spatial collection이다. 사진 편집의 light table, storyboard, editorial flatplan과 유사한 작업 방식이다.

Persistent left/right sidebar: **없음**.

### 기본 화면

- 화면 전체가 zoomable contact sheet다.
- Page는 큰 thumbnail, message, semantic shape, status로 구성된 artifact card지만 card UI 자체가 내용보다 강하지 않아야 한다.
- 각 page 아래에 candidate stack이나 review state가 접힌 형태로 붙는다.
- Deck section은 공간적 group/row로 표현한다.

### 사용자가 내용을 입력하는 방식

- Empty slot 또는 section row에서 source block을 paste한다.
- 여러 source section을 한 번에 넣으면 page proposal이 board에 생성된다.
- 한 page의 source edit는 card를 확장하거나 dedicated source overlay에서 수행한다.

### Semantic structure 확인 방법

- 각 page 아래에 message와 semantic shape를 짧게 표시한다.
- `Logic Map` mode는 thumbnail보다 relation lane을 강조해 cross-page flow와 dependency를 보여준다.
- 같은 semantic object가 여러 page에 쓰이면 board 전체에서 highlight된다.

### Slide/page 디자인 방법

- Page를 double-click하면 board 위에 large proof lens가 열린다.
- Lens 안에서 high-level composition control과 semantic selection을 사용한다.
- Board에서는 reorder, grouping, section rhythm, page density variation을 다룬다.
- Lens를 닫으면 zoom/scroll position이 유지된다.

### 요소 선택/수정 방법

- Lens 안에서 rendered object를 선택하고 contextual actions를 사용한다.
- Board level에서는 object가 아니라 page/message/group을 선택한다.
- 이 구분으로 “deck structure editing”과 “slide composition editing”을 혼합하지 않는다.

### 후보 비교 방법

- 한 page card 뒤에 후보가 stack으로 보존된다.
- `Explode variants`를 누르면 같은 row에서 A/B/C가 나란히 펼쳐진다.
- 여러 page의 후보를 동시에 펼쳐 deck rhythm과 style consistency까지 비교할 수 있다.
- 선택한 후보만 parent page 자리를 차지하고 나머지는 접힌 stack에 남는다.

### Critic/review 방법

- Findings가 page badge와 board filter로 나타난다.
- Severity, overflow, hierarchy, fidelity, cross-page consistency로 filter한다.
- Finding을 선택하면 해당 page lens가 열리고 anchored observation을 보여준다.
- Deck-wide review와 single-page repair가 자연스럽게 연결된다.

### Navigation

- Spatial pan/zoom, section jump, search, page number, mini-map.
- Presentation order는 board의 explicit path와 page numbering으로 표시한다.
- `Play from here`는 선택한 page에서 presentation mode로 들어간다.

### Export

- Board에서 deck/section/pages를 선택한 뒤 `Publish selection`을 실행한다.
- Output preview는 board order를 그대로 사용한다.
- Missing selection, unresolved candidate, severe finding을 board에서 즉시 찾는다.

### 장점

- Deck flow, page rhythm, candidate variation, unresolved review를 한눈에 볼 수 있다.
- Candidate compare가 별도 도구가 아니라 artifact organization 자체에 포함된다.
- 발표/제출 전에 전체 논리 흐름을 검수하기 좋다.

### 단점

- 한 장을 크게 보는 비율이 낮아질 수 있다.
- Zoomable workspace interaction이 초보자에게 낯설 수 있다.
- Page가 많아지면 visual noise와 spatial memory 부담이 커진다.
- Single-slide vertical slice에는 architecture의 장점이 충분히 드러나지 않을 수 있다.

### 초보 사용자 학습 난도

**중간.** Storyboard는 직관적이지만 zoom, variant stack, board-level vs lens-level selection을 배워야 한다.

### 장시간 작업 적합성

**높음.** Deck-scale 구조/검수에는 가장 좋다. Long session에서 mini-map, focus restore, density control이 필수다.

### Kill criteria

- Contact sheet가 작은 slide thumbnails와 status cards로 가득 찬 dashboard가 되면 실패.
- Page lens가 사실상 기존 tri-rail editor를 modal 안에 넣은 것이라면 실패.
- Spatial layout이 presentation order를 모호하게 만들면 실패.

## Architecture D — Checkpoint Rooms

### Mental model

**“한 번에 한 종류의 판단만 완료하며, 언제든 이전 판단으로 돌아간다.”**

Primary artifact는 editor shell이 아니라 resumable design process다. `Source → Structure → Compose → Compare → Review → Publish`가 각각 독립된 room이며 한 화면에 모든 control을 쌓지 않는다.

Persistent left/right sidebar: **없음**.

### 기본 화면

- 상단에 compact process path와 current checkpoint가 있다.
- 중앙은 checkpoint마다 완전히 다른 task surface가 된다.
- 완료 여부, unresolved decision, last output만 process path에 표시한다.
- Wizard처럼 next만 강제하지 않고 어느 checkpoint로든 돌아갈 수 있다.

### 사용자가 내용을 입력하는 방식

- Source Room에서 authored content와 source attachment를 입력한다.
- 원문을 확인한 뒤 Structure Room으로 이동한다.
- 이미 content가 존재하면 last unresolved checkpoint에서 바로 resume한다.

### Semantic structure 확인 방법

- Structure Room은 source와 semantic graph/table만 보여준다.
- 각 fact/relation을 confirm/correct하고 source span을 검증한다.
- `Approved structure`가 되어야 Compose 후보의 immutable content boundary가 된다.

### Slide/page 디자인 방법

- Compose Room은 message, role, reading path, density, composition knobs에 집중한다.
- Actual render는 큰 stage에 즉시 반영된다.
- Object-level edit보다 composition decision을 먼저 완료한다.

### 요소 선택/수정 방법

- Compose/Review Room에서만 rendered object selection이 가능하다.
- `BREAK`를 선택하면 현재 checkpoint에서 허용된 bounded operation만 나타난다.
- Source text 변경이 필요한 operation은 Structure Room으로 명시적으로 이동시킨다.

### 후보 비교 방법

- Compare Room이 전용 surface다.
- A/B/C를 equal footing으로 보여주고 message clarity, reading path, semantic fidelity, visual hierarchy 기준으로 선택한다.
- 하나를 고르지 않아도 checkpoint를 떠날 수 있지만 Publish는 unresolved 상태를 경고한다.

### Critic/review 방법

- Review Room은 actual render, finding queue, evidence, proposed patch, before/after만 보여준다.
- Apply patch는 Render → Observe → Critique loop를 한 번 더 실행한다.
- “무엇을 고칠 것인가” 외의 navigation/design controls는 숨긴다.

### Navigation

- Process path, unresolved decision queue, resume command.
- Page navigation은 room 내부의 compact goto/overview로 제공한다.
- History는 시간순 log가 아니라 checkpoint decision history로 접근한다.

### Export

- Publish Room에서 output profile, range, presentation runtime options, capability/downgrade report를 확인한다.
- PDF/HTML/PPTX/PNG가 destination에 맞는 profile로 제시된다.
- Export 후에도 canonical project는 같은 checkpoint state를 유지한다.

### 장점

- 처음 보는 사용자가 “지금 무엇을 해야 하는가”를 가장 쉽게 이해한다.
- AI와 deterministic core의 책임 경계가 단계별로 명확하다.
- Candidate compare와 critic이 부차적 panel이 아니라 실제 product workflow가 된다.
- Complex UI를 한 화면에 쌓지 않는다.

### 단점

- 숙련자가 source/structure/render를 빠르게 왕복할 때 전환 비용이 크다.
- 잘못 설계하면 AI SaaS generation wizard처럼 느껴질 수 있다.
- 한 장을 오래 polish할 때 process labels가 불필요하게 느껴질 수 있다.

### 초보 사용자 학습 난도

**가장 낮음.** 단계의 목적과 완료 조건을 명확히 설명할 수 있다.

### 장시간 작업 적합성

**중간.** Review/approval session에는 좋다. 반복 제작에는 keyboard jump, checkpoint pinning, state preservation이 없으면 피로하다.

### Kill criteria

- Linear `Next` button만 누르는 generation wizard가 되면 실패.
- 사용자가 결과를 직접 inspect/correct하지 못하고 AI 완료를 기다리는 flow가 되면 실패.
- Checkpoint 전환마다 context/selection/scroll을 잃으면 실패.

## 비교

| Criterion | A Manuscript to Proof | B Live Stage | C Light Table | D Checkpoint Rooms |
|---|---|---|---|---|
| Primary artifact | Authored document + inline proof | Current rendered page | Deck/page collection | Current design decision |
| Default scale | Section | One page | Whole deck / section | One workflow checkpoint |
| Persistent left/right sidebar | No | No | No | No |
| Source fidelity visibility | Very high | On demand | Medium–high | Very high in Structure Room |
| Slide visual prominence | Medium, high in focus view | Very high | Medium, high in lens | High in Compose/Compare/Review |
| Deck flow visibility | High as document outline | Low until overview | Very high | Medium |
| Candidate comparison | Inline sibling proofs | Temporary compare stage | Variant stacks / exploded row | Dedicated Compare Room |
| Critic model | Document redline | Anchored overlay + sheet | Board filter + page lens | Dedicated Review Room |
| Beginner clarity | High | High | Medium | Very high |
| Long-session fit | High | Medium–high | High | Medium |
| Main risk | Slide feels secondary | Hidden tools / mode switching | Dashboard/noise | Wizard/SaaS feel |

## What this round does not decide

- 어떤 architecture가 최종인지
- Architecture 간 hybrid
- Typography, palette, density token, animation style
- Persistent sidebar가 미래 어느 advanced mode에서도 금지되는지
- Production framework와 component system

## 다음 승인 gate 제안

사용자가 네 mental model 중 prototype proof로 진행할 대상을 선택한 뒤에만 다음 단계로 간다. 다음 proof에서도 같은 project, source, SlideIR, selected `BREAK`, task를 유지해야 하며, color/theme은 architecture 차이를 가리는 변수가 되지 않도록 neutral하게 통제한다.

Prototype 전에 각 선택안에 대해 다음 질문을 확정한다.

1. 첫 30초 안에 source, current artifact, next action을 찾을 수 있는가?
2. `BREAK`의 source span과 rendered object를 왕복하는 데 몇 step이 필요한가?
3. A/B/C actual renders를 같은 기준으로 비교할 수 있는가?
4. Critic finding을 확인하고 apply/ignore하는 동안 slide가 충분히 크게 보이는가?
5. Presentation과 Publish가 editor의 부가 export button이 아니라 목적지로 느껴지는가?

