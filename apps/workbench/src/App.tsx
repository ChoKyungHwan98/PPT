import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';

type AuthoringResult = {
  jobId: string;
  filename: string;
  summary: {
    parsedBlocks: number;
    parsedSections: number;
    inventoryItems: number;
    plannedSlides: number;
  };
  plan: {
    projectTitle: string;
    sectionTitle: string;
    slides: Array<{ id: string; title: string; message?: string; role: string; layoutFamily?: string; sourceBlockIds: string[] }>;
  };
  previews: string[];
  downloads: {
    pdf?: string;
    html?: string;
    pptx?: string;
    inventory?: string;
  };
  validation?: {
    checkedAt: string;
    passed: boolean;
    slides: Array<{ slideId: string; textOverflow: string[]; outOfBounds: string[]; collisions: string[]; passed: boolean }>;
  };
};

type InventoryItem = {
  id: string;
  sourceBlockId: string;
  sourceLocation: string;
  type: string;
  sourceText: string;
  numericTokens: string[];
};

type ContentInventory = { items: InventoryItem[] };

type ProjectRecord = {
  id: string;
  name: string;
  updatedAt: string;
  sourceName?: string;
  result?: AuthoringResult;
  presentations?: PresentationRecord[];
};

type PresentationRecord = {
  id: string;
  sourceName: string;
  updatedAt: string;
  result: AuthoringResult;
};

const DEFAULT_PROJECTS: ProjectRecord[] = [
  {
    id: 'dorothea',
    name: '도로시아',
    updatedAt: new Date().toISOString(),
    sourceName: '260416_밸런스기획서_Ver13.docx',
  },
];

function projectPresentations(project: ProjectRecord): PresentationRecord[] {
  if (project.presentations !== undefined) return project.presentations;
  if (project.result === undefined) return [];
  return [{ id: project.result.jobId, sourceName: project.sourceName ?? project.result.filename, updatedAt: project.updatedAt, result: project.result }];
}

function Icon({ children }: { children: ReactNode }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

function FileIcon() {
  return <Icon><path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4M9.5 12h5M9.5 15.5h5"/></Icon>;
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return <Icon><path d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'}/></Icon>;
}

function CloseIcon() {
  return <Icon><path d="m6 6 12 12M18 6 6 18"/></Icon>;
}

function DownloadIcon() {
  return <Icon><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></Icon>;
}

function PlayIcon() {
  return <Icon><path d="m9 7 8 5-8 5z"/></Icon>;
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5.5 4.5h13v15h-13z"/><path d="M8.5 8h7M8.5 11h7M8.5 14h4"/></svg></span>;
}

function FolderIcon() {
  return <Icon><path d="M3.5 6.5h6l2 2h9v10h-17z"/></Icon>;
}

function PlusIcon() {
  return <Icon><path d="M12 5v14M5 12h14"/></Icon>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog ref={ref} className="sheet" aria-labelledby="sheet-title" onClose={onClose} onCancel={onClose}>
      <header><h2 id="sheet-title">{title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="닫기"><CloseIcon /></button></header>
      {children}
    </dialog>
  );
}

function StartScreen({ onFile }: { onFile: (file: File) => void }) {
  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file !== undefined) onFile(file);
  };
  return (
    <main className="start-screen">
      <header className="home-bar">
        <div className="home-brand"><BrandMark/><b>기획서 디자이너</b></div>
        <span>새 기획서</span>
        <small>이 컴퓨터에서 작업</small>
      </header>
      <div className="start-workspace">
        <section className="start-copy">
          <p className="section-kicker">새 기획서 만들기</p>
          <h1>작성한 문서를<br/>불러오세요.</h1>
          <p>내용과 수치는 그대로 두고, 읽기 쉬운 페이지 구조와 시각 위계를 설계합니다.</p>
          <label className="file-button">
            <FileIcon />
            <span><b>DOCX에서 만들기</b><small>밸런스 기획서 선택 · 최대 50MB</small></span>
            <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={choose}/>
          </label>
          <div className="start-note"><span>현재 지원</span><p>전투 밸런스 기획서의 목표, 튜닝, 검증 파트를 먼저 읽습니다. 선택한 문서는 외부로 보내지 않습니다.</p></div>
        </section>
        <aside className="start-sample" aria-label="만들어지는 페이지 예시">
          <div className="sample-heading"><b>만들어지는 페이지</b><span>3장</span></div>
          <div className="sample-stage">
            <div className="sample-page">
              <div className="sample-rule"/><small>전투 밸런스 설계</small>
              <h2>목표값을 먼저 고정하고<br/>파라미터를 조정한다</h2>
              <div className="sample-metrics"><span><b>1.35초</b><i/></span><span><b>×2.00</b><i/></span><span><b>29.6초</b><i/></span></div>
            </div>
          </div>
          <div className="sample-pages" aria-hidden="true"><i className="is-current"><span>01</span></i><i><span>02</span></i><i><span>03</span></i></div>
          <p>실제 문서의 주장과 수치가 각 페이지의 중심이 됩니다.</p>
        </aside>
      </div>
      <footer className="start-footer"><span>원문 확인</span><i/><span>구조 정리</span><i/><span>페이지 설계</span><i/><span>PDF · PPTX · HTML · PNG</span></footer>
    </main>
  );
}

