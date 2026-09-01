# Roadmap and Risk Register

## Current status

The UI exploration and PPTX-first vertical slice are frozen as historical evidence. No UI direction or previous slide design is adopted.

The active direction, approved by the user on 2026-08-29, is:

- design game-planning information for submission, portfolio, presentation, and sharing;
- use PDF as the first delivery and quality-acceptance artifact;
- keep authored source + SlideIR → CompositionPlan → RenderTree as canonical state;
- learn from provenance-aware external references and contextual A/B choices;
- keep PPTX as a later compatibility backend rather than a V1 constraint.

The deterministic core has started. The production application shell and editor UI have not started. Phases 1–4 technical gates are complete; the optional remote-AI layer is intentionally deferred while the no-cost review and preference path is verified.

## Phase 0 — Generation-system synthesis

Status: **complete**

Deliverables:

- refreshed audit of Oh My PPT, PPT Master, PPTAgent, DeepPresenter, PPT-Eval, Presenton, PPTist, Casual Slides, reveal.js, Reveal Editor, Slidev, Marp, and PptxGenJS;
- common-denominator analysis across source, planning, composition, rendering, validation, revision, and export;
- PDF-first output decision;
- Reference Evolution Engine and contextual pairwise-learning proposal.

Exit gate:

- no single external project becomes the foundation;
- every adopted idea has a bounded module and a rejection boundary;
- PPTX requirements no longer lower the PDF/HTML design ceiling.

## Phase 1 — Executable contracts and seed corpus

Status: **complete · 2026-08-29**

Deliverables:

- executable schemas for Source Ledger, SlideIR, ReferenceRecord, ReferenceRetrievalBrief, PatternFragment, CompositionPlan, RenderTree, Finding, and PairwisePreferenceRecord;
- one MEC-01 source fixture with exact source spans;
- explicit page profiles for PDF document, PDF presentation, and HTML presentation;
- manually curated, provenance-checked seed reference corpus;
- reference source/license/usage metadata and content hashes;
- fake provider and fake reference-adapter contract tests.

Exit gate:

- invalid or untraceable content fails closed;
- every reference has a URL, provenance state, and allowed-use state;
- the same source and corpus snapshot produce reproducible retrieval briefs.

## Phase 2 — PDF-quality deterministic renderer

Status: **technical gate complete · 2026-08-29**

Evidence:

- MEC-01 is rendered from a strict RenderTree to HTML, PNG, and PDF;
- all visible text resolves to the authored source;
- bounds, text overflow, text collision, contrast, PDF page, embedded font, selectable text, vector/raster, and PNG/PDF raster checks pass;
- the PDF contains two embedded Pretendard subsets, zero painted images, and 27 vector paint operations;
- repeated runs produce the same deterministic output fingerprint;
- this artifact proves the renderer path only and is not an approved design candidate.

Deliverables:

- font loading, glyph measurement, Korean line breaking, and explicit line boxes;
- deterministic HTML/SVG reference renderer;
- PNG evidence export;
- PDF export with embedded/subset fonts and selectable text;
- bounds, collision, overflow, contrast, page-box, font, vector/raster, and text-extraction validators;
- PDF reopen/raster comparison.

Exit gate:

- one hand-authored RenderTree produces matching PNG and PDF evidence;
- severe geometry findings are zero;
- PDF text is extractable, fonts are embedded/subset, and the page is not silently flattened.

## Phase 3 — Reference analysis and retrieval

Status: **technical gate complete · 2026-08-29**

Evidence:

- only allowlisted HTTPS hosts and MIME types pass the asset-fetch gate;
- source interval, byte limit, provenance, rights, and persistence permission are enforced;
- exact and perceptual duplicate detection, image-quality checks, page-region analysis, OCR contracts, and deterministic feature indexing are executable;
- MEC-01 retrieves structure-relevant references without an AI call;
- the bounded job queue checkpoints immutable corpus versions and can resume after interruption.

