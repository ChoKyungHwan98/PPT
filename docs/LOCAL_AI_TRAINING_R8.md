# R8 Local AI Training Pipeline

상태: **production human-data → immutable dataset → eligibility → quality LoRA job 경로 완료.** 현재 실제 자료와 이 컴퓨터 환경에서는 품질 학습을 실행하지 않았다.

## 실제 데이터 원천

사용자의 명시적인 평가와 후보 선택은 기존 artifact 기록을 그대로 둔 채 아래 append-only index로 집계한다.

```text
workspace/training-data/
  evaluations.jsonl
  preferences.jsonl
  datasets/<datasetId>/
  runs/<trainingRunId>/
```

- Ready Positive는 `userDecision=ready`인 사용자 판단만 센다.
- Critic의 ready 판정, 후보 선택, curated Teacher는 Ready Positive가 아니다.
- 후보 선호는 Critic SFT와 섞지 않고 `preference.jsonl`에 분리한다.
- 동일 eventId는 두 번 추가하지 않는다.
- 원본 job/evaluation과 PNG 경로·hash·원문 hash·RenderTree fingerprint를 유지하고 dataset build 시 다시 검증한다.

2026-09-07 현재 실제 집계:

- 사용자 평가 1건: Ready 0 / Reject 1
- 후보 선택 1건
- 학습 가능한 pairwise 비교 0건(후보 1개 중 선택한 기록이므로 pair가 아님)
- smoke fixture 4건은 위 숫자에 포함하지 않음

## Production dataset

`POST /api/designer/training/dataset/build`는 현재 human-event store와 실제 PNG를 검증한 뒤 새 immutable snapshot을 만든다. 같은 events/seed/split이면 같은 ID와 hash를 재사용하고, event가 달라지면 새 디렉터리를 만든다.

현재 snapshot:

- path: `workspace/training-data/datasets/critic-production-fd55742035311270`
- datasetId: `critic-production-fd55742035311270`
- datasetSha256: `fd557420353112700380506ef390cc26c9acaca0bbd51afdeb20cfa78701353e`
- train / validation: 1 / 0

Split은 `authoredContentHash` 단위다. 같은 원문에서 나온 artifact/후보 변형은 train과 validation 양쪽에 나뉘지 않는다. Dataset build는 event schema, source event hash, artifact identity, PNG/candidate hash, 명시적 human decision, 중복 event 및 split leakage를 검사한다.

## Eligibility

Production quality training 최소 기준:

- human-labelled 20건 이상
- Ready Positive 3건 이상
- validation 2건 이상

현재 `qualityTraining=false`다. 부족한 항목은 사람 평가 19건, Ready Positive 3건, validation 2건이다. 자료가 부족한 동안 `/training/start`의 quality 요청은 409로 거부된다.

## Quality와 smoke 분리

`train_visual_critic.py`는 두 모드를 명시적으로 분리한다.

- `--mode smoke`: 기존 SmolVLM 256M, 1 optimizer step, pipeline proof, quality claim 없음
- `--mode quality`: 지정한 immutable production dataset과 직렬화된 config를 사용한 실제 LoRA/QLoRA job

Quality config에는 dataset ID/hash, base model/revision, LoRA 설정, epoch, learning rate, batch, gradient accumulation, seed, device, quantization, sample/validation 한도를 고정한다. 완료 adapter는 `trained-unbenchmarked`, `qualityClaim=false`, `active=false`로 R9 Registry에 등록하며 자동 활성화하지 않는다.

고정 smoke manifest와 기존 adapter proof는 회귀용으로 유지한다.

```text
packages/local-training/data/critic-smoke-v1.manifest.json
packages/local-training/artifacts/r8-smoke/
```

## 실측 환경과 model gate

- GPU: NVIDIA GeForce RTX 4060 Ti, 8,188 MiB VRAM
- Driver: 610.47
- RAM: 약 32 GB
- OS: Windows
- 2026-09-07 C: 여유 공간: 약 23.98 GB

우선 후보 `afx-team/UI-UX`는 MIT 라이선스의 Qwen3.5 기반 5B multimodal UI/UX 진단 모델이며 저장소 크기는 약 9.1 GB다. 현재는 다음 세 이유로 quality job을 차단한다.

- 검증된 안전 기준 12 GB VRAM 미만
- 안전 여유 기준 30 GB disk 미만
- Windows bitsandbytes/Qwen3.5 4-bit 조합이 이 컴퓨터에서 아직 검증되지 않음

자료 기준과 실행 환경을 모두 통과해야만 quality job이 시작된다. 하드웨어만 충족하거나 자료만 충족한 상태를 성공으로 표시하지 않는다.

## Product API/UI

- `GET /api/designer/training/status`: 실제 평가/Ready/Reject/Preference/Pairwise, 최신 production dataset, data/runtime eligibility, 최신 quality run
- `POST /api/designer/training/dataset/build`: 실제 human events로 immutable snapshot 생성
- `POST /api/designer/training/start`: 요청한 정확한 `datasetId`로 quality job 준비·실행
- `GET /api/designer/training/runs/:runId`: 영속 run 상태 조회

일반 사용자 UI는 production 숫자와 차단 이유만 보여준다. Smoke는 developer/debug 정보로만 분리되어 production count나 품질 학습 버튼 상태에 영향을 주지 않는다.

**R8 경로가 완료됐다는 것은 자료와 환경이 충분해졌을 때 실제 quality training을 실행할 수 있다는 뜻이다. 현재 모델 품질 향상이나 portfolio-ready 생성을 뜻하지 않는다.**
