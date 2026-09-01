# UX Flow Draft

## Core interaction model

The product uses one persistent workspace. `Edit`, `Candidates`, and `Critic` are workspace states, not wizard pages.

```text
Workspace
  ├─ Structure panel: Source / Blocks / Relations / Assets
  ├─ Canvas region: actual render
  ├─ Inspector: context of current selection
  └─ Bottom drawer: Findings / History / AI Activity / Export Report
```

The user can move backward at every stage. Generated artifacts are immutable snapshots; edits create a new revision while preserving selection history.

## State overview

```text
Open project
  → Author/Import source
  → Review semantic interpretation
  → Confirm SlideIR
  → Generate candidates
  → Compare actual A/B/C renders
  → Select candidate
  → Inspect or adjust semantic emphasis
  → Critique
  → Accept/ignore a bounded fix
  → Export and verify
```

## 1. Project / Open

- User Goal: enter a recent project or create a single-slide project quickly
- Primary Action: open project or create from authored content
- Secondary Action: inspect recent export status, duplicate project
- Information Needed: project title, last edited time, last selected candidate, validation state
- AI Involvement: none
- Back / Undo: close project returns to native open/recent surface; no custom dashboard required during editing
- Error State: missing/corrupt project opens recovery report without modifying source
- Next State: Planning Content

## 2. Planning Content Input

- User Goal: paste or edit the content that must be preserved
- Primary Action: enter Korean game-planning text
- Secondary Action: attach one screenshot or simple table; mark locked spans
- Information Needed: source content, supported V1 structures, content hash state
- AI Involvement: optional “Interpret” action only; never automatic on every keystroke
- Back / Undo: normal text undo; previous source snapshot remains available
- Error State: unsupported attachment, oversized text, or malformed table is explained inline
- Next State: Semantic Interpretation

## 3. Semantic Interpretation

- User Goal: understand how the system interpreted authored logic
- Primary Action: review proposed intent, blocks, and relations
- Secondary Action: resolve ambiguity, change a block role, add or remove a relation supported by source
- Information Needed: source span highlight for every atom, confidence, blocking ambiguities
- AI Involvement: maximum one interpretation call; deterministic parse remains available
- Back / Undo: return to source; restoring prior proposal is one history action
- Error State: invalid JSON/provider failure falls back to deterministic parse; no source is lost
- Next State: SlideIR Review

## 4. SlideIR Review

- User Goal: confirm the semantic contract before design begins
- Primary Action: approve SlideIR
- Secondary Action: inspect raw structured view, source provenance, locked numbers
- Information Needed: primary message, intent, blocks, relations, assets, content-fidelity status
- AI Involvement: none after proposal generation
- Back / Undo: edit semantic interpretation or source
- Error State: missing source reference, invented number, orphan relation, or blocking ambiguity prevents approval
- Next State: Candidate Generation

## 5. Candidate Generation

- User Goal: obtain three valid, meaningfully different designs
- Primary Action: generate candidates
- Secondary Action: adjust design direction controls or request optional Local composition suggestion
- Information Needed: selected grammar, eligible patterns, current design controls, generation status
- AI Involvement: optional one composition suggestion; deterministic engine creates geometry
- Back / Undo: change SlideIR or restore previous candidate set
- Error State: if fewer than three valid candidates exist, show exact capacity/semantic conflict instead of a weak filler candidate
- Next State: Candidate Compare

## 6. Candidate Compare

- User Goal: compare actual visual outcomes, not wireframes
- Primary Action: select A, B, or C
- Secondary Action: synchronized zoom, toggle source/finding overlays, compare rationale and validation
- Information Needed: actual PNG, pattern name, dominant artifact, reading path, hard findings, critic rank when available
- AI Involvement: optional single critique covering all three renders
- Back / Undo: regenerate from the same or changed design controls; previous set remains in History
- Error State: failed render is isolated to one candidate and replaced only by a newly validated candidate
- Next State: Canvas Adjustment

## 7. Candidate Selection

