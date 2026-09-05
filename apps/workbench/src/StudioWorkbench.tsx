import { useEffect, useMemo, useState } from 'react';
import { appendEvaluationEvent } from './studio-bridge.js';

type Finding = { findingId: string; issueType: string; severity: 'info' | 'warning' | 'error'; problem: string; reason: string; revisionDirection: string };
type DesignOutput = { artifactId: string; previewPngUrl: string; exports: Array<{ kind: 'png' | 'html' | 'pdf' | 'pptx'; url: string; editable: boolean }>; validation: { hardGatePassed: boolean }; critic: null | { firstFixation: { target: string; assessment: string }; submissionReadiness: 'ready' | 'needs-review' | 'not-ready'; findings: Finding[] }; readiness: string; trace: { semanticShape: string; selectedTeacherIds: string[]; appliedGuidanceIds: string[]; authoredContentHash: string; pngSha256: string } };
type CriticRun = { provider: string; model: string };

const api = 'http://127.0.0.1:8766';
const samples = {
  hierarchy: '제목: 전투 시스템 역할 구조\n메시지: 전투 규칙의 책임 범위를 기능 단위로 분리한다.\n구조:\n전투 시스템 책임자\n  플레이어 전투\n    이동/회피\n    공격/방어\n  보스 전투\n    패턴 선택\n    페이즈 전환',
  'aligned-before-after-spec': '제목: 보상 구조 개선\n기존 보상 구조:\n- 보상 상자 1개\n- 주간 보상 고정\n개선 보상 구조:\n- 보상 상자 2개\n- 주간 보상 선택\n메시지: 플레이 목표에 맞는 보상을 선택할 수 있는 보상 구조',
} as const;

