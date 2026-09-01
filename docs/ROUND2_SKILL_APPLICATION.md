# Phase 1 Round 2 Skill and Reference Application

작성일: 2026-08-28  
상태: prototype 코딩 전 디자인 기준 확정  
범위: 정적 UI와 한 장짜리 mechanism slide의 visual-direction 재탐색

## Design Read

게임 시스템 기획자가 자신이 쓴 인과 구조를 손상시키지 않고, 실제 슬라이드를 크게 보며 세 개의 고품질 정보 디자인을 판단하는 데스크톱 제작 도구로 읽는다. 제품의 시각 언어는 AI나 개발 콘솔이 아니라 슬라이드, 편집 테이블, 교정 표시, 게임 메커니즘의 시간성과 전환에서 도출한다.

이번 라운드는 `redesign - overhaul`이다. Architecture, UX Flow, Candidate Compare 개념은 보존하지만 Round 1 Graphite visual direction과 일곱 화면의 시각 결과는 승인된 기반으로 보지 않는다.

## 확인한 실제 소스

| Source | Snapshot | License | 이번 적용 |
|---|---|---|---|
| Anthropic `frontend-design` | `anthropic/skills@3b3fad9`, 2026-08-21 | Apache-2.0 | subject grounding, 명확한 point of view, 의도적 type/palette/layout, 하나의 signature, build 전 자기 비평 |
| Taste Skill | `leonxlnx/taste-skill@ccbc156`, 2026-08-24 | MIT | Design Read, 명시적 dials, anti-default 검사, 카드/shape/copy discipline |
| UI UX Pro Max | `nextlevelbuilder/ui-ux-pro-max-skill@8bd29e7`, 2026-08-27 | MIT | 전체 프롬프트가 아닌 검색 DB로만 사용, hierarchy/contrast/responsive/anti-pattern 항목만 채택 |
| Oh My PPT layout skill | `arcsin1/oh-my-ppt@73b9720`, 2026-08-22 | Apache-2.0 | Message, Role, Reading Path, Content Shape, Density, budget, self-check의 판단 순서만 채택 |
| Local Visual Grammar draft | 현재 저장소 | project-owned | mechanism relation 보존, one message, one dominant artifact, candidate failure discard |
| 21-product Reference Audit | 현재 저장소 | reference only | Oh My PPT, PowerPoint, Figma, Onlook, Penpot, VS Code, Zed의 역할별 근거 |

외부 Skill의 코드는 프로젝트에 설치하거나 복사하지 않는다. 라이선스는 조사 출처의 조건이며 이번 결과물의 dependency가 아니다.

## UI UX Pro Max 검색과 판정

실행한 최소 검색:

- `creative professional presentation editor content first --design-system`
- `professional workbench information hierarchy --domain ux`
- `editorial productivity professional --domain typography`
- `creative tool warm neutral --domain color`
- `desktop slide editor --domain product`
- `creative design platform --domain product`
- `responsive dense desktop layout --domain ux`

채택:

- 사용자 콘텐츠가 주인공인 neutral canvas
- heavy chrome 회피
- 일관된 modular type scale
- light surface에서 본문 대비 4.5:1 이상
- 색상만으로 선택과 상태를 전달하지 않기
- 세 해상도에서 가로 스크롤과 핵심 잘림이 없도록 검증

폐기:

- `Feature-Rich Showcase`, 반복 CTA, feature card grid는 마케팅 페이지 문법이므로 부적합
- creative pink와 Space Grotesk 추천은 게임 기획 편집기의 작업 목적에서 나온 결과가 아니므로 부적합
- `desktop slide editor` product query는 0건이었고 재검색도 직접 일치가 없었다. 제품 구조는 일반 DB fallback이 아니라 실제 Reference Audit를 우선한다.

## Skill 적용 경계

### Anthropic frontend-design

적용:

- UI의 subject는 실제 PowerPoint slide와 게임 메커니즘이다.
- 구조 장치는 실제 상태나 관계를 표현할 때만 쓴다.
- palette, type, layout, signature를 코드 전에 명시한다.
- 한 화면에서 boldness는 하나의 signature에 집중한다.

배제:

- hero page, marketing copy, web landing-page section assumptions
- 큰 숫자 + gradient + 세 개 카드 같은 자동 해답
- warm cream + serif + terracotta를 근거 없이 editorial로 사용하는 기본값

### Taste Skill

이 Skill은 스스로 dashboard와 multi-step product UI를 주 적용 범위에서 제외한다. 따라서 제품 구조에는 적용하지 않고 다음 항목만 두 번째 검사 레이어로 쓴다.

- `DESIGN_VARIANCE`, `VISUAL_DENSITY` 명시
- card는 elevation이 실제 hierarchy를 뜻할 때만 사용
- 한 화면 안에서 radius와 accent 사용 규칙 고정
- fake-precise number 금지. 이번 수치는 모두 fixture에서만 온다.
- generic three-card row, AI-purple, meaningless label, decorative status dot 회피
- visible copy self-audit

### Oh My PPT layout skill

적용:

- PPT message를 3초 안에 읽히는 한 문장으로 먼저 고정
- Role, Reading Path, Content Shape, Density 순으로 결정
- 실제 16:9 canvas의 zone과 높이 예산을 먼저 스케치
- accidental empty band와 top-heavy composition을 실패로 판정
- 구조와 visual language를 분리해 같은 인과 관계를 서로 다른 art direction으로 표현

