import fs from 'node:fs';
import path from 'node:path';
import { readConfig, assertRepository } from './config.mjs';
const settings = readConfig();
const config = JSON.parse(fs.readFileSync('data/collection.json', 'utf8'));
assertRepository(config.repository, settings.repository);
const rawDir = config.rawDir;
const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.json'));
const pages = files.map(f => JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8')));
for (const page of pages) assertRepository(page.repository, settings.repository);
const prs = [...new Map(pages.flatMap(p => p.items).map(p => [p.id, p])).values()];
const windows = new Map();
for (const page of pages) { const key = JSON.stringify(page.window); if (!windows.has(key)) windows.set(key, []); windows.get(key).push(page); }
const missing = [...windows.values()].filter(group => group.length !== group[0].pages || new Set(group.flatMap(p => p.items.map(i => i.id))).size !== group[0].expected);
const intervals=[...windows.values()].map(g=>g[0].window).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
const contiguous=intervals.length>0&&Date.parse(intervals[0].start)===Date.parse(config.start)&&Date.parse(intervals.at(-1).end)===Date.parse(config.end)&&intervals.every((w,i)=>!i||Date.parse(w.start)-Date.parse(intervals[i-1].end)===1000);
const human = prs.filter(p => p.author?.type !== 'Bot' && !p.author?.login.endsWith('[bot]'));
const patterns = {
  product: /(?:new (?:feature|capability)|introduc|launch|user.?s? (?:can|couldn't|cannot)|feature flag|customer|Closes #)/ig,
  reliability: /(?:data loss|race condition|deadlock|crash|regression|corrupt|incident|outage|OOM|memory leak|duplicate events)/ig,
  performance: /(?:\d+(?:\.\d+)?\s*(?:%|ms|seconds|minutes|[x×]|GB|MB|requests\/s)|benchmark|latency|throughput|speedup|faster|performance)/ig,
  devex: /(?:developer experience|devex|local dev|test suite|test runner|build time|CI pipeline|CI time|flaky test|development environment|debugging|test infrastructure)/ig,
  leverage: /(?:shared (?:component|infrastructure|service|framework)|adopt|migrat|reus|foundation|unblock|unified|common (?:interface|framework)|follow.up)/ig,
  simplification: /(?:consolidat|deduplicat|duplicat(?:e|ion)|legacy|simplif|single (?:source|path|interface)|remove.*(?:abstraction|deprecated)|unif)/ig,
};
const candidates = {};
for (const [dimension, pattern] of Object.entries(patterns)) {
  candidates[dimension] = human.map(pr => {
    const text = pr.title + '\n' + pr.body;
    const matches = [...text.matchAll(pattern)];
    const evidence = /https:\/\/github.com\/[^/]+\/[^/]+\/(?:pull|issues)\/\d+|(?:Closes|Fixes|Resolves) #\d+/i.test(text);
    const measurement = /(?:\d+(?:\.\d+)?\s*(?:ms|seconds|minutes|[x×]|GB|MB|%))/.test(text);
    const beforeAfter = /before|after|from .{0,30} to|previously|instead/i.test(text);
    const tests = /test|benchmark|reproduc/i.test(text);
    const titleMatch = new RegExp(pattern.source, 'i').test(pr.title);
    // Retrieval priority only. Never used by the dashboard's impact ranking.
    const retrievalPriority = Math.min(matches.length, 6) + 4 * Number(titleMatch) + 2 * Number(evidence) + 2 * Number(measurement && beforeAfter) + Number(tests);
    return { ...pr, retrievalPriority, matched: [...new Set(matches.map(m => m[0].toLowerCase()))].slice(0, 8) };
  }).filter(p => p.matched.length > 0 && !/^(?:chore\(release\)|release:|chore\(deps\)|bump )/i.test(p.title))
    .sort((a, b) => b.retrievalPriority - a.retrievalPriority || a.number - b.number);
}
fs.writeFileSync('data/candidates.json', JSON.stringify(candidates));
const manifest = { repository: settings.repository, displayName: settings.displayName, start: config.start, end: config.end, generatedAt: new Date().toISOString(), expectedPRs: config.expectedPRs, collectedPRs: pages.reduce((s,p)=>s+p.items.length,0), uniquePRs: prs.length, screenedPRs: prs.length, humanAuthoredPRs: human.length, botAuthoredPRs: prs.length-human.length, reviewedPRs: 0, complete: !missing.length && prs.length === config.expectedPRs && !config.incomplete, windows: windows.size, reviewedSourceCount: 0, notes: [] };
manifest.complete=manifest.complete&&contiguous&&pages.every(p=>!p.incomplete);
fs.writeFileSync('data/manifest.json', JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest));
for (const [dimension, records] of Object.entries(candidates)) console.log('\n'+dimension.toUpperCase()+'\n'+records.slice(0,25).map(p => `${p.number} | ${p.author.login} | ${p.title}`).join('\n'));
