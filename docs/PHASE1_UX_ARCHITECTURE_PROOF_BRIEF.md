# Phase 1 UX Architecture Proof Brief

Status: approved for static proof only  
Viewport: 1920×1080 only  
Production/exporter boundary: blocked

## Approved proof targets

- B — Live Stage
- C — Light Table

A — Manuscript to Proof is on hold. D — Checkpoint Rooms is excluded from this prototype gate. B and C may not be hybridized.

## Controlled fixture

| Field | Fixed value |
|---|---|
| Project | Chrono Break · Combat Mechanism |
| Authored source | 회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50% |
| Semantic roles | Trigger → Resource → Timed State → Transition → Outcome |
| Selection | `BREAK` · Transition · object 04 |
| Task | Source facts and relations remain locked while the user judges and adjusts BREAK emphasis |
| Visual language | Shared neutral light language; no visual-style competition |
| Slide fixture | One shared actual 16:9 mechanism render |

## B — Live Stage proof states

1. **Stage:** actual rendered page dominates; BREAK is selected; actions attach to the selection.
2. **Source:** a temporary bottom sheet exposes authored source and source↔object trace.
3. **Meaning:** semantic relations overlay the actual render and disappear when dismissed.
4. **Compare:** the stage temporarily becomes an equal candidate comparison surface.
5. **Review:** one anchored finding remains on the actual render while a temporary review sheet presents evidence and bounded actions.
6. **Overview:** a separate full-screen page overview, not a persistent slide rail.

Discoverability contract:

- A visible bottom command dock always names `Source`, `Meaning`, `Compare`, `Review`, and `Overview`.
- Keyboard hints are visible but are not the only invocation method.
- Only one temporary surface is open at a time.
- Dismissing a surface returns to the unchanged stage and BREAK selection.

Kill criteria:

- Any persistent left sidebar or right inspector.
- Slide area smaller than surrounding chrome in the default state.
- Essential tools available only by hover or hidden gesture.
- Compare or Review shown beside the stage as another permanent panel.

## C — Light Table proof states

1. **Table:** spatial page flow with named groups; the active page has a visible candidate stack.
2. **Explode:** the selected stack expands into three equally legible variants while retaining its position in deck flow.
3. **Focus lens:** the selected page grows to design-judgement size above a compressed spatial breadcrumb of neighboring pages.
4. **Deck review:** findings mark pages in place; a compact filter changes the board without turning it into a status dashboard.
5. **Play from here:** presentation launch is anchored to the selected page and preserves deck order.

Kill criteria:

- A grid of status cards or generic dashboard widgets.
- Thumbnails too small to judge hierarchy or reading path.
- Candidate state represented only by counts or labels rather than visible compositions.
- Focus mode that simply recreates the Live Stage shell.
- Page grouping expressed only through sidebar folders.

## Comparison dimensions

1. Primary artifact clarity
2. Source and semantic traceability
3. Candidate-comparison speed
4. Review evidence visibility
5. Navigation and presentation continuity
6. Discoverability without persistent panels
7. Long-session spatial stability

## Exit gate

- Browser-rendered 1920×1080 screenshots of every required state.
- Screenshot-based critique against both kill-criteria lists.
- No smaller-viewport adaptation before user approval.
- No React, Electron, Tauri, renderer, exporter, or AI integration.
