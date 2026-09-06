# R9 Trained Model Registry / Deployment

학습 완료와 실제 사용을 분리한다.

```text
adapter saved
→ unbenchmarked
→ human-labelled benchmark
→ regression gate
→ qualified 또는 rejected
→ 사용자 활성화
→ Router 후보
```

R8 smoke adapter는 실제 저장·재로딩·추론에는 성공했지만, 데이터가 4건이고 Ready Positive가 0건이다. 따라서 `unbenchmarked`, `active=false`로 등록한다. 품질 향상이나 production 사용 가능 상태로 간주하지 않는다.

## Benchmark 계약

Visual Critic benchmark는 finding recall, false positive, readiness accuracy, severity appropriateness, suggestion specificity, latency, VRAM, cost를 기록한다. Source Fidelity 위반이나 원문 수정 환각이 하나라도 있거나 false positive가 baseline보다 0.15 초과 증가하면 qualified가 될 수 없다.

현재 데이터로는 충분한 benchmark를 실행하지 않는다. 부족함을 숨기지 않고 registry에 benchmark `null`로 남긴다.

## 활성화와 되돌리기

qualified 모델만 사용자가 명시적으로 활성화할 수 있다. 활성 학습 모델은 전역 공유 registry에 하나만 존재한다. 이전 활성 모델 ID는 rollback stack에 남고, 여전히 qualified일 때만 되돌릴 수 있다. 프로젝트 화면은 이 전역 registry를 조회하지만 프로젝트별로 모델 파일을 복제하지 않는다.

Router는 active이면서 qualified인 로컬 모델만 사용한다. 조건을 만족하는 로컬 모델이 없으면 자동으로 유료 원격 모델을 호출하지 않는다.

## Runtime 연결 상태

Visual Critic 요청 직전에 base runtime registry와 trained registry를 병합한다. trained entry가 Router에서 선택되면 일반 local endpoint가 아니라 adapter-aware provider가 `baseModel + adapterPath`를 실제 Transformers/PEFT runtime에 전달한다. R8 smoke adapter로 registry entry 읽기, base model load, adapter load, PNG image inference까지 통과한 실행 증거는 `packages/local-training/artifacts/r8-smoke/runtime-adapter-proof.json`에 보존한다. 이 증거는 adapter 사용만 증명하며 품질을 주장하지 않는다.

현재 등록 모델은 `unbenchmarked`, `active=false`다. 평가 API는 적격 데이터가 확보되면 같은 human-labelled PNG를 adapter 모델과 base-model baseline에 실제로 입력하고, 결과를 `recordVisualCriticBenchmark()`를 통해 registry에 기록한다. activation/rollback gate도 연결돼 있다. 다만 현재 데이터는 benchmark eligibility를 충족하지 않으므로 실제 품질 benchmark와 활성화는 실행하지 않는다.
