import fs from 'node:fs';
import path from 'node:path';
import { readConfig } from './config.mjs';
const c=readConfig(), collection=JSON.parse(fs.readFileSync('data/collection.json'));
async function get(route){const r=await fetch(`https://api.github.com/${route}`,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'}});if(!r.ok)throw new Error(`GitHub ${r.status} for ${route}`);return r.json();}
const endpoint=await get('search/issues?q='+encodeURIComponent(`repo:${c.repository} is:pr is:merged merged:${collection.end}..${collection.end}`)+'&per_page=100');
if(endpoint.incomplete_results||endpoint.total_count>100)throw new Error('Endpoint requires further collection');
const existing=new Set(fs.readdirSync(collection.rawDir).flatMap(f=>JSON.parse(fs.readFileSync(path.join(collection.rawDir,f))).items.map(p=>p.id)));
if(endpoint.items.some(p=>!existing.has(p.id)))throw new Error('Endpoint has missing PRs; collect full metadata first');
fs.writeFileSync(path.join(collection.rawDir,'endpoint-1.json'),JSON.stringify({repository:c.repository,window:{start:collection.end,end:collection.end},expected:endpoint.total_count,page:1,pages:1,incomplete:false,items:endpoint.items.map(p=>({id:p.id,number:p.number,title:p.title,body:p.body||'',url:p.html_url,author:{login:p.user.login,type:p.user.type,id:p.user.id,avatar:p.user.avatar_url},labels:p.labels.map(l=>l.name),mergedAt:p.pull_request?.merged_at,createdAt:p.created_at,updatedAt:p.updated_at,comments:p.comments,association:p.author_association}))}));
const result={repository:c.repository,issues:[]};
const assessments=JSON.parse(fs.readFileSync('data/assessments.json'));
if(assessments.repository!==c.repository)throw new Error('Assessments must match configured repository');
for(const number of new Set(assessments.outcomes.flatMap(o=>o.issues||[]))){const p=await get(`repos/${c.repository}/issues/${number}`);if(!p.pull_request) result.issues.push({number:p.number,title:p.title,url:p.html_url,body:p.body||'',createdAt:p.created_at,state:p.state});}
fs.writeFileSync('data/issues.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({endpointCount:endpoint.total_count,issues:result.issues.map(p=>({number:p.number,title:p.title,state:p.state}))}));
