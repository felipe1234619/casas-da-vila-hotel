// Run with Playwright available to Node (NODE_PATH may point to an installed runtime).
// Every HTTP request is intercepted; no remote service is reachable through the browser.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const { chromium } = createRequire(import.meta.url)('playwright');
const chat = await readFile(new URL('../assets/js/live-chat.js',import.meta.url),'utf8');
const admin = await readFile(new URL('../assets/js/chat-admin.js',import.meta.url),'utf8');
const adminHtml = await readFile(new URL('../admin/chats.html',import.meta.url),'utf8');
const adminCss = await readFile(new URL('../assets/css/admin-analytics.css',import.meta.url),'utf8');
const browser = await chromium.launch({channel:'chrome',headless:true});
let passed=0;
function check(value,label){assert.ok(value,label);passed++;console.log(`PASS: ${label}`);}
try {
 for (const [language,viewport] of [['pt',{width:1440,height:1000}],['en',{width:390,height:844}]]) {
  const context=await browser.newContext({viewport});
  let sessions=[],messages=[],alerts=[],requests=[],llm=0;
  let rotateDuringSend = true;
  await context.addInitScript(()=>{
    window.chatEvents = [];
    window.trackSiteEvent = (event, metadata) => window.chatEvents.push({ event, metadata });
    if(!localStorage.getItem('cdv_visitor_id')) localStorage.setItem('cdv_visitor_id','analytics-visitor');
    if(!localStorage.getItem('cdv_session_id')) localStorage.setItem('cdv_session_id','analytics-session');
  });
  await context.route('**/*',async route=>{
    const request=route.request(); const path=new URL(request.url()).pathname;
    const body=request.postDataJSON();
    const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    if(path.startsWith('/api/')) requests.push({path,method:request.method(),body,headers:request.headers()});
    if(path==='/assets/js/live-chat.js')return route.fulfill({contentType:'text/javascript',body:chat});
    if(path==='/assets/js/chat-admin.js')return route.fulfill({contentType:'text/javascript',body:admin});
    if(path==='/assets/css/admin-analytics.css')return route.fulfill({contentType:'text/css',body:adminCss});
    if(path==='/admin/chats.html')return route.fulfill({contentType:'text/html',body:adminHtml});
    if(path==='/api/chat-session'){
      const session={...body,id:randomUUID(),handoff_state:'bot',credential:request.headers()['x-chat-token']};sessions.push(session);return json({chat_session:session});
    }
    if(path==='/api/chat-message'){
      const id=body?.chat_session_id||new URL(request.url()).searchParams.get('chat_session_id');const session=sessions.find(s=>s.id===id);
      assert.equal(request.headers()['x-chat-token'],session.credential,`${language}: credential must remain bound to chat ID`);
      if(request.method()==='GET')return json({messages:messages.filter(m=>m.chat_session_id===id),handoff_state:session.handoff_state});
      check(body.sender==='visitor',`${language}: browser writes only visitor messages`);
      const message={id:randomUUID(),...body,created_at:new Date().toISOString()};messages.push(message);
      const started = !session.first_visitor_message_at;
      if(started){session.first_visitor_message_at=message.created_at;alerts.push('first_message');}
      if(/gerente|manager/.test(body.message)){session.handoff_state='requested';alerts.push('human_handoff');}
      if (rotateDuringSend) { rotateDuringSend=false; await page.evaluate(()=>localStorage.setItem('cdv_session_id','rotated-during-send')); }
      return json({message,handoff_state:session.handoff_state,conversation_started:started,handoff_requested:session.handoff_state==='requested'});
    }
    if(path==='/api/olivia-chat'){
      llm++;messages.push({id:randomUUID(),chat_session_id:body.session_id,sender:'assistant',message:'Resposta simulada da Olivia'});return json({response:'Resposta simulada da Olivia'});
    }
    if(path==='/api/chat-admin'){
      if(request.headers()['x-admin-token']!=='mock-admin')return route.fulfill({status:401,contentType:'application/json',body:'{"error":"Unauthorized"}'});
      if(request.method()==='POST'){
        const s=sessions.find(s=>s.id===body.chat_session_id);
        s.handoff_state=body.action==='resume_bot'?'bot':'human_active';
        if(body.action==='reply')messages.push({id:randomUUID(),chat_session_id:s.id,sender:'admin',message:body.message,created_at:new Date().toISOString()});
        return json({ok:true});
      }
      return json({sessions,messages,alerts:[]});
    }
    if(path===`/${language}/`)return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="${language}"><meta name="viewport" content="width=device-width,initial-scale=1"><body><h1>Local chat test</h1><script src="/assets/js/live-chat.js"></script></body></html>`});
    return route.fulfill({status:404,body:'Test fixture: network blocked'});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://localhost:8769/${language}/`);
  await page.locator('.chatBubble').click();
  await page.locator('.chatMsg').waitFor();
  check(sessions.length===0&&messages.length===0&&alerts.length===0,`${language}: opening persists nothing and sends no alert`);
  await page.locator('.chatClose').click();await page.locator('.chatBubble').click();
  check(sessions.length===0,`${language}: reopening still creates no conversation`);
  check((await page.evaluate(()=>window.chatEvents.map(e=>e.event))).every(e=>e==='chat_opened'),`${language}: opening analytics distinct from conversation`);
  await page.locator('.chatInput').fill('Olá');await page.locator('.chatSend').click();
  await page.getByText('Resposta simulada da Olivia',{exact:true}).waitFor();
  check((await page.evaluate(()=>window.chatEvents.filter(e=>e.event==='chat_conversation_started'))).length===1,`${language}: real conversation event emitted after persistence`);
  check(await page.evaluate(()=>localStorage.getItem('cdv_session_id'))==='rotated-during-send',`${language}: analytics rotated during the send and AI still completed`);
  await page.evaluate(()=>localStorage.setItem('cdv_session_id','analytics-session'));
  check(sessions.length===1&&alerts.length===1,`${language}: first message starts one conversation`);
  check(sessions[0].visitor_id==='analytics-visitor'&&sessions[0].session_id==='analytics-session',`${language}: analytics identities linked`);
  check(requests.find(r=>r.path==='/api/chat-message'&&r.method==='POST').headers['x-chat-token'].length===64,`${language}: conversation credential sent`);
  check(requests.find(r=>r.path==='/api/olivia-chat').body.message_id===messages[0].id,`${language}: Olivia linked to persisted visitor message`);
  await page.locator('.chatInput').fill(language==='pt'?'Quero falar com o gerente':'I want to speak to the manager');await page.locator('.chatSend').click();
  await page.locator('[data-handoff-status]').waitFor();
  check((await page.evaluate(()=>window.chatEvents.filter(e=>e.event==='chat_handoff_requested'))).length===1,`${language}: priority handoff analytics emitted`);
  check(llm===1&&alerts.length===2,`${language}: priority handoff stops AI and queues second alert`);
  const adminPage=await context.newPage();await adminPage.goto('http://localhost:8769/admin/chats.html');
  await adminPage.locator('#adminToken').fill('mock-admin');await adminPage.locator('#loadChats').click();
  await adminPage.getByText(/PRIORIDADE/).waitFor();
  check(await adminPage.locator('.visitorSessionCard').count()===1,`${language}: priority conversation visible to operator`);
  await adminPage.locator('[data-action="claim"]').click();await adminPage.getByText(/Atendimento humano/).waitFor();
  await adminPage.locator('.chatReplyForm input').fill('Rascunho humano');
  await adminPage.locator('.chatReplyForm input').evaluate(el=>el.setSelectionRange(2,5));
  await page.locator('.chatInput').fill('Estou aguardando');await page.locator('.chatSend').click();
  await adminPage.getByText('Estou aguardando',{exact:true}).waitFor({timeout:8000});
  check(await adminPage.locator('.chatReplyForm input').inputValue()==='Rascunho humano',`${language}: focused draft preserved while new messages render`);
  check(await adminPage.locator('.chatReplyForm input').evaluate(el=>document.activeElement===el&&el.selectionStart===2&&el.selectionEnd===5),`${language}: focus and selection preserved`);
  await adminPage.locator('.chatReplyForm input').fill('Olá, aqui é a equipe.');await adminPage.locator('.chatReplyForm button').click();
  await page.getByText('Olá, aqui é a equipe.',{exact:true}).waitFor({timeout:8000});
  check(await page.locator('.chatMsgAuthor').last().textContent()==='Casas da Vila',`${language}: operator reply labeled correctly via polling`);
  check(alerts.length===2,`${language}: operator reply does not send visitor alert`);
  check(llm===1,`${language}: human-active messages do not invoke AI`);
  await adminPage.locator('[data-action="resume_bot"]').click();
  await adminPage.waitForFunction(()=>document.querySelector('.visitorSessionTop strong')?.textContent.startsWith('Olivia'));
  await page.locator('.chatInput').fill('Pode continuar');await page.locator('.chatSend').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.chatMsg span')].filter(el=>el.textContent==='Resposta simulada da Olivia').length===2);
  check(llm===2&&alerts.length===2,`${language}: explicit handback resumes AI without duplicate alerts`);
  const box=await page.locator('.chatPanel').boundingBox();check(box.x>=0&&box.x+box.width<=viewport.width,`${language}: widget fits viewport`);
  await page.reload();await page.locator('.chatBubble').click();await page.getByText('Olá, aqui é a equipe.',{exact:true}).waitFor();
  check(sessions.length===1,`${language}: reload restores owned conversation`);
  await page.evaluate(()=>localStorage.setItem('cdv_session_id','new-analytics-session'));
  await page.locator('.chatClose').click();await page.locator('.chatBubble').click();
  check(sessions.length===1,`${language}: analytics session change does not create a chat just by opening`);
  await page.locator('.chatInput').fill('New session');await page.locator('.chatSend').click();
  await page.getByText('Resposta simulada da Olivia',{exact:true}).waitFor();
  check(sessions.length===2&&sessions[1].session_id==='new-analytics-session',`${language}: new analytics session links to a new chat`);
  check(errors.length===0,`${language}: no browser runtime errors`);
  await page.screenshot({path:`/private/tmp/cdv-chat-${language}.png`});
  await context.close();
 }
 console.log(`BROWSER: ${passed} PASS, 0 FAIL. PT desktop / EN mobile; all network mocked.`);
} finally { await browser.close(); }
