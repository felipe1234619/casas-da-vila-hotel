// Real browser -> HTTP handlers -> Supabase SDK -> local PostgREST -> PostgreSQL.
// External model and email calls remain intercepted by the local server.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const config=JSON.parse(await readFile('/private/tmp/cdv-live-chat-preview-state/config.json','utf8'));
if(config.localOnly!==true||config.url!=='http://127.0.0.1:8870')throw new Error('Local preview required');
const {chromium}=createRequire(import.meta.url)('playwright');
let passed=0;const check=(value,label)=>{assert.ok(value,label);passed++;console.log('PASS: '+label);};
const api=async(path,options={})=>{const r=await fetch(config.url+path,options);const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;};
const admin=()=>api('/api/chat-admin',{headers:{'x-admin-token':config.adminToken}});
const stats=()=>api('/__preview/state');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin!==config.url||route.request().resourceType()==='media')return route.abort();
  return route.continue();
 });
 const page=await context.newPage();const sent=[];
 page.on('request',r=>{if(r.url().includes('/api/chat-message')&&r.method()==='POST')sent.push({body:r.postData(),token:r.headers()['x-chat-token']});});
 const before=await admin();const stateBefore=await stats();
 await page.goto(config.url+'/pt/',{waitUntil:'domcontentloaded'});await page.locator('.chatBubble').click();await page.locator('.chatMsg').waitFor();
 check((await admin()).sessions.length===before.sessions.length,'opening does not create real conversation');
 check((await stats()).emails.length===stateBefore.emails.length,'opening sends no email');
 await page.locator('.chatInput').fill('Olá, gostaria de conhecer as casas');await page.locator('.chatSend').click();
 await page.getByText('[PREVIEW LOCAL] Resposta simulada da Olivia.',{exact:true}).waitFor({timeout:15000});
 const first=JSON.parse(sent[0].body);const chatId=first.chat_session_id;
 let data=await admin();let session=data.sessions.find(s=>s.id===chatId);
 const identity=await page.evaluate(()=>({visitor:localStorage.getItem('cdv_visitor_id'),session:localStorage.getItem('cdv_session_id')}));
 check(session.visitor_id===identity.visitor&&session.session_id===identity.session,'real database links visitor/session identity');
 check((await stats()).emails.length===stateBefore.emails.length+1,'first message delivers exactly one intercepted alert');
 await api('/api/chat-message',{method:'POST',headers:{'Content-Type':'application/json','x-chat-token':sent[0].token},body:sent[0].body});
 check((await stats()).emails.length===stateBefore.emails.length+1,'real RPC duplicate retry does not resend alert');
 await page.locator('.chatInput').fill('Quero falar com o gerente');await page.locator('.chatSend').click();await page.locator('[data-handoff-status]').waitFor();
 data=await admin();check(data.sessions.find(s=>s.id===chatId).handoff_state==='requested','priority handoff persisted in PostgreSQL');
 check((await stats()).emails.length===stateBefore.emails.length+2,'priority handoff adds exactly one second alert');
 const operator=await context.newPage();await operator.goto(config.url+'/admin/chats.html');await operator.locator('#adminToken').fill(config.adminToken);await operator.locator('#loadChats').click();
 await operator.getByText(/PRIORIDADE/).first().waitFor();
 const card=operator.locator('.visitorSessionCard').filter({has:operator.locator(`form[data-chat="${chatId}"]`)});
 await card.locator('[data-action="claim"]').click();await operator.waitForFunction(id=>[...document.querySelectorAll('.visitorSessionCard')].find(el=>el.querySelector('form')?.dataset.chat===id)?.textContent.includes('Atendimento humano'),chatId);
 await card.locator('input').fill('Rascunho humano');await card.locator('input').evaluate(el=>el.setSelectionRange(2,5));
 const llmBefore=(await stats()).llmCalls;
 await page.locator('.chatInput').fill('Estou aguardando a equipe');await page.locator('.chatSend').click();
 await card.getByText('Estou aguardando a equipe',{exact:true}).waitFor({timeout:9000});
 check(await card.locator('input').inputValue()==='Rascunho humano','real polling preserves draft while rendering new messages');
 check(await card.locator('input').evaluate(el=>document.activeElement===el&&el.selectionStart===2),'real polling preserves operator focus/caret');
 check((await stats()).llmCalls===llmBefore,'human-active conversation pauses Olivia');
 await card.locator('input').fill('Olá, aqui é a equipe no preview.');await card.locator('.chatReplyForm button').click();
 await page.getByText('Olá, aqui é a equipe no preview.',{exact:true}).waitFor({timeout:9000});check(true,'human response travels through real server/database/polling');
 await card.locator('[data-action="resume_bot"]').click();await operator.waitForFunction(id=>[...document.querySelectorAll('.visitorSessionCard')].find(el=>el.querySelector('form')?.dataset.chat===id)?.querySelector('.visitorSessionTop strong')?.textContent.startsWith('Olivia'),chatId);
 await page.locator('.chatInput').fill('Pode continuar');await page.locator('.chatSend').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.chatMsg span')].filter(el=>el.textContent==='[PREVIEW LOCAL] Resposta simulada da Olivia.').length===2);
 check((await stats()).llmCalls===llmBefore+1,'explicit handback resumes Olivia orchestration');
 check((await stats()).emails.length===stateBefore.emails.length+2,'full handoff produces no extra alerts');
 const denied=await fetch(config.url+`/api/chat-message?chat_session_id=${chatId}`);check(denied.status===401,'conversation cannot be read without its credential');
 const direct=await fetch(config.url+'/rest/v1/chat_messages',{headers:{Authorization:'Bearer '+config.anonKey}});check([401,403].includes(direct.status),'PostgREST anon cannot bypass server ownership checks');
 // Fresh synthetic conversation with >1,000 messages and actual API cap of 73.
 const token=randomBytes(32).toString('hex');
 const created=await api('/api/chat-session',{method:'POST',headers:{'Content-Type':'application/json','x-chat-token':token},body:JSON.stringify({visitor_id:'pagination-preview',session_id:randomUUID(),identity_source:'chat'})});
 const bulkId=created.chat_session.id;
 const sql=`insert into public.chat_messages(chat_session_id,sender,message,created_at) select '${bulkId}','visitor','pagination '||n,now()+n*interval '1 millisecond' from generate_series(1,1207)n;`;
 const result=spawnSync('docker',['exec','-i',config.database,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','cdv_live_chat_preview'],{input:sql,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const all=await api(`/api/chat-message?chat_session_id=${bulkId}`,{headers:{'x-chat-token':token}});
 check(all.messages.length===1207&&all.messages.at(-1).message==='pagination 1207','real PostgREST cap 73: all 1,207 messages including newest returned');
 check((await admin()).messages.filter(m=>m.chat_session_id===bulkId).length===1207,'admin pagination works across real capped REST pages');
 for(const path of ['/sql/006_live_chat_integrity.sql','/tests/live-chat.test.js','/docs/live-chat-local-validation.md','/.env','/api/create-checkout-session']){
  const r=await fetch(config.url+path);check([403,404].includes(r.status),`preview does not expose or execute ${path}`);
 }
 await context.close();console.log(`INTEGRATION: ${passed} PASS, 0 FAIL; actual handlers + SDK + PostgreSQL + REST; external providers simulated.`);
} finally {await browser.close();}
