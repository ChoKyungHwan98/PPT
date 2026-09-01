# SlideIR Draft

Schema version: `0.1-draft`  
Scope: one authored game-planning slide

## Boundary

SlideIR records what is being communicated. It must not contain:

- CSS or HTML
- Pixel, inch, EMU, or absolute coordinates
- Palette or concrete color
- Font family or font size
- PPTX API calls or OOXML
- SVG paths
- Layout pattern coordinates
- Renderer-specific properties

## Draft type model

```ts
type SlideIR = {
  schemaVersion: '0.1'
  slideId: string
  locale: 'ko-KR'
  pagePreference: {
    mode: 'document' | 'presentation' | 'auto'
    preferredProfile?: 'a4-portrait' | 'a4-landscape' | 'screen-16:9'
  }

  source: {
    kind: 'user-authored'
    rawText: string
    contentHash: string
    spans: SourceSpan[]
  }

  intent: {
    kind: SlideIntent
    communicationGoal: ContentRef
    primaryMessage: ContentRef
    primaryFocusBlockId?: string
  }

  domain: {
    topic: string
    facets: GameDesignFacet[]
  }

  blocks: SemanticBlock[]
  relations: SemanticRelation[]
  assetNeeds: AssetRequirement[]

  constraints: {
    maxSlideCount: 1
    primaryOutput: 'pdf'
    selectableTextRequired: true
    editablePptxRequired: false
    contentPolicy: 'verbatim'
    numberPolicy: 'source-only'
    preserveOrder: boolean
    lockedSpanIds: string[]
  }

  interpretation: {
    author: 'deterministic-parser' | 'ai-proposal' | 'user'
    modelRunId?: string
    confidence?: number
    ambiguities: Ambiguity[]
  }
}
```

`pagePreference` expresses the user's delivery context, not fixed geometry. Exact page boxes and pixel dimensions are resolved later by the selected CompositionPlan and output profile. SlideIR therefore does not inherit PowerPoint's 16:9 canvas as a semantic default.

## Source fidelity

```ts
type SourceSpan = {
  id: string
  start: number
  end: number
  text: string
  checksum: string
}

type ContentRef = {
  text: string
  sourceSpanIds: string[]
  locked: boolean
}
```

V1 requires every visible text atom, value, unit, condition label, and relation label to resolve to at least one source span. `ContentRef.text` must be an exact source substring or a deterministic concatenation whose transform is recorded. V1 does not permit paraphrasing.

## Intent

```ts
type SlideIntent =
  | 'mechanism'
  | 'comparison'
  | 'state-transition'
  | 'timeline'
  | 'boss-phase'
  | 'loop'
  | 'resource-flow'
  | 'hierarchy'
  | 'data-highlight'
  | 'table-summary'
  | 'ui-annotation'

type GameDesignFacet =
  | 'combat'
  | 'controls'
  | 'progression'
  | 'economy'
  | 'balance'
  | 'content'
  | 'ui-ux'
  | 'live-operations'
  | 'validation'
```

## Semantic blocks

```ts
type SemanticRole =
  | 'primary'
  | 'trigger'
  | 'input'
  | 'process'
  | 'state'
  | 'result'
  | 'modifier'
  | 'evidence'
  | 'constraint'
  | 'exception'
  | 'context'

type BlockBase = {
  id: string
  kind: string
  role: SemanticRole
  importance: 1 | 2 | 3 | 4 | 5
  sourceSpanIds: string[]
  order: number
  parentId?: string
  keepTogether?: boolean
}

type SemanticBlock =
  | HeadingBlock
  | ParagraphBlock
  | BulletGroupBlock
  | MetricBlock
  | KeyValueBlock
  | TableBlock
  | MechanicStepBlock
  | StateBlock
  | TimelineEventBlock
  | BossPhaseBlock
  | ResourceNodeBlock
  | HierarchyNodeBlock
  | UiRegionBlock
  | ExceptionBlock
  | TestCriterionBlock
```

Representative block shapes:

