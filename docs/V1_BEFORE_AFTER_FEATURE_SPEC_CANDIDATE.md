# Before / After Feature Spec — 후보 평가 기록

최종 상태: `portfolio-not-ready / rejected-as-ready-candidate`.

사용자가 실제 PNG를 확인하고 포트폴리오 제출 품질이 아니라고 명시적으로 판단했다. 사용자 검토 대기 상태는 종료됐다.

- Ready Positive Fixture 아님. Golden 아님.
- 추가 polishing 금지. 기존 PNG와 구조·검증 증거는 삭제하지 않는다.
- 구조는 정상이나 visual quality가 부족한 negative/intermediate evidence로 보존한다.
- 이후 Critic benchmark fixture 후보로 검토할 수 있으나, 현재 benchmark에 등록하거나 새 AI 평가를 실행한 것은 아니다.

판정 대상 PNG의 SHA256은 `6d1c21aabb634cc48bb25d5c10c3191db96255ca90412d21c477389185329588`이며, 동일 판정은 `dodge-feature-spec-01.proof.json`의 status / classification / userReview에 기록한다.

## 1. Source

`packages/source-ingestion/fixtures/dodge-feature-spec.source.json`에 사용자가 제공한 문구와 세 대응쌍을 고정했다.

- 제목: 회피 시스템 개선
- 기존 방식: 공격 중 회피 입력 불가 / 구르기 중심 회피 / 락온 중에도 동일한 회피 모션
- 개선 방식: 공격 중 회피 입력 시 더킹으로 캔슬 / 입력 방향에 따라 회피 방향 결정 / 락온 상태를 유지한 채 근거리 회피
- 핵심 의도: 공격 흐름을 끊지 않으면서, 보스와의 근거리 공방을 지속할 수 있는 회피 시스템

원문의 두 줄 의도 문장과 source spans를 그대로 보존했다. 행 머리표는 문서 표기이며 장표에 새 라벨이나 문장을 만들지 않았다.

## 2. Semantic 구조

기존 SlideIR을 재사용한다. 제목 1개, 핵심 의도와 그 라벨 2개, 열 제목 2개, 비교 항목 6개로 총 11개 block이다.

세 `compares-with` relation이 각각 source span 두 개를 연결한다. 이는 순차 실행이나 원인·결과가 아니라 변경 전후의 대응 관계다. Change는 별도 창작 문장이 아니라 이 대응 관계의 시각 표시다.

| Relation | Before | After |
|---|---|---|
| change-1 | 공격 중 회피 입력 불가 | 공격 중 회피 입력 시 더킹으로 캔슬 |
| change-2 | 구르기 중심 회피 | 입력 방향에 따라 회피 방향 결정 |
| change-3 | 락온 중에도 동일한 회피 모션 | 락온 상태를 유지한 채 근거리 회피 |

입력 도우미는 구조화된 authored fields/edges를 받는다. 임의 문서를 이해하는 AI Interpreter를 새로 구현한 것은 아니다.

## 3. InformationPlan

- semanticShape: `comparison`
- grammarId: `before-after-feature-spec`
- groups: `context / before / after`
- message: 핵심 의도 원문, exact source trace
- 읽기 흐름: 제목 → 의도 → 좌우 제목 → 대응쌍 1·2·3

왼쪽 목록과 오른쪽 목록의 배열 위치를 짝짓기 근거로 쓰지 않는다.

## 4. Pattern / Reference

새 범용 Pattern: `pattern-aligned-before-after-spec`.

기존 검색을 통해 `ext-2025-shadowverse-super-evolution`을 선택한다. 새 레퍼런스나 원본 이미지를 장표에 추가하지 않았다. 기존 External Master 분석을 검색 가능한 analysis-only ReferenceRecord로 연결했다.

가져온 원칙:

- 같은 비교 기준을 좌우의 같은 행으로 정렬한다.
- 기존 기준을 남겨둔 채 변경된 규칙을 더 강하게 보여준다.
- 하나의 authored message가 비교 전체를 설명한다.

가져오지 않은 것: CEDEC 프레임, 로고, IP, 브랜드 색, 원본 geometry.

프레젠테이션 스킬의 한 장 한 목적, 제목·본문 위계, 반복 카드 대신 단일 composition, 실측 후 검증 원칙을 적용했다. 사용자의 production Renderer 요구가 우선하므로 별도 PPT 제작 라이브러리나 수작업 HTML로 우회하지 않았다.

## 5. Generic reuse proof