Deliverables:

- allowlisted source adapters and rate-limit/robots/terms controls;
- perceptual hashing and duplicate/repost filtering;
- OCR and page-region analysis;
- layout, hierarchy, typography, density, reading-path, graphic-language, and content-shape tags;
- local embedding/index and versioned corpus snapshots;
- batch queue suitable for overnight local operation;
- top-k retrieval by semantic shape and task, not color similarity alone.

Exit gate:

- relevant references are retrieved for MEC-01 without sending the whole corpus to an AI provider;
- duplicate and unlicensed/unknown-use assets cannot enter generation as reusable source material;
- every retrieved item remains traceable to its source.

## Phase 4 — Composition search and A/B generation

Status: **technical gate complete · 2026-08-29**

Evidence:

- MEC-01 produces two reproducible CompositionPlans from different topology/reference hypotheses;
- both RenderTrees preserve every locked source fact exactly once and every authored relation;
- missing or duplicated locked text, invented text, collisions, overflow, bounds, and contrast failures fail closed;
- the comparison package randomizes presentation order deterministically and supports A, B, tie, reject-both, single-candidate, and zero-candidate outcomes;
- a failed candidate is omitted rather than replaced to fill a quota;
- contextual preference choices rerank only the matching task context and retain exploration allowance;
- immutable preference snapshots can be replayed to reconstruct the same learning state.

Deliverables:

- mechanism grammar and PatternFragment binding;
- composition hypotheses from distinct reference/topology clusters;
- seeded constraint solving and deterministic layout;
- hard quality-floor rejection;
- A/B selection packaging with `tie` and `reject-both` support;
- contextual preference-weight update with exploration allowance.

Exit gate:

- two valid MEC-01 outputs preserve identical authored facts and relations while differing materially in composition logic;
- a failed candidate is retried or omitted, never included to fill a quota;
- one pairwise decision changes only relevant retrieval/ranking weights.

## Phase 5 — Optional AI layer

Status: **deferred without blocking the deterministic core**

Direct provider wiring requires an explicit credential decision. No key has been read, written, or used, and no paid call has been made.

Deliverables:

- capability-probed adapters for local OpenAI-compatible runtimes and selected remote providers;
- Information Designer, Composition Designer, Visual Critic, and Preference Reason profiles;
- structured outputs, request allowlists, content-addressed cache, cancellation, and cost records;
- actual-render critique with typed findings and at most one bounded revision.

Exit gate:

- disabling AI leaves deterministic retrieval, composition, render, validation, PDF, PNG, and preference storage operational;
- no provider receives the repository, full conversation, or full reference corpus;
- critic changes that worsen hard findings are rejected.

## Phase 6 — Minimal review surface

Status: **technical proof in progress**

Current evidence:

- a self-contained local comparison page embeds equal-size actual PNG renders;
- internal topology/provider names are hidden from the reviewer;
- A, B, tie, and reject-both actions produce an importable contextual preference record;
- the page is deliberately a review proof, not a production editor or renewed UX-architecture exploration.

Deliverables:

- a simple local A/B proof page, not a production editor;
- equal-size actual renders;
- A, B, tie, and reject-both actions;
- short optional reason capture;
- actual-render findings on demand;
- selected PDF/HTML export action and experiment history.

Exit gate:

- the page can be judged without learning an object editor;
- UI chrome does not compete with the artifacts;
- one comparison and its reason are stored and replayable.

## Phase 7 — First vertical-slice acceptance

Deliverables:

```text
MEC-01 authored source
  → SlideIR
  → seed-corpus retrieval
  → A/B CompositionPlans
  → actual PNG renders
  → deterministic validation
  → optional actual-render critique
  → user A/B, tie, or reject-both
  → PairwisePreferenceRecord
  → selected PDF page + HTML presentation page
```

Exit gate:

