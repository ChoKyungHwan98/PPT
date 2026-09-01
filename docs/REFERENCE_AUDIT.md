# Reference Audit

Research date: 2026-08-28  
Scope: 21 professional creative/workbench products, 6 required presentation systems, and 3 design skills

References are evidence, not templates. The final product must not clone one application or assemble unrelated fragments into a Frankenstein UI. External screenshots remain linked at their sources and are not copied into the repository by default.

## Product and repository audit

### 1. Oh My PPT

- Product / URL: [arcsin1/oh-my-ppt](https://github.com/arcsin1/oh-my-ppt)
- License: Apache-2.0
- Screen / feature observed: local-first presentation workflow, style previews, page editing, page beautify, versioned jobs and history
- Good: generation and editing live in one presentation-centered workflow; previews communicate actual style; snapshot/rollback discipline is useful
- Bad: broad prompt-to-deck content generation remains central; HTML is the authored slide state; layout quality depends substantially on agent-authored markup
- Interaction to take: actual style previews, per-page regeneration/revision, job history, atomic rollback
- Visual pattern to take: presentation object remains visible while operations run
- Do not take: free prompt to whole deck, HTML canonical state, model-authored page fragment, full-screen generation wizard

### 2. Onlook

- Product / URL: [Onlook](https://github.com/onlook-dev/onlook), [official site](https://www.onlook.com/)
- License: Apache-2.0 repository; hosted product terms are separate
- Screen / feature observed: layers on the left, central live canvas, styles inspector on the right, AI and direct manipulation in the same workspace, design checkpoints
- Good: AI coexists with direct visual control; canvas stays primary; selected element maps to a structured source; branches/checkpoints make experiments recoverable
- Bad: chat and code affordances can compete with the design surface; infinite canvas and DOM concepts do not map directly to one-slide composition
- Interaction to take: selection synchronized between hierarchy, canvas, and inspector; checkpointed AI changes; side-by-side preview and underlying structured state
- Visual pattern to take: quiet dark chrome around a high-contrast work surface
- Do not take: persistent chat as primary navigation, code editor, web-container workflow, DOM/Tailwind inspector

### 3. Penpot

- Product / URL: [Penpot](https://github.com/penpot/penpot), [interface guide](https://help.penpot.dev/user-guide/first-steps/the-interface/)
- License: MPL-2.0
- Screen / feature observed: pages/layers/assets, central viewport, contextual design/prototype/inspect panels, native design tokens
- Good: clear hierarchy between layers, design tokens, and properties; W3C-aligned token concepts; selected object changes the inspector context
- Bad: a full vector editor exposes far more geometry controls than this product needs; deep panels can crowd the viewport
- Interaction to take: contextual inspector, layer lock/visibility, token binding, progressive disclosure
- Visual pattern to take: compact panel labels, clear selected-layer state, neutral canvas stage
- Do not take: arbitrary vector path editing, every low-level transform control in V1

### 4. Figma

- Product / URL: [Figma keyboard workflow](https://help.figma.com/hc/en-us/articles/360040328653-Use-Figma-products-with-a-keyboard), [layer locking](https://help.figma.com/hc/en-us/articles/360041596573-Lock-and-unlock-layers)
- License: proprietary SaaS/application; reference only
- Screen / feature observed: layers, large canvas, contextual properties, selection handles, keyboard-first object navigation, action/command search
- Good: mature selection model; predictable canvas focus; keyboard paths reduce panel travel; panels can be hidden for focus
- Bad: recent breadth and feature density can add navigation chrome; general design-tool concepts can encourage unrestricted object editing
- Interaction to take: synchronized selection, focus selected object, zoom/fit shortcuts, command palette, inline selection affordances
- Visual pattern to take: compact neutral chrome, high signal-to-noise selection states
- Do not take: component/prototype complexity, consumer-facing resource hub, full vector editor scope

### 5. Microsoft PowerPoint

- Product / URL: [slide thumbnails](https://support.microsoft.com/en-us/powerpoint/show-or-hide-slide-thumbnails), [Selection Pane](https://support.microsoft.com/en-US/PowerPoint/use-the-selection-pane-to-manage-objects-in-documents)
- License: proprietary commercial application; reference only
- Screen / feature observed: resizable thumbnail navigator, central slide, ribbon, format/selection panes, slide sorter
- Good: users already understand the slide canvas and thumbnail mental model; object layering maps directly to final editability; format controls are contextual
- Bad: ribbon exposes too many commands; layer management is secondary and awkward; panes fragment attention
- Interaction to take: slide-as-document mental model, zoom/fit, object selection, editable export expectations
- Visual pattern to take: central physical slide with clear page boundary and elevation
- Do not take: ribbon density, Office-wide command taxonomy, animation/master complexity in V1

### 6. PPTist

- Product / URL: [PPTist](https://github.com/pipipi-pikachu/PPTist)
- License: AGPL-3.0 current version; separate commercial licensing offered
- Screen / feature observed: browser presentation editor with slide navigation, canvas, object editing, selection panel, shortcuts, context menus, PPTX import/export
- Good: extensive slide-object interaction coverage; practical shortcut and context-menu behavior; useful inventory of presentation editor edge cases
- Bad: full PowerPoint clone scope is far larger than the product; export fidelity is explicitly imperfect; license is incompatible with casual closed-source reuse
- Interaction to take: reference only for canvas selection, alignment, grouping, and context menus
- Visual pattern to take: slide editor spatial conventions
- Do not take: code or components without separate approval/license; full editor scope; template AIPPT flow

### 7. Visual Studio Code

- Product / URL: [workbench layout](https://code.visualstudio.com/docs/configure/custom-layout), [UI overview](https://code.visualstudio.com/docs/editing/userinterface), [source](https://github.com/microsoft/vscode)
- License: source repository MIT; Microsoft distribution has separate product terms/branding
- Screen / feature observed: primary/secondary sidebars, editor tabs, movable bottom panel, command palette, Problems/Output/Terminal model, persisted layout
- Good: content/editor stays primary; diagnostics live in a collapsible bottom region; keyboard access and layout persistence support all-day use
- Bad: extensions and status indicators can turn into dense chrome; unrestricted docking can create unrecoverable layouts
- Interaction to take: Problems-style findings drawer, command palette, panel toggle/focus shortcuts, restore default layout
- Visual pattern to take: compact tab strips, subtle region boundaries, restrained status bar
- Do not take: activity-bar icon accumulation, extension marketplace, arbitrary panel freedom in V1

### 8. Zed

- Product / URL: [Zed](https://github.com/zed-industries/zed), [documentation](https://zed.dev/docs/)
- License: primarily GPL-3.0-or-later, Apache-2.0 where marked
- Screen / feature observed: high-performance editor, command palette, compact panels, editor-centered layout
- Good: extremely restrained chrome; command-driven operation; fast focus switching
- Bad: sparse discoverability can burden new users; source license rules out casual code reuse
- Interaction to take: command-first access, fast panel focus, low-latency feedback as a design target
- Visual pattern to take: quiet compact tabs and minimal persistent controls
- Do not take: source code, coding metaphors that make game planners feel they are in a text editor

### 9. Dockview

- Product / URL: [Dockview](https://github.com/dockview/dockview), [core concepts](https://dockview.dev/docs/core/overview/)
- License: MIT core; enterprise package proprietary
- Screen / feature observed: tab groups, resizable split views, drag/drop docking, serialization and restoration
- Good: mature workspace persistence and panel primitives; framework-neutral core; default layout can be restored
- Bad: unrestricted docking adds complexity and can reduce canvas consistency; some desirable navigation features are enterprise-only
- Interaction to take: bounded resize, saved workspace presets, tab grouping, maximize/restore panel
- Visual pattern to take: none directly; treat as enabling infrastructure
- Do not take: floating/popout panels or arbitrary nesting in V1; enterprise-only assumptions

### 10. Canva

- Product / URL: [Canva](https://www.canva.com/), [editor resource overview](https://resourcepage.my.canva.site/)
- License: proprietary SaaS/application; reference only
- Screen / feature observed: design/template browsing, thumbnail-rich candidate selection, direct canvas editing, asset search
- Good: visual options are understandable before selection; low-friction candidate browsing; real previews outperform abstract labels
- Bad: template and asset discovery can displace the actual document; consumer-oriented upsell and card grids are unsuitable for an all-day planning IDE
- Interaction to take: rendered candidate browsing, quick preview, selected-state clarity
- Visual pattern to take: image-first comparison cards only in Candidate Compare mode
- Do not take: template-first home, content marketplace, large empty onboarding, consumer SaaS chrome

### 11. Apple Keynote

- Product / URL: [Keynote working views](https://support.apple.com/en-ae/guide/keynote/tanae4979928/mac)
- License: proprietary application; reference only
- Screen / feature observed: navigator, slide-only, light table, outline view, object list, Format sidebar
- Good: clean separation of working views; slide-only focus; outline and visual slide remain connected
- Bad: Apple-specific interaction conventions and low information density do not fully suit a Windows-first technical tool
- Interaction to take: mode-specific views without wizard transitions; focus mode; outline/visual cross-navigation
- Visual pattern to take: restrained controls and generous central document focus
- Do not take: platform-specific glass styling or oversized macOS spacing

### 12. Affinity Publisher

- Product / URL: [workspace overview](https://affinity.help/publisher/en-US.lproj/pages/Workspace/atAglance.html)
- License: proprietary application; reference only
- Screen / feature observed: central document view, tools, contextual toolbar, dockable Studio panels, page/master-page management
- Good: professional editorial density; contextual toolbar; role/persona concept groups tools by job
- Bad: many panels remain visible and can overwhelm; persona model is too broad for a one-slide tool
- Interaction to take: contextual tools and saved workspace presets
- Visual pattern to take: editorial neutral chrome and precise page-stage boundary
- Do not take: floating studio panel clutter, print-production complexity

### 13. Adobe InDesign

- Product / URL: [contextual Properties panel](https://helpx.adobe.com/indesign/using/properties-panel.html), [workspace basics](https://helpx.adobe.com/uk/indesign/using/workspace-basics.html)
- License: proprietary commercial application; reference only
- Screen / feature observed: context-aware Properties panel, page/navigation panels, configurable professional workspaces
- Good: frequently used controls appear first; additional controls use persistent progressive disclosure; page and selected-object states produce different inspectors
- Bad: panel taxonomy and print-production depth are excessive; legacy dialogs break workflow continuity
- Interaction to take: selection-specific inspector with remembered disclosure; page/object mode distinction
- Visual pattern to take: compact section headings and information-rich property groups
- Do not take: dialog proliferation, print/prepress features, dense icon-only tool strips

### 14. LibreOffice Impress

- Product / URL: [Impress guide](https://books.libreoffice.org/en/IG262/IG26201-IntroducingImpress.html)
- License: MPL-2.0 / LGPLv3+ project licensing
- Screen / feature observed: Slides pane, Workspace, contextual right Sidebar decks, Navigator of slide objects
- Good: clear three-region presentation editor; sidebar content changes with object selection; Navigator encourages meaningful object names
- Bad: visual styling and toolbar density feel dated; layout and style controls are spread across decks
- Interaction to take: independent export-compatibility reference, named object navigation, contextual sidebar
- Visual pattern to take: none directly beyond familiar presentation structure
- Do not take: toolbar visual language or full office-suite parity target

### 15. Excalidraw

- Product / URL: [Excalidraw](https://github.com/excalidraw/excalidraw)
- License: MIT
- Screen / feature observed: infinite canvas, minimal object tools, contextual property controls, fast keyboard and direct manipulation
- Good: low barrier between intention and manipulation; excellent canvas focus; controls appear close to the task
- Bad: free-form whiteboard semantics and hand-drawn aesthetic are wrong for a precise presentation system
- Interaction to take: low-chrome selection, quick zoom/pan, lightweight contextual actions
- Visual pattern to take: canvas-first focus and sparse persistent toolbar
- Do not take: hand-drawn style, infinite-canvas document model, unconstrained connectors

### 16. diagrams.net / draw.io

- Product / URL: [draw.io](https://github.com/jgraph/drawio), [official terms/license note](https://www.drawio.com/trust/terms-of-use/)
- License: Apache-2.0 source repository
- Screen / feature observed: central diagram canvas, shape palette, contextual format panel, layers, connectors
- Good: explicit connector semantics; shape insertion and format panel are mature; local storage choices are clear
- Bad: enormous stencil catalog and technical-diagram breadth produce toolbar/palette overload
- Interaction to take: connector source/target affordance reference, relation selection and rerouting concepts
- Visual pattern to take: clear distinction between nodes and connectors
- Do not take: stencil marketplace, unrestricted diagram authoring, direct XML workflow

### 17. Blender

- Product / URL: [editor areas](https://docs.blender.org/manual/en/latest/editors/index.html), [UI paradigms](https://developer.blender.org/docs/features/interface/human_interface_guidelines/paradigms/)
- License: GPL-2.0-or-later for core source
- Screen / feature observed: configurable Areas, Editors, Regions, workspaces, non-modal select-then-operate interaction
- Good: the central artifact remains live while surrounding editors change; workspace presets support different jobs; non-blocking panels
- Bad: steep learning curve, dense iconography, and near-limitless layouts are inappropriate for V1
- Interaction to take: role-specific workspace presets and non-modal inspection
- Visual pattern to take: active area emphasis and compact region headers
- Do not take: code, unrestricted area splitting, modal hotkey culture

### 18. Unreal Editor

- Product / URL: [Unreal Editor interface](https://dev.epicgames.com/documentation/unreal-engine/unreal-editor-interface?lang=en-US)
- License: proprietary/source-available under Unreal Engine EULA; reference only
- Screen / feature observed: dominant Level Viewport, World Outliner, contextual Details, Content Drawer, bottom status/tools
- Good: strongest domain-adjacent example of hierarchy ↔ viewport ↔ property synchronization; temporary Content Drawer preserves viewport space
- Bad: very high control density and mode complexity; game-engine terminology would imply capabilities outside scope
- Interaction to take: synchronized hierarchy/canvas/inspector selection, transient asset drawer, resettable workspace
- Visual pattern to take: central artifact dominance and compact technical chrome
- Do not take: ribbon/tool density, 3D viewport controls, engine-style mode proliferation

### 19. Obsidian

- Product / URL: [workspace](https://obsidian.md/help/workspace)
- License: proprietary application; help/source components have separate licenses
- Screen / feature observed: collapsible left/right sidebars, tab groups, split central panes, saved workspaces
- Good: content-first writing surface; workspace state persistence; panels can disappear completely when not needed
- Bad: plugin ecosystems create icon and command inconsistency; note-centric model lacks robust visual selection behavior
- Interaction to take: named workspace presets, collapsible contextual sidebars, persistent tab state
- Visual pattern to take: low-chrome content focus
- Do not take: plugin-driven UI variance, note graph metaphors

### 20. Framer

- Product / URL: [canvas documentation](https://www.framer.com/help/articles/how-to-use-the-canvas/)
- License: proprietary SaaS/application; reference only
- Screen / feature observed: infinite canvas, layers, selection, zoom, direct web-layout editing
- Good: strong canvas navigation and immediate visual feedback; selected object feels physically connected to inspector changes
- Bad: web publishing and responsive layout concepts are outside PowerPoint; AI/site generation could overtake the editor
- Interaction to take: direct manipulation feedback, canvas navigation, quick focus/zoom
- Visual pattern to take: clean selection outlines and compact property controls
- Do not take: site publishing, breakpoint controls, web component model

### 21. Miro

- Product / URL: [Miro toolbars](https://help.miro.com/hc/en-us/articles/360017730553-Toolbars)
- License: proprietary SaaS/application; reference only
- Screen / feature observed: board-centered workspace, creation toolbar, contextual controls, panels and board navigation
- Good: the work surface dominates; temporary tools support quick creation; zoom/pan is approachable
- Bad: board templates, collaboration chrome, and infinite-canvas freedom can obscure precise document structure
- Interaction to take: transient creation tools and low-friction navigation
- Visual pattern to take: canvas-centered tool placement
- Do not take: dashboard/template home, free-form board model, collaboration surface in V1

## Required presentation-system audit

This section answers a narrower engineering question than the UI audit: what can be adopted, what is only a research pattern, and what must be authored for this product. The upstream snapshots below were inspected on the research date; commit hashes are evidence anchors, not dependency pins.

### Oh My PPT: current layout, style-package, and beautify structure

- Sources: [repository](https://github.com/arcsin1/oh-my-ppt), [release notes](https://github.com/arcsin1/oh-my-ppt/releases), [style generator](https://github.com/arcsin1/style-generate-skill)
- Audited snapshots: `oh-my-ppt@73b9720` (2026-08-22) and `style-generate-skill@02c17be` (2026-08-19)
- License: Apache-2.0 for both repositories
- Layout finding: `oh-my-ppt-layout` is a decision skill, not a single template. It asks for message, role, reading path, content shape, density, named pattern/skeleton, height budget, and final width/height audit. Its catalog entries describe input shape, structure recipe, budget rule, and failure signs. Structure is explicitly separated from the chosen style's color, type, shape, and decorative language.
- Style-package finding: a package separates `style.json` metadata, `SKILL.md` visual direction, and a sandboxed `preview.html`; `preview.webp` is optional. Import/write paths validate keys, versions, source kind, preview size, scripts, event handlers, and external resource references, then use atomic replacement. The generator adds controlled taxonomies, overwrite consent, input-size limits, and validation before optional thumbnail capture.
- Page-beautify finding: the current slide's complete HTML and a browser-measured layout audit are read, while the model can save only the inner page fragment. The selected size-specific layout skill is mandatory. The host owns job state, cancellation, meaningful-change detection, one correction retry, validation, history, and atomic temp-file replacement.
- Reuse: catalog-entry anatomy; canvas budgeting; structure/style priority rule; package metadata/provenance/versioning; sandboxed visual preview; atomic job/history pattern.
- Build anew: typed game-planning Visual Grammar; `SlideIR → CompositionPlan → RenderTree`; deterministic candidate enumeration; immutable content facts; renderer-owned geometry; typed critic patches. HTML, Tailwind classes, model-written fragments, and broad session context must never become canonical state.
- Adoption decision: architecture reference first. Any later source-level reuse requires a named exception, Apache attribution/NOTICE review, and proof that it does not introduce HTML-canonical authoring.

### PPT Master: workflow and native editable export

- Sources: [repository](https://github.com/hugohe3/ppt-master), [PowerPoint/SVG mapping](https://github.com/hugohe3/ppt-master/blob/main/docs/powerpoint-svg-mapping.md), [template guide](https://github.com/hugohe3/ppt-master/blob/main/docs/templates-guide.md)
- Audited snapshot: `ppt-master@ebd74d1` (2026-08-25)
- License: MIT
- Workflow finding: the entry skill routes requests into distinct artifact lifecycles, then imposes ordered stages, explicit blocking gates, source ownership, recovery pointers, and append-only run evidence. Author source, derived preview, validation reports, exports, and package-only behavior have separate owners.
- Export finding: authored SVG is compiled to editable DrawingML/native PowerPoint objects within an explicit capability map. `svg_output/` owns visible page design, while preview artifacts do not silently become the export source. The exporter does not infer Masters, Layouts, placeholders, or new visible content. Final-package read-back and reports verify the promised structure.
- Template finding: PPTX import reads OOXML into manifests, stable Master/Layout identifiers, placeholder geometry, extracted assets, layered authoring SVG, complete-page verification SVG, and conversion diagnostics. A confirmation gate precedes reusable-template authoring.
- Reuse: artifact-ownership discipline; capability/fidelity matrix; exporter read-back; dual visual/native verification; separate flat-versus-structured export modes. The SVG-to-DrawingML converter is a benchmark candidate, not an assumed V1 dependency.
- Build anew: the semantic SlideIR, game-planning grammar, deterministic composition engine, shared text-measurement contract, and RenderTree-to-PPTX backend port. The product cannot adopt PPT Master's broad document research, agent-host workflow, multi-slide role system, or hand-authored SVG as its core.
- Adoption decision: benchmark its native converter against PptxGenJS on the one-slide fixture. Reuse code only if it beats the simpler backend on editability and parity without importing the full workflow.

### PptxGenJS

- Sources: [repository](https://github.com/gitbrent/PptxGenJS), [documentation](https://gitbrent.github.io/PptxGenJS/)
- License: MIT
- Finding: its typed APIs create text, shapes, tables, images, charts, and Masters directly as OOXML-compatible PowerPoint objects across Node, Electron, and browsers. It is an exporter library, not an information-design or layout engine.
- Reuse: first V1 `PptxExporter` adapter; native text/shape/image primitives; custom page size; object naming and accessibility metadata where supported.
- Build anew: text measurement, Korean line breaking, composition, collision/overflow validation, SVG/path fallback policy, render parity tests, and the entire AI boundary.
- Adoption decision: recommended first backend because it is narrow, MIT, TypeScript-friendly, and keeps native objects editable. Acceptance still depends on the exporter benchmark; library support is not proof of render parity.

### PPTAgent and its PPTEval

- Sources: [repository](https://github.com/icip-cas/PPTAgent), [paper](https://aclanthology.org/2025.emnlp-main.728/)
- License: MIT
- Finding: PPTAgent analyzes reference presentations for functional slide types and content schemas, then uses selected references to drive edit actions. Its accompanying PPTEval separates Content, Design, and Coherence.
- Reuse: the idea that reference slides should be indexed by functional role/content shape rather than used as undifferentiated screenshots; the separation of content fidelity from design quality.
- Build anew: local reference-asset metadata, retrieval boundaries, typed grammar matching, and game-specific evaluation. Do not reuse its document-to-outline generation, large-model assumptions, Linux service topology, page-copy/edit action language, or whole-deck coherence machinery in V1.
- Adoption decision: research-only for V1. Consider a small role/content-shape retrieval experiment only after deterministic fixtures pass.

### DeepPresenter

- Sources: [project code in PPTAgent](https://github.com/icip-cas/PPTAgent/tree/main/deeppresenter), [paper](https://arxiv.org/abs/2602.22839)
- License: MIT repository; model weights and external services require separate terms review
- Finding: its strongest applicable idea is environment-grounded reflection: inspect rendered artifacts, observe perceptual defects, and revise the artifact instead of relying on textual self-reflection. The current system also adds research, asset creation, sandbox tools, HTML slide authoring, parallel agents, and large context-management machinery.
- Reuse: the epistemic rule behind `Render → Observe → Critique`; critic evidence must cite the actual rendered slide and target a concrete defect.
- Build anew: bounded single-slide critic input, typed findings, whitelisted patches, deterministic revalidation, and the one-revision state machine.
- Adoption decision: borrow the observation principle only. Do not adopt its Researcher/Presenter multi-agent topology, HTML authoring, large context, or open-ended tool loop.

### Microsoft PPT-Eval

- Sources: [benchmark site](https://microsoft.github.io/ppteval/), [repository](https://github.com/microsoft/ppteval)
- License: MIT; Microsoft and third-party trademarks/assets remain separately governed
- Naming note: this is the 2026 computer-use benchmark `PPT-Eval`, not PPTAgent's earlier `PPTEval` presentation-quality evaluator.
- Finding: 120 PowerPoint tasks use task-specific rubrics that grant partial credit, penalize detrimental or unnecessary changes, and return feedback. This is more useful than a single pass/fail score for editable-slide operations.
- Reuse: partial-credit rubric structure; explicit detrimental-change penalties; task-specific evidence; human-correlation mindset.
- Build anew: fixture-level content hashes, geometry gates, editability inspection, candidate diversity checks, Korean typography checks, and actual-render visual questions for game-planning slides.
- Adoption decision: adapt its evaluation philosophy and rubric anatomy. Do not import the hosted explorer, computer-use task corpus, or PowerPoint-automation agent runtime into V1.

### Consolidated adoption boundary

| Project | Adopt now | Research/benchmark only | Explicitly reject as a foundation |
|---|---|---|---|
| Oh My PPT | Pattern anatomy, package safety concepts | Job/history implementation patterns | HTML canonical state and model-written layout code |
| PPT Master | Artifact ownership and fidelity matrix | SVG-to-DrawingML exporter spike | Full routed agent skill and SVG authoring workflow |
| PptxGenJS | First editable PPTX adapter | Feature-specific fallbacks | Treating exporter APIs as layout intelligence |
| PPTAgent | Functional-role/content-shape indexing concept | Later reference retrieval experiment | Content generation and whole-deck agent pipeline |
| DeepPresenter | Render-grounded critique principle | Critic-question comparison | Research/multi-agent/HTML/open-loop architecture |
| PPT-Eval | Partial credit and detrimental-change rubrics | Selected rubric fixtures | Computer-use benchmark runtime as product runtime |

## Design skill audit

### Anthropic frontend-design

- URL: [SKILL.md](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md), [license](https://github.com/anthropics/skills/blob/main/skills/frontend-design/LICENSE.txt)
- License: Apache-2.0
- Take: ground design in the concrete subject; make deliberate art direction; require structural devices to encode real information
- Do not take: web hero/page assumptions, large expressive typography defaults, direct frontend implementation instructions

### Taste Skill

- URL: [repository](https://github.com/leonxlnx/taste-skill), [skill](https://github.com/leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md)
- License: MIT
- Take: brief inference, tunable variance/density, anti-repetition and preflight discipline
- Do not take: marketing-page scope, motion intensity, image-heavy grid requirements, default high variance

### UI UX Pro Max

- URL: [repository](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
- License: MIT
- Take: searchable design knowledge, accessibility checks, stack-aware validation, generated recommendation as a proposal
- Do not take: load the whole catalog into every request, generate product identity from generic industry presets, let recommendation tables become runtime law

## Active References

The final active set is deliberately limited to six.

| Active reference | Assigned responsibility |
|---|---|
| Oh My PPT | Presentation-specific generation/edit/history workflow and actual style preview |
| PowerPoint | Slide mental model, thumbnail navigation, final editability expectations |
| Figma | Canvas selection, layers, inspector, keyboard workflow |
| Onlook | AI plus direct visual editing, checkpoints, selected object/source synchronization |
| VS Code | All-day workbench density, command palette, collapsible findings/history drawer |
| Penpot | Contextual inspector, token semantics, open design-system concepts |

Supporting references:

- Dockview for layout infrastructure
- Unreal Editor for hierarchy/viewport/details synchronization
- InDesign for contextual inspector progressive disclosure
- Canva for actual-image candidate browsing
- Keynote for focus and outline views

## Synthesis rules

- The workspace composition is original; no active reference supplies the complete shell.
- Presentation workflow comes from Oh My PPT and PowerPoint.
- Canvas behavior comes from Figma, Penpot, and Onlook.
- Workbench density and drawers come from VS Code.
- AI is represented as provenance and optional activity, not a dominant chat panel.
- Candidate comparison temporarily adopts a gallery-like layout; normal editing does not.
- Docking is bounded by product presets rather than unrestricted from first launch.
