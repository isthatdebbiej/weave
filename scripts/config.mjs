import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
export function readConfig(filename = process.env.ANALYSIS_CONFIG || 'analysis.config.yaml', freshSnapshot = false) {
  const value = parse(fs.readFileSync(filename, 'utf8'));
  if (!value || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value.repository || '')) throw new Error('repository must be owner/name');
  const days = value.window?.days ?? 90;
  if (!Number.isInteger(days) || days < 1) throw new Error('window.days must be a positive integer');
  let frozen;
  if (!freshSnapshot && !value.window?.end && fs.existsSync('data/collection.json')) { const prior=JSON.parse(fs.readFileSync('data/collection.json','utf8')); if(prior.repository===value.repository) frozen=prior.end; }
  const end = process.env.SNAPSHOT_END || value.window?.end || frozen || new Date().toISOString();
  if (!Number.isFinite(Date.parse(end))) throw new Error('window.end must be an ISO timestamp or null');
  const start = new Date(Date.parse(end) - days * 86400000).toISOString();
  return { ...value, repository:value.repository, displayName:value.displayName || value.repository.split('/')[1], start, end, days,
    pageSize:Math.min(100,Math.max(1,value.collection?.pageSize || 100)), partitionDays:Math.max(1,value.collection?.partitionDays || 3), interval:Math.max(2100,value.collection?.requestIntervalMs || 2200), rawDir:path.join('data','raw',value.repository.replace('/','_'),`${start.replace(/[^0-9]/g,'')}-${end.replace(/[^0-9]/g,'')}`), reviewDir:path.join('data','reviews',value.repository.replace('/','_')) };
}
export function assertRepository(actual, expected) { if (actual !== expected) throw new Error(`Dataset repository ${actual} does not match configured repository ${expected}. Collect and analyze the new repository before building.`); }
