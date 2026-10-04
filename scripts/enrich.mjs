import fs from 'node:fs';
import { readConfig } from './config.mjs';
const config = readConfig();
const token=process.env.GITHUB_TOKEN;
if(!token)throw new Error('GITHUB_TOKEN is required');
fs.mkdirSync(config.reviewDir,{recursive:true});
const numbers=process.argv.slice(2).map(Number);
async function get(url){for(let a=0;a<3;a++){const r=await fetch('https://api.github.com'+url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'}});if(r.status>=500){await new Promise(r=>setTimeout(r,1000));continue;}if(!r.ok)throw new Error(`${url}: ${r.status}`);return r.json();}throw new Error('Retries exhausted');}
let cursor=0;
async function worker(){while(cursor<numbers.length){const n=numbers[cursor++];const filename=`${config.reviewDir}/${n}.json`;if(fs.existsSync(filename)){console.log(`${n}: cached`);continue;}try{const pr=await get(`/repos/${config.repository}/pulls/${n}`);const sources={};for(const endpoint of ['files','comments','reviews']){sources[endpoint]=[];for(let page=1;;page++){const batch=await get(`/repos/${config.repository}/pulls/${n}/${endpoint}?per_page=100&page=${page}`);sources[endpoint].push(...batch);if(batch.length<100)break;}}const discussion=[];for(let page=1;;page++){const batch=await get(`/repos/${config.repository}/issues/${n}/comments?per_page=100&page=${page}`);discussion.push(...batch);if(batch.length<100)break;}fs.writeFileSync(filename,JSON.stringify({pr,discussion,...sources},null,2));console.log(`${n}: ${sources.files.length} files, ${sources.comments.length} review comments, ${sources.reviews.length} reviews`);}catch(e){console.error(String(e));process.exitCode=1;}}}
await Promise.all([worker(),worker(),worker(),worker()]);
