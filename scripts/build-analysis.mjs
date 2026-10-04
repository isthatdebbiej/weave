import fs from 'node:fs';
import path from 'node:path';
import { readConfig, assertRepository } from './config.mjs';
const config=readConfig();
const assessments=JSON.parse(fs.readFileSync('data/assessments.json'));
const manifest=JSON.parse(fs.readFileSync('data/manifest.json'));
const profiles=JSON.parse(fs.readFileSync('data/profiles.json'));
const issues=fs.existsSync('data/issues.json')?JSON.parse(fs.readFileSync('data/issues.json')):{repository:config.repository,issues:[]};
assertRepository(issues.repository,config.repository);
for(const item of [assessments,manifest,profiles])assertRepository(item.repository,config.repository);
const reviews=new Map(fs.readdirSync(config.reviewDir).filter(f=>f.endsWith('.json')).map(f=>{const d=JSON.parse(fs.readFileSync(path.join(config.reviewDir,f)));return [d.pr.number,d];}));
const evidence=new Map(), engineers=new Map(), initiatives=new Map();
const textExcerpt=body=>(body||'').split('## 🤖')[0].replace(/<!--[\s\S]*?-->/g,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/<img[^>]*>/g,'').replace(/```[\s\S]*?```/g,'').replace(/https?:\/\/[^\s)]+/g,url=>url.length>180?'[long source link omitted]':url).trim().slice(0,1600);
function person(login){const p=profiles.users[login];if(!p)throw new Error(`Missing public profile ${login}`);engineers.set(login,p);return p;}
function prEvidence(number){const d=reviews.get(number);if(!d)throw new Error(`Missing reviewed PR ${number}`);const p=d.pr;const id=`pr-${number}`;evidence.set(id,{id,type:'pr',title:`#${number} · ${p.title}`,url:p.html_url,date:p.merged_at||p.updated_at,excerpt:textExcerpt(p.body)});return id;}
const outcomes=assessments.outcomes.map(a=>{
  const main=reviews.get(a.prs[0]);
  if(!main?.pr.merged_at)throw new Error(`Unmerged primary outcome ${a.id}`);
  if(Date.parse(main.pr.merged_at)<Date.parse(manifest.start)||Date.parse(main.pr.merged_at)>Date.parse(manifest.end))throw new Error(`Out-of-window primary outcome ${a.id}`);
  const primary=a.primaryAuthor||main.pr.user.login;
  person(primary);
  const sourceIds=a.prs.map(prEvidence);
  for(const number of a.issues||[]){const issue=issues.issues.find(i=>i.number===number);if(!issue)throw new Error(`Missing linked issue ${number}`);const id=`issue-${number}`;evidence.set(id,{id,type:'issue',title:`#${number} · ${issue.title}`,url:issue.url,date:issue.createdAt,excerpt:textExcerpt(issue.body)});sourceIds.push(id);}
  const participants=[{engineerId:primary,role:'Driver',rationale:'Authored and delivered the documented implementation; credit refers to the public contribution, including disclosed agent-assisted work.',evidenceIds:[prEvidence(a.prs.find(n=>reviews.get(n)?.pr.user.login===primary)||a.prs[0])]}];
  for(const p of a.extraPeople||[]){person(p.id);let ids=[prEvidence(p.pr)];if(p.comment){const d=reviews.get(p.commentPR||p.pr);const c=d.comments.find(c=>c.id===p.comment);if(!c||c.user.login!==p.id)throw new Error(`Missing reviewer evidence ${p.id}/${p.comment}`);const id=`review-${c.id}`;evidence.set(id,{id,type:'review',title:`${p.id} · material review on #${p.commentPR||p.pr}`,url:c.html_url,date:c.created_at,excerpt:c.body.slice(0,1800)});ids.unshift(id);sourceIds.push(id);for(const reply of d.comments.filter(r=>r.in_reply_to_id===c.id&&r.user.login===d.pr.user.login)){const rid=`review-${reply.id}`;evidence.set(rid,{id:rid,type:'review',title:`${reply.user.login} · implementation response`,url:reply.html_url,date:reply.created_at,excerpt:reply.body.slice(0,1400)});sourceIds.push(rid);ids.push(rid);}}
    participants.push({engineerId:p.id,role:p.role,rationale:p.rationale,evidenceIds:ids});
  }
  const code=main.files.find(f=>f.filename.includes(a.codeMatch||'test')&&f.patch)||main.files.find(f=>/test|spec/.test(f.filename)&&f.patch);
  if(code){const id=`code-${main.pr.number}-${code.sha}`;evidence.set(id,{id,type:'code',title:code.filename,url:code.blob_url,date:main.pr.merged_at,excerpt:(code.patch||'').slice(0,1800)});sourceIds.push(id);}
  initiatives.set(a.initiative,{id:a.initiative,name:a.initiativeName,dimension:initiatives.get(a.initiative)?.dimension||a.dimension});
  return {id:a.id,initiativeId:a.initiative,title:a.title,summary:a.summary,benefit:a.benefit,dimension:a.dimension,significance:a.significance,significanceRationale:a.significanceRationale,confidence:sourceIds.some(s=>s.startsWith('review-'))?'corroborated':'documented',stage:a.stage,verified:true,evidenceIds:[...new Set(sourceIds)],participants,metrics:a.metrics.map(m=>({value:m.value,label:m.label,context:m.context,evidenceIds:[prEvidence(m.pr)]})),followUp:a.followUp,limitations:a.limitations};
});
manifest.displayName=config.displayName;
manifest.reviewedPRs=reviews.size;
manifest.reviewedSourceCount=evidence.size;
manifest.generatedAt=new Date().toISOString();
manifest.notes=['Candidate retrieval screens all metadata using broad dimension-specific patterns; final ratings are curated from source descriptions, implementation patches, tests, and review trails. This is a bounded evidence review, not an exhaustive expert review of every contribution.','The assessed cohort is selected from candidates across six dimensions, not from PR-count leaderboards. Rankings describe the verified outcomes in this assessment and may change with additional evidence.','Performance values are attributed to their public source and measurement context. Private benchmark dashboards were not independently accessed.'];
const output={version:'1.0.0',manifest,engineers:[...engineers.values()],initiatives:[...initiatives.values()],outcomes,evidence:[...evidence.values()]};
fs.writeFileSync('data/impact.json',JSON.stringify(output,null,2));fs.mkdirSync('public',{recursive:true});fs.writeFileSync('public/impact.json',JSON.stringify(output));
console.log(JSON.stringify({engineers:output.engineers.map(e=>`${e.name} (@${e.id})`),outcomes:outcomes.length,evidence:evidence.size,reviewedPRs:reviews.size}));
