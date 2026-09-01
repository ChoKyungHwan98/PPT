# AI Provider Design

## Boundary

AI is optional and advisory. It may:

1. Interpret authored content into a SlideIR proposal
2. Suggest a grammar pattern
3. Suggest semantic role mapping
4. Suggest emphasis priority
5. Critique actual rendered images
6. Suggest a whitelisted revision patch
7. Structure a user's A/B, tie, or reject-both reason into preference metadata

AI may not generate source facts, rewrite V1 text, generate coordinates, write CSS/SVG/OOXML, access the repository, receive the whole conversation, or run an unbounded revision loop.

## Provider interface

```ts
type ProviderKind = 'local' | 'openrouter' | 'openai' | 'anthropic'

interface AiProvider {
  readonly id: string
  readonly kind: ProviderKind

  probeCapabilities(): Promise<ProviderCapabilities>

  generateStructured<T>(
    request: StructuredAiRequest,
    schema: JsonSchema<T>
  ): Promise<AiResult<T>>

  interpretSlide(request: InterpretSlideRequest): Promise<AiResult<SlideIRProposal>>
  proposeComposition(
    request: ProposeCompositionRequest
  ): Promise<AiResult<CompositionSuggestion[]>>
  critiqueRender(request: CritiqueRenderRequest): Promise<AiResult<CritiqueReport>>
  structurePreference(
    request: StructurePreferenceRequest
  ): Promise<AiResult<PairwisePreferenceReason>>
}
```

```ts
type ProviderCapabilities = {
  structuredOutput: 'native-json-schema' | 'grammar' | 'json-only' | 'none'
  imageInput: boolean
  maxImages?: number
  maxContextTokens?: number
  promptCaching: boolean
  seed: boolean
  usageReporting: boolean
  localExecution: boolean
  endpointFamily: 'ollama' | 'openai-compatible' | 'anthropic' | 'native'
}
```

Capability results are runtime facts, not assumptions derived from the provider name.

## Local-first adapters

### Ollama adapter

- Prefer native `/api/chat` when its `format` JSON Schema and `images` semantics provide the strongest capability match.
- Support `/v1/chat/completions` as an alternate profile.
- Probe model metadata and issue a tiny schema/vision conformance test before enabling a role.
- Validate every response again with the product schema.

Ollama documents JSON Schema structured output, including vision plus structured output, but the feature belongs to the selected model as well as the runtime. [Structured Outputs](https://docs.ollama.com/capabilities/structured-outputs), [Vision](https://docs.ollama.com/capabilities/vision)

### LM Studio adapter

- Use the OpenAI-compatible `/v1/chat/completions` profile.
- Probe `response_format: json_schema`, image input, model context, and server health.
- Do not assume that all loaded models follow the schema equally well.

LM Studio documents JSON Schema output through its local OpenAI-compatible endpoint. [LM Studio Structured Output](https://lmstudio.ai/docs/developer/openai-compat/structured-output)

### llama.cpp adapter

- Use the OpenAI-compatible server profile.
- Treat multimodal support as capability-probed because the server documentation still characterizes parts of it as experimental.
- Fail closed if the response does not validate, even when the server returned HTTP 200.
- Avoid complex JSON Schema features until a conformance suite passes for the installed server version.

The llama.cpp server supports OpenAI-style chat, image input for multimodal models, and schema-constrained responses, but external validation remains mandatory. [llama.cpp server](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)

### Generic local OpenAI-compatible adapter

- Loopback endpoints only by default.
- Non-loopback custom endpoints require explicit remote-upload consent.
- Provider profile declares supported endpoint, response format, image encoding, and usage fields.
- No automatic assumption that OpenAI-compatible means feature-compatible.

## Role profiles

One capable multimodal local model may perform all roles with separate prompt profiles.

### Information Designer

Input:

- One authored text payload
- Source span table
- SlideIR JSON Schema
- Relevant intent definitions only

Output: `SlideIRProposal` with confidence and ambiguities.

### Visual Designer

Input:

- Compact SlideIR digest
- Eligible grammar pattern descriptors, maximum six
- Design controls
- Top-k provenance-checked reference metadata and necessary thumbnails
- Reference Retrieval Brief

Output: pattern IDs, role mapping, emphasis ordering, and reasons. No geometry.

### Visual Critic

Input:

- Actual A/B PNG renders in one request
- Candidate IDs and compact decision summaries
- Deterministic findings
- Ten-question visual rubric

Output: object-referenced findings, ranking, and allowed patch suggestions. It cannot propose new copy.

If the local model has structured text but no vision, interpretation and composition remain available while AI visual critique is disabled. The deterministic Rule Critic continues to function.

## Whitelisted revision patches

```ts
type RevisionPatch =
  | { op: 'switch-pattern'; patternId: string }
  | { op: 'remap-role'; blockId: string; role: SemanticRole }
  | { op: 'adjust-emphasis'; blockId: string; level: 1 | 2 | 3 }
  | { op: 'adjust-zone-weight'; zoneId: string; delta: number }
  | { op: 'change-representation'; blockId: string; representation: string }
  | { op: 'request-user-decision'; reason: string; sourceSpanIds: string[] }
```

Arbitrary coordinate or style-object patches are rejected.

## Context and caching

Application cache key:

```text
task
+ provider/profile/model
+ prompt profile version
+ output schema version
+ SlideIR/content hash
+ grammar fragment hashes
+ reference IDs
+ rendered image hashes
+ generation controls
```

Rules:

- Identical artifact hashes never trigger a new call.
- Stable instructions and schemas precede dynamic slide data.
- Context artifacts are assembled by explicit allowlist.
- No repository path, full chat transcript, or unrelated slide is accepted by request constructors.
- Raw model output is stored only as a hash by default; validated structured output is the durable artifact.

## V1 call budget

| Task | Maximum |
|---|---:|
| Interpret | 1 |
| Composition suggestion | 1, optional |
| Visual critique | 1 |
| Revision | 1 |
| Preference reason structuring | 1, optional |

Syntax-only JSON repair may run locally without another model call. A semantic retry consumes the task's single retry budget and is visible in AI Activity.

## Privacy and safety

- Local endpoints default to `127.0.0.1`/`localhost` allowlist.
- No model receives filesystem tools.
- Remote adapters require explicit provider setup and upload consent.
- Credentials are stored in the OS credential store, never SlideIR or UI state.
- Requests and costs are visible in a collapsible AI Activity drawer.
- Cancel and deadline are supported for every request.
- A failed or unavailable provider degrades to deterministic behavior.

## Future cloud adapters

- OpenRouter: explicit model, parameter-capability enforcement, no paid fallback by default, optional ZDR routing.
- OpenAI: native structured output, image input, and prompt-prefix caching.
- Anthropic: native Messages structured output, vision blocks, and prompt cache controls.

Cloud adapters use the same task contracts but maintain provider-native request builders rather than one lowest-common-denominator payload.
