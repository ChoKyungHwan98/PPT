const CHANNEL = 'gds:tool';

type HostResponse = { channel?: string; type: string; requestId?: string; [key: string]: unknown };

function request(type: string, payload: Record<string, unknown>): Promise<HostResponse> {
  const requestId = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { window.removeEventListener('message', receive); reject(new Error('스튜디오 저장 응답이 없습니다.')); }, 8000);
    const receive = (event: MessageEvent<HostResponse>) => {
      if (event.data?.channel !== CHANNEL || event.data.requestId !== requestId) return;
      window.clearTimeout(timer); window.removeEventListener('message', receive); resolve(event.data);
    };
    window.addEventListener('message', receive);
    window.parent.postMessage({ channel: CHANNEL, type, requestId, ...payload }, '*');
  });
}

export async function appendEvaluationEvent(event: unknown): Promise<void> {
  if (window.parent === window) {
    const events = JSON.parse(localStorage.getItem('ppt-designer-evaluation-events') ?? '[]') as unknown[];
    localStorage.setItem('ppt-designer-evaluation-events', JSON.stringify([...events, event]));
    return;
  }
  const artifactId = 'ppt-designer-evaluation-events-v1';
  const loaded = await request('artifact:load', { artifactId });
  const revision = typeof loaded.revision === 'number' ? loaded.revision : 0;
  const current = loaded.found === true && loaded.data && typeof loaded.data === 'object' && Array.isArray((loaded.data as { events?: unknown[] }).events)
    ? (loaded.data as { events: unknown[] }).events : [];
  const saved = await request('artifact:save', { artifactId, expectedRevision: revision, data: { schemaVersion: '0.1', events: [...current, event] } });
  if (saved.type !== 'artifact:saved') throw new Error('평가 기록이 다른 창에서 변경되었습니다. 다시 시도하세요.');
}

