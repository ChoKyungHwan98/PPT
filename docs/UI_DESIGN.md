# UI Design Draft

> **Exploration suspension · 2026-08-28**  
> 이 문서의 visual directions, shared information architecture, W/C/K layout 권고는 방향성 탐색 기록으로만 보존한다. 어떤 안도 채택되지 않았으며, 새 UI가 이 shell을 상속하거나 W4/W5 variation을 만들어서는 안 된다. 이후 세 Core Workspace Proof도 `Left Sidebar + Center Canvas + Right Inspector`로 수렴해 UX architecture 선택 근거로는 반려되었다. 현재 탐색 기준은 [Presentation Authoring Reference Audit](./PRESENTATION_AUTHORING_REFERENCE_AUDIT.md)과 [UX Architecture Exploration](./UX_ARCHITECTURE_EXPLORATION.md)이다. 제품 불변조건과 critique rubric만 계속 유효하다.

## Design intent

The product should feel like a professional information-design workstation and a game-planning IDE. The slide, not the application chrome or AI, is the protagonist.

The visual language must avoid:

- SaaS dashboard composition
- Marketing hero headings
- Card soup and rounded containers everywhere
- Meaningless status pills
- Purple/blue gradients, glass, glow, or AI sparkle decoration
- Large empty landing-page whitespace
- Repeated icon-box/title/subtitle modules
- Bento grids without information purpose
- Persistent chat as the main interaction
- A home screen that receives more design attention than the editor

## Reference synthesis

- Oh My PPT and PowerPoint define presentation workflow expectations.
- Figma, Penpot, and Onlook define selection/canvas/inspector behavior.
- VS Code defines workbench density, drawer behavior, and command access.
- Unreal Editor validates hierarchy ↔ viewport ↔ details synchronization for a game-development audience.
- InDesign informs progressive disclosure in the inspector.
- Canva informs only the temporary Candidate Compare gallery.

## Visual directions

### Direction A — Graphite Workbench — Recommended prototype baseline

Character: quiet, technical, precise, low-fatigue.

```text
Variance 4 / Density 7 / Editoriality 6 /
Diagram 9 / Decoration 1 / Contrast 7
```

- Graphite chrome, white/neutral slide stage, restrained cyan selection
- Thin separators instead of card containers
- Compact tab and panel headers
- Orange only for change/warning; violet only for AI provenance
- Best fit for long sessions and visual neutrality
- Risk: can resemble an IDE if typography and slide-focused spacing are not carefully tuned

### Direction B — Warm Editorial Desk

Character: calm editorial studio, tactile without softness or nostalgia.

```text
Variance 5 / Density 6 / Editoriality 8 /
Diagram 8 / Decoration 2 / Contrast 6
```

- Warm ivory work surfaces, dark navy/charcoal text, restrained blue-cyan active state
- No gradients, beige glow, soft cards, or olive brand dominance
- Strong typographic labels and hairline rules
- Best fit for the existing warm-neutral preference signal
- Risk: white/ivory slide designs need a distinctly cooler stage to keep boundaries visible

### Direction C — Technical Atelier

Character: dark structural rails around a warm editorial work surface.

```text
Variance 6 / Density 7 / Editoriality 7 /
Diagram 9 / Decoration 2 / Contrast 8
```

- Dark Structure rail and toolbar
- Light Inspector and source surfaces
- Neutral mid-tone canvas stage
- Strong separation of semantic/navigation and visual work
- Most distinctive option
- Risk: split theme can feel fragmented if every surface uses a different tone

## Shared information architecture

```text
Top Bar
  Project / document tabs / save state / mode / export

Workspace
  Structure
    Source
    Semantic Blocks
    Relations
    Assets

  Canvas
    actual 16:9 render
    selection
    finding overlay
    fit / zoom / 100%
    optional safe area / guides

  Inspector
    Slide context
    Object context
    Finding context

Bottom Drawer, closed by default
  Critic
  Validation
  AI Activity
  History
  Export Report
  Source Provenance
```

Initial width targets at 1440px:

