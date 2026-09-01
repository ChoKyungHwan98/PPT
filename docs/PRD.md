# Product Requirements Document

## Product definition

GAME PPT DESIGNER NEXT transforms already-authored game-planning material into professionally structured, readable, and visually persuasive presentation/document artifacts that can be presented, submitted, and shared.

The product does not invent the game design. Its job is to improve how the game design is understood.

The immediate product is a game-planning presentation/document designer whose primary delivery artifact is a high-fidelity PDF for portfolio, submission, and sharing. PowerPoint is a later compatibility format, not the canonical source, mandatory authoring mental model, or V1 design boundary. The canonical chain is authored source → SlideIR → CompositionPlan → RenderTree.

Priority order:

1. Logic preservation
2. Speed of comprehension
3. Information clarity
4. Legibility
5. Visual hierarchy
6. Aesthetic quality

## Primary user

A game planner who already has rules, numbers, relationships, flows, tables, and intent, but loses substantial time converting those decisions into an effective presentation or document.

The expected use pattern is a serious desktop tool used for hours, not a short-lived prompt-and-download flow.

## Product principles

- The user owns content and logic.
- AI acts only as Information Designer, Visual Designer, and Visual Critic.
- AI advises; deterministic code executes.
- Every number, condition, unit, and connector must be traceable to authored source.
- The product works when all AI providers are disabled.
- The current work artifact—source, semantic structure, rendered page, candidate set, or review evidence—must dominate its task surface; application chrome must not dominate it.
- The UI is an authoring and review environment, not a dashboard, chatbot wrapper, or automatic clone of a PowerPoint/Figma/IDE workbench.
- HTML, PDF, PPTX, and PNG outputs consume the same versioned SlideIR → CompositionPlan → RenderTree chain.
- Output backend capabilities may affect fidelity or editability, but may never silently alter authored facts or semantic relations.
- Every revision is bounded, typed, reversible, and recorded.
- A fixed house style is not the product goal. Different content may require different composition, typography, density, and graphic language.
- Reference use is retrieval and decomposition, not copying. Every reference keeps provenance and usage metadata.
- User pairwise choices influence future retrieval and ranking in the same semantic context without becoming permanent global style rules.

## V1 vertical slice

Input: one Korean game-planning page describing a mechanism.

Reference fixture:

> 플레이어가 광역 공격을 3회 회피하면 시간 파편을 획득한다.  
> 시간 파편을 사용하면 보스의 시간이 5초간 정지된다.  
> 이때 BREAK 상태가 되고 받는 피해가 50% 증가한다.

Current one-page learning acceptance flow:

```text
Input
  → SlideIR
  → reference retrieval brief
  → two distinct CompositionPlans from different reference/composition hypotheses
  → actual A/B PNG renders
  → deterministic validation
  → optional Visual Critic observing the actual renders
  → maximum one revision
  → user A/B, tie, or reject-both decision
  → contextual preference record
  → selected one-page PDF + HTML presentation page
  → PDF reopen, text, font, geometry, and raster comparison
```

Editable PPTX is not part of the first vertical-slice gate. It remains a later independent backend and may not restrict the visual quality of PDF/HTML output.

## V1 supported content

- Heading and supporting text
- Mechanic steps and causal relationships
- Conditions, states, results, and modifiers
- Key-value and metric values
- Simple table
- Simple flow and connectors
- One source image with annotations

## V1 non-goals

- Whole-deck generation
- Outline or story generation
- External research
- Arbitrary content rewriting
- Animation, video, or audio
- AI image generation
- Figma or Canva import
- Full PowerPoint editor replacement
- SmartArt
- Fine-tuning
- Multi-agent debate
- Full RAG
- Arbitrary HTML, CSS, SVG, or OOXML generation by a model
- Editable PPTX compatibility in the first vertical slice
- Unbounded web crawling or redistribution of third-party reference files

## V1 PDF proof definition

- Text is selectable and extractable.
- Fonts are embedded or subset.
- Vector text, rules, diagrams, and tables remain vector where the renderer supports them.
- Original bitmap assets retain sufficient effective resolution.
- A page may not be silently flattened into one full-page bitmap.
- The reopened PDF raster matches the approved reference render within defined tolerances.
- Page size and margins come from an explicit document/presentation profile, not PowerPoint presets.

## Success criteria

- Authored text and numeric facts are preserved exactly in V1.
- A/B candidates come from different composition/reference hypotheses, not palette-only variants.
- No severe overflow, collision, or out-of-bounds finding.
- Local AI unavailability does not block render or export.
- The Visual Critic observes actual rendered PNGs.
- The exported PDF reopens, preserves extractable text and embedded fonts, and renders without severe drift.
- Every generated output can be traced to the same selected CompositionPlan and RenderTree revision.
- A planner can identify the primary message within three seconds in human review.
- The user's pairwise decision and reason change future retrieval/ranking for relevant content without globally fixing one style.
