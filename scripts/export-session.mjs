import fs from 'node:fs';
import path from 'node:path';
const input=process.argv[2];if(!input)throw Error('Pass the absolute Codex session JSONL path.');
const secrets=[];
if(fs.existsSync('.env.local'))for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=line.match(/^(?:GITHUB_TOKEN|GH_TOKEN|VERCEL_TOKEN)=(.+)$/);if(m)secrets.push(m[1].replace(/^["']|["']$/g,''));}
const scrub=value=>{let text=JSON.stringify(value);for(const token of secrets)if(token.length>8)text=text.split(token).join('[REDACTED CREDENTIAL]');text=text.replace(/(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|vcp_[A-Za-z0-9_]{20,})/g,'[REDACTED CREDENTIAL]');return JSON.parse(text);};
const rows=fs.readFileSync(input,'utf8').trim().split('\n').map(JSON.parse),exported=[];
for(const r of rows){const p=r.payload;if(r.type==='response_item'){
 if(p.type==='message'&&['user','assistant'].includes(p.role)&&p.channel!=='analysis'){
  const content=(p.content||[]).filter(c=>!/^<environment_context>/.test(c.text||''));if(content.length)exported.push(scrub({timestamp:r.timestamp,type:'message',role:p.role,channel:p.channel,content}));
 }else if(['function_call','custom_tool_call','function_call_output','custom_tool_call_output'].includes(p.type))exported.push(scrub({timestamp:r.timestamp,...p}));
 }else if(r.type==='event_msg'&&p.type==='item_completed'&&['CommandExecution','McpToolCall','FileChange'].includes(p.item?.type))exported.push(scrub({timestamp:r.timestamp,type:'nested_tool_event',item:p.item}));
}
fs.mkdirSync('submission',{recursive:true});
const meta={type:'export_manifest',createdAt:new Date().toISOString(),cutoff:rows.at(-1)?.timestamp,records:exported.length,exclusions:['system/developer messages','private reasoning/analysis','compaction summaries','credentials'],note:'Snapshot through the export invocation; nested tool events are retained alongside their parent calls.'};
fs.writeFileSync('submission/session-export.jsonl',[meta,...exported].map(x=>JSON.stringify(x)).join('\n')+'\n');
fs.writeFileSync('submission/session-export.txt',[JSON.stringify(meta,null,2),...exported.map(x=>JSON.stringify(x,null,2))].join('\n\n'));
console.log(JSON.stringify({records:exported.length,cutoff:meta.cutoff,files:['submission/session-export.jsonl','submission/session-export.txt']}));
