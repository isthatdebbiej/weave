import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { equalWeights, rankEngineers } from '../src/lib/ranking.ts';
import type { ImpactData } from '../src/lib/types.ts';
const data=JSON.parse(fs.readFileSync('data/impact.json','utf8')) as ImpactData;
test('complete coverage spans ninety days with all authors included in directory',()=>{
 const audit=JSON.parse(fs.readFileSync('public/coverage.json','utf8')),directory=JSON.parse(fs.readFileSync('public/directory.json','utf8'));
 assert.equal(audit.intervalDays,90);assert.equal(audit.expected,audit.unique);assert.equal(directory.people.length,204);
 assert.ok(directory.people.every((p:{id:string;areas:unknown[]})=>p.areas.length&&!p.id.endsWith('[bot]')));
});
test('top and bottom display limits are applied after ranking all assessed contributors',()=>{
 const ranks=rankEngineers(data,equalWeights),bottom=[...ranks].sort((a,b)=>a.score-b.score||a.engineer.name.localeCompare(b.engineer.name)).slice(0,10);
 assert.equal(ranks.length,data.engineers.length);assert.equal(ranks.slice(0,5).length,5);assert.equal(bottom.length,10);
 assert.equal(bottom[0].score,Math.min(...ranks.map(r=>r.score)));assert.ok(bottom.every(r=>r.rank>=1));
});
test('every displayed measurement has context and a resolvable evidence source',()=>{
 const ids=new Set(data.evidence.map(e=>e.id));
 for(const o of data.outcomes)for(const m of o.metrics){assert.ok(m.context.length>20);assert.ok(m.evidenceIds.every(id=>ids.has(id)));}
});