배제:

- HTML을 slide canonical state로 사용
- Tailwind class와 model-authored fragment
- source를 AI가 임의로 요약하거나 생략하는 기능
- catalog pattern을 템플릿처럼 복제

## 실제 제품 Reference 적용

| Reference | 이번 화면에서 가져오는 판단 | 가져오지 않는 것 |
|---|---|---|
| Oh My PPT | 실제 style preview를 보며 선택, presentation 중심 workflow | prompt-to-deck, HTML authoring UI |
| PowerPoint | 중앙의 물리적 slide, fit/zoom, 익숙한 slide 선택 mental model | ribbon과 Office command taxonomy |
| Figma | canvas focus, 선택 상태, panel hide/focus | full vector editor와 resource hub |
| Onlook | AI 결과와 직접 디자인 판단의 공존, checkpoint 개념 | chat과 code의 상시 노출 |
| Penpot | contextual inspector, progressive disclosure, neutral stage | 모든 geometry control |
| VS Code / Zed | 장시간 사용 가능한 compact chrome, command access, 접히는 drawer | dark developer-tool skin과 coding vocabulary |

충돌 시 우선순위:

1. 사용자가 작성한 게임 기획의 논리 보존
2. 실제 slide의 가시성과 비교 가능성
3. PowerPoint 기반 slide mental model
4. Reference Audit의 검증된 interaction
5. Skill의 일반 지침

## Program UI dials

```text
DESIGN_VARIANCE 5
VISUAL_DENSITY 7
EDITORIALITY 4
TOOL_DENSITY 6
CANVAS_EMPHASIS 10
MOTION_INTENSITY 1
```

- `DESIGN_VARIANCE 5`: 익숙한 slide mental model은 유지하되, Round 1의 tri-rail 고정을 버린다.
- `VISUAL_DENSITY 7`: 장시간 쓰는 도구의 compact control을 유지하지만 설명문은 숨긴다.
- `CANVAS_EMPHASIS 10`: slide가 화면 면적과 대비의 주인공이다.
- `MOTION_INTENSITY 1`: 이번 결과는 정적 prototype이므로 움직임을 주장하지 않는다.

## Round 1 명시적 폐기

- near-black Graphite shell을 기본값으로 쓰지 않는다.
- black stage와 비어 있는 화면 면적을 사용하지 않는다.
- 고정 좌우 rail, 오른쪽 decision copy, 열린 findings drawer를 comparison 기본 상태로 두지 않는다.
- 후보 설명과 Critic score를 slide보다 강한 type/contrast로 노출하지 않는다.
- box + line + large geometric hub + metric tile을 mechanism의 자동 visual grammar로 쓰지 않는다.
- topology 차이만으로 후보 다양성을 통과시키지 않는다.

## Quality Floor

아래 항목 중 하나라도 실패하면 해당 후보는 숫자를 채우기 위해 제출하지 않는다.

### Semantic hard gate

- 정확한 다섯 사실이 모두 보인다.
  - 회피 ×3
  - 시간 파편 획득
  - 시간 정지 5초
  - BREAK
  - 받는 피해 +50%
- 네 개의 순서 관계가 명백하다.
- `BREAK`는 시간 정지 뒤, 피해 증가 앞에 있다.
- AI가 만든 새 gameplay fact나 설명 수치가 없다.

### Slide design gate

- 50% 크기의 screenshot에서도 한 문장 message와 primary artifact를 3초 내 식별할 수 있다.
- primary artifact가 slide 면적과 contrast의 중심이며 title/body가 경쟁하지 않는다.
- 장식선과 도형은 실제 시간, 축적, 전환, 결과 중 하나를 인코딩한다.
- typography가 최소 세 역할을 갖고 임의 크기 조합처럼 보이지 않는다.
- body와 label은 1600×900 원본 기준 18px 이상, heading은 24px 이상이다.
- card grid가 지배 문법이 아니다.
- accidental empty band, clipping, collision, unreadable label이 없다.
- 실제 게임회사 기획서나 포트폴리오 한 장으로 독립 사용 가능해야 한다.

### Candidate diversity gate

세 후보는 다음 다섯 축 중 네 개 이상에서 실질적으로 달라야 한다.

- typography system
- composition
- visual hierarchy
- graphic language
- information grouping

### Program UI gate

- slide가 viewport의 주 시각 면적이다.
- 1920×1080, 1440×900, 1366×768에서 세 후보를 즉시 비교할 수 있다.
- 설명과 평가 정보는 progressive disclosure에 있다.
- black empty stage가 없고 UI chrome이 slide보다 먼저 보이지 않는다.
- 선택은 color뿐 아니라 label, outline, state text로 전달한다.
- 가로 스크롤, 핵심 잘림, 겹침이 없다.

## 코딩 전 판정

이번 규칙 추출로 Round 2의 방향은 다음처럼 좁혀진다.

- app shell은 light warm-neutral production table로 설계하되 cream-editorial cliché는 피한다.
- candidate compare는 equal access와 large-slide reading을 분리한다. overview는 즉시 비교, focus view는 정밀 판독을 담당한다.
- slide A/B/C는 동일한 fixture와 relation을 유지하고, 서로 다른 artifact와 type/composition으로 설계한다.
- Critic evidence는 초기 비교 화면에 상시 노출하지 않고 접힌 review strip 또는 focus mode에서만 보인다.
