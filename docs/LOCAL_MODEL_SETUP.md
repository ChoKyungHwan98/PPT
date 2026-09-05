# Local Visual Critic 설정

조사일: 2026-09-05

## afx-team/UI-UX 판단

- 공식 저장소는 UI-UX를 Qwen3.5-4B 기반, 16K context의 멀티모달 UX 진단 모델로 설명한다.
- Hugging Face 파일 메타데이터는 5B params/BF16으로 표시한다. 따라서 설치 용량은 4B라는 이름만 보고 계산하지 않는다.
- 라이선스는 MIT이며 별도 `LEGAL.md`도 함께 확인해야 한다.
- 공식 학습/평가는 모바일 UI의 가림, 닫기 제어, 내용 불일치 등 UX 결함 진단이 중심이다. 발표 장표의 편집 디자인 평가는 공식 검증 범위가 아니므로, 우리 Critic fixture로 별도 benchmark하기 전에는 품질을 가정하지 않는다.
- 공식 실행법은 Transformers와 vLLM이다. vLLM은 OpenAI-compatible endpoint를 제공하므로 현재 adapter의 기본 연결 방식으로 채택했다.

공식 자료:

- https://github.com/afx-team/UI-UX
- https://huggingface.co/afx-team/UI-UX

## 현재 PC

- GPU: NVIDIA GeForce RTX 4060 Ti
- VRAM: 8,188 MiB
- 시스템 RAM: 약 32 GB

BF16 원본 가중치는 4B면 약 8 GB, 5B면 약 10 GB가 가중치만으로 필요하다. 이미지 처리, KV cache, CUDA 여유 공간까지 고려하면 현재 8 GB GPU에 공식 BF16 구성을 그대로 올리는 것은 안전하지 않다.

## VRAM별 권장

| VRAM | 권장 상태 | 설정 방향 |
| --- | --- | --- |
| 8 GB | 실험만 | 공식 양자화본이 확인되기 전에는 기본 설치 금지. Transformers CPU offload는 가능하나 매우 느릴 수 있다. |
| 12 GB | 조건부 | 짧은 context와 낮은 이미지 해상도로 BF16/양자화를 각각 시험하고 OOM 여부를 측정한다. |
| 16 GB | 권장 시작점 | 단일 PNG Critic, 짧은 출력, 16K보다 작은 실제 context로 benchmark한다. |
| 24 GB 이상 | 여유 | 공식 vLLM BF16 설정을 우선 검증한다. 동시 요청은 초기에는 1개로 제한한다. |

위 표는 파라미터 수 × BF16 2 bytes와 런타임 여유 공간에 근거한 엔지니어링 추정이며, 제작자가 공표한 최소 VRAM 표가 아니다.

## 공식 vLLM 실행 형태

```bash
vllm serve afx-team/UI-UX --port 8000 --max-model-len 16384 \
  --dtype bfloat16 --enable-reasoning --reasoning-parser deepseek_r1
```

Windows 네이티브 vLLM 절차는 UI-UX 공식 문서에 없다. 이 PC에서는 WSL2/Linux 환경을 우선한다. Transformers는 Windows에서도 시도할 수 있지만 CUDA/PyTorch/Transformers 버전 호환을 별도 확인한다.

서비스 연결 환경 변수:

```text
LOCAL_CRITIC_ENDPOINT=http://127.0.0.1:8000/v1/chat/completions
LOCAL_CRITIC_MODEL=afx-team/UI-UX
```

OpenRouter를 선택할 때는 스튜디오에 저장한 키와 별도로 실행 환경에 `CRITIC_MODEL_ID`를 지정한다. 모델 ID는 코드 계약에 고정하지 않는다.

## 양자화

공식 UI-UX 저장소와 모델 카드에는 검증된 4-bit/8-bit 배포본이나 권장 양자화 설정이 없다. 따라서 임의 양자화 파일을 기본 경로로 자동 다운로드하지 않는다. 8 GB에서 사용하려면 먼저 출처·라이선스·정확도를 확인한 양자화본으로 Critic benchmark를 통과시켜야 한다.

## 다음 실제 inference 절차

1. WSL2/Linux에서 별도 Python 환경을 만든다.
2. 공식 요구 버전의 Transformers 또는 vLLM을 설치한다.
3. 모델 서버를 8000번 포트에 띄운다.
4. `/v1/models`와 단일 PNG 호출을 확인한다.
5. 기존 human-labelled Critic fixture로 오탐·누락·readiness 정확도를 비교한다.
6. 기준 미달이면 OpenRouter를 유지하고 로컬 모델을 기본값으로 승격하지 않는다.
