# 게임기획 스튜디오 연결 V1

상태: 구현 완료(지원 구조 제한)

## 사용자 흐름

`기획 원고 → 장표 생성 → 실제 미리보기 → Hard Gate → AI 검토 → 승인/거절 → 내보내기`

스튜디오 화면에는 내부 계약 이름을 표시하지 않는다. 사용자는 `기획 원고`, `장표`, `AI 검토`, `다시 생성`, `승인`, `거절`, `내보내기`만 본다.

## 연결 방식

- PPT Designer는 `도구/기획서 디자이너/game-ppt-designer-next`에 독립 엔진으로 남는다.
- 게임기획 스튜디오는 새 Workbench 정적 빌드를 `/tools/deck/`에 탑재한다.
- 스튜디오 실행 시 로컬 엔진 서비스(`127.0.0.1:8766`)를 별도 프로세스로 시작한다.
- Workbench는 공개 입출력 계약으로만 엔진을 호출한다.
- 승인/거절 이벤트는 스튜디오의 기존 artifact 저장 브리지를 사용해 활성 프로젝트에 보존한다.

## V1 지원 범위

현재 직접 입력은 V1에서 검증한 다음 두 구조만 허용한다.

- 전후 비교: 같은 개수의 `기존`/`개선` 항목
- 역할 구조: 들여쓰기로 명시한 부모/자식 관계

지원하지 않는 자유 형식 원고를 되는 것처럼 추측하지 않는다. 이후 Interpreter가 안정화될 때 지원 구조를 확장한다.

## 안전 경계

- 실제 생성은 기존 해석, 정보 설계, curated Teacher 선택, Composition, RenderTree, Hard Gate, exporter를 통과한다.
- Hard Gate가 실패하면 PNG와 AI 검토를 제공하지 않는다.
- Critic은 실제 PNG와 작은 구조 요약만 받고 원문 변경 권한이 없다.
- Teacher 품질, Ready 판단, 취향, Critic finding은 별도 필드다.

## 평가 데이터

원본 이벤트는 `ppt-designer-evaluation-events-v1` artifact에 저장한다. `buildCritiqueDataset()`과 `buildPairwiseDataset()`은 원본 이벤트를 향후 SFT/선호학습 실험용 레코드로 변환하지만 학습은 실행하지 않는다.

