# Preference Memory

## Purpose

Preference memory learns repeated user choices without cloning a specific UI or slide. It is not model fine-tuning and is not a content source.

The primary signal is now contextual pairwise choice, including `reject-both`, rather than a flat global approved/rejected folder.

## Storage layout

```text
references/
  approved/ui/
  rejected/ui/
  approved/slide/
  rejected/slide/
```

Each image or artifact has a sidecar metadata file.

```ts
type PreferenceRecord = {
  id: string
  kind: 'ui' | 'slide'
  verdict: 'approved' | 'rejected'
  artifactHash: string
  source?: string
  createdAt: string

  semanticShape?: string
  grammar?: string
  density?: number
  designSignature?: string[]
  domain?: string[]

  liked: string[]
  disliked: string[]
  alignment?: string
  color?: string
  interaction?: string
  reason: string
}
```

```ts
type PairwisePreferenceRecord = {
  id: string
  contextHash: string
  semanticShape: string
  taskPurpose: string
  candidateAId: string
  candidateBId: string
  winner: 'A' | 'B' | 'tie' | 'reject-both'
  reasons: string[]
  comparedPatternIds: string[]
  comparedReferenceClusterIds: string[]
  createdAt: string
}
```

## V1 behavior

- Store explicit pairwise selections, ties, reject-both decisions, and reasons.
- Show and allow editing or deleting each record.
- Update retrieval weights and candidate ranking only within relevant semantic/task contexts.
- Do not fine-tune.
- Do not automatically turn one approval into a permanent style rule.
- Rejected artifacts contribute avoidance metadata, not full-image prompt context.
- Preserve an exploration allowance so the system continues testing unfamiliar reference clusters.

## Retrieval stages

Reference retrieval begins with an explicitly curated and provenance-checked seed corpus. Preference learning becomes more confident as pairwise records accumulate; no arbitrary record count turns it into an automatic global style system.

Future retrieval fields:

- Semantic shape
- Visual Grammar
- Density
- Design signature
- Domain
- User preference confidence

Only top-k metadata and necessary thumbnails enter AI context. Raw source collections, the repository, and the full preference history do not.

## Governance

- Preference memory is local by default.
- User-provided assets retain provenance and license metadata.
- The user can reset or export memory.
- Memory never overrides source fidelity, accessibility, or validation hard gates.
- A preference inferred from fewer than three consistent decisions is considered weak evidence.

## Current product decision · 2026-08-29

- Fixed visual style is rejected as the core learning target; content may require different design directions.
- External references are continuously discoverable only through allowed, rate-limited, provenance-aware adapters.
- Default storage is metadata, source URL, perceptual hash, analysis, and internal thumbnail; redistribution rights are evaluated separately.
- A/B choices are contextual by semantic shape, task, and audience.
- `reject-both` is a valid and important result.
- Initial learning updates retrieval and ranking; model fine-tuning remains deferred.
- Local compute handles discovery, deduplication, OCR/analysis, embedding, rendering, validation, and experiment queues.
- Remote AI is reserved for difficult semantic interpretation, composition hypotheses, and actual-render critique.

## Explicit prototype decisions

### 2026-08-28 · Phase 1 Round 1 · rejected as a set

- Artifacts: Workspace W1/W2/W3, Candidate Compare C1/C2, Critic K1/K2, and the shared Graphite visual direction
- Verdict: all visual candidates rejected; Architecture, UX Flow, and Candidate Compare product concepts remain in scope
- Disliked UI signatures: dark mechanical chrome, administrator/developer-tool mood, excessive black empty stage, UI chrome competing with the slide, visible evaluation copy stronger than the design artifact
- Disliked slide signatures: box-and-line construction, large geometric centerpiece without editorial refinement, mechanically placed metrics, topology diversity without an acceptable independent quality floor
- Required next direction: full visual re-exploration using actual design-skill criteria; light or warm-neutral professional-tool chrome is allowed; slide must dominate; progressive disclosure; each candidate needs distinct typography, composition, graphic language, hierarchy, and grouping
- Decision strength: explicit and strong for these artifacts; not a permanent rejection of all dark professional tools or all diagrams

