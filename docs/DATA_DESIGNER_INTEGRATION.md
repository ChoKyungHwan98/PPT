# Data Designer Integration Boundary

## Decision

The new presentation engine does not move into the Table Designer React tree and does not reuse its workbench UI. It remains an independent tool inside Game Design Studio.

The first integration is a typed, read-only evidence handoff:

```text
Table Designer WorkbenchDocument
  → existing studioArtifact publication
  → Game Design Studio artifact catalog
  → explicit user include action
  → GameDataEvidence snapshot
  → SlideIR evidence binding
  → CompositionPlan / RenderTree
```

## Why this boundary

- The Table Designer already publishes `data-table` artifacts with immutable table/column IDs, revision, fingerprint, schema metadata, and at most 20 rows.
- The Studio already provides a same-origin `artifact:list` bridge used by the legacy deck tool.
- The presentation engine can therefore consume data without changing the Table Designer domain model, persistence, command engine, or UI.
- A snapshot is local-renderable but blocked from remote AI by default. Sending row data requires a later explicit permission flow.

## First supported use

1. The user selects a published table inside the presentation tool.
2. The tool shows the exact table, revision, included columns, and included rows.
3. The user chooses a presentation role such as evidence table, comparison, metric source, or relationship diagram.
4. SlideIR stores immutable evidence IDs and source mappings.
5. The renderer creates a native table/diagram in HTML, PNG, and PDF.

No automatic import occurs merely because both tools are open.

## Deferred

- write-back from a presentation to the Table Designer;
- direct mutation of `.gsw` projects;
- remote-AI transmission of private row values;
- embedding the presentation engine inside the Table Designer panel layout;
- changing the Studio tool registry before the single-page generation quality gate passes.
