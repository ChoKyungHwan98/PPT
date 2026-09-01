# Phase 1 Round 2 Visual Directions

작성일: 2026-08-28  
상태: code-before design specification  
공통 fixture: `회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%`

## Program UI: Production Table

### Point of view

발표 자료를 검수하는 밝은 제작 테이블이다. UI는 슬라이드 주변의 조용한 측정 도구로 물러나고, 후보는 검은 stage 속 썸네일이 아니라 실제 종이/화면처럼 또렷하게 놓인다. signature는 세 slide edge가 같은 baseline에 정확히 정렬되는 `proof table`이다.

### Palette

| Token | Value | Role |
|---|---:|---|
| Linen Gray | `#E7E5E0` | app background, warm하지만 cream paper가 아닌 작업대 |
| Porcelain | `#F7F7F4` | toolbar와 compact control surface |
| Canvas White | `#FFFFFF` | slide boundary와 focus surface |
| Carbon Ink | `#20252B` | primary text |
| Steel | `#69717A` | secondary text |
| Work Blue | `#176B87` | 유일한 UI accent, selected/focus/action |
| Rule | `#C9CCD0` | 실제 구획을 나타내는 divider |

### Typography

- UI heading: `Noto Sans KR`, 600, compact tracking
- UI body/control: `Noto Sans KR`, 400/500
- utility/data: `Bahnschrift`, `Noto Sans KR`, 500
- UI와 slide의 typography를 공유하지 않아 slide art direction을 오염시키지 않는다.

### Layout sketch

```text
┌ compact title / candidate switch / fit / compare ┐ 48
├───────────────────────────────────────────────────┤
│                                                   │
│   [ slide A ]   [ slide B ]   [ slide C ]         │ overview
│   title/state    title/state    title/state        │
│                                                   │
├ collapsed review: facts 5/5 · relations 4/4 ─────┤ 36
```

Focus view:

```text
┌ title / A B C / compare / fit ┐
│                               │
│          [ large slide ]      │
│                               │
├ A Editorial · facts 5/5 · review closed ┤
```

### UI rules

- toolbar 48px, bottom review strip 36px를 넘지 않는다.
- compare overview에서 세 slide는 동일 크기와 동일 zoom이다.
- 후보 rationale, dials, critic detail은 slide 아래 한 줄 label보다 먼저 보이지 않는다.
- focus view에서는 side inspector를 기본으로 열지 않는다.
- 평가 결과는 `5/5`, `4/4`, `검토 닫힘`처럼 compact proof만 보이고 상세는 progressive disclosure로 남긴다.
- 1366×768에서도 canvas가 세로 기준 가장 큰 영역을 차지한다.

### Expected tradeoff

장점은 slide dominance와 장시간 사용의 낮은 피로도다. 단점은 semantic source와 object inspector가 기본 화면에서 보이지 않아 초심자가 숨은 기능을 발견하기 어렵다는 점이다. command와 contextual drawer 설계가 production 단계에서 필요하다.

## A: Editorial / Information Design

### Design dials

```text
DESIGN_VARIANCE 7
VISUAL_DENSITY 5
EDITORIALITY 9
DIAGRAM_EMPHASIS 5
DECORATION_LEVEL 2
CONTRAST_LEVEL 8
```

### Decision path

- Message: 회피 세 번이 5초의 공격 기회를 만든다.
- Role: editorial mechanism explainer
- First: `회피 세 번이 만든 5초`
- Reading Path: 왼쪽 headline → 오른쪽 INPUT/RESOURCE/STATE/SHIFT/OUTCOME → BREAK 전환 → 결과
- Content Shape: 조건, 획득, 지속, 전환, 결과를 하나의 문장과 다섯 개의 vertical editorial beats로 편집한다.
- Density: medium-low
- Primary artifact: 다섯 단계가 한 축을 따라 읽히고 BREAK에서 축을 벗어나는 typographic sequence

### Graphic direction

고급 기획 문서의 opening spread에 가까운 방향이다. 카드 대신 baseline, column, type weight, 한 번의 색면 전환으로 관계를 만든다. serif는 publication이라는 명확한 근거 아래 hero 숫자와 headline에만 제한하고, 한국어 세부 텍스트는 sans로 유지한다.

### Palette

| Name | Value | Role |
|---|---:|---|
| Paper White | `#F4F5F2` | slide ground |
| Editorial Navy | `#152839` | headline, main logic |
| Signal Vermilion | `#D24B38` | BREAK와 단 한 번의 transition |
| Quiet Blue | `#4E7894` | time fragment and time stop support |
| Rule Gray | `#C6CBC9` | semantic alignment rule |
| Soft Ink | `#586169` | supporting copy |

