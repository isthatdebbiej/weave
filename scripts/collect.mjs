import fs from 'node:fs';
import { readConfig } from './config.mjs';
const config = readConfig(undefined, true);
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token) throw new Error('Configure GITHUB_TOKEN locally for authenticated full-corpus collection.');
// Every invocation has an isolated directory: a retry or new window cannot mix stale pages.
config.rawDir += '-' + Date.now();
fs.mkdirSync(config.rawDir, { recursive: true });
const { end, start } = config;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let last = 0;
async function request(url) {
  for (let attempt=0; attempt<5; attempt++) {
    await wait(Math.max(0,last+config.interval-Date.now())); last=Date.now();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
    if (res.status === 403 || res.status === 429 || res.status >= 500) { await wait(Math.min(60000,10000*(attempt+1))); continue; }
    if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
    const data = await res.json(); if (data.incomplete_results) { await wait(3000); continue; } return data;
  }
  throw new Error('GitHub collection could not complete after retries.');
}
const trim=p=>({id:p.id,number:p.number,title:p.title,body:p.body||'',url:p.html_url,author:p.user?{login:p.user.login,type:p.user.type,id:p.user.id,avatar:p.user.avatar_url}:null,labels:p.labels.map(l=>l.name),mergedAt:p.pull_request?.merged_at,createdAt:p.created_at,updatedAt:p.updated_at,comments:p.comments,association:p.author_association});
async function collect(a,b,key) {
  const base='https://api.github.com/search/issues?q='+encodeURIComponent(`repo:${config.repository} is:pr is:merged merged:${a}..${b}`)+`&sort=created&order=asc&per_page=${config.pageSize}`;
  const first=await request(base+'&page=1');
  if(first.total_count>900) { const mid=Math.floor((Date.parse(a)+Date.parse(b))/2000)*1000; await collect(a,new Date(mid).toISOString(),key+'a'); await collect(new Date(mid+1000).toISOString(),b,key+'b'); return; }
  const pages=Math.max(1,Math.ceil(first.total_count/config.pageSize));
  for(let page=1;page<=pages;page++) { const response=page===1?first:await request(base+'&page='+page); fs.writeFileSync(`${config.rawDir}/${key}-${page}.json`,JSON.stringify({repository:config.repository,window:{start:a,end:b},expected:first.total_count,page,pages,incomplete:false,items:response.items.map(trim)},null,2)); }
  console.log(`${a} – ${b}: ${first.total_count}`);
}
for(let t=Date.parse(start),i=0;t<=Date.parse(end);t+=config.partitionDays*86400000,i++){ const b=Math.min(Date.parse(end),t+config.partitionDays*86400000-1000); await collect(new Date(t).toISOString(),new Date(b).toISOString(),String(i).padStart(2,'0')); }
const count=await request('https://api.github.com/search/issues?q='+encodeURIComponent(`repo:${config.repository} is:pr is:merged merged:${start}..${end}`)+'&per_page=1');
fs.writeFileSync('data/collection.json',JSON.stringify({repository:config.repository,rawDir:config.rawDir,start,end,expectedPRs:count.total_count,incomplete:count.incomplete_results},null,2));
console.log('Run npm run screen to reconcile counts and generate retrieval candidates.');
