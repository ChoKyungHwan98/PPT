# Model Registry and Router (R3)

Provider와 model 선택은 `authoring-harness`의 Registry/Router가 담당한다. API key는 Registry에 저장하지 않고 환경 변수 경계를 유지한다.

Registry는 model identity, endpoint profile, base/adapter 관계, capability, role, context/output 한도, VRAM/quantization, benchmark 상태와 점수, latency/cost, active 상태와 version을 기록한다. `installed`와 `qualified`는 다르다. 실행 경로에는 `active && qualified`인 모델만 들어갈 수 있다.

Router는 역할과 capability를 먼저 검사한다. 기본 정책은 deterministic 해결, qualified local, 사용자가 exact modelId로 승인한 remote, 실패 순서다. local-first가 remote로 자동 fallback하지 않는다.

현재 runtime registry에는 local OpenAI-compatible critic과 OpenRouter critic profile이 등록된다. 둘 다 환경 설정 없이 `unbenchmarked/inactive`이며 자동 실행되지 않는다. 운영자가 benchmark 결과에 따라 status와 active를 명시적으로 설정해야 한다.