```ts
type MechanicStepBlock = BlockBase & {
  kind: 'mechanic-step'
  label: ContentRef
  detail?: ContentRef
}

type StateBlock = BlockBase & {
  kind: 'state'
  name: ContentRef
  description?: ContentRef
}

type MetricBlock = BlockBase & {
  kind: 'metric'
  label: ContentRef
  value: ContentRef
  unit?: ContentRef
}

type TableBlock = BlockBase & {
  kind: 'table'
  columns: ContentRef[]
  rows: ContentRef[][]
}

type BossPhaseBlock = BlockBase & {
  kind: 'boss-phase'
  label: ContentRef
  threshold: ContentRef
  behaviors: ContentRef[]
}

type UiRegionBlock = BlockBase & {
  kind: 'ui-region'
  assetId: string
  regionLabel: ContentRef
  explanation: ContentRef
}
```

## Semantic relations

```ts
type RelationType =
  | 'sequence'
  | 'causes'
  | 'enables'
  | 'consumes'
  | 'produces'
  | 'transitions-to'
  | 'depends-on'
  | 'compares-with'
  | 'part-of'
  | 'exception-of'
  | 'annotates'

type SemanticRelation = {
  id: string
  fromBlockId: string
  toBlockId: string
  type: RelationType
  label?: ContentRef
  sourceSpanIds: string[]
}
```

A rendered connector requires one relation ID. Decorative arrows are prohibited.

## Asset requirements

```ts
type AssetRequirement = {
  id: string
  role: 'source-image' | 'screenshot' | 'icon' | 'reference-only'
  purpose: string
  required: boolean
  sourceUri?: string
  contentHash?: string
  provenance?: {
    author?: string
    license?: string
    sourceUrl?: string
  }
}
```

## Interpretation uncertainty

```ts
type Ambiguity = {
  id: string
  sourceSpanIds: string[]
  question: string
  candidates: string[]
  blocking: boolean
}
```

The interpreter must expose uncertainty instead of inventing a relationship. Blocking ambiguities stop composition until the user resolves them.

## Example

```json
{
  "schemaVersion": "0.1",
  "slideId": "mechanism-time-break-01",
  "locale": "ko-KR",
  "format": { "aspectRatio": "16:9" },
  "intent": {
    "kind": "mechanism",
    "communicationGoal": {
      "text": "시간 파편을 사용해 직접 BREAK를 만든다",
      "sourceSpanIds": ["s2", "s3"],
      "locked": true
    },
    "primaryMessage": {
      "text": "시간 파편을 사용하면 BREAK 상태가 된다",
      "sourceSpanIds": ["s2", "s3"],
      "locked": true
    },
    "primaryFocusBlockId": "break-state"
  },
  "blocks": [
    { "id": "dodge", "kind": "mechanic-step", "role": "trigger", "order": 1 },
    { "id": "fragment", "kind": "resource-node", "role": "input", "order": 2 },
    { "id": "freeze", "kind": "mechanic-step", "role": "process", "order": 3 },
    { "id": "break-state", "kind": "state", "role": "primary", "order": 4 },
    { "id": "damage", "kind": "metric", "role": "modifier", "order": 5 }
  ],
  "relations": [
    { "id": "r1", "fromBlockId": "dodge", "toBlockId": "fragment", "type": "produces" },
    { "id": "r2", "fromBlockId": "fragment", "toBlockId": "freeze", "type": "enables" },
    { "id": "r3", "fromBlockId": "freeze", "toBlockId": "break-state", "type": "transitions-to" },
    { "id": "r4", "fromBlockId": "break-state", "toBlockId": "damage", "type": "causes" }
  ]
}
```

The example omits repetitive required fields for readability; the executable schema will not.

## Validation gates

- Every block and relation ID is unique.
- Every source span checksum matches the raw source.
- Every numeric atom exists verbatim in its referenced span.
- Every relation endpoint exists.
- `primaryFocusBlockId`, if present, identifies exactly one block.
- Cycles are allowed only for loop grammars.
- `contentPolicy` is `verbatim` in V1.
- No renderer, style, or coordinate field is accepted by the schema.