### Typography

- display/number: `Batang`, bold, restrained use
- Korean headline/body: `Noto Sans KR`, 700/400
- utility label: `Bahnschrift`, 600, only for `BREAK` and numeric unit alignment

### Composition sketch

```text
┌ category                         message ┐
│ 회피 세 번이 만든 5초  │ INPUT    회피 ×3 │
│                       │ RESOURCE 시간 파편 │
│                       │ STATE    시간 정지 │
│ mechanism note        │ SHIFT    BREAK     │
│                       │ OUTCOME  피해 +50% │
└──────────────────────────────────────────┘
```

### Signature

`BREAK`가 독립 카드가 아니라 vertical sequence의 baseline을 벗어나 비스듬히 횡단하는 붉은 editorial cut이다. 그 cut만 강한 색을 쓰며 나머지는 정렬과 타이포그래피로 설계한다.

### Self-check

- 다섯 사실이 headline에 흡수되어 사라지지 않아야 한다.
- serif가 전체 슬라이드를 nostalgic하게 만들면 실패다.
- rule은 순서와 alignment만 표현하며 장식 grid로 증식하지 않는다.
- headline과 sequence가 두 개의 hero가 되지 않도록 sequence가 최종 primary artifact여야 한다.

## B: System / Mechanism Visualization

### Design dials

```text
DESIGN_VARIANCE 8
VISUAL_DENSITY 6
EDITORIALITY 3
DIAGRAM_EMPHASIS 10
DECORATION_LEVEL 4
CONTRAST_LEVEL 9
```

### Decision path

- Message: 세 번의 회피가 시간을 충전하고 BREAK 취약 구간을 연다.
- Role: mechanism timing exhibit
- First: 3개의 회피 pulse가 시간 정지 band로 수렴하는 event trace
- Reading Path: 왼쪽 3 pulse → 시간 파편 획득 → 5초 정지 band → rupture/BREAK → +50% consequence
- Content Shape: 다섯 단계는 node box가 아니라 한 번의 연속 event trace 위의 phase와 state로 표현한다.
- Density: medium
- Primary artifact: accumulation, hold, rupture, consequence가 한 composition에 들어 있는 temporal trace

### Graphic direction

게임 시스템 문서의 전투 telemetry와 timing notation에서 visual language를 가져온다. 연결선은 장식이 아니라 시간 진행이다. 세 개의 dodge pulse는 실제 ×3을, 넓은 hold band는 5초를, 끊어진 seam은 BREAK를, 확장된 output field는 피해 +50%를 뜻한다.

### Palette

| Name | Value | Role |
|---|---:|---|
| Night Blue | `#0C1E2C` | slide ground |
| Ice Trace | `#72D6D0` | time event trace |
| Fragment Cyan | `#A9F0E4` | resource accumulation |
| Break Coral | `#FF6B57` | rupture/BREAK |
| Mist | `#DCE8EA` | primary text |
| Grid Blue | `#294353` | timing guides only |

### Typography

- display: `Bahnschrift Condensed`, 600/700 for time and BREAK
- Korean body: `Noto Sans KR`, 400/600
- technical label: `Bahnschrift`, 500

### Composition sketch

```text
┌ mechanism message ───────────────────────┐
│      pulse  pulse  pulse                 │
│        ╲     │     ╱                     │
│ ──────── accumulation ━━━ 5s HOLD ┃BREAK┃━━ +50% │
│ 회피 ×3       파편 획득      시간 정지       피해 │
│                     state explanation    │
└──────────────────────────────────────────┘
```

### Signature

하나의 continuous time trace가 3회의 입력을 모으고, 5초 구간에서 넓어졌다가, `BREAK` seam에서 물리적으로 찢어져 더 큰 output field로 변한다.

### Self-check

- 단순한 node box 연결로 되돌아가면 실패다.
- 세 pulse가 순서가 아닌 decorative dot처럼 보이면 실패다.
- time stop과 BREAK를 동시에 일어나는 같은 상태로 오해하지 않도록 seam 순서를 분명히 한다.
- dark slide는 허용하지만 app shell까지 dark로 전염시키지 않는다.

## C: Professional Presentation

### Design dials