function DashboardScreen({ projects, onOpen, onCreate }: { projects: ProjectRecord[]; onOpen: (id: string) => void; onCreate: (name: string) => void }) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [scope, setScope] = useState<'all' | 'recent'>('all');
  const scopedProjects = scope === 'recent' ? [...projects].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)) : projects;
  const visibleProjects = scopedProjects.filter((project) => project.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const create = () => {
    const name = projectName.trim();
    if (name === '') return;
    onCreate(name);
    setCreating(false);
    setProjectName('');
  };
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-rail">
        <div className="rail-brand"><BrandMark/><b>기획서 디자이너</b></div>
        <nav aria-label="프로젝트 탐색">
          <button className={scope === 'all' ? 'is-active' : ''} type="button" onClick={() => setScope('all')}><FolderIcon/>전체 프로젝트 <span>{projects.length}</span></button>
          <button className={scope === 'recent' ? 'is-active' : ''} type="button" onClick={() => setScope('recent')}><FileIcon/>최근 작업</button>
        </nav>
        <button className="new-project-button" type="button" onClick={() => setCreating(true)}><PlusIcon/>새 프로젝트</button>
      </aside>
      <main className="dashboard-main">
        <header className="dashboard-heading">
          <div><h1>{scope === 'recent' ? '최근 작업' : '프로젝트'}</h1><span>{visibleProjects.length}개</span></div>
          <label className="project-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="프로젝트 검색"/></label>
        </header>
        <div className="project-list" role="list">
          <div className="project-list-head" aria-hidden="true"><span>프로젝트</span><span>기획서</span><span>원본 문서</span><span>최근 작업</span></div>
          {visibleProjects.map((project) => (
            <div className="project-row" role="listitem" key={project.id}>
              <button className="project-row-main" type="button" onClick={() => onOpen(project.id)}>
                <span className="project-identity"><i><FolderIcon/></i><b>{project.name}</b></span>
                <span>{projectPresentations(project).length === 0 ? '—' : `${projectPresentations(project).length}개`}</span>
                <span>{project.sourceName ?? '—'}</span>
                <span>{new Date(project.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
              </button>
            </div>
          ))}
          {visibleProjects.length === 0 && <div className="project-empty">일치하는 프로젝트가 없습니다.</div>}
        </div>
      </main>
      {creating && <Modal title="새 프로젝트" onClose={() => setCreating(false)}><div className="new-project-form"><label>프로젝트 이름<input autoFocus value={projectName} onChange={(event) => setProjectName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') create(); }}/></label><div><button type="button" onClick={() => setCreating(false)}>취소</button><button className="primary-action" type="button" disabled={projectName.trim() === ''} onClick={create}>만들기</button></div></div></Modal>}
    </div>
  );
}

function ProjectScreen({ project, onBack, onFile, onOpen }: { project: ProjectRecord; onBack: () => void; onFile: (file: File) => void; onOpen: (result: AuthoringResult) => void }) {
  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file !== undefined) onFile(file);
  };
  const presentations = projectPresentations(project);
  return (
    <div className="project-shell">
      <header className="project-bar">
        <button className="project-back" type="button" onClick={onBack} aria-label="프로젝트 목록"><BrandMark/><span>프로젝트</span></button>
        <b>{project.name}</b>
        <span>자동 저장</span>
      </header>
      <main className="project-home">
        <header className="project-title"><div><h1>{project.name}</h1><span>기획서 {presentations.length}개</span></div><label className="add-document"><PlusIcon/>기획서 추가<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={choose}/></label></header>
        <section className="document-section" aria-labelledby="documents-title">
          <div className="section-heading"><h2 id="documents-title">기획서</h2><span>목차와 내용을 바탕으로 설계한 발표 문서</span></div>
          {presentations.length > 0 ? (
            <div className="document-list">{presentations.map((presentation) => <button className="document-row" type="button" onClick={() => onOpen(presentation.result)} key={presentation.id}>
              <img src={presentation.result.previews[0]} alt=""/>
              <span><b>{presentation.result.plan.sectionTitle || '밸런스 기획서'}</b><small>{presentation.sourceName}에서 생성</small></span>
              <i>{presentation.result.summary.plannedSlides}장</i><em>열기</em>
            </button>)}</div>
          ) : (
            <div className="document-empty"><FileIcon/><div><b>아직 만든 기획서가 없습니다.</b><span>상단의 ‘기획서 추가’에서 작성한 DOCX를 선택하세요.</span></div></div>
          )}
        </section>
        <section className="source-section" aria-labelledby="source-title">
          <div className="section-heading"><h2 id="source-title">원본 문서</h2><span>기획서 제작에 사용하는 작성 자료</span></div>
          {project.sourceName !== undefined && <div className="source-row"><FileIcon/><span><b>{project.sourceName}</b><small>DOCX</small></span><i>{presentations.length === 0 ? '대기 중' : '연결됨'}</i></div>}
        </section>
      </main>
    </div>
  );
}

function ProcessingScreen({ filename }: { filename: string }) {
  const steps = ['문서 구조 읽기', '근거 항목 정리', '페이지 설계', '출력 파일 생성'];
  return (
    <main className="processing-screen" aria-live="polite">
      <div className="processing-file"><FileIcon/><span><b>{filename}</b><small>내용을 바꾸지 않고 설계 중입니다.</small></span></div>
      <div className="processing-line"><i/></div>
      <ol>{steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span><b>{step}</b></li>)}</ol>
      <p>문서 분량과 PowerPoint 출력에 따라 잠시 시간이 걸릴 수 있습니다.</p>
    </main>
  );
}

