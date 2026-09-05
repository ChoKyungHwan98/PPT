# AI Usage, Budget, Cost and Cache (R2)

모든 AI 호출은 `authoring-harness`의 `AIUsageManager`를 경유한다. Domain provider는 모델 호출과 구조화 응답만 담당하고, Harness가 실행 식별자·예산·비용·캐시를 기록한다.

## 기본 예산

한 artifact에서 Interpretation, Design suggestion, Visual Critic, Revision은 각각 최대 1회다. deterministic 경로로 끝난 단계는 AI 호출 0회로 남는다. 예산을 넘으면 provider를 호출하기 전에 중단한다. 실패 시 다른 유료 provider로 자동 전환하지 않는다.

## 기록

Activity에는 run/project/document/artifact, 역할, provider/model, local/remote, byte와 token 사용량, 비용, 지연, cache hit, context artifact, context budget, 출력 한도, prompt/schema version 및 content/context/image hash가 기록된다. Run summary는 실제 provider 호출 수와 token·비용·local/remote 횟수를 집계한다. Cache hit는 activity에는 남지만 AI 호출 수와 비용에는 포함하지 않는다.

## 캐시

캐시는 로컬 파일 시스템에만 저장한다. Key는 task·role·provider·model·prompt/schema version·canonical artifact hashes·이미지 hash·compact context hash·generation parameters·output limit의 content hash다. 하나라도 바뀌면 miss다. 값은 반환 전에 동일 Zod schema로 다시 검증한다. 사용자 자료를 remote shared cache로 올리지 않는다.

현재 실제 연결점은 Visual Critic이다. 기존 Critic의 token/cost run record를 보존하면서 Harness activity와 run summary를 `job.json`에 함께 기록한다.
