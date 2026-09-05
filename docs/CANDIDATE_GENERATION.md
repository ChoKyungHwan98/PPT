# Validated Candidate Generation (R5)

같은 Source, SlideIR, mode, InformationPlan에서 호환되는 PatternFragment를 탐색해 최대 세 개의 CompositionPlan을 만든다. Layout family와 reading path가 같은 결과는 중복으로 제거한다. 유효 후보가 적으면 그 수만 반환하며 슬롯을 채우기 위한 복제품을 만들지 않는다.

각 후보는 CompositionPlan, RenderTree, 실제 PNG, Hard Gate 결과, pattern/reference provenance를 가진다. Composition 계약 또는 Hard Gate에 실패한 후보는 비교 화면에 들어가지 않는다.

MEC-01 production proof는 `accumulation-threshold-consequence`, `editorial-causal-spine`, `threshold-field`의 서로 다른 세 topology를 동일 semantic artifact에서 실제 렌더한다. 사용자 선택 계약은 choose A/B/C 또는 reject all이다. 선택을 Preference로 승격하는 규칙은 R6의 책임이다.