### 2026-08-28 · Phase 1 Round 2 · slide directions retained as fixture assets

- Artifacts: A Editorial / Information Design, B System / Mechanism Visualization, C Professional Presentation
- Verdict: meaningful slide visual-direction exploration and approved for reuse as real fixture assets inside later UI prototypes
- Not approved: Phase 1 program UI is not complete; the Round 2 Candidate Proof Table is only one compare shell, not a substitute for W1/W2/W3, C1/C2, K1/K2
- Required next deliverable: seven program UI prototypes showing Source/Semantic Structure, actual 16:9 slide canvas, Inspector, Edit/Candidate/Critic state switching, and on-demand Findings/History
- Reuse boundary: preserve the A/B/C slide visuals for UI context; do not spend the next round redesigning the slides
- Decision strength: explicit for fixture reuse and explicit that production remains blocked pending seven-screen UI approval

### 2026-08-28 · Phase 1 Program UI Round 2 · submitted, approval pending

- Artifacts: Workspace W1/W2/W3, Candidate Compare C1/C2, Critic K1/K2
- Working models: persistent context workbench, canvas focus studio, argument mapping desk, equal proof board, focus and filmstrip, anchored findings, revision proof
- Evidence: 21 screenshots at 1920×1080, 1440×900, and 1366×768 using the retained A/B/C actual renders
- Quality self-check: seven distinct workflows, slide-first light neutral chrome, required Workspace regions visible, no fixture mutation, no viewport clipping found
- Approval state: no direction is selected or approved yet; wait for explicit user evaluation
- Production boundary: React, Electron, Tauri, renderer, exporter, and AI integration remain blocked

### 2026-08-28 · Phase 1 Design DNA reset · no UI adopted

- Verdict: all existing program UI prototypes are retained only as exploration evidence; no Workspace, Compare, Critic, visual direction, or shared Design System is adopted
- Explicit prohibition: do not create W4/W5 or further variations inside the same shell, token family, panel anatomy, or component system
- Suspended assumptions: shared 4px grid, common neutral palette, restrained-cyan selection, shared panel widths, and the common Workbench shell in `UI_DESIGN.md` / `DESIGN_SYSTEM.md`
- Required next gate: propose and approve three independent Design DNA systems before creating any UI
- Reference rule: one strong Primary Reference per DNA and no more than two Secondary References
- Diversity requirement: typography, density, navigation, panel model, canvas treatment, color, and interaction philosophy must all differ
- Proposed DNA set: Adobe InDesign-led Editorial Redline, Apple Keynote-led Presentation Theatre, Unreal Editor-led Mechanism Foundry
- Approval state: DNA proposal submitted; none approved yet
- Production boundary: remains blocked

### 2026-08-28 · Phase 1 Design DNA independence approved · proof gate only

- Approved: the independence of Editorial Redline, Presentation Theatre, and Mechanism Foundry
- Not approved: no DNA is selected as the final direction
- Authorized deliverable: one Core Workspace Proof per DNA using the same project, slide, source, semantic structure, selected BREAK object, and editing purpose
- Prohibited: full UX screen sets, W4/W5 variations, DNA mixing, shared visual components, and production implementation
- Required evidence: browser screenshots at 1920×1080, 1440×900, and 1366×768 plus comparison on seven common criteria
- Strong failure rule: Mechanism Foundry is rejected if it resembles Graphite Workbench, an IDE, administrator dashboard, or AI experiment shell

### 2026-08-28 · Phase 1 Core Workspace Proof · submitted, selection pending

