import { useEffect, useMemo, useState } from 'react';
import { appendEvaluationEvent } from './studio-bridge.js';

type Finding = { findingId: string; issueType: string; severity: 'info' | 'warning' | 'error'; region?: string; problem: string; reason: string; revisionDirection: string };
type Candidate = { candidateId: string; previewPngUrl: string; label: string; validation: { hardGatePassed: boolean } };
type DesignOutput = { artifactId: string; previewPngUrl: string; candidates?: Candidate[]; exports: Array<{ kind: 'png' | 'html' | 'pdf' | 'pptx'; url: string; editable: boolean }>; validation: { hardGatePassed: boolean }; critic: null | { firstFixation: { target: string; assessment: string }; submissionReadiness: 'ready' | 'needs-review' | 'not-ready'; findings: Finding[] }; readiness: string; trace: { semanticShape: string; selectedTeacherIds: string[]; appliedGuidanceIds: string[]; authoredContentHash: string; pngSha256: string } };
type CriticRun = { provider: string; model: string; inputTokens?: number; outputTokens?: number; estimatedCostUsd?: number; cacheHit?: boolean };
type Surface = 'none' | 'source' | 'review' | 'activity' | 'history' | 'compare';
type ProductArea = '기획서' | '발표자료' | 'AI 학습' | '모델 관리';
type TrainingStatus = { evaluationCount: number; readyCount: number; rejectCount: number; pairwiseCount: number; reasonTags: Array<[string, number]>; dataset: { datasetId: string; sha256: string; trainCount: number; validationCount: number }; eligibility: { meaningfulTraining: boolean; smokeTraining: boolean; reason: string }; latestRun: { trainingRunId: string; status: string; baseModel: string; finalLoss: number; adapterReloaded: boolean; inferenceSmoke: { passed: boolean } } };

const api = 'http://127.0.0.1:8766';
const samples = {
  hierarchy: '제목: 전투 시스템 역할 구조\n메시지: 전투 규칙의 책임 범위를 기능 단위로 분리한다.\n구조:\n전투 시스템 책임자\n  플레이어 전투\n    이동/회피\n    공격/방어\n  보스 전투\n    패턴 선택\n    페이즈 전환',
  'aligned-before-after-spec': '제목: 보상 구조 개선\n기존 보상 구조:\n- 보상 상자 1개\n- 주간 보상 고정\n개선 보상 구조:\n- 보상 상자 2개\n- 주간 보상 선택\n메시지: 플레이 목표에 맞는 보상을 선택할 수 있는 보상 구조',
} as const;

function Mark() { return <span className="product-mark" aria-hidden="true">기</span>; }

function LearningModule({ status, onBack }: { status: TrainingStatus | null; onBack: () => void }) {
  return <div className="product-shell"><header className="product-top"><button className="crumb" onClick={onBack}>‹ 도로시아</button><b>AI 학습</b><span>기획서 디자이너</span></header><main className="module-overview training-module"><header><h1>AI 학습</h1><p>사람이 남긴 실제 판단만 학습 자료로 묶고, 품질 검증 전에는 모델을 사용하지 않습니다.</p></header><div className="training-grid"><section className="training-summary"><article><small>사람 평가</small><b>{status?.evaluationCount ?? '—'}</b><p>Ready {status?.readyCount ?? 0} · Reject {status?.rejectCount ?? 0}</p></article><article><small>후보 선택쌍</small><b>{status?.pairwiseCount ?? '—'}</b><p>선택과 품질 판정은 별도로 보관</p></article><article><small>고정 데이터</small><b>{status ? `${status.dataset.trainCount} / ${status.dataset.validationCount}` : '—'}</b><p>학습 / 검증</p></article></section><section className="training-run"><div><small>학습 가능 여부</small><strong>{status?.eligibility.meaningfulTraining ? '품질 학습 가능' : '검증용 실행만 가능'}</strong><p>{status?.eligibility.reason ?? '학습 상태를 불러오는 중입니다.'}</p></div><button disabled={!status?.eligibility.meaningfulTraining}>품질 학습 시작</button><em>데이터가 부족할 때는 실행 버튼이 열리지 않습니다.</em></section><section className="training-evidence"><header><b>문제 이유 분포</b><span>{status?.dataset.datasetId ?? '—'}</span></header>{status?.reasonTags.map(([tag, count]) => <div key={tag}><span>{tag}</span><i style={{ width: `${Math.min(100, count * 18)}%` }}/><b>{count}</b></div>)}</section><section className="training-complete"><small>최근 검증 실행</small><b>{status?.latestRun.trainingRunId ?? '없음'}</b><p>{status ? `${status.latestRun.baseModel} · 어댑터 재로딩 ${status.latestRun.adapterReloaded ? '성공' : '실패'} · 추론 ${status.latestRun.inferenceSmoke.passed ? '성공' : '실패'}` : '불러오는 중'}</p><span>완료된 모델은 자동으로 활성화되지 않습니다.</span></section></div><button className="module-back" onClick={onBack}>프로젝트로 돌아가기</button></main></div>;
}