- User Goal: commit to one composition without losing alternatives
- Primary Action: select candidate
- Secondary Action: pin an alternate; record “liked” and “disliked” reasons
- Information Needed: selected-state confirmation, candidate hash, pending findings
- AI Involvement: none
- Back / Undo: switch to a prior candidate at any time before export
- Error State: stale candidate after source change is clearly marked and cannot export
- Next State: Canvas Detail Adjustment

## 8. Canvas Detail Adjustment

- User Goal: refine emphasis and design intent without becoming a full PPT editor
- Primary Action: select a semantic object and edit approved high-level properties
- Secondary Action: show guides, safe area, source span, fit/zoom
- Information Needed: semantic role, emphasis, typography role, constraints, source, current grammar
- AI Involvement: none by default
- Back / Undo: command-stack undo and immutable revision snapshots
- Error State: edits that would violate source fidelity or hard layout constraints are rejected with a reason
- Next State: Critic

## 9. Critic

- User Goal: find legibility, hierarchy, alignment, and aesthetic problems in the real render
- Primary Action: review findings anchored to the slide
- Secondary Action: filter deterministic/AI findings; inspect rationale; compare candidates
- Information Needed: severity, affected object, reason, evidence, suggested typed patch
- AI Involvement: optional Local Visual Critic sees actual PNG and compact rubric
- Back / Undo: close drawer/mode without applying; retain report in History
- Error State: no vision capability shows deterministic findings only, not a fake AI pass
- Next State: Fix

## 10. Fix

- User Goal: apply only clear, reversible improvements
- Primary Action: accept a typed patch
- Secondary Action: ignore, edit patch parameters, or request user decision
- Information Needed: before/after preview, changed constraints, content-fidelity proof
- AI Involvement: maximum one revision suggestion; deterministic engine applies and re-renders
- Back / Undo: one-click revert to pre-fix snapshot
- Error State: revised render failing a hard gate is rejected and never replaces the selected version
- Next State: Export

## 11. Export

- User Goal: obtain one verified editable PPTX slide
- Primary Action: export PPTX
- Secondary Action: inspect export report or open output location
- Information Needed: editability support, font status, OOXML validation, preview/export parity, warnings
- AI Involvement: none
- Back / Undo: return to selected render; export never mutates SlideIR
- Error State: package failure, missing font, or post-export overflow keeps the previous verified artifact and shows recovery actions
- Next State: Verified or back to Canvas/Critic

## Selection and inspector synchronization

- Selecting a source span highlights its semantic blocks and related rendered objects.
- Selecting a semantic block highlights its source and rendered objects.
- Selecting a RenderTree object reveals its semantic source and inspector context.
- Selecting a critic finding focuses the affected object and opens only relevant controls.

The selection model must not expose generated decorative objects as if they were authored semantic blocks. Decorative objects can be selected only in a diagnostic object-tree view.

## Undo and history model

- Source edits: command undo plus periodic source snapshots
- Semantic edits: typed patches
- Candidate generation: immutable candidate-set snapshot
- Candidate selection: reversible pointer change
- Critic fix: before/after revision pair
- Export: new artifact; never overwrites the only previous export without confirmation

## Keyboard baseline

| Action | Proposed shortcut |
|---|---|
| Command palette | `Ctrl+Shift+P` |
| Fit slide | `Shift+1` |
| Zoom selected object | `Shift+2` |
| 100% zoom | `Ctrl+1` |
| Toggle Structure | `Ctrl+Alt+1` |
| Toggle Inspector | `Ctrl+Alt+2` |
| Toggle Findings drawer | `Ctrl+J` |
| Compare candidates | `Ctrl+Alt+C` |
| Critic mode | `Ctrl+Alt+K` |
| Undo / Redo | platform standard |

Shortcuts are validated during prototype testing and are not final bindings.

## Recovery principles

- A provider failure never destroys deterministic artifacts.
- A rendering failure identifies the candidate and engine stage.
- A font failure names the missing font and affected objects.
- A stale candidate cannot silently export.
- A layout that cannot fit does not shrink indefinitely; it explains the blocking constraint.
- Every destructive user action has undo or explicit confirmation.

