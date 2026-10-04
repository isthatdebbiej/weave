import fs from 'node:fs';
import { readConfig } from './config.mjs';
const config=readConfig();
const records=fs.readdirSync(config.reviewDir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(`${config.reviewDir}/${f}`)));
const users=new Map();
for(const r of records)for(const u of [r.pr.user,...r.comments.map(c=>c.user),...r.reviews.map(c=>c.user)])if(u?.type==='User')users.set(u.login,u);
const result={};
for(const [login,u] of users){const r=await fetch(`https://api.github.com/users/${login}`,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`}});const p=r.ok?await r.json():u;result[login]={id:login,name:p.name||login,avatar:p.avatar_url,url:p.html_url};}
fs.writeFileSync('data/profiles.json',JSON.stringify({repository:config.repository,users:result},null,2));
console.log(`Saved public display names for ${Object.keys(result).length} contributors.`);
