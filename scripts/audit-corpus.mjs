import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readConfig, assertRepository } from './config.mjs';
const config=readConfig(), collection=JSON.parse(fs.readFileSync('data/collection.json'));
assertRepository(collection.repository,config.repository);
const pages=fs.readdirSync(collection.rawDir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(collection.rawDir,f))));
const grouped=new Map();
for(const page of pages){assertRepository(page.repository,config.repository);const key=page.window.start;const g=grouped.get(key)||[];g.push(page);grouped.set(key,g);}
const windows=[...grouped.values()].map(p=>({start:p[0].window.start,end:p[0].window.end,expected:p[0].expected,collected:p.reduce((s,x)=>s+x.items.length,0),unique:new Set(p.flatMap(x=>x.items.map(i=>i.id))).size,pages:p.length,expectedPages:p[0].pages,pageNumbers:p.map(x=>x.page).sort((a,b)=>a-b),incomplete:p.some(x=>x.incomplete)})).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
for(const [i,w] of windows.entries()){if(w.expected!==w.unique||w.pages!==w.expectedPages||w.incomplete||w.pageNumbers.some((p,i)=>p!==i+1))throw new Error('Unreconciled partition');if(i&&Date.parse(w.start)-Date.parse(windows[i-1].end)!==1000)throw new Error('Partition gap/overlap');}
if(Date.parse(windows[0].start)!==Date.parse(collection.start)||Date.parse(windows.at(-1).end)!==Date.parse(collection.end))throw new Error('Incomplete time window');
const records=[...new Map(pages.flatMap(p=>p.items).map(p=>[p.id,p])).values()].sort((a,b)=>a.number-b.number);
if(records.length!==collection.expectedPRs||records.some(p=>Date.parse(p.mergedAt)<Date.parse(collection.start)||Date.parse(p.mergedAt)>Date.parse(collection.end)))throw new Error('Global count/window mismatch');
const corpus=gzipSync(JSON.stringify({repository:config.repository,start:collection.start,end:collection.end,records}),{level:9});
fs.writeFileSync('public/corpus.json.gz',corpus);
const audit={version:'1.0.0',repository:config.repository,start:collection.start,end:collection.end,intervalDays:(Date.parse(collection.end)-Date.parse(collection.start))/86400000,expected:collection.expectedPRs,unique:records.length,duplicatesRemoved:pages.reduce((s,p)=>s+p.items.length,0)-records.length,complete:true,windows,corpus:{url:'/corpus.json.gz',bytes:corpus.length,sha256:createHash('sha256').update(corpus).digest('hex')}};
fs.writeFileSync('public/coverage.json',JSON.stringify(audit,null,2));
console.log(JSON.stringify({records:records.length,partitions:windows.length,compressedBytes:corpus.length,complete:true}));
