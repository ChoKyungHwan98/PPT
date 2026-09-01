# Output Architecture Review

## Decision status

**Approved on 2026-08-28; priority updated on 2026-08-29.** C Multi-backend remains the target architecture, but the first product proof is now PDF-first. Editable PPTX is deferred from the vertical-slice gate and may not constrain page format or visual quality.

제품의 canonical source와 사용자 목적을 다음처럼 분리한다.

- **목적:** 게임 기획의 논리와 정보를 효과적인 presentation/document로 시각 설계하고 발표·제출·공유하게 한다.
- **Canonical semantic state:** authored source + `SlideIR`.
- **Canonical design decision:** selected `CompositionPlan`과 그 versioned parameters.
- **Canonical render intent:** 특정 revision에 대해 완전히 resolve된 immutable `RenderTree`.
- **Outputs:** PDF proof, HTML presentation, PNG evidence, and later editable PPTX compatibility. 어느 output도 semantic source 자체가 아니다.

`RenderTree`는 CSS DOM도 OOXML tree도 아니다. Geometry, typography, paint, clipping, z-order, relation, source link를 typed primitive로 표현하며 각 backend가 읽는다.

## External evidence

- [reveal.js](https://revealjs.com/)는 HTML/browser runtime을 presentation의 본체로 두고 PDF를 지원하지만 native PPTX를 core로 만들지 않는다.
- [Slidev](https://sli.dev/guide/exporting.html)는 browser presentation/SPA, PDF, PNG, PPTX를 제공한다. 공식 문서상 PPTX의 slide는 image이므로 text가 selectable/editable하지 않다.
- [Marp CLI](https://github.com/marp-team/marp-cli)는 Markdown에서 HTML/PDF/PPTX/images를 만든다. 기본 PPTX는 pre-rendered page이고 editable PPTX는 experimental이며 복잡한 style에서 fidelity가 낮아질 수 있다고 명시한다.
- [PPTist](https://github.com/pipipi-pikachu/PPTist)와 [Casual Slides](https://github.com/CasualOffice/slides)는 native-ish object editing과 PPTX round-trip을 우선하는 대신 PowerPoint-shaped canvas, object model, toolbar 범위가 커진다.
- [Oh My PPT](https://github.com/arcsin1/oh-my-ppt)는 HTML authoring result에서 PDF/PNG/PPTX/HTML/MP4를 내보내지만 HTML→editable PPTX fidelity 개선을 별도 exporter 문제로 계속 다룬다.

결론은 단순하다. **Browser visual freedom, native PowerPoint editability, 모든 format의 동일 fidelity는 한 변환 경로에서 자동으로 동시에 얻어지지 않는다.**

## A. PPTX-first

### Definition

PowerPoint object model과 slide geometry를 canonical render/design state에 가깝게 두고, application preview와 다른 output을 PPTX 표현 가능 범위에 맞춘다.

```text
SlideIR
  → PPTX-shaped composition/object model
  → PPTX
  → PowerPoint/LibreOffice render
  → PDF / PNG
```

### Evaluation

| Axis | Assessment |
|---|---|
| Design freedom | **중간–낮음.** Native text/shape/chart/table 범위에서는 안정적이지만 browser composition, complex clipping/effects, interactive presentation을 제한한다. |
| Editability | **가장 높음.** Mapping이 성공한 object는 PowerPoint에서 직접 수정할 수 있다. |
| Compatibility | **높음.** 조직의 PowerPoint workflow, email, LMS, applicant submission과 잘 맞는다. Font/version/theme 차이는 여전히 존재한다. |
| PDF quality | **높을 수 있으나 환경 종속.** PowerPoint가 있으면 좋지만 headless/cross-platform reproducibility가 약해진다. |
| Presentation convenience | **PowerPoint 환경에서 높음.** Web share, embedded interactive content, link-only distribution은 약하다. |
| Development complexity | **초기 중간, 품질 목표에서는 높음.** OOXML/native object mapping, text wrap calibration, import/export parity가 product architecture를 지배한다. |
| PowerPoint fallback | 이미 primary path다. 실패 시 image flattening 또는 feature downgrade가 필요하지만 canonical과 fallback 경계가 흐려질 수 있다. |

### Main advantage

Editable PPTX가 절대적 1순위인 corporate automation tool에는 가장 직접적이다.

### Main failure for this product

사용자 목적을 “PowerPoint file 제작”으로 다시 축소하고 authoring UX를 PowerPoint object editor로 끌어당긴다. HTML presentation과 document output은 secondary conversion이 되고, Visual Grammar가 exporter capability의 교집합에 갇힐 위험이 크다.

## B. HTML/RenderTree-first + PDF + optional PPTX

### Definition

Browser renderer를 primary visual truth로 두고 HTML presentation, PDF, PNG를 같은 path에서 만든다. PPTX는 변환 또는 compatibility export다.

```text
SlideIR + CompositionPlan
  → RenderTree
  → HTML/SVG browser render
  ├─ HTML presentation
  ├─ browser PDF
  ├─ PNG
  └─ optional PPTX conversion
```

여기서 **HTML DOM을 canonical state로 저장하는 방식은 포함하지 않는다.** Canonical은 여전히 typed RenderTree이고, HTML은 primary backend다.

### Evaluation

| Axis | Assessment |
|---|---|
| Design freedom | **매우 높음.** Web typography, SVG, clipping, filters, responsive presentation runtime을 사용할 수 있다. |
| Editability | **Application 안에서는 높고 PowerPoint에서는 낮음.** PPTX를 image로 만들면 visual fidelity는 유지되지만 text/object editability를 잃는다. |
| Compatibility | **Browser/PDF/PNG에서 높음.** PowerPoint-native workflow는 optional exporter 품질에 따라 달라진다. |
| PDF quality | **높음.** Controlled browser/font embedding/print profile로 reproducible vector-heavy PDF를 만들 수 있다. Raster asset과 unsupported effect는 별도 검증이 필요하다. |
| Presentation convenience | **매우 높음.** Link/package presentation, fullscreen, presenter runtime, interaction을 직접 제공할 수 있다. |
| Development complexity | **초기 중간.** 실제 renderer와 PDF/PNG path를 공유할 수 있다. Editable PPTX를 나중에 붙이면 별도 parity problem이 남는다. |
| PowerPoint fallback | Full-slide image PPTX는 쉽지만 editable이 아니다. HTML→native conversion은 capability loss와 text reflow를 명시적으로 처리해야 한다. |

### Main advantage

가장 빠르게 높은 visual freedom과 presentation/share quality를 얻는다.

### Main failure for this product

Editable PPTX가 “optional conversion”로 밀리면서 기존 vertical slice의 compatibility promise를 약화시킬 수 있다. Browser output이 사실상 canonical로 굳으면 Phase 0에서 거부한 HTML-canonical architecture로 회귀할 위험도 있다.

## C. Multi-backend — `RenderTree → HTML / PDF / PPTX / PNG`

### Definition

Format-neutral RenderTree와 backend capability profile을 계약으로 두고 각 output을 sibling backend로 만든다.

```text
Authored source
  → SlideIR
  → selected CompositionPlan
  → immutable RenderTree
  ├─ HTML Presentation Backend → package / hosted artifact
  ├─ PDF Backend              → PDF
  ├─ PNG Backend              → PNG
  └─ PPTX Backend             → native editable PPTX where supported
                                 + explicit downgrade report
```

HTML과 PDF가 PPTX에서 파생되지 않고, PPTX도 HTML DOM을 역변환하지 않는다. 모든 backend는 같은 object ID, geometry, source link, typography role을 읽는다.

### Evaluation

| Axis | Assessment |
|---|---|
| Design freedom | **높음.** RenderTree는 format-neutral이며 output profile별 capability를 적용한다. 모든 output 동시 보장을 요구하면 intersection subset으로 제한될 수 있으므로 profile을 구분해야 한다. |
| Editability | **Application에서 가장 일관됨.** Canonical state는 app에서 수정된다. PPTX backend가 지원하는 text/shape/connector/table은 native editable object로 export한다. |
| Compatibility | **가장 넓음.** Browser, print/PDF, Office, image distribution을 모두 cover한다. Backend별 validation과 downgrade report가 필수다. |
| PDF quality | **높음.** PDF-specific vector/font/metadata path를 검증할 수 있고 browser print에만 종속될 필요가 없다. Vertical slice에서는 controlled SVG/browser PDF도 가능하다. |
| Presentation convenience | **높음.** HTML runtime이 first-class이며 PowerPoint presentation도 compatibility path로 유지한다. |
| Development complexity | **가장 높음.** 여러 renderer, capability matrix, backend parity test, artifact manifest를 유지해야 한다. |
| PowerPoint fallback | Native editable export, supported-subtree raster fallback, clearly labeled full-slide visual-fidelity PPTX를 분리할 수 있다. 어떤 fallback도 silent하지 않다. |

### Main advantage

제품 목적과 file format을 분리하면서도 editable PPTX를 포기하지 않는다. UX가 PowerPoint-shaped object editor가 될 필요가 없고, presentation/document distribution도 first-class가 된다.

### Main risk

“모든 format에서 모든 effect를 동일하게”라는 무제한 promise를 하면 개발 범위가 폭발한다. 반드시 output profile과 capability policy가 필요하다.

## Comparison summary

| Criterion | A PPTX-first | B HTML/RenderTree-first | C Multi-backend |
|---|---|---|---|
| Design freedom | Medium–low | Very high | High, profile-dependent |
| App editability | Medium–high | High | High |
| Native PPTX editability | Highest | Low / optional | High for supported primitives |
| Office compatibility | Highest | Low–medium | High |
| HTML presentation | Secondary | First-class | First-class |
| PDF/PNG consistency | Office-render dependent | Strong | Strongest with backend tests |
| Initial development cost | Medium | Lowest for visual slice | Highest architecture cost |
| Long-term product fit | Low–medium | Medium–high | Highest |
| Main trap | Product becomes PowerPoint editor | PPTX becomes flattened afterthought | Backend scope explosion |

## Recommendation

### Approved C: Multi-backend, implemented in renderer-first sequence

Architecture는 C로 유지한다. 구현 순서는 PDF 제출 품질을 가장 먼저 증명하도록 browser/SVG reference renderer와 PDF/PNG path부터 시작한다.

1. `SlideIR`는 source-linked semantic truth다.
2. `CompositionPlan`은 선택 가능한 design decision이며 CSS/PPTX field를 포함하지 않는다.
3. `RenderTree`는 exact geometry/typography/paint를 resolve하지만 backend-specific code를 포함하지 않는다.
4. HTML/PDF/PNG/PPTX는 독립 backend다.
5. Candidate와 Critic은 output file이 아니라 same revision의 actual RenderTree render를 관찰한다.
6. Export는 backend별 `CapabilityReport`와 `ValidationReport`를 반환한다.

Editable PPTX는 장기 호환 기능으로 남지만 첫 vertical slice의 acceptance test는 아니다. PDF/HTML 설계를 PowerPoint가 표현할 수 있는 교집합으로 제한하지 않는다.

## Output profiles

Output format과 design capability를 동일시하지 않기 위해 profile을 둔다.

### 1. HTML Presentation

- Browser fullscreen presentation
- Presenter notes/runtime hooks
- Link 또는 packaged offline artifact
- Future animation/interaction capability
- Canonical project를 포함하지 않는 distribution artifact

### 2. PDF Publication

- Fixed visual fidelity
- Embedded/subset fonts and document metadata
- Presentation PDF와 document PDF profile을 장기적으로 분리 가능
- Print/submit/archive 목적
- **V1 primary delivery and acceptance artifact**

### 3. PNG Render

- Exact actual-render evidence
- Candidate/critic/cache/eval과 공유
- Page image, thumbnail, social/document embedding 목적
- Editability 없음이 명확함

### 4. Editable PPTX Compatibility

- Live text, native shapes, connectors, tables where supported
- PowerPoint text wrapping calibration
- Unsupported effect는 object/subtree 단위 downgrade
- Export report와 PowerPoint render comparison 필수
- Later compatibility milestone에 포함

### 5. Visual-fidelity PPTX fallback

- PowerPoint에서 발표해야 하지만 native mapping이 불가능한 경우에만 별도 option으로 제공 가능
- Full-slide 또는 subtree rasterization을 사용한다.
- **Editable PPTX라고 표시하지 않는다.**
- Default나 silent fallback으로 사용하지 않는다.

## Backend capability contract

```ts
type OutputTarget = 'html' | 'pdf' | 'png' | 'pptx-editable' | 'pptx-fidelity'

type BackendCapability = {
  target: OutputTarget
  supportedNodeKinds: string[]
  supportedTextFeatures: string[]
  supportedPaintFeatures: string[]
  supportedEffects: string[]
  supportsAnimation: boolean
  supportsNativeEditing: boolean
}

type OutputFinding = {
  objectId: string
  severity: 'info' | 'warning' | 'error'
  code: string
  message: string
  resolution: 'native' | 'simplified' | 'rasterized-subtree' | 'rejected'
}

type OutputArtifactManifest = {
  projectHash: string
  slideIrHash: string
  compositionPlanHash: string
  renderTreeHash: string
  backendVersion: string
  target: OutputTarget
  artifactHash: string
  findings: OutputFinding[]
}
```

Rules:

- Backend는 source content를 변경하지 않는다.
- Backend는 geometry를 다시 “디자인”하지 않는다. 필요한 text reflow tolerance는 명시된 calibration contract 안에서만 허용한다.
- Unsupported feature를 조용히 삭제하지 않는다.
- `pptx-editable`에서 whole-slide rasterization은 error다.
- PDF/PNG/HTML/PPTX artifacts는 같은 RenderTree hash를 기록한다.
- 각 artifact는 actual output을 다시 열거나 render하여 overflow, collision, missing font, missing object를 검증한다.

## PowerPoint fallback policy

PowerPoint compatibility는 세 단계로 명시한다.

1. **Native editable mapping:** supported text, shape, connector, table을 native object로 쓴다.
2. **Localized visual downgrade:** native로 표현할 수 없는 effect만 단순화하거나 isolated subtree로 rasterize한다. 사용자에게 object-level finding을 보여준다.
3. **Visual-fidelity PPTX:** 사용자가 명시적으로 선택한 경우에만 full-page render를 PPTX에 넣는다. 이 artifact는 발표 호환용이며 editable acceptance를 통과한 것으로 보지 않는다.

Native mapping이 severe finding 없이 가능하지 않으면 `pptx-editable` export는 fail closed한다. PDF/HTML/PNG가 성공했다고 editable PPTX 성공으로 간주하지 않는다.

## Vertical slice impact

첫 vertical slice는 한 장의 PDF-first A/B learning loop다.

```text
Authored game-planning content
  → SlideIR
  → Reference Retrieval Brief
  → distinct composition hypotheses A/B
  → RenderTree + actual PNG renders
  → Visual Critic
  → A/B, tie, or reject-both decision
  → contextual preference record
  → HTML presentation page
  → PDF page
```

PNG는 observation/eval artifact, HTML은 presentation artifact, PDF는 submission/share artifact다. Editable PPTX는 이 loop가 품질을 증명한 이후 별도 backend milestone에서 검증한다.

## Approved decisions

1. C multi-backend is the target architecture.
2. PDF is the V1 primary delivery and acceptance artifact; PDF itself is not canonical source.
3. The first vertical slice produces A/B PNG renders, one selected PDF page, one HTML presentation page, and a contextual preference record.
4. Editable PPTX is deferred to a later compatibility milestone and does not constrain V1 composition.
5. Visual-fidelity PPTX remains a separately named, explicit user choice with rasterization disclosure; it is never an automatic fallback.
