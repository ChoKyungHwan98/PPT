# Presentation Authoring Reference Audit

## 목적과 범위

이 문서는 시각 스타일이 아니라 presentation/document authoring의 실제 interaction flow를 비교한다. 질문은 “어떤 프로그램처럼 보일 것인가”가 아니라 다음과 같다.

1. 사용자는 어디서 시작하는가?
2. 페이지와 슬라이드를 어떻게 찾는가?
3. 무엇을 직접 수정하는가?
4. 디자인 결정은 어디서 일어나는가?
5. 도구는 언제 나타나고 사라지는가?
6. sidebar는 실제로 어떤 일을 하기 때문에 존재하는가?
7. contextual UI는 어떤 범위에서 쓰이는가?
8. 후보와 변형은 어떻게 다뤄지는가?
9. 편집과 발표는 어떻게 분리되는가?
10. HTML, PDF, PPTX, PNG 출력은 어떤 위치를 차지하는가?

Audit 기준일은 2026-08-28이다. README만 읽지 않고 최신 기본 브랜치의 route, shell, editor, navigation, export 관련 코드를 함께 확인했다. 실행 화면이 README와 불일치하거나 프로젝트가 초기 단계인 경우 이를 명시했다.

## 조사 snapshot

| Project | Inspected revision | License | Official source |
|---|---|---|---|
| Oh My PPT | `73b9720`, 2026-08-22 | Apache-2.0 | [arcsin1/oh-my-ppt](https://github.com/arcsin1/oh-my-ppt) |
| PPTist | `e491258`, 2026-08-16 | AGPL-3.0 / separate commercial terms | [pipipi-pikachu/PPTist](https://github.com/pipipi-pikachu/PPTist) |
| Presenton | `f867ada`, 2026-08-26 | Apache-2.0 | [presenton/presenton](https://github.com/presenton/presenton) |
| Casual Slides | `2762698`, 2026-08-02 | Apache-2.0 | [CasualOffice/slides](https://github.com/CasualOffice/slides) |
| reveal.js | `807b430`, 2026-08-24 | MIT | [hakimel/reveal.js](https://github.com/hakimel/reveal.js) |
| Reveal Editor | `a9bb409`, 2026-08-26 | MIT | [samplereality/reveal-editor](https://github.com/samplereality/reveal-editor) |
| Slidev | `a8d8ff7`, 2026-08-25 | MIT | [slidevjs/slidev](https://github.com/slidevjs/slidev) |
| Marp ecosystem | `marp aaac234`, `marp-cli 527edc3`, `marp-vscode f718437` | MIT | [marp-team/marp](https://github.com/marp-team/marp), [marp-cli](https://github.com/marp-team/marp-cli), [marp-vscode](https://github.com/marp-team/marp-vscode) |

## 1. Oh My PPT

근거: [README workflow](https://github.com/arcsin1/oh-my-ppt/blob/main/README_EN.md#-workflow), `session-detail`, `BrowseView`, `WorkspaceTabs`, `PreviewStage`, element inspector와 export 관련 최신 source.

| Question | Interaction finding |
|---|---|
| Start | Home에서 topic-based creation, multi-turn chat, document upload, saved template, legacy PPTX import 중 하나로 시작한다. 생성 전 topic/material/page count/canvas/style/font/visual을 확인한다. |
| Navigate | Session 안에서 deck browse와 selected-page edit를 분리한다. Browse는 page card grid이고, edit는 선택 페이지 중심이다. Page card에서 rename, duplicate, delete, per-page export가 가능하다. |
| Edit content | Canvas element drag/edit, selection-bound element inspector, page/deck chat edit, HTML editing, one-click page beautify가 공존한다. History rollback도 session 안에 있다. |
| Change design | 90+ style skills, full-deck style switch, master settings, selected-element appearance/layout controls를 사용한다. Style switch는 background job으로 실행되고 실패 페이지를 재시도할 수 있다. |
| Tool timing | Browse와 Edit가 workspace tab으로 갈리고, inspector는 element selection에 반응한다. History와 asset picker는 modal, generation 상태는 별도 activity/status surface다. |
| Sidebar | 생성과 편집에서 sidebar/workbench가 사용되지만, deck browse는 grid로 전환된다. Sidebar는 product identity가 아니라 생성 상태, page list, AI/edit controls를 동시에 유지하기 위한 결과다. |
| Contextual UI | Page card action, selected-element inspector, current-page AI operation, insert ribbon이 context에 따라 달라진다. |
| Candidate/variant | 동등한 A/B/C를 한 화면에서 비교하는 UX는 없다. Style switch나 beautify는 현재 결과를 background job으로 교체하고 history/retry로 관리하는 쪽에 가깝다. |
| Present | Preview, presentation, fullscreen presentation을 분리하며 좌우키와 `ESC`를 지원한다. |
| Export | PDF, slide PNG, long PNG, editable PPTX, MP4, packaged HTML을 지원한다고 명시한다. HTML authoring result가 여러 배포 형식으로 내려간다. |

**채택할 원리:** Browse와 Edit를 다른 공간으로 취급하는 점, long-running design operation을 background job으로 보내는 점, 발표와 다양한 배포 형식을 같은 workflow에 두는 점.

**채택하지 않을 전제:** HTML을 canonical authoring state로 두는 것, 전체 deck chat/generation을 기본 진입으로 두는 것, AI 작업 상태 때문에 authoring chrome을 상시 점유하는 것.

## 2. PPTist

근거: [project positioning and features](https://github.com/pipipi-pikachu/PPTist#-project-positioning), `Editor/index.vue`, `Toolbar/index.vue`, floating element toolbar, thumbnails, screen/presenter components.

| Question | Interaction finding |
|---|---|
| Start | Blank/local demo data, PPTX/JSON/PPTIST import, template-based AIPPT에서 시작한다. Product positioning은 Office clone보다 web slide editing/presentation foundation에 무게를 둔다. |
| Navigate | 160px persistent thumbnail rail에서 section, reorder, multi-select, context menu를 사용한다. Presentation에서는 bottom thumbnails와 all-slide preview가 별도로 제공된다. |
| Edit content | PowerPoint와 유사한 direct manipulation이다. Text, image, shape, line, chart, table, media를 canvas에서 선택·이동·크기 조절하고 rich text를 직접 편집한다. |
| Change design | 선택이 없으면 slide design/transition, 단일 선택이면 style/position/animation, 다중 선택이면 multi-style/multi-position으로 오른쪽 toolbar의 anatomy가 바뀐다. |
| Tool timing | Left thumbnail과 right toolbar는 지속된다. 선택 객체 바로 위에는 type-specific floating toolbar가 나타나고, context menu와 modal editor가 추가된다. |
| Sidebar | 이 시스템에서는 필요하다. 이유는 slide order와 광범위한 object property를 동시에 노출하는 full object editor이기 때문이다. 이 사실은 semantic design tool에도 sidebar가 필요하다는 근거가 아니다. |
| Contextual UI | Floating toolbar, selection-adaptive right tabs, canvas/thumbnail context menus가 강하다. |
| Candidate/variant | Template 선택은 있지만 같은 semantic content의 design candidate를 sibling으로 보존하고 비교하는 모델은 없다. |
| Present | Fullscreen slideshow, speaker/audience view, preview-all, bottom thumbnails, timer, laser/brush/blackboard를 제공한다. |
| Export | PPTX, JSON, images, print/PDF, PPTIST를 제공한다. PPTX import/export fidelity는 범위와 기능에 따라 제한됨을 프로젝트가 명시한다. |

**채택할 원리:** 선택 순간에만 나타나는 floating toolbar, 편집 mode와 presentation mode의 기능적 분리, page context menu.

**채택하지 않을 전제:** 모든 PowerPoint object를 재현하는 UI, persistent tri-rail, exporter의 object model을 authoring mental model로 사용하는 것.

## 3. Presenton

근거: [current README](https://github.com/presenton/presenton), `PresentationPage`, `SidePanel`, `SlideContent`, `PresentationActions`, `PresentationMode` source.

| Question | Interaction finding |
|---|---|
| Start | Prompt, uploaded document, built-in template, own PowerPoint design에서 시작한다. Generated result를 drag-edit로 polish하는 workflow다. |
| Navigate | Desktop에서 165px thumbnail rail로 reorder/add/select하고, 중앙에는 한 장만 크게 표시한다. Arrow keys로 active slide를 바꾼다. |
| Edit content | Active slide에서 drag, inline text, selection transform/toolbar를 사용한다. AI assistant도 slide를 target으로 변경할 수 있다. |
| Change design | Template/theme/layout, reusable blocks, element insertion palette를 사용한다. Blank/layout slide 추가 시 layout selection modal이 열린다. |
| Tool timing | 오른쪽 action/AI panel은 383px expanded와 90px collapsed 사이를 전환한다. Mobile에서는 drawer다. Object selection toolbar는 canvas에 contextual하게 붙는다. |
| Sidebar | 왼쪽 thumbnail은 desktop에서 지속되고 오른쪽 tool area는 collapse 가능하다. 생성 결과를 manual edit하는 wide feature set이 이 구조를 만든다. |
| Contextual UI | Selection toolbar, active-slide action bar, blank-slide prompt overlay, mobile drawer가 context에 맞춰 나타난다. |
| Candidate/variant | Template/layout preview와 chat layout preview는 있으나 동등한 실제 render 후보를 보존·평가하는 compare workspace는 없다. |
| Present | `/presentation?...&mode=present&slide=n`으로 editor tree를 unmount하고 별도 presentation mode와 fullscreen/navigation을 사용한다. |
| Export | Editable PPTX와 PDF를 주 출력으로 둔다. README는 “generation → manual polish → editable deck export”를 핵심 흐름으로 설명한다. |

**채택할 원리:** 한 장을 실제 크기로 두고 tool rail을 collapse하는 점, object selection과 AI target slide를 연결하는 feedback, 생성 후 manual polish를 명시하는 점.

**채택하지 않을 전제:** prompt가 primary start인 것, AI assistant가 상시 주 도구인 것, generated deck가 product center인 것.

## 4. CasualOffice/slides

근거: [current README](https://github.com/CasualOffice/slides), `App.tsx`, `UniverSlide.tsx`, title bar/toolbar/status/notes/slideshow source.

| Question | Interaction finding |
|---|---|
| Start | Welcome에서 new/open/recent를 선택하거나 `.pptx`를 drag-and-drop한다. File-centric workflow가 명시적이다. |
| Navigate | PowerPoint-shaped left slide rail이 기본 visible이며 toggle할 수 있다. Thumbnail context menu, PageUp/PageDown, active slide count가 navigation을 보완한다. |
| Edit content | Office-style ribbon과 Univer canvas에서 direct manipulation한다. Text/object operation은 command bus를 통한다. |
| Change design | Layout, theme, background, page setup을 toolbar/dialog로 선택하고 element format은 selection context에서 다룬다. |
| Tool timing | Ribbon은 지속되지만 speaker notes는 기본 hidden이고 사용자 선택을 기억한다. Slideshow, theme, page setup, properties, recent files는 lazy modal/fullscreen surface다. |
| Sidebar | Slide rail은 deck navigation을 위해 기본 사용되지만 숨길 수 있다. Object-format surface 역시 필요할 때 호출하는 방향이다. |
| Contextual UI | Slide thumbnail context menu, selected element command, transient status, restore banner가 사용된다. |
| Candidate/variant | Layout/theme 선택은 즉시 현재 deck에 적용된다. 같은 content의 candidate set이나 compare/accept model은 없다. |
| Present | `F5` slideshow, keyboard navigation, presenter view와 notes를 별도 surface로 제공한다. |
| Export | PPTX round-trip이 canonical product promise다. 현재 README는 PDF/PNG가 live라고도 쓰고 format matrix에서는 PDF를 이후 wave로 표시해 maturity가 불일치하므로, 이 audit에서는 PPTX save만 확정된 중심 능력으로 본다. |

**채택할 원리:** File/open/recent로 시작하는 신뢰감, notes와 secondary tools를 기본 hidden으로 두는 점, presentation surface를 editor에서 분리하는 점.

**채택하지 않을 전제:** Office ribbon/OOXML data model을 우리 authoring model로 삼는 것, PowerPoint familiarity를 제품 목적보다 우선하는 것.

## 5. reveal.js

근거: [official repository](https://github.com/hakimel/reveal.js), [official documentation and live deck](https://revealjs.com/), [installation](https://revealjs.com/installation/), [themes](https://revealjs.com/themes/).

| Question | Interaction finding |
|---|---|
| Start | HTML `<section>` 또는 Markdown으로 deck를 작성하고 dev server/browser에서 연다. reveal.js 자체는 authoring app이 아니라 runtime/framework다. |
| Navigate | Horizontal/vertical nested slides, keyboard/space, controls, progress, overview를 runtime이 제공한다. |
| Edit content | Built-in visual editing이 없다. Source editor에서 HTML/Markdown을 수정한다. Official site는 visual authoring이 필요하면 별도 Slides.com editor를 사용하라고 안내한다. |
| Change design | Theme CSS 교체, CSS custom property, per-slide attributes/background, JavaScript API로 바꾼다. |
| Tool timing | 발표 runtime controls와 overview만 있다. Authoring inspector/sidebar라는 개념이 없다. |
| Sidebar | 필요하지 않다. 그 대신 authoring은 framework 밖에서 수행된다. |
| Contextual UI | Presentation state, fragments, nested navigation, overview, speaker notes가 현재 발표 상태에 따라 나타난다. Authoring contextual UI는 없다. |
| Candidate/variant | 없다. Source branch 또는 외부 도구가 필요하다. |
| Present | 이것이 핵심이다. Full browser presentation, overview, fragments, nested slides, speaker notes, pause, custom controls/API를 제공한다. |
| Export | HTML/browser runtime이 본체이고 print mode를 통한 PDF를 지원한다. Native PPTX/PNG authoring export는 core 범위가 아니다. |

**채택할 원리:** Presentation runtime을 authoring UI에서 독립시키는 것, overview와 speaker view를 별도 mode로 두는 것, HTML output이 단순 preview가 아니라 실제 shareable/presentable artifact가 될 수 있다는 점.

**채택하지 않을 전제:** HTML/Markdown source를 사용자가 직접 다루게 하는 것, arbitrary script/CSS를 canonical content로 허용하는 것.

## 6. Reveal Editor

근거: [official repository and README](https://github.com/samplereality/reveal-editor), `index.html`, `app.js`, `preview.html` source.

| Question | Interaction finding |
|---|---|
| Start | 첫 blank project 또는 Projects modal에서 new/open/duplicate/import JSON/Markdown으로 시작한다. Browser IndexedDB project가 저장 단위다. |
| Navigate | 왼쪽 slide list에서 select/add/delete/reorder하며 vertical sub-slide 관계도 표시한다. Preview 안에서는 reveal.js overview와 keyboard를 사용한다. |
| Edit content | 한 장의 `contenteditable` stage에서 직접 편집하거나 source toggle로 HTML을 편집한다. |
| Change design | Deck theme dropdown은 live preview된다. Per-slide transition, background, vertical nesting, reveal configuration을 edit한다. |
| Tool timing | Formatting toolbar와 bottom metadata는 edit 중 지속된다. Projects/settings/preview는 modal이고, expanded speaker notes는 오른쪽에 요청 시 열린다. |
| Sidebar | Persistent left slide list는 사용한다. Persistent right inspector는 없고 notes만 on demand다. 즉 page navigation과 property editing을 반드시 양쪽 rail로 나누지 않는다. |
| Contextual UI | Current text selection에 formatting/fragment command가 작동하고, source toggle, expanded notes, preview-from-current가 task context를 따른다. |
| Candidate/variant | Live theme switching은 있으나 sibling candidate를 보존·비교하지 않는다. |
| Present | Preview from start/current를 modal iframe에서 열고, 그 안에서 overview, fullscreen, speaker view, keyboard를 사용한다. |
| Export | JSON, standalone HTML, Markdown, PDF를 지원한다. PPTX/PNG는 없다. |

**채택할 원리:** Preview from current, source/direct edit의 mode 전환, deck setting과 notes를 on-demand surface로 보내는 얇은 authoring layer.

**채택하지 않을 전제:** arbitrary HTML을 저장하는 보안 모델, `contenteditable` DOM을 semantic truth로 삼는 것, persistent left slide list를 자동 채택하는 것.

## 7. Slidev

근거: [getting started](https://sli.dev/guide/), [user interface](https://sli.dev/guide/ui), [integrated editor](https://sli.dev/features/side-editor), [exporting](https://sli.dev/guide/exporting.html), current source.

| Question | Interaction finding |
|---|---|
| Start | Online starter 또는 CLI로 project를 만들고 `slides.md`를 작성한다. Markdown content-first authoring이다. |
| Navigate | Play mode에서는 bottom-left에 pointer를 옮길 때 navigation bar가 나타난다. Keyboard, goto, quick overview, full overview가 있고 VS Code tree는 선택 사항이다. |
| Edit content | 원하는 source editor 또는 navigation bar에서 호출하는 integrated side editor로 Markdown을 수정한다. 변경은 즉시 저장/reload된다. |
| Change design | Theme package, frontmatter layout, UnoCSS, Vue component로 설계한다. 높은 자유도 대신 code literacy를 요구한다. |
| Tool timing | 평상시 play surface는 거의 slide만 보이며 navigation도 hover 때 나타난다. Editor, overview, exporter, settings, drawing, recording은 명령으로 호출한다. |
| Sidebar | 필요하지 않다. Integrated side editor와 VS Code extension panel은 optional authoring aid다. |
| Contextual UI | Hover navigation, quick overview, goto, drawing toolbar, presenter layouts, notes editor가 mode별로 분리된다. |
| Candidate/variant | 없다. Theme/frontmatter를 source에서 바꾸고 version control로 비교하는 구조다. |
| Present | Play/presenter를 분리하고 두 window sync, 세 presenter layouts, current/next/notes, drawing, recording, remote control을 제공한다. |
| Export | Hostable SPA, PDF, PNG, Markdown, PPTX를 제공한다. Official docs상 PPTX slide는 image이므로 text가 selectable/editable하지 않다. |

**채택할 원리:** Low-chrome presentation surface, hover/command로만 도구를 드러내는 방식, quick overview와 full overview의 계층, presenter workflow.

**채택하지 않을 전제:** Markdown/Vue/CSS를 일반 기획자의 primary authoring UX로 쓰는 것, image-only PPTX를 editable PPTX라고 부르는 것.

## 8. Marp

근거: [Marp ecosystem](https://github.com/marp-team/marp), [Marp CLI](https://github.com/marp-team/marp-cli), [Marp for VS Code](https://github.com/marp-team/marp-vscode).

| Question | Interaction finding |
|---|---|
| Start | New Marp Markdown file 또는 기존 `.md`에 `marp: true`를 선언하고 작성한다. CLI, VS Code extension, 일반 editor 중 어느 것이든 source를 공유한다. |
| Navigate | Markdown headings/slide separators, VS Code extended outline, slide folding, editor-cursor와 preview highlight sync로 찾는다. Dedicated slide canvas navigator는 필수가 아니다. |
| Edit content | Markdown text를 직접 편집한다. Preview는 결과 확인용이며 object manipulation surface가 아니다. |
| Change design | Global/local directives, named theme, custom theme CSS로 변경한다. Preview가 local CSS 변경을 reload한다. |
| Tool timing | Marp-specific command는 toolbar icon의 quick pick와 Command Palette에 모인다. Preview와 outline은 사용자가 열 때만 존재한다. |
| Sidebar | Marp 자체는 요구하지 않는다. VS Code outline/preview sidebar는 선택 가능한 host capability다. |
| Contextual UI | Active Markdown document일 때만 Marp commands, diagnostics, autocomplete, export quick pick가 활성화된다. |
| Candidate/variant | 없다. Theme/source file/version-control 수준에서 비교한다. |
| Present | CLI preview와 exported HTML의 Bespoke runtime으로 presentation한다. Presenter view, fragments, transitions를 HTML에서 유지할 수 있다. |
| Export | HTML, PDF, PPTX, PNG/JPEG, notes TXT를 지원한다. 일반 PPTX는 pre-rendered slide images이고, editable PPTX는 experimental이며 복잡한 style에서 fidelity가 낮아질 수 있다고 공식 문서가 경고한다. |

**채택할 원리:** 하나의 의미 source에서 여러 output을 만드는 방식, editor와 preview의 느슨한 결합, export quick pick, overflow diagnostic.

**채택하지 않을 전제:** Markdown을 우리 canonical UI로 노출하는 것, browser visual fidelity와 native PPTX editability가 자동으로 양립한다고 가정하는 것.

## Cross-reference conclusions

### 1. Authoring shell은 하나가 아니다

- Full object editing을 목표로 하는 PPTist와 Casual Slides는 thumbnail + canvas + property/ribbon으로 수렴한다.
- Source-first인 Slidev와 Marp는 content editor, preview, overview, presenter를 서로 다른 mode/surface로 나눈다.
- reveal.js는 authoring UI 없이 presentation runtime만 제공한다.
- Oh My PPT는 browse grid와 single-page edit를 나누고, Reveal Editor는 왼쪽 page list만 유지한 채 오른쪽 property rail 없이 작업한다.

따라서 `Left Sidebar + Center Canvas + Right Inspector`는 presentation product의 불변 mental model이 아니다. **Rich arbitrary-object editing과 slide-order context를 동시에 상시 노출하려 할 때 생기는 한 해법**이다.

### 2. 이 제품의 핵심 작업 단위는 PowerPoint object가 아니다

우리 사용자는 이미 작성한 game-planning logic을 읽기 좋은 artifact로 설계한다. 필요한 edit granularity는 우선 다음이다.

- semantic role와 relation 확인
- message/reading path/grouping 수정
- composition candidate 비교
- actual render 검수
- bounded revision 승인

이 범위는 PPTist식 full object inspector보다 작고, Marp식 raw source editing보다 구조화되어 있다. 따라서 sidebar를 기능 수용소로 먼저 만들 이유가 없다.

### 3. Overview는 editor의 축소판이 아니라 별도 작업 mode다

Slidev의 quick/full overview, Oh My PPT의 Browse, PPTist/Casual Slides의 slideshow overview는 모두 “한 장 편집”과 “전체 흐름 파악”을 분리한다. 우리도 page navigation을 persistent thumbnail rail 하나로만 해결하지 않고, **Overview/Light Table을 독립 architecture 후보**로 시험해야 한다.

### 4. Presentation과 publication은 first-class product state다

reveal.js와 Slidev는 presentation runtime을 중심에 두고, Oh My PPT는 HTML/PDF/PNG/PPTX/MP4를 동등한 distribution option으로 다룬다. PPTX는 중요하지만 유일한 종료점이 아니다.

### 5. Contextual UI는 “inspector를 접는 것”보다 넓다

확인된 패턴은 다음과 같다.

- selection-bound floating toolbar
- current-slide action bar
- hover navigation
- command/quick-pick export
- modal overview/light table
- on-demand notes and settings
- background operation status
- dedicated presenter/review surface

즉 contextual UI는 같은 tri-rail shell에서 panel width만 바꾸는 것이 아니다. **작업 종류에 따라 surface 자체를 교체하는 것**도 포함한다.

### 6. Candidate comparison은 기존 도구의 공백이다

조사한 프로젝트는 theme/layout/template 선택을 제공하지만, 같은 semantic content에 대한 실제 render 후보를 sibling artifact로 보존하고 동등하게 비교한 뒤 하나를 승인하는 UX가 없다. 이 기능은 외부 UI를 복제할 수 있는 부분이 아니라 GAME PPT DESIGNER NEXT가 새로 설계해야 할 핵심 interaction이다.

### 7. Output format과 authoring UX를 분리할 수 있다

Slidev와 Marp는 source-first authoring에서 HTML/PDF/PNG/PPTX를 만들고, Oh My PPT는 HTML deck을 다양한 artifact로 내보내며, PPTist/Casual Slides는 PowerPoint-shaped state를 택한다. 어느 방식도 모든 축에서 우월하지 않다. 우리에게 필요한 것은 특정 file format을 UI mental model로 승격하는 것이 아니라 **format-neutral semantic/render intent와 backend capability를 명시적으로 분리하는 것**이다.

## 이번 UX 탐색에 적용할 제약

1. 기존 Workspace/Panel/Inspector layout을 default로 사용하지 않는다.
2. Persistent sidebar는 “익숙하니까”가 아니라 장시간 유지해야 하는 정보가 있을 때만 허용한다.
3. Content, Overview, Compare, Critic, Present, Publish는 한 shell의 tab인지 서로 다른 surface인지 각각 증명해야 한다.
4. Candidate는 style dropdown의 순간적 결과가 아니라 보존 가능한 sibling artifact다.
5. Critic은 inspector section이 아니라 actual rendered artifact를 관찰하고 결정을 돕는 review interaction이다.
6. Presentation Theatre의 밝고 절제된 색감 선호는 약한 visual preference로만 기록하며, 이번 UX architecture 선택 근거로 사용하지 않는다.

