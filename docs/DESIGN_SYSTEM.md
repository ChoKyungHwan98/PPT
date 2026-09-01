# Design System Draft

> **Visual token suspension · 2026-08-28**  
> Application UI invariants 중 기존 spacing, radius, typography, semantic color와 Direction A/B/C token은 다음 탐색에서 상속하지 않는다. 이 문서는 과거 가설로 보존하며 새 UI의 base theme으로 사용하지 않는다. Presentation Theatre 색감에 대한 선호는 약한 시각 evidence일 뿐 theme 승인으로 해석하지 않는다. Accessibility, slide style system, output safety처럼 비시각적 제품 제약만 유효하며, UX architecture 승인 전에는 새 visual token을 결정하지 않는다. 현재 기준은 [UX Architecture Exploration](./UX_ARCHITECTURE_EXPLORATION.md)이다.

This document separates two systems:

1. The application UI system used by the workstation
2. The slide style system used by RenderTree and PPTX export

Application chrome never dictates a slide's art direction.

## Application UI invariants

### Geometry

- Base grid: 4px
- Spacing: 4, 8, 12, 16, 20, 24, 32, 40
- Radius: 4px for compact controls, 6px standard, 8px for larger grouped surfaces
- Pill radius only for a real status/category pill
- Shadows limited to dialogs, floating palettes, and slide elevation
- Borders used to separate functional regions, not every item

### Typography

| Role | Initial range |
|---|---:|
| UI body | 13–14px |
| Secondary/meta | 11–12px |
| Panel heading | 12–13px |
| Tool/document title | 15–18px |
| Screen heading | 22–28px maximum |
| Compact control height | 28–32px |

Labels below 11px require a specific space-constrained justification. The legacy studio's repeated 8–10px text is not carried forward.

### Semantic colors

- Active/selection: restrained cyan
- Warning/change: orange
- AI/experimental: violet, used only when AI provenance matters
- Error: red
- Pass/safe: green
- Neutral hierarchy is built primarily through luminance, spacing, and typography

Accents must not compete on the same surface.

### Accessibility

- Body text contrast target: 4.5:1 minimum
- Large text and non-text UI contrast target: 3:1 minimum
- Keyboard focus is always visible
- Findings are encoded with icon/label in addition to color
- Panel and canvas navigation has a complete keyboard path

## UI direction token candidates

These are prototype candidates, not a final selection.

### Direction A — Graphite Workbench

```text
chrome.bg          #1C1E20
chrome.surface     #24272A
chrome.raised      #2B2F33
chrome.border      #383D42
text.primary       #ECEFF1
text.secondary     #A7AFB5
accent.active      #4CBFE8
canvas.stage       #151719
```

Purpose: highest workspace density, minimal color contamination, clear fit with a serious tool.

### Direction B — Warm Editorial Desk

```text
chrome.bg          #E9E5DC
chrome.surface     #F3F0E9
chrome.raised      #FBF9F4
chrome.border      #C9C3B8
text.primary       #202A33
text.secondary     #667079
accent.active      #267C9B
canvas.stage       #D7D2C8
```

Purpose: preserve the promising warm-neutral heritage without gradients, soft-card styling, or olive brand dominance.

### Direction C — Technical Atelier

```text
rail.bg            #171A1D
rail.surface       #22262A
work.bg            #D9D6CF
inspector.bg       #F1EEE7
text.dark          #202831
text.light         #E9EDF0
accent.active      #36A7CC
canvas.stage       #BFC0BD
```

Purpose: dark structural rails around a light editorial work surface. Strongest differentiation, but also the highest theme-consistency risk.

## Slide style system

Slide style packages are typed data, not free-form prose.

```text
style-package/
  manifest.json
  tokens.json
  typography.json
  object-styles.json
  preview.png
  fonts/
  assets/
  LICENSES/
```

Core token groups:

- Canvas: background, safe area, base grid
- Color roles: ink, muted ink, primary emphasis, secondary emphasis, rule, surface, danger, positive
- Typography roles: display, title, section, body, label, metric, footnote
- Spacing and rhythm
- Strokes and connectors
- Shape language
- Table and diagram styles
- Image treatment
- Accessibility floors

The style package may declare font families and concrete visual values because it belongs after SlideIR. It cannot define semantic relations or rewrite content.

## Style package security

- Versioned manifest and schema validation
- Content hashes for fonts/assets
- No remote scripts
- No executable HTML
- No absolute or traversal paths
- Atomic install and rollback
- Per-asset license and provenance
- Preview generated from a known fixture rather than arbitrary package code

## PowerPoint constraints

- Every chosen effect must have an editable PPTX mapping or a documented downgrade.
- Unsupported effects cannot silently rasterize the whole slide.
- Font substitution produces a visible export finding.
- Text role floors are calibrated for 16:9 slides and Korean body copy.
- Connector arrowheads, line joins, table fills, and text margins are normalized across render and export backends.
