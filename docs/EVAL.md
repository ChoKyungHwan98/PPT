# Evaluation Plan

## Evaluation principles

- Content fidelity is a hard gate, not an aesthetic score.
- Actual rendered images are evaluated; internal layout descriptions are insufficient.
- PDF submission fidelity, selectable text, embedded fonts, and reopen behavior are part of V1 quality.
- A Visual Critic is not trusted as its own sole judge.
- Every result is reproducible from recorded versions, seed, and input hash.
- Legacy and external exporters are benchmarked on identical fixtures.

## V1 fixture set

Total: 16 authored Korean one-slide fixtures.

| ID | Grammar | Fixture subject | Primary stress |
|---|---|---|---|
| MEC-01 | mechanism | Time Fragment → time stop → BREAK → damage +50% | causal chain, primary state, numeric fidelity |
| MEC-02 | mechanism | Perfect guard accumulates counter charges and triggers retaliation | condition, accumulation, activation |
| MEC-03 | mechanism | Combo grade modifies skill cooldown recovery | branching modifiers, compact labels |
| CMP-01 | comparison | Existing vs revised stagger system | AS-IS / TO-BE with shared dimensions |
| CMP-02 | comparison | Three weapon archetypes by range, risk, and payoff | multi-column comparison density |
| CMP-03 | comparison | Normal vs hard boss rules | conditions and unchanged dimensions |
| TML-01 | timeline | Boss attack telegraph, judgement, hit, recovery windows | timing labels and ordered events |
| TML-02 | timeline | Four-week live-operations cadence | date/order readability |
| STA-01 | state-transition | Normal → stagger-ready → BREAK → recover | transitions and loop-back |
| STA-02 | state-transition | Hidden → detected → pursuit → search | conditional branches |
| RES-01 | resource-flow | Time Fragment acquisition, storage, spend, reward | source/stock/spend semantics |
| RES-02 | resource-flow | Soft currency sources and sinks | multiple inputs/outputs and leakage risk |
| DAT-01 | data-highlight | Damage increase, duration, and activation count | value-unit adjacency |
| DAT-02 | data-highlight | Authored balance target table with one highlighted threshold | table/metric relationship |
| UIA-01 | ui-annotation | Combat HUD: break gauge and time-fragment indicator | screenshot regions and callout routing |
| UIA-02 | ui-annotation | Inventory screen: item category, count, and action region | dense hotspot labels |

All fixture values are authored and stored with source spans. No evaluator or model may invent missing values.

## First vertical-slice golden fixture

`MEC-01` is the only production target for the first vertical slice.

Required comparison set:

- A/B are retrieved or composed from different reference/composition hypotheses.
- No fixed named template is mandatory.
- Both must display the same five authored facts and four sourced relationships.
- If either misses the quality floor, retry or expose `reject-both`; do not fill a candidate quota.

## Run record

Every candidate run records:

```ts
type EvalRunRecord = {
  fixtureId: string
  sourceHash: string
  model?: string
  provider?: string
  promptVersion?: string
  skillVersions: string[]
  grammarVersion: string
  designSystemVersion: string
  slideIrSchemaVersion: string
  rendererVersion: string
  exporterVersion?: string
  seed: number
  compositionHash: string
  referenceBriefHash: string
  referenceClusterIds: string[]
  outputHash: string
  renderTimeMs: number
  validationTimeMs: number
  exportTimeMs?: number
  findings: FindingSummary
}
```

## Hard gates

### Content fidelity

- Every locked source atom appears exactly once unless the grammar explicitly permits a repeated label.
- Every visible number and unit matches an authored source span.
- No new numeric fact appears.
- Every visible causal connector references a `SemanticRelation`.
- Text extraction from the PDF matches the selected RenderTree content manifest.

### Geometry and legibility

- Severe overflow: 0
- Severe collision: 0
- Out-of-slide objects: 0, except declared bleed/decorative bounds
- Text below role floor: 0
- Unresolved missing font: 0 for a verified export
- Contrast failures on meaningful text: 0

### PDF integrity

- Silent full-page bitmap flatten: prohibited
- Text: selectable and extractable
- Fonts: embedded or subset
- Vector-capable diagram/table/rule/text content: remains vector
- Original screenshots and sourced bitmap imagery: bitmap allowed at sufficient effective resolution
- PDF reopen and page raster: no new severe finding compared with the approved reference render