- Structure: 248–272px
- Inspector: 288–320px
- Canvas: all remaining width, never less than 720px in the standard preset
- Bottom drawer: 220–320px height when open
- Top bar: 40–44px

## Workspace layout alternatives

### Workspace W1 — Persistent Tri-Rail — Recommended

```text
┌──────────────────────────────────────────────────────────────┐
│ Project / Tabs       Edit · Candidates · Critic      Export │
├──────────────┬───────────────────────────────┬───────────────┤
│ STRUCTURE    │                               │ INSPECTOR     │
│ Source       │        ACTUAL SLIDE           │ Message       │
│ Blocks       │          CANVAS               │ Grammar       │
│ Relations    │                               │ Emphasis      │
│ Assets       │     Fit  78%  100%            │ Constraints   │
├──────────────┴───────────────────────────────┴───────────────┤
│ Findings · Validation · AI Activity · History               │
└──────────────────────────────────────────────────────────────┘
```

- Strength: strongest selection synchronization and discoverability
- Weakness: canvas width can be constrained on small laptops
- Use: default ≥1440px and primary static prototype

### Workspace W2 — Canvas-First Context Rails

```text
┌──────────────────────────────────────────────────────────────┐
│ Project / Tabs             Canvas Focus             Export │
├─────┬─────────────────────────────────────────────────┬─────┤
│ S   │                                                 │ I   │
│ o   │                 ACTUAL SLIDE                    │ o   │
│ u   │                    CANVAS                       │ b   │
│ r   │                                                 │ j   │
│ c   │                                                 │ e   │
│ e   │                                                 │ c   │
├─────┴─────────────────────────────────────────────────┴─────┤
│ temporary contextual drawer                                │
└──────────────────────────────────────────────────────────────┘
```

- Structure and Inspector collapse to narrow rails and expand on focus
- Strength: maximum canvas and good laptop use
- Weakness: hidden semantic information may reduce confidence and discoverability
- Use: focus-mode preset, not default unless prototype testing strongly favors it

### Workspace W3 — Semantic Split Desk

```text
┌──────────────────────────────────────────────────────────────┐
│ Project / Tabs        Semantic Review              Export  │
├──────────────────────┬───────────────────────────────────────┤
│ SOURCE / SLIDE IR    │           ACTUAL SLIDE                │
│ authored text        │             CANVAS                    │
│ block graph          │                                       │
│ relation list        │                                       │
├──────────────────────┴───────────────────────────────────────┤
│ contextual inspector / findings / history                   │
└──────────────────────────────────────────────────────────────┘
```

- Strength: reinforces content fidelity and meaning-first workflow
- Weakness: less room for a persistent properties inspector; can look like a split editor rather than a visual design tool
- Use: SlideIR Review preset or first-time interpretation flow

## Candidate Compare alternatives

### Candidate C1 — Equal Triptych — Recommended for wide screens

```text
┌──────────────────────────────────────────────────────────────┐
│ Candidates  Same content · 3 valid structures    Sync zoom │
├──────────────────┬──────────────────┬────────────────────────┤
│  ACTUAL A        │  ACTUAL B        │  ACTUAL C              │
│  Causal Rail     │  BREAK Focus     │  Resource Activation   │
│                  │                  │                        │
├──────────────────┼──────────────────┼────────────────────────┤
│ clarity / issues │ clarity / issues │ clarity / issues       │
│ [Select A]       │ [Select B]       │ [Select C]             │
└──────────────────┴──────────────────┴────────────────────────┘
```

- All three actual PNGs receive equal area and synchronized zoom
- Rationale is one concise row, not a card description wall
- Critic rank is visible but never auto-selects
- Best at 1600px or wider

### Candidate C2 — Focus + Filmstrip

```text
┌──────────────┬─────────────────────────────────┬──────────────┐
│ A thumbnail  │                                 │ Decision     │
│ B selected   │        ACTUAL B LARGE           │ Why B        │
│ C thumbnail  │                                 │ Findings     │
│              │                                 │ [Select]     │
└──────────────┴─────────────────────────────────┴──────────────┘
```

