# Phase 1 UX Architecture Proof

Two independent static HTML prototypes at 1920×1080. They share the same Chrono Break fixture, retained A/B/C candidate renders, type family, and neutral palette. They do not share shell markup, layout anatomy, components, stylesheet, or state model.

No production framework or exporter is included.

## B — Live Stage

[Open interactive prototype](./live-stage/index.html)

| State | Purpose | Screenshot |
|---|---|---|
| Stage | Actual render dominates; BREAK selection exposes contextual actions | [1920×1080](./screenshots/live-stage/stage-1920x1080.png) |
| Source | On-demand authored source and semantic trace | [1920×1080](./screenshots/live-stage/source-1920x1080.png) |
| Meaning | Semantic overlay on the actual rendered page | [1920×1080](./screenshots/live-stage/meaning-1920x1080.png) |
| Compare | Temporary three-candidate compare stage | [1920×1080](./screenshots/live-stage/compare-1920x1080.png) |
| Review | Anchored finding plus temporary bounded-review surface | [1920×1080](./screenshots/live-stage/review-1920x1080.png) |
| Overview | Separate full-screen page overview | [1920×1080](./screenshots/live-stage/overview-1920x1080.png) |

State URLs use `?state=stage|source|meaning|compare|review|overview`. Visible controls and S/M/C/R/O keyboard shortcuts invoke the same states.

## C — Light Table

[Open interactive prototype](./light-table/index.html)

| State | Purpose | Screenshot |
|---|---|---|
| Table | Spatial page flow, grouping, selection, and candidate stack | [1920×1080](./screenshots/light-table/table-1920x1080.png) |
| Explode | Three visible variants expanded from page 04's stack | [1920×1080](./screenshots/light-table/explode-1920x1080.png) |
| Focus lens | Page 04 enlarged while retaining neighboring page context | [1920×1080](./screenshots/light-table/focus-1920x1080.png) |
| Deck review | Findings remain anchored to their pages in the board | [1920×1080](./screenshots/light-table/review-1920x1080.png) |
| Play from here | Presentation route starts at selected page 04 | [1920×1080](./screenshots/light-table/play-1920x1080.png) |

State URLs use `?state=table|explode|focus|review|play`. Visible controls and E/F/R/P keyboard shortcuts invoke the same states.

## Controlled source

```text
회피 ×3
→ 시간 파편 획득
→ 시간 정지 5초
→ BREAK
→ 받는 피해 +50%
```

Selection: `BREAK` · `Transition` · object 04.

## Scope boundary

- 1920×1080 only
- Static HTML/CSS plus local state navigation
- No 1440×900 or 1366×768 adaptation before approval
- No React, Electron, Tauri, renderer, exporter, or AI integration
