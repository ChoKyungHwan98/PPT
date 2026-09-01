# Visual Grammar Draft

## Definition

Visual Grammar maps authored game-design relationships to semantically valid visual structures. It is not a template catalog and not a prose prompt that asks a model to design a slide.

A grammar pattern defines:

- Eligible semantic shape
- Required and optional roles
- Role-to-zone mapping rules
- Topology and reading path
- Capacity limits
- Connector semantics
- Hierarchy rules
- Fallback patterns
- Editable object mapping
- Deterministic validation rules

```ts
type GrammarPattern = {
  id: string
  version: string
  intent: SlideIntent
  accepts: SemanticShapePredicate
  requiredRoles: SemanticRole[]
  optionalRoles: SemanticRole[]
  skeletons: ConstraintSkeleton[]
  capacity: CapacityRule[]
  hierarchy: HierarchyRule[]
  connectorRules: ConnectorRule[]
  fallbacks: string[]
  editability: EditableObjectRule[]
}
```

## Global rules

- One primary message per slide.
- One dominant artifact by default.
- Every connector references one or more `SemanticRelation` IDs.
- No decorative arrow may resemble a semantic connector.
- Numeric scale and threshold placement must preserve source meaning.
- Same-level concepts use the same visual syntax.
- A table is not converted into cards unless the semantic dimensions remain explicit.
- No candidate may hide source content to satisfy fit.
- Candidate diversity is structural and reference-cluster-aware, not palette-based.
- A failed candidate is discarded rather than presented to satisfy a requested count.
- The comparison target is normally A/B, but one accepted candidate or `reject-both` is valid.

## V1 catalog

| Intent | Required semantic roles | Candidate composition families | Critical validation |
|---|---|---|---|
| `mechanism` | trigger/input, process, state/result | causal rail; primary-focus hub; staged mechanism | directional relations exist; focus does not break sequence |
| `comparison` | left/right subjects, shared dimensions | split matrix; aligned rows; delta-led comparison | identical comparison dimensions and ordering |
| `state-transition` | current state, condition, transition, next state | transition gate; state rail; condition-centered fork | transitions have explicit source relation; no false branch |
| `timeline` | ordered events, time/order labels | horizontal chronology; vertical event rail; milestone band | chronological order and scale are preserved |
| `boss-phase` | phases, thresholds, behaviors | health threshold rail; stacked phase bands; phase-focus progression | thresholds are ordered and units preserved |
| `loop` | at least three nodes in a real cycle | orbit loop; staged cycle; loop with feedback focus | source graph contains a cycle; direction unambiguous |
| `resource-flow` | source, stock/accumulation, spend, outcome | source-sink flow; reservoir focus; ledger flow | produces/consumes semantics are not reversed |
| `hierarchy` | root, parent/child relations | tree; tier ladder; nested domains | graph is acyclic and parentage is unique where required |
| `data-highlight` | sourced metric, label, unit/context | dominant metric; metric-plus-causes; metric comparison | value and unit remain adjacent and exact |
| `table-summary` | headers, rows, optional authored takeaway | editorial table; grouped table; table plus source takeaway | row/column semantics and values preserved |
| `ui-annotation` | source screenshot, regions, annotations | side callouts; numbered hotspots; split detail zoom | hotspot maps to asset region and annotation relation |

## Mechanism vertical-slice grammar

Reference semantic chain:

```text
회피 x3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%
```

### Eligible hypothesis — Causal Rail

- Reading path: left to right
- Dominant artifact: explicit five-step causal chain
- Use when sequence comprehension is the highest priority
- The BREAK state receives stronger contrast but remains in sequence

### Eligible hypothesis — BREAK Focus Hub

- Reading path: outside-in, then rightward consequence
- Dominant artifact: BREAK state
- Upstream trigger/resource/process group feeds a central BREAK state
- Damage modifier is a consequence, not a peer step

### Eligible hypothesis — Resource Activation

- Reading path: top-left trigger to resource reservoir, then activation/result
- Dominant artifact: time-fragment resource
- Makes acquisition and spend semantics explicit
- Valid only if relations distinguish resource production and consumption

These are grammar hypotheses, not mandatory outputs or fixed house templates. Reference retrieval may introduce another semantically valid hypothesis. Any compared candidates preserve identical facts and relations while differing in topology, grouping, dominant artifact, typographic strategy, or graphic language.

## Candidate generation

1. Validate SlideIR.
2. Determine eligible patterns.
3. Bind semantic roles to required pattern slots.
4. Retrieve relevant reference metadata by function, content shape, reading path, and density.
5. Generate hypotheses from separate topology/reference clusters.
6. Solve zone constraints.
7. Measure actual text and wrap.
8. Generate RenderTree.
9. Validate content, geometry, legibility, and output-profile support.
10. Rank valid candidates by hard quality, relevance, diversity, and contextual preference.
11. Return A/B only when both clear the quality floor; otherwise retry, return one, or report `reject-both` availability.

AI may propose an eligible pattern ID, role mapping, or emphasis ordering. It does not create geometry.

## Design-control parameters

These controls influence search and ranking. They are not hard aesthetic templates.

| Parameter | Meaning | Must not change |
|---|---|---|
| `DESIGN_VARIANCE` | topology asymmetry and candidate exploration | content order or causal truth |
| `VISUAL_DENSITY` | space allocation and grouping compactness | type-floor or overflow rules |
| `EDITORIALITY` | typographic hierarchy and authored narrative emphasis | source wording |
| `DIAGRAM_EMPHASIS` | preference for relation-driven artifact | unsupported relations |
| `DECORATION_LEVEL` | non-semantic texture and framing | connector meaning |
| `CONTRAST_LEVEL` | visual hierarchy separation | accessibility minimums |

Recommended starting profile for game-system portfolio slides:

```text
Variance 5 / Density 6 / Editoriality 7 /
Diagram 9 / Decoration 2 / Contrast 7
```

Art direction may choose within those ranges. A parameter never authorizes content deletion or a semantically misleading composition.

## Internal skill routing

Runtime must not load a large bundle of generic skills.

Proposed structure:

```text
skills/
  core-slide-design/SKILL.md
  game-design-grammar/
    mechanism.md
    comparison.md
    state-transition.md
    timeline.md
    boss-phase.md
    loop.md
    resource-flow.md
    hierarchy.md
    data.md
    ui-annotation.md
  design-direction/SKILL.md
  visual-critic/SKILL.md
  app-ui-design/SKILL.md
```

Example route for a mechanism task:

```text
core-slide-design + mechanism + design-direction
```

The critic route adds only `visual-critic` and the compact candidate summary.

## External skill synthesis

- Anthropic `frontend-design`: retain subject grounding, deliberate art direction, and the rule that structural devices must encode real meaning. Do not import web-hero or production-frontend instructions wholesale. Apache-2.0.
- Taste Skill: retain brief inference, tunable variance/density, and anti-repetition checks. Motion is removed from V1 slides; web/landing-page presets are not applicable. MIT.
- UI UX Pro Max: retain searchable design knowledge, accessibility checks, and pre-delivery validation. Do not load its full catalog at runtime or let generated design-system recommendations override product tokens. MIT.
- Oh My PPT layout skill: retain message/role/reading-path/content-shape/height-budget self-check categories. Replace prompt-authored HTML with typed grammar and measured constraints.

All internal skills are rewritten specifically for slide information design. No external skill is installed wholesale into the V1 runtime.
