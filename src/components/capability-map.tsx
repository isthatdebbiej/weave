'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Search, X } from 'lucide-react';
import type { ImpactData } from '@/lib/types';

interface Sample { number:number; title:string; url:string; date:string; scope:string }
interface Person { id:string; name:string; avatar:string; url:string; areas:{id:string;prs:number;examples:Sample[]}[] }
interface Area {id:string;name:string;color:string;tint:string}
interface Directory {repository:string;people:Person[];areas:Area[];method:string}
export default function CapabilityMap({data,selectedId,onSelect,onInspect}: {data:ImpactData;selectedId:string|null;onSelect:(id:string)=>void;onInspect:(id:string)=>void}) {
 const [directory,setDirectory]=useState<Directory|null>(null),[error,setError]=useState(false),[query,setQuery]=useState(''),[areaId,setAreaId]=useState<string|null>(null),[personOpen,setPersonOpen]=useState(false);
 const dialog=useRef<HTMLDivElement>(null);
 useEffect(()=>{let active=true;fetch('/directory.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(d.repository!==data.manifest.repository)throw Error();if(active)setDirectory(d);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[data.manifest.repository]);
 const open=Boolean(areaId||personOpen);
 useEffect(()=>{if(!open)return;const previous=document.activeElement as HTMLElement;dialog.current?.querySelector<HTMLElement>('button')?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setAreaId(null);setPersonOpen(false);}if(e.key==='Tab'){const items=dialog.current?.querySelectorAll<HTMLElement>('button,a[href],input');if(items?.length){const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}};window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);previous?.focus();};},[open]);
 if(error)return <div className="empty-state"><h3>Capability directory could not load</h3><p>Refresh to retry. The verified initiatives remain available.</p></div>;
 if(!directory)return <div className="empty-state">Loading contributor coverage…</div>;
 const selected=directory.people.find(p=>p.id===selectedId),assessed=new Set(data.engineers.map(p=>p.id));
 const matches=directory.people.filter(p=>`${p.name} ${p.id}`.toLowerCase().includes(query.toLowerCase()));
 const matchingIds=new Set(matches.map(p=>p.id));
 const area=directory.areas.find(a=>a.id===areaId);
 const xy=(i:number)=>({x:125+(i%4)*250,y:135+Math.floor(i/4)*255});
 const select=(id:string)=>{onSelect(id);setAreaId(null);setPersonOpen(true);};
 const keyboard=(e:React.KeyboardEvent,action:()=>void)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action();}};
 return <div className="capability-content">
  <div className="capability-toolbar"><label className="directory-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find any contributor…" aria-label="Find any contributor"/></label><span>{directory.people.length} human authors · all capabilities</span></div>
  <p className="capability-intro">Find where people contribute. Select a name for linked PRs, or open a capability to see everyone. People may appear in several areas.</p>
  {selected&&<div className="selected-contributor-note"><strong>{selected.name}</strong> contributes across {selected.areas.length} capability {selected.areas.length===1?'area':'areas'}. Highlighted cards show their work.</div>}
  {query&&!matches.length&&<p className="empty-search">No contributors match “{query}”. Try a name or GitHub handle.</p>}
  <div className="capability-grid" role="group" aria-label="Contributors grouped by capability">
   {directory.areas.map(a=>{const members=directory.people.filter(p=>p.areas.some(g=>g.id===a.id));const filtered=members.filter(p=>matchingIds.has(p.id));const connected=selected?.areas.some(g=>g.id===a.id);return <article key={a.id} className={`capability-card ${connected?'connected':''} ${query&&!filtered.length?'no-matches':''}`} style={{'--area-color':a.color,'--area-tint':a.tint} as React.CSSProperties}>
    <button className="capability-card-heading" onClick={()=>{setPersonOpen(false);setAreaId(a.id);}} aria-label={`Explore ${a.name}, ${members.length} contributors`}><strong>{a.name}</strong><ArrowUpRight size={14}/></button>
    <span className="capability-count">{query?`${filtered.length} matching / ${members.length}`:members.length} contributors</span>
    <div className="capability-preview">{filtered.slice(0,3).map(p=><button key={p.id} onClick={()=>select(p.id)} aria-label={`View ${p.name} in ${a.name}`}><img src={p.avatar} alt="" width="21" height="21"/><span>{p.name}</span>{assessed.has(p.id)&&<CheckCircle2 size={12} aria-label="Reviewed impact"/>}</button>)}{!filtered.length&&<span className="capability-no-match">No matching contributors</span>}</div>
    <button className="capability-view-all" onClick={()=>{setPersonOpen(false);setAreaId(a.id);}}>View all {members.length}<ArrowUpRight size={12}/></button>
   </article>;})}
  </div>
  <p className="capability-footnote">Groups use PR title scopes, not team membership. <CheckCircle2 size={12}/> = reviewed impact story. Other contributors have metadata coverage; their impact is not yet assessed.</p>

  {open&&<div className="sheet-scrim" onMouseDown={e=>{if(e.target===e.currentTarget){setAreaId(null);setPersonOpen(false);}}}><div className="sheet" role="dialog" aria-modal="true" aria-label={area?.name||selected?.name||'Contributor'} ref={dialog}><div className="sheet-heading"><h2>{area?.name||selected?.name}</h2><button className="icon-button" aria-label="Close capability panel" onClick={()=>{setAreaId(null);setPersonOpen(false);}}><X size={19}/></button></div><div className="sheet-content">
   {area?<><p className="sheet-intro">Everyone with a merged PR scoped to this capability. Select a person to inspect their contributions across areas.</p><div className="capability-members">{directory.people.filter(p=>p.areas.some(a=>a.id===area.id)).map(p=><button key={p.id} onClick={()=>select(p.id)}><img src={p.avatar} alt="" width="28" height="28"/><span><strong>{p.name}</strong><small>@{p.id}</small></span>{assessed.has(p.id)&&<CheckCircle2 size={14} aria-label="Reviewed impact"/>}</button>)}</div></>:selected&&<><a className="directory-profile" href={selected.url} target="_blank" rel="noreferrer"><img src={selected.avatar} alt="" width="42" height="42"/><span>@{selected.id}</span><ArrowUpRight size={15}/></a><p className="sheet-intro">{assessed.has(selected.id)?'This contributor has reviewed impact stories. The work samples below also show their broader public contribution footprint.':'Metadata coverage is complete. This contributor’s outcomes have not yet received a detailed impact assessment; that does not imply lower impact.'}</p>{assessed.has(selected.id)&&<button className="download-link" onClick={()=>{onInspect(selected.id);setPersonOpen(false);}}>Explore reviewed impact<ArrowUpRight size={14}/></button>}{selected.areas.map(a=><section className="directory-area" key={a.id}><h3>{directory.areas.find(g=>g.id===a.id)?.name}</h3><p>{a.prs} merged PR records · latest examples</p>{a.examples.map(p=><a className="directory-pr" key={p.number} href={p.url} target="_blank" rel="noreferrer"><strong>#{p.number} · {p.title}</strong><span>{new Date(p.date).toLocaleDateString('en-US')}<ArrowUpRight size={12}/></span></a>)}</section>)}<p className="capability-footnote">{directory.method}</p></>}
  </div></div></div>}
 </div>;
}