### Determinism

Identical source, SlideIR, reference corpus snapshot, preference snapshot, grammar, seed, engine versions, and fonts must produce identical CompositionPlan and RenderTree hashes. PDF metadata timestamps are normalized or excluded from semantic comparison.

## Candidate diversity

The A/B candidates must start from different reference/composition hypotheses and differ in at least one major structural axis, preferably two when semantics allow:

- Topology
- Reading path
- Dominant artifact
- Information grouping

Palette-only changes do not count. Typography may count only when it changes hierarchy and reading behavior, not merely the font family. `patternId`, `skeletonId`, reference cluster, role mapping, and layout signatures are logged.

## Visual quality rubric

Hard gates are evaluated first. Valid candidates receive a 100-point soft score:

| Dimension | Weight |
|---|---:|
| Information clarity | 20 |
| Reading path | 15 |
| Visual hierarchy | 15 |
| Legibility | 15 |
| Game-design appropriateness | 10 |
| Aesthetic cohesion | 10 |
| Consistency | 10 |
| Efficient use of space | 5 |

Penalties are separate:

- Unnecessary visual change from the selected composition
- Decorative element mistaken for information
- Meaningless whitespace
- Excessive chrome in UI evaluation
- Increased manual correction burden

This partial-credit and detrimental-change structure is adapted from the evaluation philosophy of [PPT-Eval](https://microsoft.github.io/ppteval/), not its hosted GUI runtime.

## Visual Critic questions

The critic receives actual PNG renders and answers in structured form:

1. Is the primary message visible within three seconds?
2. Is the initial gaze target appropriate?
3. Is the reading direction natural?
4. Is information hierarchy clear?
5. Do important elements compete?
6. Is text density excessive?
7. Is there meaningless whitespace?
8. Could decoration be mistaken for information?
9. Does alignment look intentional?
10. Does the slide look like a professional game-planning document?

Each finding contains candidate ID, object IDs or normalized region, severity, evidence, reason, and a whitelisted patch suggestion.

## Actual-render observation

Candidate observation:

- RenderTree → HTML/SVG → PNG using the selected explicit page profile
- Pixel image plus object bounds and text-line diagnostics
- Critic always sees the PNG, not an HTML source or layout summary alone

Export observation:

- Selected RenderTree → PDF
- PDF page-box, font embedding, object/raster inventory, and text extraction postflight
- Reopen and rasterize every PDF page
- Compare reopened PDF raster with the approved reference PNG
- Geometry, wrapping, missing-font, and overflow checks remain authoritative; pixel similarity is diagnostic

## Later PPTX compatibility benchmark

Use identical fixtures and fonts to compare:

- PptxGenJS direct backend
- Selected Oh My PPT export path as a black-box legacy baseline
- Selected PPT Master native conversion/export path as a research spike

Compare:

- Live object count and types
- Text extraction fidelity
- Bounds and line-wrap drift
- PowerPoint open/save behavior
- Table and connector editability
- Render time and package size
- Implementation and license cost

This benchmark is deferred until the PDF-first vertical slice passes. It chooses an optional PPTX exporter strategy; it does not make either external project the canonical IR.

## Human blind review

- The primary user provides the first pairwise learning signal; broader review later includes game planners.
- Candidate and exporter identity hidden
- Randomized candidate order
- Pairwise preference plus rubric score
- Record task completion time and requested corrections
- Collect short reasons, not only scores

The Visual Critic's ranking is compared against human ranking. If the critic repeatedly disagrees on hierarchy or readability, it is recalibrated or disabled for that role.

## Manual correction amount

Measure:

- Number of user changes before acceptance
- Time from candidate display to export
- Number of rejected critic patches
- Number of content-fidelity interventions
- Whether the user opened another design tool to rebuild the exported page

The vertical slice fails its product goal if the user must routinely rebuild the PDF page in another design tool.

## UI prototype evaluation

Evaluate each screenshot and interactive prototype against:

- Slide is the visual protagonist
- Next action is visible in five seconds
- No card soup
- Canvas remains sufficiently large
- Source, semantic object, rendered object, and finding are easy to correlate
- Inspector uses progressive disclosure
- AI state is visible but not dominant
- Body text remains readable for all-day use
- Open bottom drawer does not make the slide unusably small
- 1366×768 remains functional without a wizard/mobile redesign
