# External Master Reference — 2025 Game Design Slides

이 묶음은 GAME PPT DESIGNER의 **외부 고급 참고자료(External Master Reference)** 입니다.

## 매우 중요

이 6장은 **ready Golden Case가 아닙니다.**
사용자가 실제 결과 이미지를 보고 명시적으로 승인하기 전에는 어떤 이미지도 `ready`, `positive fixture`, `Golden Case`로 승격하면 안 됩니다.

### 이 자료에서 배울 것

- 문제를 한 장에서 어떻게 정의하는가
- 복잡한 기능을 어떤 정보 단위로 분해하는가
- Before / After, 대립, 병렬 비교를 어떻게 구성하는가
- 원인 → 문제 → 대응 관계를 어떻게 시각화하는가
- 실제 게임 화면/카드/조직도에 annotation을 어떻게 붙이는가
- 제목, 본문, 도식, 강조 문구가 어떤 위계로 협력하는가

### 이 자료에서 복제하면 안 되는 것

- CEDEC 행사 프레임
- 회사 로고 / 브랜드 색
- 캐릭터 IP
- 픽셀 단위 좌표
- 특정 장표의 표면적인 템플릿
- 장식 요소를 맥락 없이 재사용하는 것

## References

1. `01_pokemon_problem_task-leak.png`
   - Grammar: Problem / Diagnosis
   - 핵심: 기존 프로세스가 왜 실패하는지를 흐름 내부에서 시각적으로 보여줌.

2. `02_pokemon_card-format-concept.png`
   - Grammar: Feature Concept / UI Annotation
   - 핵심: 하나의 대상에 여러 설계 요소를 annotation으로 연결.

3. `03_pokemon_initiative-team-structure.png`
   - Grammar: Organization / Structure
   - 핵심: 설명 텍스트와 구조 도식을 병치해 복잡한 구조를 한 장에 전달.

4. `04_shadowverse_accessibility-vs-competitiveness.png`
   - Grammar: Trade-off / Problem Framing
   - 핵심: 서로 충돌하는 설계 목표를 대립 구조로 명확히 정의.

5. `05_shadowverse_super-evolution.png`
   - Grammar: Before-After / Feature Spec
   - 핵심: 기존/신규 사양을 좌우 비교해 변경점을 즉시 읽게 함.

6. `06_shadowverse_rules-vs-card-ability.png`
   - Grammar: System Comparison / Countermeasure
   - 핵심: 서로 다른 대응 레이어를 병렬 구조로 비교.

## Codex 처리 원칙

각 이미지를 단순 image embedding이나 template source로 취급하지 말고,
`Information Structure → Visual Grammar → Applicability → Avoid/Boundary`
형태로 분석할 것.

가능하면 각 reference에서 다음만 추출할 것:

- page goal
- information grammar
- visual hierarchy
- reading path
- grouping
- relation representation
- evidence/annotation pattern
- why it works
- when to use
- when not to use

결과는 좌표 복제가 아니라 **재사용 가능한 원칙**이어야 합니다.
