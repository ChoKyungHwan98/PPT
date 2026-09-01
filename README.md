# GAME PPT DESIGNER NEXT

This is the clean root for the new product. The deterministic generation core is now under implementation. Frozen legacy code and rejected UI prototypes are not used as its foundation.

## Current executable proof

- packages/contracts: source fidelity, SlideIR, reference provenance, composition, RenderTree, findings, AI adapter, and contextual A/B preference contracts
- packages/renderer: browser text measurement, Korean line breaking, SVG/HTML rendering, PNG/PDF export, and hard validation
- packages/composition-engine: mechanism grammar, reference-conditioned composition hypotheses, structural diversity, and comparison packaging
- packages/reference-engine: provenance gates, analysis, deduplication, local retrieval, and resumable overnight jobs
- packages/preference-learning: immutable A/B, tie, and reject-both history with contextual replay
- packages/review-surface: a minimal local blind-comparison proof; not the production editor
- packages/studio-integration: typed, local-only ingestion of Table Designer evidence published through Game Design Studio
- apps/workbench: the first new authoring UI implementation. It is slide-first, has no persistent sidebars, and opens source, meaning, review, overview, and export controls only when needed.
- packages/contracts/fixtures/mec-01.ts: exact authored fixture
- output/pdf/mec-01-proof: one deterministic technical render proof; this is renderer evidence, not an approved design candidate

The first real-document authoring path is executable without UI or AI:

```powershell
pnpm author:balance -- --input "C:\path\balance-design.docx"
```

It preserves the source as an authored-document ledger, creates a traceable content inventory and presentation plan, then independently exports HTML, PDF, PNG pages, and a fully editable three-slide PPTX. Outputs are written next to the source under `GAME_PPT_DESIGNER_OUTPUT` unless `--output-dir` is provided.

Run `pnpm verify` to validate the deterministic core. The workbench remains an earlier interaction proof and is not the current production foundation.

## Local authoring program

Run `pnpm dev:workbench`, open the local address, and select a DOCX. The current screen performs the real deterministic pipeline, shows actual PNG renders, exposes source evidence on demand, and downloads PDF, HTML, and editable PPTX outputs. It deliberately has no persistent sidebar or inspector; the rendered page remains the visual focus.

The dark mechanism page currently shown inside the workbench is a test fixture only. It is not an approved visual design and is deliberately kept separate from the UI architecture.

Start with [Master Design Review](./docs/MASTER_DESIGN_REVIEW.md).

## Documents

- [PRD](./docs/PRD.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [SlideIR](./docs/SLIDE_IR.md)
- [Visual Grammar](./docs/VISUAL_GRAMMAR.md)
- [Design System](./docs/DESIGN_SYSTEM.md)
- [AI Provider](./docs/AI_PROVIDER.md)
- [Reference Audit](./docs/REFERENCE_AUDIT.md)
- [Presentation Authoring Reference Audit](./docs/PRESENTATION_AUTHORING_REFERENCE_AUDIT.md)
- [Presentation Generation Synthesis](./docs/PRESENTATION_GENERATION_SYNTHESIS.md)
- [UX Flow](./docs/UX_FLOW.md)
- [UX Architecture Exploration](./docs/UX_ARCHITECTURE_EXPLORATION.md)
- [Output Architecture Review](./docs/OUTPUT_ARCHITECTURE_REVIEW.md)
- [Phase 1 UX Architecture Proof Brief](./docs/PHASE1_UX_ARCHITECTURE_PROOF_BRIEF.md)
- [Phase 1 UX Architecture Proof Report](./docs/PHASE1_UX_ARCHITECTURE_PROOF_REPORT.md)
- [Phase 1 UX Architecture Prototype Index](./prototypes/phase1-ux-architecture-proof/README.md)
- [Design Quality Lab](./prototypes/design-quality-lab/README.md)
- [UI Design](./docs/UI_DESIGN.md)
- [Phase 1 Prototype Comparison Report](./docs/PHASE1_PROTOTYPE_REPORT.md)
- [Phase 1 Static Prototype Index](./prototypes/phase1/README.md)
- [Preference Memory](./docs/MEMORY.md)
- [Evaluation](./docs/EVAL.md)
- [Roadmap and Risks](./docs/ROADMAP.md)
- [Data Designer Integration](./docs/DATA_DESIGNER_INTEGRATION.md)