function ResultScreen({ result, onBack, onUpdate }: { result: AuthoringResult; onBack: () => void; onUpdate: (result: AuthoringResult) => void }) {
  const [page, setPage] = useState(0);
  const [sheet, setSheet] = useState<'evidence' | 'export' | null>(null);
  const [view, setView] = useState<'page' | 'outline' | 'review'>('page');
  const [inventory, setInventory] = useState<ContentInventory | null>(null);
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildError, setRebuildError] = useState('');
  const current = result.plan.slides[page];
  const move = (delta: number) => setPage((value) => Math.max(0, Math.min(result.previews.length - 1, value + delta)));
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (sheet !== null) return;
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet, result.previews.length]);
  useEffect(() => {
    if (sheet !== 'evidence' || inventory !== null || result.downloads.inventory === undefined) return;
    void fetch(result.downloads.inventory).then(async (response) => {
      if (!response.ok) return;
      setInventory(await response.json() as ContentInventory);
    });
  }, [sheet, inventory, result.downloads.inventory]);
  const currentEvidence = inventory?.items.filter((item) => current?.sourceBlockIds.includes(item.sourceBlockId)) ?? [];
  const currentValidation = result.validation?.slides.find((slide) => slide.slideId === current?.id);
  const issueCount = currentValidation === undefined ? null : currentValidation.textOverflow.length + currentValidation.outOfBounds.length + currentValidation.collisions.length;
  const beginEdit = (index: number) => {
    const slide = result.plan.slides[index];
    if (slide === undefined) return;
    setEditingPage(index);
    setDraftTitle(slide.title);
    setDraftMessage(slide.message ?? '');
    setRebuildError('');
  };
  const saveEdit = async () => {
    if (editingPage === null || draftTitle.trim() === '') return;
    setRebuilding(true);
    setRebuildError('');
    try {
      const nextPlan = { ...result.plan, slides: result.plan.slides.map((slide, index) => index === editingPage ? { ...slide, title: draftTitle.trim(), message: draftMessage.trim() } : slide) };
      const response = await fetch(`/api/jobs/${encodeURIComponent(result.jobId)}/rebuild`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: nextPlan }) });
      const payload = await response.json() as { error?: string; plan?: AuthoringResult['plan']; validation?: AuthoringResult['validation']; previews?: string[]; downloads?: AuthoringResult['downloads'] };
      if (!response.ok || payload.plan === undefined || payload.previews === undefined) throw new Error(payload.error ?? '페이지를 다시 만들지 못했습니다.');
      onUpdate({ ...result, plan: payload.plan, previews: payload.previews, downloads: { ...result.downloads, ...payload.downloads }, ...(payload.validation === undefined ? {} : { validation: payload.validation }) });
      setEditingPage(null);
    } catch (reason) {
      setRebuildError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setRebuilding(false);
    }
  };
  return (
    <div className={view === 'outline' ? 'result-shell result-shell-outline' : 'result-shell'}>
      <header className="app-bar">
        <button className="wordmark" type="button" onClick={onBack} aria-label="프로젝트로 돌아가기"><BrandMark/><div><b>{result.plan.projectTitle || '프로젝트'}</b><small>{result.filename}</small></div></button>
        <div className="workspace-tabs" role="tablist" aria-label="작업 단계">
          <button className={view === 'page' ? 'is-active' : ''} type="button" role="tab" aria-selected={view === 'page'} onClick={() => setView('page')}>페이지</button>
          <button className={view === 'outline' ? 'is-active' : ''} type="button" role="tab" aria-selected={view === 'outline'} onClick={() => setView('outline')}>구성</button>
          <button className={view === 'review' ? 'is-active' : ''} type="button" role="tab" aria-selected={view === 'review'} onClick={() => setView('review')}>검수</button>
        </div>
        <nav>
          {result.downloads.html !== undefined && <a className="present-action" href={result.downloads.html} target="_blank" rel="noreferrer"><PlayIcon/>발표 보기</a>}
          <button type="button" onClick={() => setSheet('evidence')}>내용 확인</button>
          <button className="primary-action" type="button" onClick={() => setSheet('export')}><DownloadIcon/>내보내기</button>
        </nav>
      </header>
      {view === 'page' && <main className="canvas-area">
        <div className="page-meta"><span>{String(page + 1).padStart(2, '0')} / {String(result.previews.length).padStart(2, '0')}</span><b>{current?.title}</b></div>
        <section className="canvas" aria-label={`페이지 ${page + 1}`}>
          <img src={result.previews[page]} alt={current?.title ?? `페이지 ${page + 1}`}/>
          <button className="page-arrow page-arrow-left" type="button" onClick={() => move(-1)} disabled={page === 0} aria-label="이전 페이지"><ArrowIcon direction="left"/></button>
          <button className="page-arrow page-arrow-right" type="button" onClick={() => move(1)} disabled={page === result.previews.length - 1} aria-label="다음 페이지"><ArrowIcon direction="right"/></button>
        </section>
        <p className="canvas-caption">실제 출력 화면 · PDF와 HTML에도 같은 페이지 설계가 적용됩니다.</p>
      </main>}
      {view === 'outline' && <main className="outline-view">
        <header><div><h1>{result.plan.sectionTitle}</h1><span>{result.plan.slides.length}장 구성</span></div><p>각 페이지가 말하는 주장과 근거 연결을 확인합니다.</p></header>
        <div className="outline-list">{result.plan.slides.map((slide, index) => <div className="outline-item" key={slide.id}>
          <button className="outline-open" type="button" onClick={() => { setPage(index); setView('page'); }}><span className="outline-number">{String(index + 1).padStart(2, '0')}</span><img src={result.previews[index]} alt=""/><span className="outline-copy"><b>{slide.title}</b><small>{slide.message ?? slide.role}</small></span><span className="outline-source">원문 {slide.sourceBlockIds.length}개 연결</span></button>
          <button className="outline-edit" type="button" onClick={() => beginEdit(index)}>수정</button>
        </div>)}</div>
      </main>}
      {view === 'review' && <main className="review-view">
        <section className="review-canvas"><div className="page-meta"><span>{String(page + 1).padStart(2, '0')} / {String(result.previews.length).padStart(2, '0')}</span><b>{current?.title}</b></div><div className="canvas"><img src={result.previews[page]} alt={current?.title ?? `페이지 ${page + 1}`}/></div></section>
        <aside className="review-summary"><header><h2>현재 페이지 검사</h2><span>실제 생성 결과 기준</span></header><div className="review-check"><i>✓</i><span><b>원문 연결</b><small>{current?.sourceBlockIds.length ?? 0}개 원문 블록에서 구성</small></span></div><div className="review-check"><i>{issueCount === 0 ? '✓' : issueCount === null ? '·' : '!'}</i><span><b>배치 검사</b><small>{issueCount === null ? '이전 생성본 · 다시 만들면 검사됩니다' : issueCount === 0 ? '넘침·경계 이탈·겹침 없음' : `${issueCount}개 문제 확인 필요`}</small></span></div><div className="review-check"><i>✓</i><span><b>출력 준비</b><small>PDF · PPTX · HTML 생성 완료</small></span></div><button type="button" onClick={() => setSheet('evidence')}>연결된 원문 확인</button><p>{issueCount === null ? '새로 생성한 기획서부터 실제 화면 배치 검사 결과가 저장됩니다.' : `검사 시각 ${new Date(result.validation?.checkedAt ?? '').toLocaleString('ko-KR')}`}</p></aside>
      </main>}
      {view !== 'outline' && <footer className="page-strip">
        <div className="strip-label"><b>슬라이드</b><span>{result.summary.plannedSlides}장</span></div>
        <div className="thumbnails">{result.previews.map((preview, index) => <button type="button" className={page === index ? 'is-current' : ''} onClick={() => setPage(index)} key={preview} aria-label={`${index + 1}번 페이지`} aria-current={page === index ? 'page' : undefined}><img src={preview} alt=""/><span>{String(index + 1).padStart(2, '0')}</span></button>)}</div>
        <div className="strip-help"><span>← →</span><b>페이지 이동</b></div>
      </footer>}
      {sheet === 'evidence' && <Modal title="원문과 결과의 연결" onClose={() => setSheet(null)}><div className="evidence-summary"><div><span>읽은 문서</span><b>{result.summary.parsedBlocks}개 내용 블록</b></div><div><span>확인한 목차</span><b>{result.summary.parsedSections}개 섹션</b></div><div><span>사용한 근거</span><b>{result.summary.inventoryItems}개 항목</b></div></div><div className="evidence-page"><small>현재 페이지</small><h3>{current?.title}</h3><p>연결된 원문 블록: {current?.sourceBlockIds.join(', ')}</p></div><div className="evidence-items">{inventory === null ? <p>원문을 불러오는 중입니다.</p> : currentEvidence.slice(0, 12).map((item) => <div key={item.id}><span>{item.sourceLocation}</span><b>{item.sourceText}</b></div>)}</div>{result.downloads.inventory !== undefined && <a className="text-link" href={result.downloads.inventory} download>전체 근거 목록 저장</a>}</Modal>}
      {sheet === 'export' && <Modal title="제출·공유 파일" onClose={() => setSheet(null)}><div className="export-list">{result.downloads.pdf !== undefined && <a className="recommended" href={result.downloads.pdf} download><span><b>PDF</b><small>포트폴리오 제출용 권장</small></span><DownloadIcon/></a>}{result.downloads.pptx !== undefined && <a href={result.downloads.pptx} download><span><b>편집 가능한 PPTX</b><small>PowerPoint에서 텍스트와 도형 수정</small></span><DownloadIcon/></a>}{result.downloads.html !== undefined && <a href={result.downloads.html} target="_blank" rel="noreferrer"><span><b>HTML 발표</b><small>브라우저에서 바로 발표</small></span><DownloadIcon/></a>}</div><p className="export-note">PPTX는 호환용 출력입니다. 원본 내용과 페이지 설계는 프로그램 내부 기록에 남습니다.</p></Modal>}
      {editingPage !== null && <Modal title={`${editingPage + 1}번 페이지 수정`} onClose={() => { if (!rebuilding) setEditingPage(null); }}><div className="page-edit-form"><label>페이지 제목<textarea value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} rows={2}/></label><label>설명 문장<textarea value={draftMessage} onChange={(event) => setDraftMessage(event.target.value)} rows={3}/></label>{rebuildError !== '' && <p>{rebuildError}</p>}<div><button type="button" disabled={rebuilding} onClick={() => setEditingPage(null)}>취소</button><button className="primary-action" type="button" disabled={rebuilding || draftTitle.trim() === ''} onClick={() => void saveEdit()}>{rebuilding ? '다시 만드는 중' : '적용하고 다시 만들기'}</button></div></div></Modal>}
    </div>
  );
}

