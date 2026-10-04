'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, ChevronRight, Clock3, ExternalLink, GitPullRequest, Info, Layers3, ListOrdered, Maximize2, Network, RotateCcw, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import CapabilityMap from './capability-map';
import { dimensions } from '@/lib/dimensions';
import { contributionValue, elapsedSeconds, equalWeights, formatDuration, lensWeights, normalizeWeights, rankEngineers } from '@/lib/ranking';
import { dimensionIds, type Dimension, type ImpactData, type Outcome, type RankedEngineer, type RunRecord, type Weights } from '@/lib/types';

type View = 'leaderboard' | 'map';
type Lens = Dimension | 'overall' | 'custom';
type Sheet = { type: 'evidence'; ids: string[]; title: string } | { type: 'info' } | { type: 'actions' } | { type: 'initiative'; id: string } | null;
const timerKey = 'engineering-impact-run-v1';
const dateLabel = (value: string) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' });

function Badge({ dimension }: { dimension: Dimension }) {
  const d = dimensions[dimension];
  return <span className="dimension-badge" style={{ '--tint': d.tint, '--ink': d.color } as CSSProperties}><i />{d.short}</span>;
}

function Avatar({ name, src, size = 38 }: { name: string; src: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return <span className="avatar" style={{ width: size, height: size }} aria-hidden="true">{src && !failed ? <img src={src} alt="" width={size} height={size} onError={() => setFailed(true)} /> : name.slice(0, 2).toUpperCase()}</span>;
}

function Timer({ run }: { run: RunRecord }) {
  const [record, setRecord] = useState(run);
  const [now, setNow] = useState<number | null>(null);
  const [author, setAuthor] = useState(false);
  useEffect(() => {
    const local = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
    setAuthor(local);
    let initial = run;
    if (local && !run.stoppedAt) {
      try { const saved = JSON.parse(localStorage.getItem(timerKey) || 'null'); if (saved?.startedAt === run.startedAt && (!saved.stoppedAt || Number.isFinite(Date.parse(saved.stoppedAt)))) initial = saved; } catch { /* unavailable storage does not stop the timer */ }
    }
    setRecord(initial);
    try { if (local) localStorage.setItem(timerKey, JSON.stringify(initial)); } catch { /* storage is optional */ }
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [run]);
  const seconds = now === null ? null : elapsedSeconds(record, now);
  function stop() {
    const next = { ...record, stoppedAt: new Date().toISOString() };
    setRecord(next);
    try { localStorage.setItem(timerKey, JSON.stringify(next)); } catch { /* download remains available */ }
    const url = URL.createObjectURL(new Blob([JSON.stringify(next, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'run.json'; a.click(); URL.revokeObjectURL(url);
  }
  return <div className={`timer ${seconds !== null && seconds > run.budgetSeconds && !record.stoppedAt ? 'timer-over' : ''}`} title={`Started October 4 at 14:30 Pacific. ${record.stoppedAt ? 'Final recorded duration.' : 'Includes planning, implementation, and publishing.'}`}>
    {record.stoppedAt ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
    <span>{record.stoppedAt && <span className="timer-label">Completed in </span>}{seconds === null ? '—:—:—' : formatDuration(seconds)}</span>
    {!record.stoppedAt && <span className="timer-budget">/ 01:30:00</span>}
    {author && !record.stoppedAt && <button className="timer-stop" onClick={stop}>Stop</button>}
  </div>;
}

function SheetDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const items = ref.current?.querySelectorAll<HTMLElement>('button, a[href], input, select, [tabindex="0"]');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); previous?.focus(); };
  }, [onClose]);
  return <div className="sheet-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="sheet" ref={ref} role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close panel" onClick={onClose}><X size={19} /></button></div>
      <div className="sheet-content">{children}</div>
    </div>
  </div>;
}

export default function Dashboard({ data, run }: { data: ImpactData; run: RunRecord }) {
  const [view, setView] = useState<View>('leaderboard');
  const [topN, setTopN] = useState(5);
  const [order, setOrder] = useState<'top'|'bottom'>('top');
  const [mapMode, setMapMode] = useState<'capabilities'|'verified'>('capabilities');
  const [directorySelected, setDirectorySelected] = useState<string|null>(null);
  const [lens, setLens] = useState<Lens>('overall');
  const [weights, setWeights] = useState<Weights>({ ...equalWeights });
  const [prioritiesOpen, setPrioritiesOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(true);
  const [rankOpen, setRankOpen] = useState(false);
  const [activeOutcome, setActiveOutcome] = useState<string | null>(null);
  const ranks = useMemo(() => rankEngineers(data, weights), [data, weights]);
  const overallRanks = useMemo(() => rankEngineers(data, equalWeights), [data]);
  const displayRanks = view === 'map' ? overallRanks : ranks;
  const visible = order === 'top' ? ranks.slice(0, topN) : [...ranks].sort((a,b) => a.score - b.score || a.engineer.name.localeCompare(b.engineer.name)).slice(0, topN);
  const repoName = data.manifest.displayName || data.manifest.repository.split('/')[1];
  const windowDays = Math.round((Date.parse(data.manifest.end) - Date.parse(data.manifest.start)) / 86400000);
  const selected = displayRanks.find(r => r.engineer.id === selectedId) || visible[0];
  const normalized = normalizeWeights(view === 'map' ? equalWeights : weights);
  const evidenceById = useMemo(() => new Map(data.evidence.map(e => [e.id, e])), [data]);
  const selectedOutcome = selected?.outcomes.find(o => o.id === activeOutcome) || selected?.outcomes[0];
  function chooseLens(next: Lens) { setLens(next); if (next !== 'custom') setWeights(lensWeights(next)); setActiveOutcome(null); }
  function choosePerson(row: RankedEngineer) { setSelectedId(row.engineer.id); setDetailOpen(true); setActiveOutcome(null); setRankOpen(false); }
  function showEvidence(ids: string[], title = 'Supporting evidence') { setSheet({ type: 'evidence', ids, title }); }
  const sheetTitle = sheet?.type === 'actions' ? 'What to do next' : sheet?.type === 'info' ? 'About this analysis' : sheet?.type === 'initiative' ? data.initiatives.find(i => i.id === sheet.id)?.name || 'Initiative' : sheet?.type === 'evidence' ? sheet.title : '';

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Engineering impact home"><span className="brand-symbol"><span /><span /><span /></span><span>impact<span className="brand-period">.</span></span></a>
      <div className="sidebar-section">WORKSPACE</div>
      <nav className="primary-nav" aria-label="Dashboard views">
        <button className={view === 'leaderboard' ? 'active' : ''} onClick={() => setView('leaderboard')} aria-current={view === 'leaderboard' ? 'page' : undefined}><ListOrdered size={18} /><span>Leaderboard</span></button>
        <button className={view === 'map' ? 'active' : ''} onClick={() => { setView('map'); setDetailOpen(false); }} aria-current={view === 'map' ? 'page' : undefined}><Network size={18} /><span>Impact map</span></button>
      </nav>
      <div className="sidebar-project"><span className="project-icon">{repoName.slice(0, 1)}</span><div><strong>{repoName}</strong><span>Engineering</span></div><span className="project-dot" /></div>
      <div className="sidebar-bottom"><button onClick={() => setSheet({ type: 'info' })}><Info size={16} />About & sources<ArrowUpRight size={14} /></button><span>Made for meaningful work.</span></div>
    </aside>

    <div className="app-main">
      <header className="app-header"><div className="breadcrumb">{repoName} <ChevronRight size={13} /> <span>Engineering impact</span></div><div className="header-right"><span className="snapshot-indicator"><i />Public GitHub</span><Timer run={run} /><button className="icon-button" aria-label="About, sources, and data coverage" onClick={() => setSheet({ type: 'info' })}><Info size={17} /></button></div></header>
      <main className="main-content">
        <section className="page-heading"><div><div className="eyebrow">{repoName.toUpperCase()} ENGINEERING</div><h1>{view === 'leaderboard' ? 'The people behind the progress.' : 'Good work connects.'}</h1><p>{view === 'leaderboard' ? `Explore the contributions moving ${repoName} forward.` : 'Explore the people and initiatives behind the outcomes.'}</p></div><div className="date-range"><span className="calendar-icon">{windowDays}</span><div><strong>Last {windowDays} days</strong><span>{dateLabel(data.manifest.start)} – {dateLabel(data.manifest.end)}, {new Date(data.manifest.end).getUTCFullYear()}</span></div></div></section>

        <div className="toolbar">
          <div className="toolbar-left">{view === 'leaderboard' ? <><select className="ranking-order" aria-label="Leaderboard order" value={order} onChange={e => { setOrder(e.target.value as 'top'|'bottom'); setTopN(e.target.value === 'bottom' ? 10 : 5); setSelectedId(null); }}><option value="top">Highest assessed impact</option><option value="bottom">Lowest assessed impact</option></select><div className="segmented" aria-label="Number of engineers">{[3, 5, 10].map(n => <button key={n} aria-pressed={topN === n} onClick={() => setTopN(n)}>{order === 'top' ? 'Top' : 'Bottom'} {n}</button>)}</div></> : <div className="segmented"><button aria-pressed={mapMode === 'capabilities'} onClick={() => { setMapMode('capabilities'); setDetailOpen(false); }}>Capability coverage</button><button aria-pressed={mapMode === 'verified'} onClick={() => setMapMode('verified')}>Verified initiatives</button></div>}{view === 'leaderboard' && <><span className="toolbar-divider" /><label className="lens-select"><Layers3 size={15} /><select value={lens} aria-label="Impact lens" onChange={e => chooseLens(e.target.value as Lens)}><option value="overall">All impact dimensions</option>{dimensionIds.map(id => <option key={id} value={id}>{dimensions[id].label}</option>)}<option value="custom" disabled={lens !== 'custom'}>Custom priorities</option></select><ChevronDown size={14} /></label></>}</div>
          <div className="toolbar-right"><button className="secondary-button leadership-button" onClick={() => setSheet({type:'actions'})}><Sparkles size={14}/>Leadership actions</button>{view === 'leaderboard' && <div className="priorities-wrap"><button className={`secondary-button ${prioritiesOpen ? 'pressed' : ''}`} onClick={() => setPrioritiesOpen(!prioritiesOpen)} aria-expanded={prioritiesOpen}><SlidersHorizontal size={15} />Priorities{lens === 'custom' && <i className="custom-dot" />}</button>{prioritiesOpen && <div className="priorities-popover" role="dialog" aria-label="Adjust impact priorities"><div className="popover-heading"><strong>What matters most?</strong><button className="icon-button" aria-label="Close priorities" onClick={() => setPrioritiesOpen(false)}><X size={15} /></button></div>{dimensionIds.map(id => <label key={id} className="priority-control"><span><i style={{ background: dimensions[id].color }} />{dimensions[id].short}<output>{Math.round(normalized[id] * 100)}%</output></span><input type="range" min={0} max={10} step={1} value={weights[id]} aria-label={`${dimensions[id].label} priority`} onChange={e => { const next = { ...weights, [id]: Number(e.target.value) }; if (Object.values(next).some(v => v > 0)) { setWeights(next); setLens('custom'); } }} /></label>)}<button className="text-button reset-priorities" onClick={() => chooseLens('overall')}><RotateCcw size={13} />Reset to balanced</button></div>}</div>}</div>
        </div>

        {!data.manifest.complete && <div className="coverage-banner"><Info size={15} />Collection in progress — rankings are not final.</div>}
        <div className={`workspace ${detailOpen && selected ? 'with-detail' : ''}`}>
          <section className={`results-panel ${view === 'map' ? 'map-panel' : ''}`} aria-label={view === 'leaderboard' ? 'Engineer leaderboard' : 'Engineering impact map'}>
            <div className="results-header"><h2>{view === 'leaderboard' ? order === 'top' ? 'Leading contributions' : 'Lower observed impact · assessed cohort' : mapMode === 'capabilities' ? 'Contributions across the repository' : 'Verified people & initiatives'}{(view === 'leaderboard' || mapMode === 'verified') && <span>{view === 'map' ? overallRanks.length : visible.length}</span>}</h2>{view === 'leaderboard' ? <span className="subtle-label">{lens === 'overall' ? order === 'bottom' ? `${ranks.length} reviewed contributors` : 'Balanced priorities' : lens === 'custom' ? 'Your priorities' : dimensions[lens].short}</span> : <button className="icon-button" aria-label="Reset map selection" onClick={() => { setSelectedId(visible[0]?.engineer.id || null); setActiveOutcome(null); setDetailOpen(false); setDirectorySelected(null); }}><Maximize2 size={15} /></button>}</div>
            {view === 'map' && mapMode === 'capabilities' ? <CapabilityMap data={data} selectedId={directorySelected} onSelect={setDirectorySelected} onInspect={id => { const person = overallRanks.find(r => r.engineer.id === id); if(person) { choosePerson(person); setMapMode('verified'); } }} /> : !visible.length ? <div className="empty-state"><Layers3 size={28} /><h3>No verified outcomes yet</h3><p>{data.manifest.complete ? 'Choose another impact lens to explore the available evidence.' : 'The complete contribution dataset is being prepared.'}</p></div> : view === 'leaderboard' ? <div className="leaderboard-scroll">{order === 'bottom' && <p className="bottom-context">Lowest rubric totals in the reviewed cohort. Limited evidence is a prompt for a conversation, not a performance judgment. Open a person for a concrete next opportunity.</p>}<div className="list-columns"><span>RANK / ENGINEER</span><span>OBSERVABLE IMPACT</span></div>{visible.map(row => {
              const top = row.outcomes[0], isSelected = detailOpen && selected?.engineer.id === row.engineer.id;
              return <div key={row.engineer.id} className={`engineer-row ${isSelected ? 'selected' : ''}`}><button className="row-main" onClick={() => choosePerson(row)} aria-label={`View ${row.engineer.name}, rank ${row.rank}`} aria-pressed={isSelected}><span className={`rank-number ${row.rank === 1 ? 'first-rank' : ''}`}>{String(row.rank).padStart(2, '0')}</span><Avatar name={row.engineer.name} src={row.engineer.avatar} /><span className="engineer-identity"><strong>{row.engineer.name}</strong><span>@{row.engineer.id}</span></span><span className="row-story"><strong>{top.title}</strong><Badge dimension={top.dimension} /></span><ChevronRight className="row-arrow" size={16} /></button><div className="row-metrics">{top.metrics.slice(0, 2).map((metric, i) => <button key={i} onClick={() => showEvidence(metric.evidenceIds, `${metric.value} ${metric.label}`)} title={metric.context}><span>{metric.value}</span> {metric.label}<ArrowUpRight size={11} /></button>)}{!top.metrics.length && <button onClick={() => showEvidence(top.evidenceIds, top.title)}><GitPullRequest size={12} />View contribution<ArrowUpRight size={11} /></button>}</div></div>;
            })}</div> : <ImpactMap data={data} rows={overallRanks} selectedId={detailOpen ? selected?.engineer.id || null : null} onPerson={choosePerson} onInitiative={id => setSheet({ type: 'initiative', id })} onEdge={(id, initiativeId) => { const ids = data.outcomes.filter(o => o.verified && o.initiativeId === initiativeId && o.participants.some(p => p.engineerId === id)).flatMap(o => o.evidenceIds); showEvidence([...new Set(ids)], `${data.engineers.find(e => e.id === id)?.name || id} · ${data.initiatives.find(i => i.id === initiativeId)?.name || 'Contribution'}`); }} />}
            <div className="results-footer"><span><span className="tiny-dot" />{data.manifest.complete ? `${windowDays}-day snapshot` : 'Collecting snapshot'}</span><button className="text-button" onClick={() => setSheet({ type: 'info' })}>Sources & methodology<ArrowUpRight size={12} /></button></div>
          </section>

          {detailOpen && selected && selectedOutcome && <aside className="detail-panel" aria-label={`${selected.engineer.name}'s impact`}><div className="detail-top"><span>CONTRIBUTOR SPOTLIGHT</span><button className="icon-button" aria-label="Close contributor details" onClick={() => setDetailOpen(false)}><X size={16} /></button></div><div className="detail-scroll"><div className="profile"><Avatar name={selected.engineer.name} src={selected.engineer.avatar} size={48} /><div><h2>{selected.engineer.name}</h2><a href={selected.engineer.url} target="_blank" rel="noreferrer">@{selected.engineer.id}<ArrowUpRight size={12} /></a></div><span className="profile-rank">#{selected.rank}</span></div>
            <div className="outcome-tabs" aria-label="Strongest contributions">{selected.outcomes.map((o, i) => <button key={o.id} className={selectedOutcome.id === o.id ? 'active' : ''} onClick={() => setActiveOutcome(o.id)} aria-pressed={selectedOutcome.id === o.id}>0{i + 1}<span>{dimensions[o.dimension].short}</span></button>)}</div>
            <div className="story-heading"><Badge dimension={selectedOutcome.dimension} /><span className="stage-label">{selectedOutcome.stage}</span></div><h3 className="story-title">{selectedOutcome.title}</h3><p className="story-summary">{selectedOutcome.summary}</p><div className="why-matters"><span className="small-label">WHY IT MATTERS</span><p>{selectedOutcome.benefit}</p></div>
            {selectedOutcome.metrics.length > 0 && <div className="detail-metrics">{selectedOutcome.metrics.map((m, i) => <button key={i} onClick={() => showEvidence(m.evidenceIds, `${m.value} ${m.label}`)} title={m.context}><strong>{m.value}<ArrowUpRight size={13} /></strong><span>{m.label}</span></button>)}</div>}
            <div className="evidence-preview"><div className="section-label"><span>THE EVIDENCE</span><button onClick={() => showEvidence(selectedOutcome.evidenceIds, selectedOutcome.title)}>View all<ArrowRight size={12} /></button></div>{selectedOutcome.evidenceIds.slice(0, 3).map(id => { const e = evidenceById.get(id); return e && <a className="evidence-link" key={id} href={e.url} target="_blank" rel="noreferrer"><span className="evidence-icon"><GitPullRequest size={13} /></span><span><strong>{e.title}</strong><small>{e.type === 'pr' ? 'Pull request' : e.type === 'review' ? 'Review' : e.type === 'issue' ? 'Issue' : 'Code'} · {dateLabel(e.date)}</small></span><ArrowUpRight size={13} /></a>; })}</div>
            <div className="contributor-line"><span className="small-label">CONTRIBUTION</span>{selectedOutcome.participants.filter(p => p.engineerId === selected.engineer.id).map(p => <p key={p.engineerId}><strong>{p.role}</strong> · {p.rationale}</p>)}<button className="text-button" onClick={() => setSheet({ type: 'initiative', id: selectedOutcome.initiativeId })}>Explore this initiative<ArrowRight size={12} /></button></div>
            {selectedOutcome.limitations.length > 0 && <div className="evidence-limit"><Info size={13} /><span>{selectedOutcome.limitations.join(' ')}</span></div>}
            <div className="follow-up"><Sparkles size={16} /><div><span>{order === 'bottom' ? 'NEXT OPPORTUNITY TO EXPLORE' : 'A LEADERSHIP FOLLOW-UP'}</span><p>{selectedOutcome.followUp}</p></div></div>
            <button className="rank-explainer-toggle" onClick={() => setRankOpen(!rankOpen)} aria-expanded={rankOpen}>Why this rank?<ChevronDown size={14} className={rankOpen ? 'rotated' : ''} /></button>{rankOpen && <div className="rank-explainer"><p>Three strongest distinct outcomes, weighted by your priorities. Ratings describe assessed significance; they are not business KPIs.</p>{selected.outcomes.map(o => <div key={o.id}><strong>{o.title}</strong><span>{o.significance} × {(normalized[o.dimension] * 100).toFixed(1)}% = {contributionValue(o, normalized).toFixed(2)}</span><p>{o.significanceRationale}</p></div>)}<footer>Total: {selected.score.toFixed(2)} · Equal totals share a rank.</footer></div>}
          </div></aside>}
        </div>
        <footer className="page-footer"><span>{data.manifest.repository}</span><span>Outcomes, with the evidence to back them up.<span className="footer-mark">✳</span></span></footer>
      </main>
    </div>

    {sheet && <SheetDialog title={sheetTitle} onClose={() => setSheet(null)}>{sheet.type === 'evidence' ? <><p className="sheet-intro">Public sources supporting this contribution.</p>{data.outcomes.flatMap(o => o.metrics).filter(m => `${m.value} ${m.label}` === sheet.title).map((m, i) => <p className="metric-context" key={i}>{m.context}</p>)}{[...new Set(sheet.ids)].map(id => { const e = evidenceById.get(id); return e && <article className="source-card" key={id}><div className="source-meta"><span>{e.type.toUpperCase()}</span><span>{dateLabel(e.date)}</span></div><h3><a href={e.url} target="_blank" rel="noreferrer">{e.title}<ExternalLink size={14} /></a></h3><p className="source-excerpt">{e.excerpt}</p><a className="text-button" href={e.url} target="_blank" rel="noreferrer">Open on GitHub<ArrowUpRight size={13} /></a></article>; })}</> : sheet.type === 'initiative' ? <>{data.outcomes.filter(o => o.initiativeId === sheet.id).map(o => <article className="initiative-card" key={o.id}><Badge dimension={o.dimension} /><h3>{o.title}</h3><p>{o.benefit}</p>{o.participants.map(p => { const eng = data.engineers.find(e => e.id === p.engineerId); return <div className="initiative-person" key={p.engineerId}><Avatar name={eng?.name || p.engineerId} src={eng?.avatar || ''} size={30} /><div><strong>{eng?.name || p.engineerId}<span>{p.role}</span></strong><p>{p.rationale}</p></div></div>; })}<button className="text-button" onClick={() => showEvidence(o.evidenceIds, o.title)}>Inspect the evidence<ArrowRight size={13} /></button></article>)}</> : sheet.type === 'actions' ? <LeadershipActions data={data} onEvidence={showEvidence} onMap={() => {setSheet(null);setView('map');setMapMode('capabilities');setDetailOpen(false);}} /> : <About data={data} run={run} />}</SheetDialog>}
  </div>;
}

function ImpactMap({ data, rows, selectedId, onPerson, onInitiative, onEdge }: { data: ImpactData; rows: RankedEngineer[]; selectedId: string | null; onPerson: (r: RankedEngineer) => void; onInitiative: (id: string) => void; onEdge: (person: string, initiative: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const ids = new Set(rows.flatMap(r => r.outcomes.map(o => o.initiativeId)));
  const initiatives = data.initiatives.filter(i => ids.has(i.id)).sort((a, b) => a.name.localeCompare(b.name));
  const shown = showAll ? initiatives : initiatives.slice(0, 10);
  const height = Math.max(420, Math.max(rows.length, shown.length) * 54 + 70);
  const y = (i: number, count: number) => 64 + i * (height - 126) / Math.max(1, count - 1);
  const related = new Set(rows.find(r => r.engineer.id === selectedId)?.outcomes.map(o => o.initiativeId) || []);
  return <div className="map-scroll"><div className="map-legend"><span><i className="legend-person" />Engineer</span><span><i className="legend-initiative" />Initiative</span><span className="map-legend-hint">Select a connection to explore</span></div><svg className="impact-svg" viewBox={`0 0 700 ${height}`} role="group" aria-label="Engineers connected to evidenced initiatives"><defs><pattern id="dot-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill="#e8e7ed" /></pattern></defs><rect width="700" height={height} fill="url(#dot-grid)" rx="14" />
    {rows.flatMap((row, ri) => shown.map((initiative, ii) => {
      if (!row.outcomes.some(o => o.initiativeId === initiative.id)) return null;
      const highlighted = !selectedId || selectedId === row.engineer.id || related.has(initiative.id);
      const d = `M 231 ${y(ri, rows.length)} C 320 ${y(ri, rows.length)}, 375 ${y(ii, shown.length)}, 455 ${y(ii, shown.length)}`;
      return <g key={`${row.engineer.id}-${initiative.id}`} role="button" tabIndex={0} aria-label={`${row.engineer.name} contribution to ${initiative.name}`} onClick={() => onEdge(row.engineer.id, initiative.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdge(row.engineer.id, initiative.id); } }} className="map-edge"><path d={d} stroke={dimensions[initiative.dimension].color} opacity={highlighted ? 0.5 : 0.12} strokeWidth={highlighted && selectedId ? 2.5 : 1.5} fill="none" /><path className="edge-hit" d={d} stroke="transparent" strokeWidth="15" fill="none" /></g>;
    }))}
    {rows.map((row, i) => <g key={row.engineer.id} transform={`translate(42 ${y(i, rows.length) - 22})`} tabIndex={0} role="button" aria-label={`Select ${row.engineer.name}`} aria-pressed={selectedId === row.engineer.id} onClick={() => onPerson(row)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPerson(row); } }} className="map-person"><rect width="190" height="44" rx="22" fill={selectedId === row.engineer.id ? '#f0ebf9' : '#fff'} stroke={selectedId === row.engineer.id ? '#a28bc7' : '#e4e2e9'} /><circle cx="24" cy="22" r="15" fill="#f1eef6" /><text x="24" y="26" textAnchor="middle" fontSize="10" fill="#766586">{row.engineer.name.slice(0, 2).toUpperCase()}</text><text x="48" y="26" fontSize="11" fill="#37333f" fontWeight="500">{row.engineer.name.length > 20 ? row.engineer.name.slice(0, 19) + '…' : row.engineer.name}</text><circle cx="189" cy="22" r="3" fill="#9a8ead" /></g>)}
    {shown.map((initiative, i) => <g key={initiative.id} transform={`translate(455 ${y(i, shown.length) - 21})`} tabIndex={0} role="button" aria-label={`Explore ${initiative.name}`} onClick={() => onInitiative(initiative.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onInitiative(initiative.id); } }} className="map-initiative" opacity={selectedId && !related.has(initiative.id) ? 0.5 : 1}><rect width="211" height="42" rx="10" fill={dimensions[initiative.dimension].tint} stroke={related.has(initiative.id) ? dimensions[initiative.dimension].color : 'transparent'} /><circle cx="0" cy="21" r="3" fill={dimensions[initiative.dimension].color} /><text x="14" y="25" fontSize="11" fill={dimensions[initiative.dimension].color} fontWeight="500">{initiative.name.length > 29 ? initiative.name.slice(0, 28) + '…' : initiative.name}</text></g>)}
    </svg>{initiatives.length > 10 && <button className="text-button map-more" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer initiatives' : `Show all ${initiatives.length} initiatives`}<ChevronDown size={13} /></button>}<div className="map-dimensions">{dimensionIds.map(id => <span key={id}><i style={{ background: dimensions[id].color }} />{dimensions[id].short}</span>)}</div></div>;
}

function About({ data, run }: { data: ImpactData; run: RunRecord }) {
  const m = data.manifest;
  return <div className="about-content"><div className="about-repo"><span className="project-icon">{(m.displayName || m.repository).slice(0, 1)}</span><div><strong>{m.displayName} Engineering Impact</strong><a href={`https://github.com/${m.repository}`} target="_blank" rel="noreferrer">{m.repository}<ArrowUpRight size={12} /></a></div></div><h3>Coverage</h3><p>{new Date(m.start).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} – {new Date(m.end).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} Pacific.</p><dl className="coverage-grid"><div><dt>Merged PRs collected</dt><dd>{m.uniquePRs.toLocaleString()} / {m.expectedPRs.toLocaleString()}</dd></div><div><dt>Metadata screened</dt><dd>{m.screenedPRs.toLocaleString()}</dd></div><div><dt>PRs deeply reviewed</dt><dd>{m.reviewedPRs.toLocaleString()}</dd></div><div><dt>Verified outcomes</dt><dd>{data.outcomes.filter(o => o.verified).length}</dd></div><div><dt>Engineers assessed</dt><dd>{data.engineers.length}</dd></div><div><dt>Collection status</dt><dd>{m.complete ? 'Complete' : 'Incomplete'}</dd></div></dl><p>All merged PR metadata is screened across the window. Detailed issues, reviews, and code are inspected for candidate outcomes. A complete census does not mean every line of code received a detailed review.</p>{m.notes.map((note, i) => <p key={i}>{note}</p>)}<p>{m.humanAuthoredPRs.toLocaleString()} human-authored and {m.botAuthoredPRs.toLocaleString()} bot-authored records. Bot work remains context; it receives no human credit without documented participation.</p><h3>How ranking works</h3><p>For each engineer, take the three strongest distinct verified outcomes. Multiply each outcome’s significance by its dimension’s normalized priority weight, then sum. Related PRs are grouped into a single outcome. Equal totals share a rank; names break presentation ties alphabetically.</p><div className="rubric"><p><b>1 · Bounded</b>A concrete improvement to a limited workflow.</p><p><b>3 · Substantial</b>A meaningful subsystem or workflow improvement.</p><p><b>5 · Broad or critical</b>Cross-subsystem benefit or documented critical-impact resolution.</p></div><p>These are qualitative assessments with explicit source-backed rationales, not measured business impact. Counts of commits, PRs, reviews, or changed lines do not determine rankings. Unknown evidence is not evidence of no impact.</p><h3>Six dimensions</h3>{dimensionIds.map(id => <div className="about-dimension" key={id}><Badge dimension={id} /><p>{dimensions[id].description}</p></div>)}<h3>Attribution & limitations</h3><p>Human contributors are credited only for documented material work. Authorship, assignment, or a review approval alone does not establish significance. A substantive review can receive the same significance assessment as implementation. Shared credit is not a percentage allocation and must not be summed as an organization-wide total.</p><p>Public GitHub cannot capture private work, mentorship outside PRs, customer revenue, or overall job performance. Contributors are not assumed to be employees. Shipped, implemented, adopted, and measured outcomes are distinguished in the evidence.</p><h3>Take-home</h3><p>Started October 4, 2026 at 14:30 Pacific, including planning. {run.stoppedAt ? `Time spent: ${formatDuration(elapsedSeconds(run))}.` : 'The timer remains running until deployment and public verification are complete.'}</p><p>Next.js · TypeScript · Tailwind · Precomputed public GitHub evidence.</p><a className="download-link" href="/impact.json" download><ArrowDownRight size={15} />Download the analysis JSON</a><a className="download-link" href="/coverage.json" download>Download collection audit</a><a className="download-link" href="/corpus.json.gz" download>Download complete PR metadata corpus (.gz)</a></div>;
}

function LeadershipActions({data,onEvidence,onMap}: {data:ImpactData;onEvidence:(ids:string[],title:string)=>void;onMap:()=>void}) {
 const groups=[{title:'Scale work that others can reuse',description:'Look for demonstrated adoption, then fund the next concrete use.',outcomes:data.outcomes.filter(o=>o.dimension==='leverage').slice(0,2)},{title:'Turn implementation into demonstrated benefit',description:'Confirm staged capabilities work for their intended users before expanding rollout.',outcomes:data.outcomes.filter(o=>o.dimension==='product'&&/flag|staged|implemented/i.test(o.stage)).slice(0,2)},{title:'Validate the tradeoffs before standardizing',description:'Use the reported workload and limitations to choose the next validation.',outcomes:data.outcomes.filter(o=>o.dimension==='performance'&&o.metrics.length).slice(0,3)}];
 return <div className="leadership-actions"><p className="sheet-intro">Use this assessment to select follow-ups and investment opportunities. A ranking is a starting point for a conversation with the engineer.</p>{groups.map(g=><section key={g.title}><h3>{g.title}</h3><p>{g.description}</p>{g.outcomes.map(o=><article className="leadership-card" key={o.id}><Badge dimension={o.dimension}/><strong>{o.title}</strong><p>{o.followUp}</p><button className="text-button" onClick={()=>onEvidence(o.evidenceIds,o.title)}>Review supporting evidence<ArrowUpRight size={12}/></button></article>)}</section>)}<section><h3>Close the evidence gaps</h3><p>Detailed impact assessment covers {data.engineers.length} contributors. Before using lower observed rankings, ask what was shipped, who adopted it, what changed for users, and what work happened outside public GitHub. Agree one observable outcome and a follow-up date with the contributor.</p><button className="download-link" onClick={onMap}>Explore every public contributor<ArrowUpRight size={14}/></button></section></div>;
}
