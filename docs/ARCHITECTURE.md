# Architecture

> **Architecture decision update · 2026-08-29**  
> The canonical chain remains authored source + SlideIR → CompositionPlan → RenderTree. The implementation and acceptance order is now PDF-first: HTML/SVG reference render → PNG evidence + PDF proof, followed by HTML presentation. PPTX is a later compatibility backend and does not constrain page geometry, visual language, or the first vertical slice.

## Legacy repository assessment

The legacy root is:

`C:\Users\Admin\Desktop\게임기획\게임기획 툴\도구\기획서 디자이너\프로젝트`

It is an Oh My PPT-derived Electron application with a large dirty working tree. No cleanup, commit, tag, or reset was performed during this design phase.

The following legacy subsystems are rejected as foundations for the new product:

- Existing deck-wide DeckIR, which mixes source evidence, outline, slide content, and design state
- Descriptor-based layout candidate engine without resolved geometry
- Hard-coded PPTX layouts and approximate weighted-character text fit
- Character-count capacity and preflight checks
- Free manuscript to outline to whole-deck workflow
- Existing session, store, route, and editor state model
- HTML/CSS as canonical slide state
- Existing AI runtime contract
- Existing PPT Designer UI

Legacy is retained only for black-box comparison, sample files, fixtures, OOXML checks, export experiments, snapshot/rollback ideas, and blind A/B benchmarks.

No new package may import a legacy module. An exception requires a written proposal covering provenance, license, replacement cost, and measurable reuse value, followed by user approval.

## Current UI token assessment

The legacy renderer uses warm beige and olive tokens such as `#f5f1e8`, `#3e4a32`, and `#5d6b4d`, plus gradients, soft shadows, and card surfaces. The warm-neutral premise is worth retaining as a possible direction; the gradient-heavy and soft-card execution is not.

The legacy studio uses a more relevant professional-tool base: graphite `#1f1f1f`, surfaces near `#282828`, and restrained cyan `#4cc2ef`, mostly with 4–5px radii. Its compact workbench and central preview are useful references. Its frequent 8–10px labels, miniature wireframe candidates, fixed blueprint previews, and two-column-only shell are rejected.

## Clean root proposal

Documentation-only clean root created for review:

`C:\Users\Admin\Desktop\게임기획\게임기획 툴\도구\기획서 디자이너\game-ppt-designer-next`

No production code or dependency manifest exists yet.

Proposed production structure after approval:

```text
game-ppt-designer-next/
  apps/
    desktop/
  packages/
    content-core/
    slide-ir/
    visual-grammar/
    design-system/
    composition-engine/
    text-engine/
    render-tree/
    slide-renderer/
    output-backends/
      html-presenter/
      pdf-exporter/
      png-exporter/
      pptx-exporter/
    validator/
    reference-assets/
    reference-collector/
    preference-learning/
    ai-gateway/
    revision-orchestrator/
    memory/
    eval/
  skills/
    app-ui-design/
    core-slide-design/
    design-direction/
    visual-critic/
    game-design-grammar/
  references/
    external/ui/
    approved/ui/
    rejected/ui/
    approved/slide/
    rejected/slide/
  docs/
```

`references/external` stores metadata and URLs by default. Third-party screenshots are not copied unless redistribution rights are known. This proposed package expansion remains documentation only until the output architecture is approved.

## Canonical artifact model

### SlideIR

Describes what the authored content means. It contains source-linked semantic information and no layout or visual styling.

### CompositionPlan

Describes how one grammar pattern assigns semantic roles to zones and constraints. It is derived, reproducible, and disposable.

### RenderTree

Describes every resolved visual object that will be rendered or exported. It includes geometry, typography roles resolved to concrete values, paint, clipping, z-order, relations, object identity, and source links. It is not an HTML DOM or an OOXML tree.

The three artifacts are never merged into one mutable document.

## Pipeline

```text
User-authored content
  → Semantic ingestion
  → SlideIR
  → Reference Retrieval Brief
  → Visual Grammar + Reference Corpus + Composition Search
  → Candidate planning A/B
  → Layout solver + text measurement
  → RenderTree A/B
  → Actual reference render
  → Observe geometry + pixels
  → Deterministic validation
  → Optional Visual Critic
  → Typed revision patch
  → Re-plan and re-render
  → User pairwise selection or reject-both
  → Contextual preference record
  → Output backend capability check
  ├─ PDF proof [V1 primary]
  ├─ PNG evidence [V1]
  ├─ HTML presentation [V1]
  └─ Editable PPTX where supported [later compatibility]
  → Per-format postflight, render comparison, and downgrade report
```

No output is canonical source. PDF is the primary delivery and acceptance artifact because the user's immediate goal is portfolio/document submission. Visual-fidelity or editable PPTX work is deferred and may not lower the PDF design ceiling.

## Package dependency graph

```text
content-core
  └─ slide-ir

design-system
  ├─ text-engine
  └─ render-tree

slide-ir + design-system
  └─ visual-grammar

content-core + design-system
  ├─ reference-assets
  └─ reference-collector

slide-ir + visual-grammar + design-system + text-engine + render-tree
  └─ composition-engine

render-tree + design-system + text-engine
  ├─ slide-renderer
  └─ output-backends
       ├─ html-presenter
       ├─ pdf-exporter
       ├─ png-exporter
       └─ pptx-exporter

slide-ir + render-tree + text-engine
  └─ validator

slide-ir + visual-grammar + reference-assets
  └─ ai-gateway

reference-assets + validator + memory
  └─ preference-learning

composition-engine + slide-renderer + validator + output-backends + ai-gateway
  └─ revision-orchestrator

revision-orchestrator + validator + output-backends
  └─ eval

revision-orchestrator + memory + preference-learning + eval
  └─ apps/desktop
```

