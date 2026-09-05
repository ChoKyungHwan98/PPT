# Preference, Evaluation and Memory (R6)

네 종류의 기록은 분리한다. Teacher Quality는 정보 구조 원칙의 신뢰도, Artifact Ready Quality는 제출 가능 여부, User Preference는 후보 사이의 개인 선택, Critic Findings는 실제 렌더 진단이다. 어느 기록도 다른 기록을 자동 승격하거나 강등하지 않는다.

후보 선택은 append-only `PreferenceEvidenceEvent` 한 건이다. 동일 semantic shape·mode·domain에서 1~2건은 weak, 3~4건은 emerging, 5건 이상이며 80% 이상 일관될 때만 established다. Design Profile은 established pattern이 있을 때만 생성되며 Hard Gate, Source Fidelity, Teacher Quality를 덮어쓸 수 없다.

학습용 export는 원본 event를 수정하지 않고 SFT critique, chosen-vs-rejected pairwise, Ready/Reject classification의 세 view를 만든다.