export function App() {
  const [state, setState] = useState<'dashboard' | 'project' | 'processing' | 'result' | 'error'>('dashboard');
  const [projects, setProjects] = useState<ProjectRecord[]>(() => {
    try {
      const saved = localStorage.getItem('game-presentation-projects');
      return saved === null ? DEFAULT_PROJECTS : JSON.parse(saved) as ProjectRecord[];
    } catch {
      return DEFAULT_PROJECTS;
    }
  });
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [filename, setFilename] = useState('');
  const [result, setResult] = useState<AuthoringResult | null>(null);
  const [error, setError] = useState('');
  const currentProject = projects.find((project) => project.id === projectId);
  const storeProjects = (next: ProjectRecord[]) => {
    setProjects(next);
    localStorage.setItem('game-presentation-projects', JSON.stringify(next));
  };
  const openProject = (id: string) => {
    setProjectId(id);
    setState('project');
  };
  const createProject = (name: string) => {
    const project: ProjectRecord = { id: `project-${Date.now()}`, name, updatedAt: new Date().toISOString() };
    storeProjects([project, ...projects]);
    setProjectId(project.id);
    setState('project');
  };
  const processFile = async (file: File) => {
    setFilename(file.name);
    setState('processing');
    setError('');
    try {
      const response = await fetch('/api/author', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }, body: file });
      const payload = await response.json() as AuthoringResult | { error?: string };
      if (!response.ok) throw new Error('error' in payload && payload.error !== undefined ? payload.error : '문서를 처리하지 못했습니다.');
      if (!('jobId' in payload)) throw new Error(payload.error ?? '문서를 처리하지 못했습니다.');
      const nextResult = payload as AuthoringResult;
      setResult(nextResult);
      storeProjects(projects.map((project) => {
        if (project.id !== projectId) return project;
        const presentations = projectPresentations(project);
        const nextPresentation: PresentationRecord = { id: nextResult.jobId, sourceName: file.name, updatedAt: new Date().toISOString(), result: nextResult };
        return { id: project.id, name: project.name, sourceName: file.name, presentations: [...presentations, nextPresentation], updatedAt: nextPresentation.updatedAt };
      }));
      setState('result');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setState('error');
    }
  };
  const updateCurrentPresentation = (nextResult: AuthoringResult) => {
    setResult(nextResult);
    storeProjects(projects.map((project) => {
      if (project.id !== projectId) return project;
      const presentations = projectPresentations(project).map((presentation) => presentation.result.jobId === nextResult.jobId ? { ...presentation, result: nextResult, updatedAt: new Date().toISOString() } : presentation);
      return { id: project.id, name: project.name, sourceName: project.sourceName ?? presentations[0]?.sourceName ?? nextResult.filename, presentations, updatedAt: new Date().toISOString() };
    }));
  };
  return (
    <div className="app-shell">
      {state === 'dashboard' && <DashboardScreen projects={projects} onOpen={openProject} onCreate={createProject}/>} 
      {state === 'project' && currentProject !== undefined && <ProjectScreen project={currentProject} onBack={() => setState('dashboard')} onFile={processFile} onOpen={(savedResult) => { setResult(savedResult); setState('result'); }}/>} 
      {state === 'processing' && <ProcessingScreen filename={filename}/>} 
      {state === 'result' && result !== null && <ResultScreen result={result} onBack={() => setState('project')} onUpdate={updateCurrentPresentation}/>} 
      {state === 'error' && <main className="error-screen"><span>문서를 만들지 못했습니다</span><h1>{error}</h1><p>현재 버전은 도로시아 밸런스 기획서의 목표·튜닝·검증 구조를 먼저 지원합니다.</p><button type="button" onClick={() => setState('project')}>프로젝트로 돌아가기</button></main>}
    </div>
  );
}
