import fs from 'node:fs';
import assert from 'node:assert/strict';
import { readConfig, assertRepository } from './config.mjs';
const c=readConfig(),d=JSON.parse(fs.readFileSync('data/impact.json')),audit=JSON.parse(fs.readFileSync('public/coverage.json'));
assertRepository(d.manifest.repository,c.repository);assertRepository(audit.repository,c.repository);
assert.equal(Date.parse(d.manifest.start),Date.parse(c.start));assert.equal(Date.parse(d.manifest.end),Date.parse(c.end));
assert.equal(d.manifest.complete,true);assert.equal(audit.complete,true);assert.equal(audit.unique,d.manifest.expectedPRs);
assert.equal(d.manifest.humanAuthoredPRs+d.manifest.botAuthoredPRs,d.manifest.uniquePRs);
assert.equal(d.manifest.screenedPRs,d.manifest.uniquePRs);
const ids=new Set(d.evidence.map(e=>e.id)),people=new Set(d.engineers.map(e=>e.id));
assert.equal(people.size,d.engineers.length);assert.equal(ids.size,d.evidence.length);
assert.equal(new Set(d.outcomes.map(o=>o.id)).size,d.outcomes.length);
for(const e of d.engineers){assert.ok(e.name&&e.id&&e.url===`https://github.com/${e.id}`);assert.ok(!e.id.endsWith('[bot]'));}
for(const e of d.evidence){assert.ok(e.url.startsWith(`https://github.com/${c.repository}/`));assert.ok(e.excerpt);assert.ok(Number.isFinite(Date.parse(e.date)));}
for(const o of d.outcomes){assert.ok([1,3,5].includes(o.significance));assert.ok(o.significanceRationale.length>30);assert.ok(o.summary&&o.benefit&&o.followUp);assert.ok(o.evidenceIds.length);assert.ok(o.participants.length);for(const id of [...o.evidenceIds,...o.metrics.flatMap(m=>m.evidenceIds),...o.participants.flatMap(p=>p.evidenceIds)])assert.ok(ids.has(id),id);for(const p of o.participants)assert.ok(people.has(p.engineerId));for(const m of o.metrics)assert.ok(m.context&&m.value&&m.evidenceIds.length);}
console.log(`Validated ${d.manifest.uniquePRs} collected PRs; ${people.size} assessed people; ${d.outcomes.length} outcomes; ${ids.size} sources. Repository and snapshot match YAML.`);