```text
DESIGN_VARIANCE 5
VISUAL_DENSITY 6
EDITORIALITY 6
DIAGRAM_EMPHASIS 7
DECORATION_LEVEL 2
CONTRAST_LEVEL 7
```

### Decision path

- Message: 회피 누적은 시간 정지를 거쳐 명확한 피해 보상으로 전환된다.
- Role: game-company internal proposal / portfolio mechanism slide
- First: mechanism title과 `입력 → 전환 → 보상`의 세 phase
- Reading Path: 왼쪽 design claim → 오른쪽 horizontal phase diagram → 아래 exact rule summary
- Content Shape: 다섯 사실을 Condition, Conversion, Payoff의 세 group으로 묶되 내부 순서를 유지한다.
- Density: medium
- Primary artifact: 세 phase가 오른쪽으로 전진하며 아래로 이행하는 stepped mechanism flow

### Graphic direction

실제 게임회사 내부 리뷰와 채용 포트폴리오 양쪽에서 무리 없이 쓰일 polished presentation이다. 흰 바탕, 선명한 cobalt, 정돈된 grid를 쓰지만 기본 PowerPoint SmartArt처럼 보이지 않도록 색면 카드를 제거하고 phase의 시작점과 선 길이를 의미에 따라 다르게 설계한다.

### Palette

| Name | Value | Role |
|---|---:|---|
| Clear White | `#FFFFFF` | slide ground |
| Slate Ink | `#1D2A35` | title/body |
| System Cobalt | `#2458A6` | condition and conversion |
| Time Blue | `#4D83C2` | time stop field |
| Break Orange | `#E46A3C` | state transition and payoff |
| Cool Gray | `#E8EDF1` | grouped phase ground |

### Typography

- display/headline: `Noto Sans KR`, 700
- body: `Noto Sans KR`, 400/500
- numeric/phase label: `Bahnschrift`, 600

### Composition sketch

```text
┌ claim               CONDITION  회피 ×3 → 파편 ─→
│ 누적된 회피가             └ CONVERSION 5초 → BREAK ─→
│ 공격 기회로 바뀐다              └ PAYOFF 피해 +50% ─→
│ design intent                                  │
└───────────────────────────────────────────────┘
```

### Signature

세 phase가 동일 카드가 아니라 시작점과 높이가 다른 하나의 stepped flow로 연결된다. 마지막 orange payoff는 큰 `+50%`와 별도의 line weight로 보상 증폭을 표현한다.

### Self-check

- 세 개의 동일 카드나 일반 SmartArt처럼 보이면 실패다.
- professional이라는 이유로 모든 hierarchy를 평균화하면 실패다.
- 왼쪽 claim이 source에 없는 gameplay 설명으로 확장되지 않도록 fixture 의미 범위에 머문다.
- portfolio polish를 위해 작은 caption을 과도하게 추가하지 않는다.

## Diversity pre-check

| Axis | A Editorial | B Mechanism | C Professional |
|---|---|---|---|
| Typography | serif accent + Korean sans | condensed technical + Korean sans | Korean sans + numeric utility |
| Composition | vertical typographic sequence and cut | continuous temporal trace | asymmetric claim + stepped phase flow |
| Visual hierarchy | headline/sequence | trace/rupture | claim/phase/payoff |
| Graphic language | editorial axis and typographic cut | pulse, hold field, rupture seam | structured phase lines and handoff |
| Grouping | five beats in one argument | accumulation/hold/rupture/output | condition/conversion/payoff |

세 안은 palette만 바꾼 동일 topology가 아니다. 각 안은 같은 semantic chain을 다른 primary artifact로 설명한다.

## Pre-code uniqueness critique

- UI의 warm-neutral은 Anthropic Skill이 경고한 generic cream editorial default가 될 위험이 있다. 이를 피하기 위해 Linen Gray는 canvas 주변에만 쓰고, serif/terracotta/marketing hero를 UI에 사용하지 않는다.
- A는 editorial default로 미끄러질 위험이 가장 크다. 붉은 accent는 BREAK라는 source state 하나에만 연결하고, newspaper-style dense columns와 decorative rules를 금지한다.
- B는 Round 1의 box-line diagram으로 회귀할 위험이 있다. 모든 단계 상자를 제거하고 연속 event trace가 관계를 직접 표현하도록 한다.
- C는 PowerPoint 기본 도형으로 평준화될 위험이 있다. equal cards 대신 한 개의 stepped flow와 비대칭 claim 영역을 사용한다.

이 사전 비평을 통과한 뒤에만 정적 HTML/CSS prototype을 작성한다.
