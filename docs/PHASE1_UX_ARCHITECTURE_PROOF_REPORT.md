# Phase 1 UX Architecture Proof Report

Status: submitted for direction approval  
Scope: B Live Stage and C Light Table only  
Viewport: 1920×1080

Prototype and screenshot index: [Phase 1 UX Architecture Proof](../prototypes/phase1-ux-architecture-proof/README.md)

## 1. Controlled evidence

Both prototypes use:

- Project: Chrono Break · Combat Mechanism
- Source: 회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%
- Semantic roles: Trigger → Resource → Timed State → Transition → Outcome
- Selected object: BREAK · Transition · object 04
- Retained A/B/C actual fixture renders
- One neutral light visual language

Only the interaction architecture changes. B and C have separate HTML anatomy, layout rules, class namespaces, and query-state logic. No shell or UI component is shared.

## 2. B — Live Stage

### Interaction proof

```text
Actual rendered page
  ├─ select BREAK → contextual action strip
  ├─ Source → temporary authored-source sheet
  ├─ Meaning → semantic relation overlay on render
  ├─ Compare → temporary equal-candidate stage
  ├─ Review → anchored finding + temporary review sheet
  └─ Overview → separate full-screen page surface
```

The default stage render is approximately 1500×844px. The main page therefore occupies roughly 65% of the post-header viewport area before its shadow/pasteboard are counted. There is no persistent left sidebar or right inspector.

### Discoverability result

- The bottom command dock visibly names Source, Meaning, Compare, Review, and Overview.
- Selection-local actions repeat the three most relevant operations next to BREAK.
- Keyboard shortcuts supplement visible controls rather than replacing them.
- Temporary Source and Review sheets push the dock above themselves; no control covers evidence text.

### Screenshot critique

- **Stage:** slide/page is unambiguously the primary artifact. The application header and dock remain visually subordinate.
- **Source:** the full source sentence and five semantic roles are readable while most of the actual render stays visible. Source is clearly a temporary evidence surface, not an editor sidebar.
- **Meaning:** semantic path is drawn on the actual pixels, making source-role-to-object tracing immediate. The overlay intentionally darkens the render and should never become a permanent mode.
- **Compare:** three candidates are about 608×342px each and begin near the top of the working area. Their hierarchy and reading paths can be judged without a side panel.
- **Review:** the finding remains anchored to `+50%` on the actual render; the temporary sheet states evidence and bounded actions. The slide remains large enough to verify the claim.
- **Overview:** six pages occupy a dedicated 3×2 surface. It reads as a navigation mode rather than a permanently shrunken editor.

### Kill criteria

| Criterion | Result |
|---|---|
| Persistent left sidebar | Pass — absent |
| Persistent right inspector | Pass — absent |
| Page dominates default state | Pass — 1500×844 actual render |
| Essential tools require hover | Pass — visible dock and selection strip |
| Compare/Review become permanent panels | Pass — mutually exclusive temporary surfaces |

### Residual risks

- The command dock is still a persistent piece of chrome. Small-viewport adaptation must prove that it can compress without hiding essential operations.
- Dense slides may make semantic overlay labels occlude the artifact; label collision and progressive detail require a later interaction test.
- Repeated switching between Source, Compare, and Review may feel modal during long sessions even though the selected page is preserved.

## 3. C — Light Table

### Interaction proof

```text
Spatial deck board
  → named page groups + reading path
  → page 04 candidate stack
  → Explode variants
  → Focus lens
  → deck-level findings on pages
  → Play from page 04
```

The default table uses three spatial groups and a continuous reading path rather than thumbnail rows or status cards. Page 04's selected stack is approximately 420×236px. Explode increases each candidate to approximately 608×342px; Focus increases the selected page to approximately 1320×742px.

### Screenshot critique

- **Table:** page sequence is legible as a spatial path across System, Build-up, and Break Window groups. The selected candidate stack exposes physical depth and visible A/B/C edges rather than only a count.
- **Explode:** all three real compositions are visible at equal judgement size. The location trail keeps `03 BREAK WINDOW · PAGE 04` in deck context.
- **Focus lens:** the page reaches detailed design-review size while real previous/next page labels remain at the edges. The breadcrumb prevents the lens from becoming an unrelated single-slide editor.
- **Deck review:** hierarchy findings remain attached to pages 02, 04, and 06. The compact filter changes what is marked but does not create a metric dashboard.
- **Play from here:** the selected page remains large and the presentation route explicitly starts at 04 while preserving pages 05–06 after it.

### Kill criteria

| Criterion | Result |
|---|---|
| Thumbnail/status-card dashboard | Pass — continuous board and page path |
| Pages too small for design judgement | Pass with condition — table supports hierarchy judgement; Explode/Focus provide detailed judgement |
| Candidate represented only by metadata | Pass — three actual compositions are visibly stacked and exploded |
| Focus simply recreates Live Stage | Pass — group breadcrumb and neighboring-page context persist; no Live Stage command dock or contextual sheet model |
| Grouping depends on sidebar folders | Pass — groups are spatial regions in the board |

### Residual risks

- A deck with dozens of pages will require zoom levels, semantic clustering, and stable spatial navigation. The six-page proof does not validate that scale.
- The board uses more open space than Live Stage. If spacing is replaced by cards, counters, or filters, it will collapse into the rejected dashboard model.
- Static screenshots cannot prove whether stack→explode→focus motion preserves spatial memory. Motion and keyboard return behavior must be tested in the next approved fidelity level.
- Source-to-object trace is weaker than in Live Stage because Light Table prioritizes page/deck relations; a future proof must reveal source without introducing a permanent inspector.

## 4. Same criteria comparison

| Dimension | B Live Stage | C Light Table |
|---|---|---|
| Primary artifact | Current actual render | Page collection and its spatial order |
| Default page prominence | Very high | Medium, selected stack is largest |
| Source trace | Strong, one visible command away | Indirect through page contents; unresolved on-demand source interaction |
| Semantic trace | Strong overlay on actual pixels | Encoded by groups/path; object-level trace weaker |
| Candidate comparison | Temporary direct compare | Stack in context, then spatial explode |
| Review | One finding in depth | Findings across the deck |
| Navigation | Full-screen Overview when requested | The table itself is navigation |
| Presentation continuity | Global Play from current page | Play is explicitly anchored to a page in the board |
| Beginner discoverability | High | Medium–high; stack/explode metaphor must be learned |
| Long-session strength | Focus and low chrome | Deck memory and batch review |
| Main risk | Frequent temporary-mode switching | Spatial scaling and board complexity |

## 5. QA

- 11 screenshots rendered in Chromium at exactly 1920×1080.
- All screenshots use the fixed project, source, semantic roles, and BREAK selection.
- No Lorem Ipsum, placeholder copy, abstract status metrics, or fabricated game facts.
- Source images resolve locally and are the retained A/B/C actual fixture renders.
- B has six explicit states; C has five explicit states.
- No persistent left/right sidebar exists in either default or interaction state.
- No production source, framework, renderer, exporter, or AI integration was added.

## 6. Approval gate

No UX direction is selected by this report. The user may:

1. Advance B only to small-viewport adaptation.
2. Advance C only to small-viewport adaptation.
3. Advance both independently.
4. Reject or request another architecture proof.

B/C hybridization remains prohibited until explicitly approved.
