# Phase 1 Core Workspace Proof Brief

작성일: 2026-08-28  
상태: prototype 제작 승인  
범위: 동일 작업 순간을 세 Design DNA로 구현한 Core Workspace Proof 3개

## 승인 경계

- `Editorial Redline`, `Presentation Theatre`, `Mechanism Foundry`의 독립성을 승인한다.
- 어느 DNA도 최종 방향으로 선택하지 않는다.
- 세 DNA 모두 prototype gate로 진행한다.
- 전체 Workspace/Candidate/Critic 세트는 아직 만들지 않는다.
- W4/W5 variation, DNA hybrid, shared visual component, production 구현을 금지한다.

## 동일 작업 순간

| 조건 | 고정값 |
|---|---|
| Project | Chrono Break / Combat Mechanism |
| Slide | B Mechanism actual 16:9 render |
| Source | 회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50% |
| Semantic Structure | Trigger → Resource → Timed State → Transition → Outcome |
| Selection | `BREAK`, semantic role `Transition` |
| Task | BREAK transition의 emphasis와 relation을 유지하며 시각 속성을 편집 |
| Content guard | 다섯 facts와 네 relations 변경 금지 |

## Proof별 필수 증거

### Editorial Redline

- Page, Story, Studio, Preflight가 실제 screen anatomy로 보인다.
- pasteboard, ruler/guide, page boundary, editorial selection을 사용한다.
- candidate/critic segmented navigation이나 기존 W1 shell을 사용하지 않는다.

### Presentation Theatre

- Slide view가 주인공이고 `Outline / Slide / Light Table / Review` view philosophy가 보인다.
- detail은 selection에 반응해 reveal되며 persistent tri-pane을 만들지 않는다.
- wide stage가 빈 landing page처럼 보이지 않아야 한다.

### Mechanism Foundry

- Mechanism Object, Render Target, Details, bounded operation이 실제 interaction state로 연결된다.
- Unreal식 Outliner ↔ Viewport ↔ Details synchronization이 game-planning language로 번역된다.
- 기존 Graphite Workbench, IDE, 관리자 dashboard, AI lab처럼 보이면 실패다.
- dark viewport apron은 slide 주변 24~32px 수준으로 제한한다.

## Capture와 평가

각 proof를 실제 브라우저에서 다음 viewport로 렌더한다.

- 1920×1080
- 1440×900
- 1366×768

동일 기준:

1. Slide protagonist
2. First-use clarity
3. Game-planning structure legibility
4. Long-session comfort
5. Professional production-tool credibility
6. Distance from AI SaaS, administrator, and IDE aesthetics
7. Primary Reference philosophy in interaction

## Exit gate

세 proof를 비교한 뒤 사용자가 발전시킬 DNA를 결정한다. 그 전에는 전체 UX set, common component extraction, production UI를 시작하지 않는다.