export function StudioWorkbench() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const projectId = params.get('workspaceId') ?? 'dorothea';
  const [screen, setScreen] = useState<'projects' | 'project' | 'workspace' | 'learning' | 'models'>('projects');
  const [area, setArea] = useState<ProductArea>('기획서');
  const [mode, setMode] = useState<'document' | 'presentation'>('document');
  const [structure, setStructure] = useState<keyof typeof samples>('hierarchy');
  const [content, setContent] = useState<string>(samples.hierarchy);
  const [output, setOutput] = useState<DesignOutput | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState(0);
  const [criticRun, setCriticRun] = useState<CriticRun | null>(null);
  const [busy, setBusy] = useState<'generate' | 'critic' | 'save' | null>(null);
  const [provider, setProvider] = useState<'local' | 'openrouter'>('local');
  const [surface, setSurface] = useState<Surface>('none');
  const [message, setMessage] = useState('원고를 확인한 뒤 장표를 생성하세요.');
  const [serviceReady, setServiceReady] = useState<boolean | null>(null);
  const [history, setHistory] = useState<Array<{ artifactId: string; at: string; preview: string }>>([]);
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus | null>(null);
  useEffect(() => { void fetch(`${api}/api/designer/health`).then((res) => setServiceReady(res.ok)).catch(() => setServiceReady(false)); }, []);
  useEffect(() => { if (screen === 'learning') void fetch(`${api}/api/designer/training/status`).then((response) => response.ok ? response.json() : null).then((value) => setTrainingStatus(value as TrainingStatus | null)).catch(() => setTrainingStatus(null)); }, [screen]);

  const openArea = (next: ProductArea) => {
    setArea(next);
    if (next === 'AI 학습') { setScreen('learning'); return; }
    if (next === '모델 관리') { setScreen('models'); return; }
    setMode(next === '기획서' ? 'document' : 'presentation');
    setScreen('workspace');
  };
  const changeStructure = (next: keyof typeof samples) => { setStructure(next); setContent(samples[next]); setOutput(null); setSurface('source'); };
  const generate = async () => {
    setBusy('generate'); setCriticRun(null); setMessage('내용을 보존하며 장표를 설계하고 있습니다.');
    try {
      const response = await fetch(`${api}/api/designer/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schemaVersion: '0.1', projectId, documentId: `document-${Date.now()}`, mode, authoredContent: content, authoredStructure: structure, outputProfile: 'screen-16:9' }) });
      const value = await response.json() as DesignOutput & { error?: string };
      if (!response.ok) throw new Error(value.error ?? '장표를 만들지 못했습니다.');
      setOutput(value); setSelectedCandidate(0); setSurface('none'); setMessage('원문과 배치 검사를 통과했습니다.');
      setHistory((current) => [{ artifactId: value.artifactId, at: new Date().toISOString(), preview: value.previewPngUrl }, ...current]);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(null); }
  };
  const critique = async () => {
    if (!output) return; setBusy('critic'); setMessage('실제 장표 화면을 AI가 검토하고 있습니다.');
    try {
      const response = await fetch(`${api}/api/designer/jobs/${encodeURIComponent(output.artifactId)}/critic`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider }) });
      const value = await response.json() as { output?: DesignOutput; run?: CriticRun; error?: string };
      if (!response.ok || !value.output) throw new Error(value.error ?? 'AI 검토를 완료하지 못했습니다.');
      setOutput(value.output); setCriticRun(value.run ?? null); setSurface('review'); setMessage('AI 검토가 완료되었습니다.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(null); }
  };
  const decide = async (decision: 'ready' | 'reject') => {
    if (!output) return; setBusy('save');
    try {
      const event = { schemaVersion: '0.1', eventId: `evaluation-${crypto.randomUUID()}`, artifactId: output.artifactId, png: { path: output.previewPngUrl, sha256: output.trace.pngSha256 }, authoredContentHash: output.trace.authoredContentHash, semanticShape: output.trace.semanticShape, selectedTeacherIds: output.trace.selectedTeacherIds, appliedGuidanceIds: output.trace.appliedGuidanceIds, critic: output.critic ? { provider: criticRun?.provider ?? provider, model: criticRun?.model ?? 'not-recorded', findings: output.critic.findings } : null, userDecision: decision, reasonTags: decision === 'ready' ? [] : ['aesthetics'], decidedAt: new Date().toISOString(), separation: { teacherQualityChanged: false, readyQualityRecorded: true, preferenceRecorded: false } };
      const response = await fetch(`${api}/api/designer/jobs/${encodeURIComponent(output.artifactId)}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error ?? '판단을 기록하지 못했습니다.');
      await appendEvaluationEvent(event); setMessage(decision === 'ready' ? '이 결과를 승인 기록에 남겼습니다.' : '이 결과를 거절 기록에 남겼습니다.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(null); }
  };
  const candidates = output?.candidates?.length ? output.candidates : output ? [{ candidateId: output.artifactId, previewPngUrl: output.previewPngUrl, label: '현재 결과', validation: output.validation }] : [];
  const preview = candidates[selectedCandidate]?.previewPngUrl ?? output?.previewPngUrl;
  const exportOf = (kind: 'png' | 'pdf' | 'pptx') => output?.exports.find((item) => item.kind === kind)?.url;

  if (screen === 'projects') return <div className="product-shell"><header className="product-top"><div><Mark/><b>게임 기획 스튜디오</b></div><span>기획서 디자이너</span></header><main className="project-browser"><header><div><small>작업 공간</small><h1>프로젝트</h1><p>기획 문서와 발표자료를 프로젝트별로 이어서 관리합니다.</p></div><button onClick={() => setScreen('project')}>새 프로젝트</button></header><label className="project-filter">⌕ <input aria-label="프로젝트 검색" placeholder="프로젝트 검색"/></label><section className="project-cards"><button onClick={() => setScreen('project')}><span className="project-thumb"><i>도로시아</i><b>전투 밸런스</b></span><strong>도로시아</strong><small>최근 문서 · 전투 시스템 역할 구조</small><time>{new Date().toLocaleDateString('ko-KR')} 수정</time></button><button className="project-create" onClick={() => setScreen('project')}><b>＋</b><span>새 프로젝트 만들기</span></button></section></main></div>;

  if (screen === 'project') return <div className="product-shell"><header className="product-top"><button className="crumb" onClick={() => setScreen('projects')}>‹ 프로젝트</button><b>도로시아</b><span>로컬에 저장됨</span></header><main className="project-overview"><header><small>프로젝트</small><h1>도로시아</h1><p>게임 기획의 논리, 발표자료, AI 검토 기록을 한곳에서 관리합니다.</p></header><section className="area-grid">{(['기획서','발표자료','AI 학습','모델 관리'] as ProductArea[]).map((item, index) => <button key={item} onClick={() => openArea(item)}><span>0{index + 1}</span><h2>{item}</h2><p>{item === '기획서' ? '세부 규칙과 관계를 보존한 문서' : item === '발표자료' ? '핵심 메시지가 먼저 보이는 발표용 페이지' : item === 'AI 학습' ? '내 선택과 검토 기록으로 학습 자료 관리' : '설치된 모델과 검증 상태 관리'}</p><b>열기 →</b></button>)}</section><section className="recent-work"><div><h2>최근 작업</h2><span>{history.length}개</span></div>{history.length ? history.map((item) => <button key={item.artifactId} onClick={() => setScreen('workspace')}><img src={item.preview} alt=""/><span><b>{item.artifactId}</b><small>{new Date(item.at).toLocaleString('ko-KR')}</small></span></button>) : <p>아직 생성한 장표가 없습니다.</p>}</section></main></div>;

  if (screen === 'learning') return <LearningModule status={trainingStatus} onBack={() => setScreen('project')}/>;
  if (screen === 'models') return <div className="product-shell"><header className="product-top"><button className="crumb" onClick={() => setScreen('project')}>‹ 도로시아</button><b>모델 관리</b><span>기획서 디자이너</span></header><main className="module-overview"><header><h1>모델 관리</h1><p>설치 여부와 품질 검증 여부를 구분해 실행 모델을 관리합니다.</p></header><div className="module-stats"><article><small>등록 모델</small><b>2</b><p>로컬 1 · 원격 1 프로필</p></article><article><small>실행 가능</small><b>0</b><p>검증 통과와 활성화가 모두 필요</p></article></div><button className="module-back" onClick={() => setScreen('project')}>프로젝트로 돌아가기</button></main></div>;

  return <div className="authoring-shell">
    <header className="authoring-top"><button className="crumb" onClick={() => setScreen('project')}>‹ 도로시아</button><div><b>{area}</b><span>{serviceReady === false ? '생성 서비스 연결 필요' : serviceReady ? '준비됨' : '확인 중'}</span></div><nav><button onClick={() => setSurface(surface === 'source' ? 'none' : 'source')}>원고</button><button disabled={!output} onClick={() => setSurface('compare')}>후보 비교</button><button disabled={!output} onClick={() => setSurface('review')}>검토</button><button onClick={() => setSurface('history')}>기록</button><button className="generate" disabled={busy !== null || !content.trim()} onClick={() => void generate()}>{busy === 'generate' ? '설계 중' : output ? '다시 만들기' : '장표 만들기'}</button></nav></header>
    <main className="authoring-stage"><div className="canvas-meta"><span>{mode === 'document' ? '기획서용 · 상세 정보 우선' : '발표용 · 핵심 메시지 우선'}</span><b>{output?.validation.hardGatePassed ? '내용 검사 통과' : '16:9 페이지'}</b></div><div className="canvas-frame">{preview ? <img src={preview} alt="생성한 장표"/> : <div><b>장표가 이곳에 표시됩니다.</b><span>원고를 확인하고 장표 만들기를 누르세요.</span></div>}{output?.critic?.findings.filter((finding) => finding.region).map((finding) => <button key={finding.findingId} className={`finding-pin ${finding.severity}`} title={finding.problem} onClick={() => setSurface('review')}>!</button>)}</div><p>{message}</p></main>
    <footer className="authoring-dock"><div>{candidates.map((candidate, index) => <button className={selectedCandidate === index ? 'is-active' : ''} onClick={() => setSelectedCandidate(index)} key={candidate.candidateId}><img src={candidate.previewPngUrl} alt=""/><span>{String.fromCharCode(65 + index)}</span></button>)}</div><nav>{(['png','pdf','pptx'] as const).map((kind) => exportOf(kind) ? <a key={kind} href={exportOf(kind)} download>{kind.toUpperCase()}</a> : <button key={kind} disabled>{kind.toUpperCase()}</button>)}<button onClick={() => setSurface('activity')}>AI 사용 내역</button></nav></footer>
    {surface !== 'none' && <aside className="context-surface"><header><b>{surface === 'source' ? '기획 원고' : surface === 'review' ? '화면 검토' : surface === 'activity' ? 'AI 사용 내역' : surface === 'history' ? '변경 기록' : '후보 비교'}</b><button onClick={() => setSurface('none')}>×</button></header>{surface === 'source' && <div className="source-editor"><label>정보 구조<select value={structure} onChange={(event) => changeStructure(event.target.value as keyof typeof samples)}><option value="hierarchy">역할 구조</option><option value="aligned-before-after-spec">전후 비교</option></select></label><textarea value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false}/><small>들여쓰기와 대응 관계를 보존합니다.</small></div>}{surface === 'compare' && <div className="compare-surface">{candidates.length > 1 ? candidates.map((candidate, index) => <button onClick={() => { setSelectedCandidate(index); setSurface('none'); }} key={candidate.candidateId}><img src={candidate.previewPngUrl} alt=""/><b>후보 {String.fromCharCode(65 + index)}</b></button>) : <p>현재 조건에서 검사를 통과한 후보는 1개입니다. 수를 채우기 위해 복제하지 않습니다.</p>}</div>}{surface === 'review' && <div className="review-surface"><div className="review-actions"><select value={provider} onChange={(event) => setProvider(event.target.value as 'local' | 'openrouter')}><option value="local">내 컴퓨터</option><option value="openrouter">OpenRouter</option></select><button disabled={!output || busy !== null} onClick={() => void critique()}>화면 검토 시작</button></div>{output?.critic ? <><strong>{output.critic.submissionReadiness === 'ready' ? '제출 가능' : output.critic.submissionReadiness === 'not-ready' ? '수정 필요' : '사람 검토 필요'}</strong><p>{output.critic.firstFixation.assessment}</p>{output.critic.findings.map((finding) => <article key={finding.findingId}><small>{finding.severity}</small><b>{finding.problem}</b><p>{finding.reason}</p><em>{finding.revisionDirection}</em></article>)}<div className="decision-row"><button onClick={() => void decide('reject')}>거절</button><button onClick={() => void decide('ready')}>승인</button></div></> : <p>실제 PNG를 보고 위계, 여백, 관계를 검토합니다. 결과가 없을 때는 공간을 차지하지 않습니다.</p>}</div>}{surface === 'activity' && <div className="activity-surface"><dl><dt>사용 모델</dt><dd>{criticRun?.model ?? '호출 없음'}</dd><dt>실행 위치</dt><dd>{criticRun ? (provider === 'local' ? '내 컴퓨터' : '원격') : '—'}</dd><dt>입력 토큰</dt><dd>{criticRun?.inputTokens ?? 0}</dd><dt>출력 토큰</dt><dd>{criticRun?.outputTokens ?? 0}</dd><dt>비용</dt><dd>${(criticRun?.estimatedCostUsd ?? 0).toFixed(6)}</dd><dt>캐시</dt><dd>{criticRun?.cacheHit ? '사용' : '미사용'}</dd></dl></div>}{surface === 'history' && <div className="history-surface">{history.length ? history.map((item) => <article key={item.artifactId}><img src={item.preview} alt=""/><div><b>{item.artifactId}</b><small>{new Date(item.at).toLocaleString('ko-KR')}</small></div></article>) : <p>아직 변경 기록이 없습니다.</p>}</div>}</aside>}
  </div>;
}
