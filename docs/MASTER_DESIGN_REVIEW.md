# GAME PPT DESIGNER NEXT — Master Design Review

Status: **approval draft / documentation only**  
Date: 2026-08-28  
Production implementation: **not started**

## Product thesis

The planner decides what the game design says. AI interprets that content as visual language. The deterministic program produces the decision accurately and repeatably.

This is not an AI deck generator. It is a one-slide-at-a-time information-design workstation that preserves authored game-planning content and exports editable PowerPoint.

## Required review package

1. Existing repository analysis — [ARCHITECTURE.md](./ARCHITECTURE.md#legacy-repository-assessment)
2. Clean root proposal — [ARCHITECTURE.md](./ARCHITECTURE.md#clean-root-proposal)
3. Package dependency graph — [ARCHITECTURE.md](./ARCHITECTURE.md#package-dependency-graph)
4. Architecture refinement — [ARCHITECTURE.md](./ARCHITECTURE.md)
5. SlideIR Schema draft — [SLIDE_IR.md](./SLIDE_IR.md)
6. First Visual Grammar catalog — [VISUAL_GRAMMAR.md](./VISUAL_GRAMMAR.md)
7. Local AI Provider design — [AI_PROVIDER.md](./AI_PROVIDER.md)
8. Reference Audit, 20 products and 3 design skills — [REFERENCE_AUDIT.md](./REFERENCE_AUDIT.md)
9. Active Reference selection — [REFERENCE_AUDIT.md](./REFERENCE_AUDIT.md#active-references)
10. UX flow draft — [UX_FLOW.md](./UX_FLOW.md)
11. UI design draft — [UI_DESIGN.md](./UI_DESIGN.md)
12. Workspace UI, three directions — [UI_DESIGN.md](./UI_DESIGN.md#workspace-layout-alternatives)
13. Candidate Compare UI, two directions — [UI_DESIGN.md](./UI_DESIGN.md#candidate-compare-alternatives)
14. Critic UI, two directions — [UI_DESIGN.md](./UI_DESIGN.md#critic-mode-alternatives)
15. Static prototype plan — [UI_DESIGN.md](./UI_DESIGN.md#static-prototype-plan)
16. V1 fixtures — [EVAL.md](./EVAL.md#v1-fixture-set)
17. Evaluation plan — [EVAL.md](./EVAL.md)
18. Implementation roadmap — [ROADMAP.md](./ROADMAP.md)
19. Expected risks — [ROADMAP.md](./ROADMAP.md#risk-register)
20. External dependencies and licenses — [ARCHITECTURE.md](./ARCHITECTURE.md#dependency-and-license-candidates)

Supporting documents:

- [PRD.md](./PRD.md)
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- [MEMORY.md](./MEMORY.md)

## Decisions proposed for approval

1. Keep the current repository as frozen legacy and prohibit legacy imports by default.
2. Use separate canonical artifacts for `SlideIR`, `CompositionPlan`, and `RenderTree`.
3. Make the deterministic core independently usable with no model or network.
4. Make Local AI the first provider and keep all AI outputs advisory and schema-bound.
5. Build only the single mechanism-slide vertical slice before any deck workflow.
6. Use actual rendered PNGs for candidate comparison and visual critique.
7. Start static UI prototyping only after the architecture, UX flow, UI direction, SlideIR, and grammar are approved.

## Approval gates

### Gate A — architecture review

- Clean root and import boundaries
- Package dependency direction
- SlideIR / CompositionPlan / RenderTree separation
- Local AI capability and failure policy

### Gate B — product design review

- Workspace flow
- One of three visual directions
- One Workspace layout, one Candidate Compare layout, one Critic layout
- Design-system density and color direction

### Gate C — static prototype review

- Seven static screens rendered at real desktop sizes
- Screenshot-based visual critique
- User selection and revisions recorded

Production implementation begins only after Gate C.

