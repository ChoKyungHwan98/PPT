# Presentation Generation Synthesis

> **Decision update · 2026-08-29**  
> The product is now PDF-first for portfolio and game-planning submission quality. PPTX is a later compatibility backend, not a first-slice gate, canonical format, canvas model, or design constraint.

## 조사 질문

이번 재조사의 질문은 “어떤 UI가 좋은가”가 아니다.

1. 각 프로젝트는 내용을 어떤 중간 상태로 바꾸는가?
2. 시각 구조와 스타일을 어떻게 선택하는가?
3. 실제 페이지를 무엇으로 렌더하는가?
4. 품질을 어떻게 확인하고 수정하는가?
5. PDF, HTML, PNG, PPTX를 어떻게 분리하는가?
6. 반복해서 등장하는 방식은 무엇이며, 우리 제품에는 어떻게 결합해야 하는가?

## 프로젝트별 생성 방식

Primary sources: [Oh My PPT](https://github.com/arcsin1/oh-my-ppt), [PPT Master](https://github.com/hugohe3/ppt-master), [PPTAgent / DeepPresenter](https://github.com/icip-cas/PPTAgent), [PPT-Eval](https://github.com/microsoft/ppteval), [Presenton](https://github.com/presenton/presenton), [PPTist](https://github.com/pipipi-pikachu/PPTist), [Casual Slides](https://github.com/CasualOffice/slides), [reveal.js](https://github.com/hakimel/reveal.js), [Reveal Editor](https://github.com/samplereality/reveal-editor), [Slidev](https://github.com/slidevjs/slidev), [Marp](https://github.com/marp-team/marp), and [PptxGenJS](https://github.com/gitbrent/PptxGenJS).

| 프로젝트 | 유지하는 원본/중간 상태 | 디자인 생성 방식 | 실제 렌더·검사 | 출력 | 우리에게 가져올 것 |
|---|---|---|---|---|---|
| Oh My PPT | 세션의 page HTML, outline, style package | message, role, reading path, content shape, density를 판단하고 layout skill과 style skill을 결합 | browser 측정값을 포함한 page beautify, history, retry | HTML/PDF/PNG/PPTX 등 | layout 판단 절차, structure/style 분리, 실제 렌더 후 제한된 수정 |
| PPT Master | source, manifest, authoring SVG, package evidence를 분리 | design spec 뒤 SVG로 페이지를 설계 | SVG와 최종 package를 각각 검증 | SVG→DrawingML editable PPTX | artifact ownership, SVG 수준의 시각 자유도, exporter capability map |
| PPTAgent | reference slide의 functional type과 content schema | 현재 내용과 역할이 맞는 reference slide를 선택해 edit action 생성 | PPTEval로 Content/Design/Coherence 분리 평가 | PPTX | reference를 외형이 아니라 기능·내용 형태로 검색하는 방법 |
| DeepPresenter | 계획과 중간 slide artifact | agent가 계획·렌더·수정을 반복 | reasoning이 아니라 실제 렌더 이미지를 관찰 | 연구 pipeline | `Render → Observe → Revise` 원칙 |
| PPT-Eval | task, artifact, rubric evidence | 생성기는 아님 | 부분 점수와 detrimental-change penalty | benchmark | 하나의 미적 점수 대신 항목별 근거와 악화 페널티 |
| Presenton | prompt/document, selected template/layout, editable page state | HTML/Tailwind 기반 template과 provider 선택 | browser editor에서 수동 보정 | PDF/PPTX | provider adapter, self-hosting, template/layout을 명시적 자원으로 다루는 방식 |
| PPTist | PowerPoint와 유사한 JSON/object page model | template, theme, arbitrary object editing | browser canvas와 export 비교 | image/PDF/PPTX/JSON | rich object editor가 필요해질 때의 데이터 모델 참고; AGPL 코드는 reference-only |
| Casual Slides | OOXML↔`ISlideData`, 미지원 XML side-channel | PowerPoint형 page object를 직접 편집 | fidelity probe와 round-trip tier | PPTX 중심, PNG/PDF | import/export 손실을 capability tier로 관리하는 방식 |
| reveal.js | HTML section 또는 Markdown | CSS theme과 직접 authored markup | browser runtime 자체가 presentation truth | HTML, Chromium PDF | presentation runtime과 PDF print path; PPTX 비종속성 |
| Reveal Editor | reveal.js markup/config | slide list + text/markdown/config editing | embedded reveal preview | reveal HTML | source와 preview를 얇게 연결하는 방식 |
| Slidev | Markdown + Vue components | layout component와 theme | Vite/browser preview, Playwright export | HTML/PDF/PNG, lossy PPTX | source-first workflow, overview/presenter, browser-quality PDF |
| Marp | Markdown + directives + CSS theme | 제한된 Markdown grammar와 theme engine | browser preview와 overflow diagnostic | HTML/PDF/PNG/PPTX | 작은 source grammar, reproducible CLI, PDF-first batch rendering |
| PptxGenJS | JavaScript object calls | 디자인 판단 없음 | PowerPoint/Keynote/LibreOffice에서 결과 확인 | OOXML PPTX | 나중의 narrow PPTX adapter; layout intelligence로 사용하지 않음 |

## 반복해서 나타나는 공통분모

### 1. 사용자의 내용과 렌더 결과를 분리한다

Markdown, HTML, JSON object model, SVG, slide schema 등 형태는 다르지만 대부분 유지 가능한 중간 상태를 둔다. PDF나 PPTX 자체를 유일한 원본으로 삼는 방식은 생성·수정·다중 출력에 불리하다.

### 2. 내용을 바로 좌표로 바꾸지 않는다

outline, functional role, content schema, layout, theme, page object 같은 단계를 거친다. 좋은 결과는 “LLM이 좌표를 잘 찍는가”보다 어떤 중간 결정을 제한하고 검증하는가에 더 의존한다.

### 3. 구조와 스타일을 별개의 결정으로 둔다

timeline인지 comparison인지, 무엇이 주인공인지, 어떤 순서로 읽는지가 먼저다. 색·폰트·장식은 그 구조를 표현하는 별도 층이다.

### 4. 고정된 viewport에서 실제로 렌더한다

브라우저, SVG, canvas, PowerPoint 등 엔진은 다르지만 최종 좌표와 줄바꿈을 실제로 계산한다. 텍스트 설명만 보고 품질을 판정하지 않는다.

### 5. 출력 형식은 각각 다른 손실을 가진다

HTML/PDF는 시각 자유도와 재현성이 높고, editable PPTX는 Office 호환성이 높지만 표현 범위와 변환 비용이 크다. 성공한 프로젝트일수록 이 차이를 숨기지 않고 capability 또는 fidelity 문제로 관리한다.

### 6. 수정은 국소적이고 되돌릴 수 있어야 한다

history, retry, page-level regenerate, edit action, source edit 등 구현은 다르지만 전체 결과를 매번 무제한 재생성하는 방식은 피한다.

## 공통적이어도 그대로 채택하지 않을 것

- PowerPoint형 object editor: PPTX round-trip 제품에는 자연스럽지만 우리 사용자의 핵심 병목은 object manipulation이 아니다.
- HTML을 canonical source로 저장: 높은 시각 자유도는 얻지만 의미 관계와 사용자 내용 추적이 약해진다.
- 정해진 template에 내용 끼워 넣기: 품질 하한은 높일 수 있지만 내용별 차이를 충분히 만들지 못한다.
- AI가 raw HTML/SVG/CSS를 무제한 작성: 빠르지만 재현성, 안전성, 충돌 수정, preference 학습이 어렵다.
- 세 후보 강제 생성: 품질 미달 후보를 수량 때문에 노출하게 된다.
- 하나의 미적 점수: critic의 취향을 강화하고 실제 사용자 선호와 내용 이해를 놓친다.

## 우리 제품의 결합 구조

```text
Authored Source
  → Source Ledger
  → SlideIR
  → Reference Retrieval Brief
  → Composition Search
  → CompositionPlan A/B
  → Deterministic Layout + Text Measurement
  → RenderTree A/B
  → HTML/SVG Reference Renderer
  → PNG Evidence + PDF Proof
  → Hard Validation
  → Optional Visual Critic
  → User Pairwise Choice
  → Contextual Preference Memory
  → next retrieval/ranking update
```

### Source Ledger + SlideIR

- 사용자가 작성한 문장, 수치, 관계, 표, 이미지 요구를 추적한다.
- 디자인과 출력 필드는 포함하지 않는다.
- AI가 꺼져도 수동 또는 deterministic parser로 만들 수 있다.

### Reference Retrieval Brief

현재 페이지가 필요로 하는 reference의 조건을 기록한다.

```ts
type ReferenceRetrievalBrief = {
  intent: string
  semanticShape: string
  relationshipShape: string[]
  primaryArtifact: string
  densityBand: string
  readingPathCandidates: string[]
  audience: string
  outputProfile: 'pdf-document' | 'pdf-presentation' | 'html-presentation'
  avoidSignatures: string[]
}
```

레퍼런스는 “비슷한 색”이 아니라 기능, 내용 형태, reading path, density, artifact type으로 검색한다.

### Composition Search

- 고정 template 하나를 선택하는 단계가 아니다.
- reference의 구조 원리를 추출한 `PatternFragment`를 조합한다.
- 후보 A/B는 서로 다른 reference cluster 또는 composition hypothesis에서 출발한다.
- 사용자에게 보여 줄 수준에 못 미치면 후보 수를 줄이거나 다시 탐색한다.
- 레퍼런스의 구체적 문구, 고유 그래픽, 로고, 일러스트를 복제하지 않는다.

### RenderTree와 실제 렌더

- RenderTree는 확정된 geometry, text line, paint, clipping, z-order, source link를 가진다.
- 저장된 HTML DOM이나 PPTX object tree가 아니다.
- 첫 reference renderer는 HTML/SVG + controlled browser다.
- PDF와 PNG는 동일한 실제 렌더 경로에서 생성한다.
- PPTX backend는 이후 별도 capability adapter로 추가한다.

## Reference Evolution Engine

### 수집 원칙

- 공개 접근이 허용된 출처만 사용하고 robots.txt, 이용약관, 요청 속도를 존중한다.
- 기본 저장물은 URL, 제목, 제작자, 발견일, license/usage note, perceptual hash, 분석 metadata, 작은 내부 thumbnail이다.
- 원본 파일 재배포 권리가 확인되지 않으면 원본을 제품에 번들하지 않는다.
- 같은 디자인의 repost와 해상도 변형은 perceptual hash로 제거한다.
- source URL과 분석 버전 없이 reference를 사용하지 않는다.

### 밤새 로컬에서 수행할 작업

1. 허용된 source adapter에서 새 reference 발견
2. 중복 제거와 품질 낮은 이미지 제거
3. OCR과 page-region 분리
4. layout, hierarchy, typography, density, color role, graphic language 분석
5. content shape와 game-planning relevance 분류
6. embedding/index 갱신
7. 기존 preference와의 유사도 계산
8. 다음 A/B 실험 queue 작성

### A/B 선택 학습

```ts
type PairwisePreference = {
  id: string
  contextHash: string
  candidateA: string
  candidateB: string
  winner: 'A' | 'B' | 'tie' | 'reject-both'
  reasons: string[]
  semanticShape: string
  comparedSignatures: string[]
  createdAt: string
}
```

- 선택은 전역 취향이 아니라 semantic shape와 작업 목적에 묶어 저장한다.
- “밝은 배경 선호” 하나가 모든 페이지를 밝게 만들지 않는다.
- 이미 잘 선택된 영역도 일부 탐색 비율을 남겨 조기 획일화를 막는다.
- `reject-both`는 중요한 학습 신호이며 억지 winner를 만들지 않는다.
- 초기에는 fine-tuning하지 않는다. retrieval weight와 candidate ranking만 갱신한다.

## AI와 deterministic core의 역할

### Local machine

- crawling orchestration
- OCR, embedding, deduplication, clustering
- metadata tagging과 낮은 비용의 1차 점검
- deterministic candidate enumeration, rendering, validation
- cache와 experiment queue

### 선택적 원격 AI

- Source → SlideIR 해석 중 어려운 관계
- ReferenceRetrievalBrief와 composition hypothesis 제안
- 실제 PNG를 본 visual critique
- 사용자 A/B 이유의 구조화

한 페이지마다 저장소나 전체 대화를 보내지 않는다. source spans, compact SlideIR, top-k reference metadata/thumbnails, actual render만 보낸다.

## 출력 결정

### V1 기본 출력

1. **PDF Proof** — 제출·포트폴리오의 기준 결과
2. **PNG Evidence** — A/B 비교, critic, cache, 썸네일
3. **HTML Presentation** — 브라우저 발표와 공유

### 이후 호환 출력

4. **Editable PPTX** — 지원 가능한 object만 별도 adapter로 변환
5. **Visual-fidelity PPTX** — 사용자가 명시적으로 요청한 경우에만 사용

PDF는 canonical source가 아니다. 다만 첫 제품 검증에서 품질을 판정하는 primary delivery artifact다.

## 새 vertical slice

```text
한 장의 사용자 원문
  → SlideIR
  → 승인·허용된 seed reference corpus 검색
  → 서로 다른 composition hypothesis A/B
  → 실제 PNG 두 장
  → content/geometry/font/PDF hard gate
  → actual-render critic
  → 사용자 A/B 또는 reject-both
  → preference record 저장
  → 선택안 PDF 1쪽 + HTML page
```

첫 slice는 UI editor, 전체 deck, editable PPTX, crawler의 무제한 인터넷 운용을 포함하지 않는다. 작은 seed corpus와 batch command로 생성·평가·학습 연결이 재현되는지 먼저 증명한다.

## 채택 판단

공통분모는 최적성의 증명이 아니라 독립 프로젝트들이 반복해서 만난 제약의 증거다. 따라서 다음 원칙으로 채택한다.

- 반복되는 구조는 기본 가설로 사용한다.
- 프로젝트별 강점은 독립 module로 분리한다.
- 실제 결과와 사용자 pairwise choice가 가설을 계속 수정한다.
- 어떤 외부 프로젝트도 canonical architecture나 단일 fork 기반이 되지 않는다.
