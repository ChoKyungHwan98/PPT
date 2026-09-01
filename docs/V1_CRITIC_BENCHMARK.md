# V1 Visual Critic Benchmark

## 현재 판정

- OpenRouter 연결, 실제 PNG 입력, 구조화 출력, 작은 context, token·비용 기록은 동작한다.
- 단계 0과 단계 6은 **미완료**다.
- 기존 `positive-golden-case`는 사용자가 최종 제출 품질로 승인하지 않았으므로 `intermediate-golden-case / needs-review`로 재분류했다.
- 현재 `ready` Positive Fixture는 **없다**. 따라서 단계 완료 판정도 존재하지 않는다.
- 단계 7 Partial Revision은 시작하지 않는다.

## 입력 경계

Critic에는 다음만 전달한다.

- 실제 PNG
- 페이지 목표
- 작은 Semantic 요약
- InformationPlan 핵심 구조
- 10개 평가 항목
- 제출 가능 수준의 세 단계 기준
- Hard Gate PASS

저장소, 전체 대화, 긴 생성 reasoning, 전체 Memory는 전달하지 않는다.

## 제출 가능 수준

- `ready`: 실제 제출물에 그대로 넣을 수 있다. 명백한 hierarchy, space, grouping, typography, relation 문제가 없고 prototype 또는 wireframe처럼 보이지 않는다.
- `needs-review`: 내용은 이해할 수 있고 치명적 오류는 없지만 시각적 완성도, 공간 활용, 위계, 정렬 또는 그룹화에 사람이 손볼 부분이 남아 있다.
- `not-ready`: 읽는 순서, 위계, 그룹화, 밀도, 공간 사용 또는 시각 구조에 명확한 문제가 있어 제출용으로 사용할 수 없다.

사람의 기대 판정과 Critic 판정을 정확히 비교한다. Positive fixture는 사용자가 실제 이미지를 보고 남긴 승인 기록, `ready`, finding 0건을 모두 만족해야 통과한다.

## Positive 승인 구조

코드는 이미지를 보고 Positive를 자동 선정하지 않는다. `ready` fixture에는 다음 사용자 승인 기록이 필수다.

- 승인 ID
- 승인 주체 `user`
- 승인한 artifact ID
- 승인 시각
- 사용자가 남긴 승인 문장

승인 artifact ID가 fixture artifact ID와 다르면 schema 검증에서 거부한다. 기존 `positiveAudit.submissionApproved=true` 같은 독립 boolean은 제거했다. 승인 여부는 사용자 승인 기록의 존재로만 판단한다.

## Fixture

모든 라벨은 `exhaustive`다.

| Fixture | 사람의 기대 문제 | 기대 판정 |
|---|---|---|
| `hierarchy-problem` | hierarchy, space-use, relation-clarity, submission-readiness | not-ready |
| `density-problem` | density, space-use, grouping, submission-readiness | not-ready |
| `reading-order-problem` | reading-order, relation-clarity, grouping, submission-readiness | not-ready |
| `rough-but-readable` | space-use, hierarchy, grouping, typography-hierarchy, submission-readiness | needs-review |
| `intermediate-golden-case` | 사용자가 최종 제출 품질로 승인하지 않음 | needs-review |

`rough-but-readable`은 현재 V1 Renderer 결과다. 이전 `clean-result`라는 이름과 Positive 라벨은 폐기했다.

`intermediate-golden-case`는 기존 `vertical-slice/break-mechanism/evidence/artifact-render.png`를 유지하되 Positive 품질 기준으로 사용하지 않는다.

## 이전 Low / Medium 비교 기록

아래 값은 Golden 이미지를 잘못 Positive로 둔 상태에서 얻은 과거 기록이므로 현재 단계 완료 판정에 사용하지 않는다. 재분류 이후에는 추가 AI 호출을 하지 않았다.

Model은 설정값 `CRITIC_MODEL_ID`의 `google/gemini-3.7-flash`를 사용했다.

| 지표 | Low | Medium |
|---|---:|---:|
| Problem Recall | 7/17, 41.18% | 6/17, 35.29% |
| False Positive | 3건 | 3건 |
| Readiness Accuracy | 1/5, 20% | 1/5, 20% |
| Severity Accuracy | 2/7, 28.57% | 3/6, 50% |
| 구체적 수정 제안 | 6/7, 85.71% | 5/6, 83.33% |
| Positive 통과 | 실패 | 실패 |
| 전체 fixture 통과 | 실패 | 실패 |

두 설정 모두 현재 V1은 `needs-review`로 판정했다. 세 failure fixture도 모두 `needs-review`로 약하게 판정했다.

Medium은 Recall과 Readiness Accuracy를 개선하지 않았고, 비용과 token만 증가했다. 따라서 현재 비교 결과만으로 Medium을 기본값으로 채택하지 않으며 Low를 유지한다. 이는 Low가 품질 기준을 통과했다는 뜻이 아니다.

## 실제 비용

- Low: input 11,278 / output 2,156 / total 13,434 tokens, USD 0.0165435
- Medium: input 11,278 / output 3,971 / reasoning 1,977 / total 15,249 tokens, USD 0.02334975
- 합계: USD 0.03989325

## 남은 문제

1. 사용자가 명시적으로 승인한 실제 `ready` 이미지가 아직 없다.
2. Positive가 없으므로 Critic의 제출 품질 calibration을 다시 실행할 수 없다.
3. 기준 이미지가 확보되기 전에는 모델 호출과 단계 7을 진행하지 않는다.

세부 human label, Low/Medium 구조화 결과, 입력 trace와 비용은 `output/v1-visual-critic/benchmark-report.json`에 저장한다.
