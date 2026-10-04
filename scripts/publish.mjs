import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const action=process.argv[2];
function execute(command,args,env=process.env){const r=spawnSync(command,args,{env,encoding:'utf8',maxBuffer:20*1024*1024});let output=(r.stdout||'')+(r.stderr||'');for(const key of ['GITHUB_TOKEN','VERCEL_TOKEN'])if(process.env[key])output=output.split(process.env[key]).join('[REDACTED]');process.stdout.write(output);if(r.error)throw new Error(r.error.message);if(r.status!==0)throw new Error(`${command} exited ${r.status}`);return output;}
if(action==='github'){
 const token=process.env.GITHUB_TOKEN;if(!token)throw Error('GITHUB_TOKEN required');
 const remote=execute('git',['remote']);if(!remote.split(/\s+/).includes('origin'))execute('git',['remote','add','origin','https://github.com/isthatdebbiej/weave.git']);
 const url=execute('git',['remote','get-url','origin']).trim();if(url!=='https://github.com/isthatdebbiej/weave.git')throw Error('Unexpected publication destination');
 execute('git',['branch','-M','main']);
 const env={...process.env,GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'http.https://github.com/.extraheader',GIT_CONFIG_VALUE_0:'AUTHORIZATION: basic '+Buffer.from(`x-access-token:${token}`).toString('base64'),GIT_TERMINAL_PROMPT:'0'};
 execute('git',['push','-u','origin','main'],env);
}else if(action==='vercel'){
 const token=process.env.VERCEL_TOKEN;if(!token||!/^[a-zA-Z0-9_-]+$/.test(token))throw Error('Invalid or missing Vercel token');
 const output=execute('cmd.exe',['/d','/s','/c',`npm exec --yes --package=vercel -- vercel --yes --prod --name weave-engineering-impact --token ${token}`]);
 fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/deployment.txt',output);
}else throw Error('Choose github or vercel');
