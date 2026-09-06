# Product Integration R2–R9 Completion

## 최종 통합 결과

R2부터 R9까지의 기능 계약을 실제 제품 경로에 연결했다. `/jobs`는 Hard Gate를 통과한 실제 후보 1~3개를 반환하고, 사용자의 후보 선택/전체 거절은 Ready 판단과 분리된 Preference evidence로 저장된다. 프로젝트 목록·검색·최근 작업은 로컬 영구 저장소를 사용한다.

```text
프로젝트
→ 기획서 또는 발표자료
→ mode별 Information Design
→ Teacher / Reference
→ 유효 후보 1–3개
→ Hard Gate
→ 실제 PNG
→ 선택적 Local/Remote Critic
→ 사용자 승인/거절과 Preference evidence
→ PNG / HTML / PDF / editable PPTX

사람 평가
→ 고정 dataset
→ 서버 eligibility 검사
→ bounded LoRA smoke
→ adapter 저장·재로딩
→ global trained-model registry (unbenchmarked)
→ benchmark regression gate
→ 사용자 활성화
→ runtime registry와 trained registry merge
→ qualified active local model만 Router 후보
→ base model + 실제 adapter path로 Visual Critic 추론
```

모델 평가 API는 현재 자료 부족을 실제로 거부하며 registry를 `unbenchmarked`로 유지한다. 후보 비교, Preference 갱신, 프로젝트 저장, 학습 자료 점검/학습 guard, 모델 활성화/rollback, AI usage 표시까지 UI와 서버가 같은 artifact를 사용한다.

## 실제 한계

Visual Critic 학습 자료는 human-labelled 4건, Ready Positive 0건이다. 따라서 실행한 것은 1 optimizer step의 adapter pipeline smoke이며 실제 품질 개선 학습이 아니다. 저장된 모델을 unbenchmarked로 등록했고 자동 활성화하지 않았다.

`afx-team/UI-UX`는 조사했지만 5B/약 9.1 GB 모델 저장소를 현재 8 GB VRAM과 14.71 GB 디스크 여유의 Windows 환경에서 안전한 학습 proof로 실행하지 않았다. smoke에는 256M multimodal base model을 사용했다.

## 다음 품질 과제

R2–R9 functional end-to-end integration은 완료됐지만 portfolio-ready 생성 품질은 완료되지 않았다. 실제 사용자 승인 Ready Positive를 확보하고, 더 많은 exhaustive visual labels와 pairwise 선택을 수집한 뒤에야 의미 있는 Critic 학습과 benchmark가 가능하다.

**Functional integration complete ≠ Portfolio-quality generation complete.** 현재 Ready Positive는 0개다.