- the selected result is acceptable for a real portfolio/game-planning document;
- no authored fact or relation changes;
- PDF integrity gates pass;
- the user does not need to rebuild the page in another design tool;
- a repeated run can demonstrate that the stored preference affected relevant ranking without forcing a permanent style.

## Phase 8 — Production product shell

Begins only after the generation vertical slice passes.

Possible deliverables:

- project/deck organization;
- source correction and semantic confirmation;
- candidate/review/history surfaces derived from actual workflows;
- background reference jobs and status;
- PDF/HTML publish workflows;
- later native PPTX compatibility export.

No previous Live Stage, Light Table, Workbench, DNA, or panel prototype is an automatic foundation.

## Deferred expansion

1. More game-planning grammars and fixtures
2. Multi-page narrative and document flow
3. Broader allowlisted reference discovery
4. Direct OpenRouter, OpenAI, and Anthropic optimization
5. Editable PPTX compatibility benchmark using PptxGenJS and PPT Master patterns
6. Visual-fidelity PPTX as explicit fallback
7. Fine-tuning only if accumulated pairwise data proves retrieval/ranking insufficient

## Risk register

| Risk | Impact | Mitigation / go-no-go condition |
|---|---|---|
| Reference collection violates rights or source terms | Legal and distribution risk | Allowlisted adapters, robots/terms/rate checks, provenance records, metadata-first storage, no bundling without known rights |
| Reference retrieval copies a design too closely | Plagiarism and weak originality | Extract abstract pattern features; block source copy, logos, unique artwork, and near-duplicate output; similarity audit |
| Preference learning converges too early | Repetitive house style | Contextual rather than global weights, exploration allowance, tie/reject-both, cluster diversity audit |
| Internal critic creates an echo chamber | Attractive but unhelpful output | User pairwise choice remains authoritative; critic disagreement is measured; critic can be disabled |
| Local analysis quality is weak | Bad tags and retrieval | Deterministic metadata where possible, confidence fields, sampled human audit, optional remote analysis only for difficult items |
| Korean text measurement drifts | Overflow and hierarchy damage | Real font files, glyph measurement, explicit lines, actual browser render, PDF reopen/raster check |
| PDF silently rasterizes everything | Poor text/search/print quality | Font and text extraction checks, object/raster inventory, full-page bitmap rejection |
| A/B candidates differ only cosmetically | No useful learning signal | Different reference/topology hypothesis requirement and structural signature comparison |
| Low-quality candidates are shown to maintain count | User trust failure | Hard quality floor; retry, one result, or reject-both rather than quota filling |
| Remote AI cost grows with corpus size | Unsustainable use | Local OCR/embedding/dedup/render, top-k compact context, content-addressed cache, role-specific call budgets |
| AI changes authored content | Trust failure | Source-span hard gate, source-only numbers, typed revisions, no free-text content patches |
| External source changes or disappears | Non-reproducible experiments | Corpus snapshots, hashes, discovery timestamp, cached permitted thumbnail/metadata |
| HTML becomes accidental canonical source | Semantic drift | RenderTree remains typed truth; HTML/SVG are reproducible backends only |
| PPTX concerns return too early | PDF quality ceiling drops | PPTX isolated behind later capability adapter; no V1 acceptance dependency |
| Full editor scope expands | Core quality never stabilizes | Minimal review surface only until PDF-first vertical slice passes |

## Scope guardrails

The first vertical slice does not include:

- whole-deck generation;
- arbitrary content writing or external research about the user's game design;
- unbounded crawling or downloading from arbitrary sites;
- redistribution of third-party decks or screenshots without known rights;
- full PowerPoint/Figma-style object editing;
- animation, video, or audio;
- editable PPTX output;
- AI-generated decorative imagery;
- multi-agent design debate;
- model fine-tuning;
- raw HTML/CSS/SVG generation by an AI model.

The approved external activity is narrowly scoped reference discovery, metadata/thumbnail analysis, retrieval, and provenance-aware preference experiments.