- Selected candidate is large; other candidates remain quickly reachable
- Includes semantic-difference summary from selected candidate
- Better for 1366–1440px and close inspection
- Risk: equal comparison requires more switching

## Critic Mode alternatives

### Critic K1 — Anchored Findings + Bottom Drawer — Recommended

```text
┌──────────────┬───────────────────────────────┬───────────────┐
│ STRUCTURE    │        ACTUAL SLIDE           │ FINDING       │
│              │      ①           ②            │ Issue         │
│              │             ③                 │ Reason        │
│              │                               │ Patch         │
│              │                               │ Accept Ignore │
├──────────────┴───────────────────────────────┴───────────────┤
│ ① Hierarchy  ② Alignment  ③ Density   deterministic / AI   │
└──────────────────────────────────────────────────────────────┘
```

- Findings are anchored to RenderTree objects
- Selecting a row highlights only the affected area and relevant inspector controls
- Severity filter and source type are compact labels, not colorful pills
- Best for diagnosing one selected render

### Critic K2 — Before / After Review

```text
┌───────────────────────┬───────────────────────┬──────────────┐
│ BEFORE                │ AFTER PROPOSAL        │ PATCH LIST   │
│ actual selected slide │ deterministic rerender│ changes      │
│                       │                       │ accept/reject│
└───────────────────────┴───────────────────────┴──────────────┘
```

- Used only after a revision patch has a valid rerender
- Excellent for proving that content and relationships did not change
- Risk: both slides become too small on laptop widths
- Recommended as a temporary review state launched from K1, not the default Critic layout

## Contextual inspector

### Slide selected

- Primary message
- Intent
- Grammar
- Reading path
- Density
- Art direction
- Validation summary

### Semantic object selected

- Source content and span
- Semantic role
- Emphasis
- Typography role
- Keep-together and representation constraints
- Related semantic relations

### Critic finding selected

- Issue and severity
- Why it matters
- Evidence and affected object
- Suggested typed patch
- Accept / Ignore / Compare before-after

Only the current context is shown. Advanced fields expand per section and remember their state.

## Real prototype content

All prototypes use the BREAK mechanism fixture. Visible content includes:

- 광역 공격 3회 회피
- 시간 파편 획득
- 시간 정지 5초
- BREAK
- 받는 피해 +50%

Candidate topologies use Causal Rail, BREAK Focus, and Resource Activation. No Lorem Ipsum or placeholder gray boxes are allowed.

## Static prototype plan

The next phase, after this design package is approved, creates an isolated static prototype. It is not imported into production packages.

Deliverables:

1. Workspace W1, W2, W3
2. Candidate Compare C1, C2
3. Critic K1, K2
4. Screenshots at 1440×900 and 1920×1080
5. Stress screenshots at 1366×768
6. Keyboard-focus and open-drawer states
7. A short screenshot-based critique report

Implementation approach:

- Standalone static HTML/CSS with minimal vanilla interaction
- Fixed real fixture data and pre-rendered slide candidates
- No Electron, React application state, AI call, exporter, or legacy import
- Playwright used only to capture deterministic screenshots
- Each direction gets a separate token file rather than ad-hoc component overrides

Prototype sequence:

1. User selects one visual direction or requests a hybrid.
2. Render the seven layout frames in that direction.
3. Capture real screenshots.
4. Critique each screenshot using the UI rubric.
5. Record user approved/rejected decisions and reasons.
6. Revise the selected Workspace, Compare, and Critic layouts.
7. Seek explicit approval before production UI implementation.

## UI critique rubric

1. Is the slide the visual protagonist?
2. Is the next action visible within five seconds?
3. Is there unnecessary chrome?
4. Has the layout turned into card soup?
5. Does spacing encode hierarchy?
6. Is inspector hierarchy clear?
7. Is the canvas large enough?
8. Is text density sustainable for all-day use?
9. Does the product avoid looking like an AI SaaS wrapper?
10. Are source, semantic structure, render, and findings easy to connect mentally?
