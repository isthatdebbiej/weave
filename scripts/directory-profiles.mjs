import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { readConfig, assertRepository } from './config.mjs';
const c=readConfig(),corpus=JSON.parse(gunzipSync(fs.readFileSync('public/corpus.json.gz'))),profiles=JSON.parse(fs.readFileSync('data/profiles.json'));
assertRepository(corpus.repository,c.repository);assertRepository(profiles.repository,c.repository);
const users=[...new Map(corpus.records.filter(p=>p.author?.type==='User').map(p=>[p.author.login,p.author])).values()].filter(u=>!profiles.users[u.login]);let cursor=0;
async function worker(){while(cursor<users.length){const u=users[cursor++];const r=await fetch(`https://api.github.com/users/${u.login}`,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`}});const p=r.ok?await r.json():null;profiles.users[u.login]={id:u.login,name:p?.name||u.login,avatar:p?.avatar_url||u.avatar,url:`https://github.com/${u.login}`};}}
await Promise.all(Array.from({length:4},worker));fs.writeFileSync('data/profiles.json',JSON.stringify(profiles,null,2));console.log(`Stored ${Object.keys(profiles.users).length} public profiles.`);