Dependency constraints:

- Domain packages never import `apps/desktop`.
- Render packages never import AI adapters.
- AI never imports or calls an output backend.
- Skills are versioned data read by `ai-gateway`; they are not executable plugins.
- `revision-orchestrator` coordinates services but contains no layout math.
- Export validation is invoked by the orchestrator; the exporter does not decide whether its output is acceptable.

## Deterministic core

The deterministic core must support:

- Structured SlideIR input and validation
- Grammar eligibility and candidate diversity
- Seeded candidate planning
- Constraint-based composition
- Glyph-based text measurement and Korean wrapping
- RenderTree generation
- Actual reference rendering plus HTML/PDF/PNG backend validation
- Bounds, collision, overflow, contrast, and content-fidelity validation
- PDF font embedding, selectable-text, vector/raster, page-box, and reopen validation
- Reference provenance, deduplication, and pairwise preference recording
- Optional later editable PPTX compatibility export and OOXML postflight
- Backend capability manifests and explicit per-object downgrade findings
- Artifact hashing, snapshots, and undoable typed revisions

If AI is disabled, users may provide structured content or correct the deterministic parser's SlideIR result manually.

## Text and PDF fidelity

The text engine uses actual font files, glyph advances, Unicode line-breaking rules, and explicit line boxes. It may not use character counts as a fit decision.

The V1 reference renderer and PDF exporter must share the same font files and line boxes. Every selected PDF is reopened, its text is extracted, and each page is rasterized for comparison with the approved reference render. Fonts must be embedded or subset, text must remain selectable, and meaningful vector content must not silently become one full-page bitmap.

PowerPoint wrapping calibration is deferred to the later PPTX compatibility backend and is not a V1 layout constraint.

When content does not fit, the resolution order is:

1. Reallocate zones
2. Change grouping
3. Change topology
4. Change grammar pattern
5. Ask the user for a content decision

Font size reduction below the role floor is prohibited.

## Revision state machine

```text
Draft
  → Planned
  → Rendered
  → Observed
  → Critiqued
  → Revised → Rendered
  → Selected
  → Exported
  → Verified
```

Every transition records input hashes, version identifiers, findings, and the applied typed patch. The V1 automatic loop allows one revision only.

## Dependency and license candidates

Versions are a 2026-08-28 npm metadata snapshot, not an approved lockfile.

| Package | Candidate use | Version | License | Decision |
|---|---|---:|---|---|
| Electron | Desktop shell | 44.0.0 | MIT | Candidate after UI prototype approval |
| React | Desktop renderer | 19.2.8 | MIT | Candidate |
| Vite | Build/dev tooling | 8.2.2 | MIT | Candidate |
| TypeScript | Language | 7.0.2 | Apache-2.0 | Candidate |
| Zustand | Small UI state stores | 5.0.15 | MIT | Candidate; domain state remains outside UI |
| Dockview | Docking/panel persistence | 8.2.0 | MIT core | Spike only; enterprise package excluded |
| Lucide React | Compact UI icons | 1.34.0 | ISC | Candidate |
| PptxGenJS | Later editable PPTX backend | 4.0.1 | MIT | Deferred compatibility candidate |
| Fontkit | Glyph and font metrics | 2.0.4 | MIT | Recommended for spike |
| linebreak | Unicode line breaking | 1.1.0 | MIT | Recommended for spike |
| Zod | Runtime schemas and JSON Schema export | 4.4.3 | MIT | Recommended |
| resvg-js | SVG to PNG | 2.6.2 | MPL-2.0 | Candidate; file-level obligations require review |
| Sharp | Image normalization and thumbnails | 0.35.4 | Apache-2.0 | Candidate; include libvips notices |
| fflate | PPTX ZIP postflight | 0.8.3 | MIT | Recommended |
| fast-xml-parser | OOXML checks | 5.11.1 | MIT | Recommended |
| Culori | Color conversion and contrast | 4.0.2 | MIT | Candidate |
| Kiwi | Constraint-solving spike | 0.4.4 | BSD-3-Clause | Optional; do not adopt before benchmark |
| Vitest | Unit/contract tests | 4.1.11 | MIT | Candidate |
| Playwright | Controlled HTML/SVG render, PDF, PNG, eval | 1.62.1 | Apache-2.0 | Recommended for first renderer spike |

Additional license policy:

- Pretendard may be bundled under SIL OFL 1.1 with its license and reserved-name conditions.
- PPTist is AGPL-3.0 and is reference-only unless a separate commercial license is obtained.
- Oh My PPT is Apache-2.0; any copied code requires attribution, NOTICE handling, and explicit approval.
- PPT Master, PPTAgent, DeepPresenter, and PptxGenJS are MIT, but copied files still retain their copyright notices.
- Every transitive dependency receives SBOM and license scanning before packaging.
- User/reference assets carry separate provenance and usage rights in `reference-assets`.
