// Creates only local resources. No Supabase/Vercel CLI or remote credentials.
import { spawnSync } from 'node:child_process';
import { randomBytes, createHmac } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const stateDir=resolve(process.env.CDV_PREVIEW_STATE_DIR || '/private/tmp/cdv-live-chat-preview-state');
const network='cdv-live-chat-preview';
const database='cdv-live-chat-preview-db';
const api='cdv-live-chat-preview-api';
const loopback='cdv-live-chat-preview-loopback';
if(spawnSync('git',['branch','--show-current'],{encoding:'utf8'}).stdout.trim()!=='fix/live-chat-conversation')throw new Error('Expected isolated chat branch');
function docker(args,input){const r=spawnSync('docker',args,{input,encoding:'utf8'});if(r.status!==0)throw new Error(`Docker ${args[0]} failed: ${r.stderr}`);return r.stdout.trim();}
if(existsSync(resolve(stateDir,'config.json')))throw new Error('Existing preview state: reuse or explicitly stop it, never overwrite');
mkdirSync(stateDir,{recursive:true,mode:0o700});
const secret=randomBytes(40).toString('hex');const password=randomBytes(24).toString('hex');
const jwt=role=>{const head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const body=Buffer.from(JSON.stringify({role,iss:'cdv-local-preview',exp:Math.floor(Date.now()/1000)+86400})).toString('base64url');return `${head}.${body}.${createHmac('sha256',secret).update(`${head}.${body}`).digest('base64url')}`;};
writeFileSync(resolve(stateDir,'db.env'),`POSTGRES_PASSWORD=${password}\nPOSTGRES_DB=cdv_live_chat_preview\n`,{mode:0o600});
writeFileSync(resolve(stateDir,'api.env'),`PGRST_DB_URI=postgres://chat_auth:${password}@${database}:5432/cdv_live_chat_preview\nPGRST_DB_SCHEMAS=public\nPGRST_DB_ANON_ROLE=anon\nPGRST_JWT_SECRET=${secret}\nPGRST_DB_MAX_ROWS=73\n`,{mode:0o600});
docker(['network','create','--internal',network]);
docker(['network','create',loopback]);
docker(['run','--name',database,'--network',network,'--env-file',resolve(stateDir,'db.env'),'-d','postgres:17']);
let ready=false;
for(let i=0;i<120;i++){if(spawnSync('docker',['exec',database,'pg_isready','-h','127.0.0.1','-U','postgres']).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,250));}
if(!ready)throw new Error('Local database did not initialize');
const sql=query=>docker(['exec','-i',database,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','cdv_live_chat_preview'],query);
sql(readFileSync(new URL('../sql/live-chat-fixture.sql',import.meta.url),'utf8'));
sql(`create role chat_auth login noinherit password '${password}'; grant anon,service_role to chat_auth;`);
sql(readFileSync(new URL('../../sql/006_live_chat_integrity.sql',import.meta.url),'utf8'));
docker(['run','--name',api,'--network',loopback,'--env-file',resolve(stateDir,'api.env'),'-p','127.0.0.1:8871:3000','-d','public.ecr.aws/supabase/postgrest:v14.3']);
docker(['network','connect',network,api]);
writeFileSync(resolve(stateDir,'config.json'),JSON.stringify({localOnly:true,branch:'fix/live-chat-conversation',network,loopback,database,api,rest:'http://127.0.0.1:8871',url:'http://127.0.0.1:8870',serviceKey:jwt('service_role'),anonKey:jwt('anon'),adminToken:randomBytes(24).toString('hex')},null,2),{mode:0o600});
console.log(`Local preview resources ready. State protected in ${stateDir}. No secrets printed.`);