- Artifacts: Editorial Redline, Presentation Theatre, Mechanism Foundry Core Workspace Proofs
- Controlled condition: same Chrono Break project, B Mechanism slide, five source facts, five semantic roles, selected BREAK/Transition object, and visual-emphasis editing task
- Evidence: nine browser screenshots at 1920×1080, 1440×900, and 1366×768
- Implementation isolation: only the B Mechanism fixture image is shared; DOM anatomy, CSS, tokens, navigation, panels, and selection treatment are independent
- Internal kill-gate result: all three proofs pass for submission; Mechanism Foundry retains an explicit IDE-adjacency risk for user evaluation
- Approval state: no DNA selected; wait for explicit user decision before any full UX set or hybrid
- Production boundary: remains blocked

### 2026-08-28 · UX architecture reset · tri-rail assumption rejected

- Positive but weak visual evidence: Presentation Theatre's color and overall design feel are preferred among the proofs; this is not a DNA or UX selection
- Core finding: all three proofs converged, to different degrees, on `Left Sidebar + Center Canvas + Right Inspector`; that mental model is rejected as an unsupported default for this product
- Suspended assumptions: Workspace/Panel/Inspector vocabulary, persistent deck rail, persistent property inspector, canvas-always-primary layout, and PowerPoint as canonical output
- Updated product purpose: visually design game-planning logic and information into presentation/document artifacts for presenting, submitting, and sharing
- Canonical boundary retained: authored source → SlideIR → CompositionPlan → RenderTree; PDF, HTML presentation, PPTX, and PNG are output profiles rather than semantic source
- Current gate: review the presentation-authoring reference audit, four independent UX architecture proposals, and A/B/C output architecture comparison
- Approval state: no UX architecture, output architecture, visual theme, or DNA is selected
- Production boundary: no UI prototype or production implementation until explicit approval

### 2026-08-28 · B/C UX proof and C Multi-backend approved

- Prototype targets: B Live Stage and C Light Table only
- Hold/exclusion: A Manuscript to Proof is on hold; D Checkpoint Rooms is excluded from this gate
- Independence rule: do not hybridize B and C and do not reuse one shell with rearranged panels
- Controlled proof: same Chrono Break project, authored source, SlideIR, selected BREAK object, task, slide fixture, and neutral visual language
- Resolution gate: 1920×1080 only; smaller adaptations require another approval
- Live Stage must prove full-result prominence, on-demand Source, semantic overlay, contextual selection actions, temporary Compare/Review, and full-screen Overview without persistent sidebars
- Light Table must prove page flow/grouping, candidate stack/explode, deck review, page focus lens, and Play from here without becoming a thumbnail dashboard
- Output decision: C Multi-backend approved; HTML/PDF/PNG/editable PPTX are independent RenderTree backends and none is canonical source
- Editable PPTX remains a mandatory vertical-slice compatibility gate
- Visual-fidelity PPTX is allowed only as a separately named, explicit user-selected fallback with rasterization disclosure; automatic fallback is prohibited
- Production boundary: exporter and production implementation remain blocked until the B/C proof is reviewed

### 2026-08-28 · B/C UX Architecture Proof submitted

- Artifacts: B Live Stage with six states; C Light Table with five states
- Evidence: 11 browser-rendered screenshots at 1920×1080
- Controlled variables: same neutral language, project, source, SlideIR roles, selected BREAK, retained A/B/C slide fixtures, and editing purpose
- B evidence: 1500×844 default actual render, visible contextual command dock, on-demand Source, semantic overlay, temporary Compare/Review, full-screen Overview
- C evidence: spatial three-group deck flow, visible candidate stack, Explode variants, 1320px Focus lens, in-place deck review, Play from page 04
- Self-critique: B retains modal-switching and dense-overlay risks; C retains large-deck scaling, motion/spatial-memory, and weaker source-trace risks
- Approval state: neither B nor C is selected; small-viewport adaptation and hybridization await explicit user decision
- Production boundary: unchanged
