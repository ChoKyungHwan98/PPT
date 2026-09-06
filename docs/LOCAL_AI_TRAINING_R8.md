# R8 Local AI Training Pipeline

상태: 실제 LoRA adapter pipeline smoke proof 구현. 품질 학습 완료가 아니다.

## 실측 환경

- OS: Windows 10 Home 10.0.19045
- CPU: AMD Ryzen 5 7500F, 6 cores / 12 logical processors
- RAM: 31.65 GB
- GPU: NVIDIA GeForce RTX 4060 Ti, 8,188 MiB VRAM
- NVIDIA driver: 610.47
- CUDA reported by `nvidia-smi`: 13.3
- Python used by proof: CPython 3.12.7 in `C:\Users\Admin\.cache\game-ppt-training-venv`
- 측정 당시 C: 여유 공간: 14.71 GB

## Base model 판단

우선 후보 `afx-team/UI-UX`는 MIT 라이선스의 5B vision 모델이며 저장소가 약 9.1 GB다. 현재 8 GB VRAM, Windows, 14.71 GB 여유 공간에서는 안전한 LoRA 학습 proof 대상으로 보기 어렵다. 이 모델은 Registry 후보로 남기되 실행하지 않았다.

실제 smoke proof에는 `HuggingFaceTB/SmolVLM-256M-Instruct`를 사용한다. Apache-2.0, 256M multimodal 모델이며 공식 Transformers fine-tuning 예시가 있다. 이 선택은 adapter 저장/재로딩/inference 경로를 저비용으로 검증하기 위한 것이며 production Visual Critic 품질을 대신하지 않는다.

## 데이터와 실행 경계

사람이 직접 라벨한 visual fixture 4개만 사용한다. Ready Positive는 0개다. seed 42로 3 train / 1 validation을 고정하며, 실제 forward/backward/optimizer step은 1회만 실행한다. full fine-tuning, QLoRA, DPO는 실행하지 않는다.

실행 결과는 `packages/local-training/artifacts/r8-smoke/run-record.json`에 기록한다. adapter는 저장 후 새 base model에 다시 불러오고 한 번의 image inference를 수행한다. 이 proof의 유일한 결론은 `학습 경로가 실제로 닫힌다`이다. 성능 향상이나 benchmark 통과를 주장하지 않는다.

학습 완료 adapter는 자동 활성화되지 않는다. R9에서 먼저 unbenchmarked로 등록한 뒤 별도 benchmark와 사용자 활성화를 거쳐야 한다.

## 제품 연결 상태

학습 자료 점검, quality/smoke 모드 구분, 실행 eligibility, 학습 run 상태 조회가 서버 API에 연결됐다. 현재 4개의 human label과 Ready Positive 0개로는 quality training 및 신뢰할 수 있는 benchmark를 실행하지 않는다. 개발자 smoke는 명시적인 환경 설정이 있을 때만 별도 경로로 실행된다.
