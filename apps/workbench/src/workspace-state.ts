export type WorkspaceMode = 'edit' | 'meaning' | 'review';
export type OpenSurface = 'none' | 'source' | 'overview' | 'export';

export const FIXTURE_SOURCE = '회피 ×3 → 시간 파편 획득 → 시간 정지 5초 → BREAK → 받는 피해 +50%';

export const SEMANTIC_STEPS = [
  { id: 'dodge-step', order: '01', label: '회피 ×3', role: '조건' },
  { id: 'fragment-resource', order: '02', label: '시간 파편 획득', role: '획득' },
  { id: 'freeze-step', order: '03', label: '시간 정지 5초', role: '효과' },
  { id: 'break-state', order: '04', label: 'BREAK', role: '전환' },
  { id: 'damage-modifier', order: '05', label: '받는 피해 +50%', role: '결과' },
] as const;
