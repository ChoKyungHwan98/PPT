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
