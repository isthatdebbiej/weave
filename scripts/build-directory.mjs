import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { readConfig, assertRepository } from './config.mjs';
const c=readConfig(),corpus=JSON.parse(gunzipSync(fs.readFileSync('public/corpus.json.gz'))),profiles=JSON.parse(fs.readFileSync('data/profiles.json'));
assertRepository(corpus.repository,c.repository);assertRepository(profiles.repository,c.repository);
const areas=[...(c.capabilities||[]),{id:'other',name:'Other / unclassified',color:'#797783',tint:'#f1f0f4'}];
const people=new Map();let unclassified=0;
for(const p of corpus.records){if(!p.author||p.author.type==='Bot'||p.author.login.endsWith('[bot]'))continue;
 const login=p.author.login,scope=p.title.match(/^[^(]+\(([^)]+)\)/)?.[1]||'';
 const area=areas.find(a=>a.scopes&&new RegExp(a.scopes,'i').test(scope))||areas.at(-1);if(area.id==='other')unclassified++;
 const person=people.get(login)||{id:login,name:profiles.users[login]?.name||login,avatar:p.author.avatar,url:`https://github.com/${login}`,areas:[]};
 let record=person.areas.find(a=>a.id===area.id);if(!record){record={id:area.id,prs:0,examples:[]};person.areas.push(record);}
 record.prs++;record.examples.push({number:p.number,title:p.title,url:p.url,date:p.mergedAt,scope});
 people.set(login,person);
}
for(const person of people.values())for(const area of person.areas)area.examples=area.examples.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);
const result={repository:c.repository,people:[...people.values()].sort((a,b)=>a.name.localeCompare(b.name)),areas:areas.map(({scopes,...a})=>a),unclassifiedPRs:unclassified,method:'Capability areas use the explicit scope in PR titles and configurable YAML rules. These are contribution locations, not assessed impact, team membership, or evidence of collaboration. Unmatched scopes remain unclassified. Examples are the four most recently merged PRs per person and area; complete records are available in the corpus download.'};
fs.writeFileSync('public/directory.json',JSON.stringify(result));
console.log(`Directory: ${people.size} human authors across ${areas.length} capability groups; ${unclassified} PRs left unclassified.`);