export function StudioWorkbench() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const projectId = params.get('workspaceId') ?? 'local-project';
  const [structure, setStructure] = useState<keyof typeof samples>('hierarchy');
  const [content, setContent] = useState<string>(samples.hierarchy);
  const [output, setOutput] = useState<DesignOutput | null>(null);
  const [criticRun, setCriticRun] = useState<CriticRun | null>(null);
  const [busy, setBusy] = useState<'generate' | 'critic' | 'save' | null>(null);
  const [provider, setProvider] = useState<'local' | 'openrouter'>('local');
  const [message, setMessage] = useState('원고를 확인한 뒤 장표를 생성하세요.');
  const [serviceReady, setServiceReady] = useState<boolean | null>(null);
  useEffect(() => { void fetch(`${api}/api/designer/health`).then((res) => setServiceReady(res.ok)).catch(() => setServiceReady(false)); }, []);
  const changeStructure = (next: keyof typeof samples) => { setStructure(next); setContent(samples[next]); setOutput(null); };
  const generate = async () => {
    setBusy('generate'); setCriticRun(null); setMessage('내용을 보존하며 장표를 설계하고 있습니다.');
    try {
      const response = await fetch(`${api}/api/designer/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schemaVersion: '0.1', projectId, documentId: `document-${Date.now()}`, mode: 'document', authoredContent: content, authoredStructure: structure, outputProfile: 'screen-16:9' }) });
      const value = await response.json() as DesignOutput & { error?: string };
      if (!response.ok) throw new Error(value.error ?? '장표를 만들지 못했습니다.');
      setOutput(value); setMessage('원문과 배치 검사를 통과했습니다.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(null); }
  };
  const critique = async () => {
    if (!output) return; setBusy('critic'); setMessage('실제 장표 화면을 AI가 검토하고 있습니다.');
    try {
      const response = await fetch(`${api}/api/designer/jobs/${encodeURIComponent(output.artifactId)}/critic`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider }) });
      const value = await response.json() as { output?: DesignOutput; run?: CriticRun; error?: string };
      if (!response.ok || !value.output) throw new Error(value.error ?? 'AI 검토를 완료하지 못했습니다.');
      setOutput(value.output); setCriticRun(value.run ?? null); setMessage('AI 검토가 완료되었습니다.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(null); }
  };
  const decide = async (decision: 'ready' | 'reject') => {
    if (!output) return; setBusy('save');
    try {
      await appendEvaluationEvent({ schemaVersion: '0.1', eventId: `evaluation-${crypto.randomUUID()}`, artifactId: output.artifactId, png: { path: output.previewPngUrl, sha256: output.trace.pngSha256 }, authoredContentHash: output.trace.authoredContentHash, semanticShape: output.trace.semanticShape, selectedTeacherIds: output.trace.selectedTeacherIds, appliedGuidanceIds: output.trace.appliedGuidanceIds, critic: output.critic ? { provider: criticRun?.provider ?? provider, model: criticRun?.model ?? 'not-recorded', findings: output.critic.findings } : null, userDecision: decision, reasonTags: decision === 'ready' ? [] : ['aesthetics'], decidedAt: new Date().toISOString(), separation: { teacherQualityChanged: false, readyQualityRecorded: true, preferenceRecorded: false } });
      setMessage(decision === 'ready' ? '승인 판단을 프로젝트에 기록했습니다.' : '거절 판단을 프로젝트에 기록했습니다.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(null); }
  };
  const exportOf = (kind: 'png' | 'pdf' | 'pptx') => output?.exports.find((item) => item.kind === kind)?.url;
  return <div className="studio-workbench">
    <header className="studio-head"><div><b>기획서 디자이너</b><span>{serviceReady === false ? '실행 서비스 연결 필요' : serviceReady ? '준비됨' : '연결 확인 중'}</span></div><button disabled={busy !== null || !content.trim()} onClick={() => void generate()}>{output ? '다시 생성' : '장표 생성'}</button></header>
    <main className="studio-grid">
      <section className="source-pane"><header><h2>기획 원고</h2><select value={structure} onChange={(event) => changeStructure(event.target.value as keyof typeof samples)}><option value="hierarchy">역할 구조</option><option value="aligned-before-after-spec">전후 비교</option></select></header><textarea value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false}/><p>들여쓰기와 항목 대응이 정보 관계로 사용됩니다. 원문은 임의로 바꾸지 않습니다.</p></section>
      <section className="preview-pane"><div className="preview-status"><span>{busy === 'generate' ? '생성 중' : output?.validation.hardGatePassed ? '내용·배치 검사 통과' : '장표 미리보기'}</span></div><div className="preview-stage">{output ? <img src={output.previewPngUrl} alt="생성한 장표"/> : <div className="preview-empty"><b>장표가 여기에 표시됩니다.</b><span>원고를 확인하고 ‘장표 생성’을 누르세요.</span></div>}</div><footer>{(['png','pdf','pptx'] as const).map((kind) => exportOf(kind) ? <a key={kind} href={exportOf(kind)} download>{kind.toUpperCase()} 내보내기</a> : <button key={kind} disabled>{kind.toUpperCase()} 내보내기</button>)}</footer></section>
      <aside className="critic-pane"><header><h2>AI 검토</h2><select value={provider} onChange={(event) => setProvider(event.target.value as 'local' | 'openrouter')}><option value="local">내 컴퓨터</option><option value="openrouter">OpenRouter</option></select></header>{output?.critic ? <div className="critic-result"><div className={`readiness ${output.critic.submissionReadiness}`}><b>{output.critic.submissionReadiness === 'ready' ? '제출 가능' : output.critic.submissionReadiness === 'not-ready' ? '수정 필요' : '검토 필요'}</b><span>{output.critic.firstFixation.assessment}</span></div>{output.critic.findings.map((finding) => <article key={finding.findingId}><b>{finding.problem}</b><p>{finding.reason}</p><small>{finding.revisionDirection}</small></article>)}</div> : <div className="critic-empty"><p>장표를 만든 뒤 실제 화면을 기준으로 위계·여백·관계를 검토합니다.</p><button disabled={!output || busy !== null} onClick={() => void critique()}>AI 검토 시작</button></div>}<div className="decision"><button disabled={!output || busy !== null} onClick={() => void decide('reject')}>거절</button><button className="approve" disabled={!output || busy !== null} onClick={() => void decide('ready')}>승인</button></div><p className="work-message">{message}</p></aside>
    </main>
  </div>;
}
