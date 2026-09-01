# V1 Visual Critic Benchmark

## 범위

- 단계 0의 human-labelled visual fixture 4개
- 단계 6의 실제 PNG 기반 Visual Critic
- 진단만 수행하며 단계 7 Partial Revision은 포함하지 않음

## 입력 경계

Critic에는 다음만 전달한다.

- 실제 PNG
- 페이지 목표
- 작은 Semantic 요약
- InformationPlan 핵심 구조
- 10개 항목 rubric
- Hard Gate PASS

저장소, 전체 대화, 긴 생성 reasoning, 전체 Memory는 전달하지 않는다.

## Fixture 결과

| Fixture | 사람의 핵심 finding | Critic 핵심 finding | 결과 |
|---|---|---|---|
| 정보 위계 문제 | BREAK와 +50%의 위계 부족 | hierarchy 발견 | 일치 |
| 정보 과밀 | 중앙에 정보가 몰리고 주변 공간을 쓰지 못함 | space-use 발견 | 허용 유형으로 일치 |
| 읽는 순서 문제 | 지그재그 흐름으로 순서 추적이 어려움 | reading-order 발견 | 일치 |
| 정상 결과 | blocking finding 없음 | actionable finding 없음, ready | 일치 |

문제 fixture는 핵심 문제만 라벨한 `core-only`다. 따라서 추가 finding은 자동으로 False Positive로 단정하지 않는다. 정상 fixture는 `exhaustive`이며 actionable False Positive는 0건이다.

## 최종 지표

- Problem Recall: 3/3 = 100%
- 정상 fixture actionable False Positive: 0건
- severity: 핵심 3건 모두 사람 라벨과 한 단계 이내
- 구체적인 수정 방향: 핵심 3건 모두 통과
- 원문/숫자 변경 제안: 0건
- Hard Gate 우회: 0건

## 실제 V1 결과

현재 threshold PNG는 `ready`로 판정됐다. 첫 시선은 BREAK로 향하고 좌측 buildup → BREAK → 우측 result 흐름을 이해할 수 있다고 평가했다. 정보성 finding 1건은 BREAK와 결과 영역의 연결선·텍스트 축 정렬 보완이다.

## 실행 설정과 비용

- Provider: OpenRouter
- Model: 환경 설정 `CRITIC_MODEL_ID` 사용
- 실제 검증 모델: `google/gemini-3.7-flash`
- Reasoning: `low`, reasoning 본문 제외
- 최종 채택 benchmark run: input 10,037 / output 1,952 / total 11,989 tokens
- 최종 채택 benchmark run 추정 비용: USD 0.01484775
- 같은 PNG와 구조화 결과는 `CRITIC_REPLAY=1`로 API 재호출 없이 다시 평가할 수 있음

세부 구조화 결과는 `output/v1-visual-critic/benchmark-report.json`에 저장한다.