| Fixture | 구조 | 검증 |
|---|---|---|
| Generic 2 pairs | 자원 회복 조건 2쌍 | Pattern 선택, 실제 Pretendard 측정, RenderTree, Hard Gate PASS |
| 회피 시스템 3 pairs | 이번 원문 3쌍 | 동일 계약과 전체 source/relation 보존 PASS |
| Generic 4 pairs | 자원 회복 조건 4쌍 | 같은 결과, block 수 고정 없음 |
| MEC-01 negative | accumulation → threshold → consequence | 비교 Pattern 배제, 기존 CompositionPlan 그대로 유지 |
| Invalid pairing | 둘 이상이 동일 After를 가리킴 | 선택 거부 |

Generic fixture는 After 저장 순서를 일부러 뒤집었다. 실제 pairing은 authored relation을 따라 유지된다.

추가 negative 검사: visible line 변조, source 누락, 중복, relation 누락, 잘못된 carrier parent, 수치 변조가 모두 실패한다. Production comparison logic에 fixture 고유 문구/ID를 검사하는 코드가 없는지도 테스트한다.

## 6. RenderTree

Composition regions:

`page-heading → message-context → comparison-heading → comparison-field`

`comparison-field` 아래 3개 pair region이 있다. 각 row는 before text, after text, 원문 relation ID를 가진 짧은 change carrier로 표현한다.

- 28개 node: group 7, text 11, shape 10
- 큰 색면은 개선 방식 field 1개뿐이며 반복 카드 없음
- 실제 문구를 줄이거나 font를 자동 축소하지 않음
- Composition region order/weight와 binding 역할이 배치를 결정
- 기존 MEC-01 layout branch에는 변경 없음

폰트는 실제 Pretendard 400/700을 사용한다. Canvas 측정 전 font loading을 명시적으로 기다리는 선택 옵션을 추가했다. 기존 측정 호출의 동작은 유지했다.

## 7. Hard Gate / PNG

- Program finding: 0
- Source Fidelity finding: 0
- missing content / invented content / duplicate content / missing relation: 0
- overflow / collision: 0
- 동일 입력 RenderTree 결정성: PASS
- PNG: 1920×1080, 81,950 bytes
- PNG SHA256: `6d1c21aabb634cc48bb25d5c10c3191db96255ca90412d21c477389185329588`
- Renderer: RenderTree → production HTML/SVG → Chromium screenshot
- PNG 생성 1회, polish iteration 0회, Critic 호출 0회

## 8. 증거 파일

`packages/renderer/fixtures/dodge-feature-spec-01` 접두사로 다음을 저장했다.

- `.slide-ir.json`
- `.information-plan.json`
- `.retrieval.json`
- `.composition-plan.json`
- `.render-tree.json`
- `.html`
- `.png`
- `.proof.json`

## 9. 후보 제작 당시 변경 파일

신규:

- `packages/source-ingestion/src/authored-feature-comparison.ts`
- `packages/source-ingestion/fixtures/dodge-feature-spec.source.json`
- `packages/contracts/src/aligned-feature-spec.ts`
- `packages/composition-engine/src/aligned-feature-composition.ts`
- `packages/reference-engine/src/external-comparison-records.ts`
- `packages/renderer/src/aligned-feature-layout.ts`
- `packages/renderer/src/aligned-feature-validation.ts`
- `packages/renderer/src/proof/dodge-feature-spec.ts`
- `packages/renderer/test/aligned-feature-spec.test.ts`
- 위 8개 proof 파일과 이 보고서

기존 파일 최소 연결:

- `packages/contracts/src/information-plan.ts`: before/after group role
- `packages/contracts/src/reference.ts`: optional comparison contract
- `packages/contracts/src/seed-patterns.ts`: 범용 Pattern
- `packages/contracts/src/render-tree.ts`: optional metadata role 값
- `packages/contracts/src/index.ts`
- `packages/composition-engine/src/information-composition.ts`
- `packages/composition-engine/src/design-intent.ts`
- `packages/reference-engine/src/index-public.ts`
- `packages/renderer/src/information-layout.ts`
- `packages/renderer/src/hard-gate.ts`
- `packages/renderer/src/measure.ts`
- `package.json`

## 10. 검증 및 승인 경계

`pnpm verify`: 타입 검사 및 테스트 33개 파일 / 118개 테스트 PASS.

테스트와 Hard Gate PASS는 구조·원문 보존에 대한 증거다. 사용자의 visual quality 거절 판정은 그대로 유지하며 이 artifact를 Ready Positive 또는 Golden으로 승격하지 않는다. 추가 polishing 없이 기존 결과를 보존한다.

현재 Ready Positive는 0개다. 단계 0은 부분 완료, 단계 6은 Positive calibration 미완료이며 MEC-01 Stage 7 단일 revision cycle은 완료된 상태로 유지한다. MEC-01 revision을 다시 실행하지 않는다. 이번 상태 정리에서는 새 PNG·Critic·AI benchmark를 실행하지 않았으며 Stage 8/9도 시작하지 않는다.
