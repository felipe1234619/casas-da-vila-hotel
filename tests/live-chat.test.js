// node --experimental-vm-modules --test tests/live-chat.test.js
// All provider and database calls are mocks. No environment credentials are read.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import * as crypto from 'node:crypto';
const ID='10000000-0000-4000-8000-000000000001';
const MSG='20000000-0000-4000-8000-000000000001';
const REQ='30000000-0000-4000-8000-000000000001';
const TOKEN='a'.repeat(64);
async function harness(options={}) {
  const rows={chat_sessions:[],chat_messages:[],chat_alerts:[]};
  if(!options.empty) rows.chat_sessions.push({id:ID,access_token_hash:crypto.createHash('sha256').update(TOKEN).digest('hex'),visitor_id:'visitor',session_id:'session',handoff_state:options.state||'bot'});
  if(options.message) rows.chat_messages.push({id:MSG,chat_session_id:ID,sender:'visitor',message:options.message});
  const calls={mail:[],llm:0,rpc:[]};
  const client={
    from(table){
      let filters=[],insert=null,limit=Infinity,offset=0;
      const q={range(a,b){offset=a;limit=b-a+1;return q;},select(){return q;},order(){return q;},limit(n){limit=n;return q;},eq(k,v){filters.push(x=>x[k]===v);return q;},in(k,v){filters.push(x=>v.includes(x[k]));return q;},insert(v){insert=v;return q;},
        async run(single=false){
          if(options.dbError)return {error:{message:'internal provider secret'}};
          if(insert){
            if(rows[table].some(x=>x.access_token_hash===insert.access_token_hash))return {error:{code:'23505'}};
            const row={id:ID,handoff_state:'bot',...insert}; rows[table].push(row);return {data:single?row:[row]};
          }
          if(options.pageError && offset>0)return {error:{message:'page unavailable'}};
          const data=rows[table].filter(x=>filters.every(f=>f(x))).slice(offset,offset+Math.min(limit,options.apiCap||Infinity));
          return {data:single?(data[0]||null):data};
        },single(){return q.run(true);},maybeSingle(){return q.run(true);},then(ok,bad){return q.run().then(ok,bad);}};
      return q;
    },
    async rpc(name,args){
      calls.rpc.push({name,args});
      if(options.rpcError)return {error:{message:'db secret'}};
      const s=rows.chat_sessions.find(x=>x.id===args.p_chat_id);
      if(name==='chat_record_message'){
        const existing=rows.chat_messages.find(x=>x.request_id===args.p_request_id);
        if(existing)return {data:{message:existing,handoff_state:s.handoff_state,duplicate:true}};
        if(args.p_sender==='assistant' && (options.race||s.handoff_state!=='bot'))return {data:{suppressed:true,handoff_state:'human_active'}};
        const m={id:crypto.randomUUID(),chat_session_id:s.id,request_id:args.p_request_id,sender:args.p_sender,message:args.p_message,reply_to:args.p_reply_to}; rows.chat_messages.push(m);
        if(m.sender==='visitor'){
          const enqueue=kind=>{if(!rows.chat_alerts.some(a=>a.chat_session_id===s.id&&a.kind===kind))rows.chat_alerts.push({id:crypto.randomUUID(),chat_session_id:s.id,kind,state:'pending',payload:{message:m.message,visitor_id:s.visitor_id,session_id:s.session_id}});};
          if(!s.first_visitor_message_at){s.first_visitor_message_at='now';enqueue('first_message');}
          if(args.p_handoff){s.handoff_state='requested';enqueue('human_handoff');}
        }
        if(m.sender==='admin')s.handoff_state='human_active';
        return {data:{message:m,handoff_state:s.handoff_state}};
      }
      if(name==='chat_set_handoff'){s.handoff_state=args.p_state;return {};}
      const a=rows.chat_alerts.find(x=>x.id===args.p_id);
      if(name==='chat_claim_alert'){
        if(a.state==='sent'||a.state==='sending'||options.expired)return {data:null};
        a.state='sending';a.lease=args.p_lease;return {data:{...a}};
      }
      if(name==='chat_finish_alert'){
        if(options.finishError)return {error:{message:'finish failed'}};
        a.state=args.p_provider_id?'sent':'pending';return {};
      }
      throw new Error(`Unexpected RPC ${name}`);
    }
  };
  const context=vm.createContext({Buffer,URL,AbortSignal,console:{info(){},warn(){},error(){}},process:{env:{SUPABASE_URL:'https://invalid.test',SUPABASE_SERVICE_ROLE_KEY:'mock',ADMIN_ANALYTICS_TOKEN:'admin-test',RESEND_API_KEY:'mock',BOOKING_NOTIFICATION_EMAIL:'ops@example.test',BOOKING_FROM_EMAIL:'hotel@example.test',...options.env}},fetch:async(url,opts)=>{
    assert.equal(url,'https://api.resend.com/emails');calls.mail.push({url,...opts});
    if(options.mailError)throw new Error('timeout');
    return {ok:!options.mailReject,status:options.mailStatus || (options.mailReject?403:200),text:async()=>options.mailBody ?? JSON.stringify({id:'mail-mock'})};
  }});
  const cache=new Map();
  function synthetic(key,exports){const mod=new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v);},{context,identifier:key});cache.set(key,mod);return mod;}
  async function load(path){
    if(cache.has(path))return cache.get(path);
    const source=await readFile(path,'utf8');const mod=new vm.SourceTextModule(source,{context,identifier:path});cache.set(path,mod);
    await mod.link(async(spec,ref)=>{
      if(spec==='node:crypto')return cache.get(spec)||synthetic(spec,crypto);
      if(spec==='@supabase/supabase-js')return cache.get(spec)||synthetic(spec,{createClient:()=>client});
      const file=resolve(dirname(ref.identifier),spec);
      const mocks={
        'conversation-context.js':{buildConversationContext:()=>({})},'sales-stage.js':{calculateSalesStage:()=>null},
        'memory-extractor.js':{extractConversationData:()=>({})},'conversation-state.js':{getConversationState:()=>({}),updateConversationState:()=>{}},
        'groq-client.js':{generateGroqCompletion:async()=>{calls.llm++;return {text:'Resposta simulada',model:'mock'};}},
        'load-agent.js':{loadAgent:async()=>({buildSystemPrompt:()=>({prompt:'Mock',selectedSections:[]})})},
        'runtime-builder.js':{buildKnowledgeRuntime:async()=>({loadedModules:[],files:[]})}
      };
      const mock=mocks[file.split('/').at(-1)];if(mock)return cache.get(file)||synthetic(file,mock);
      return load(file);
    });return mod;
  }
  async function module(file){const mod=await load(resolve(file));if(mod.status==='linked')await mod.evaluate();return mod.namespace;}
  async function call(file,req={}){
    const handler=(await module(`server/chat/${file}-handler.js`)).default;
    const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(x){this.body=x;return this;}};
    await handler({method:'POST',headers:{'x-chat-token':TOKEN},query:{},...req},res);return res;
  }
  return {rows,calls,client,call,module};
}
const visitor=(overrides={})=>({chat_session_id:ID,request_id:REQ,sender:'visitor',message:'Olá',...overrides});
test('session binds identities, hashes token and does not start conversation or send email',async()=>{const h=await harness({empty:true});const r=await h.call('session',{body:{visitor_id:'visitor',session_id:'session',identity_source:'analytics',page_path:'/pt/'}});assert.equal(r.statusCode,200);assert.equal(r.body.chat_session.visitor_id,'visitor');assert.equal(r.body.chat_session.session_id,'session');assert.ok(h.rows.chat_sessions[0].access_token_hash);assert.equal(r.body.chat_session.access_token_hash,undefined);assert.equal(h.calls.mail.length,0);assert.equal(h.rows.chat_messages.length,0);});
test('session creation retry returns same session',async()=>{const h=await harness();const r=await h.call('session',{body:{visitor_id:'visitor',session_id:'session'}});assert.equal(r.statusCode,200);assert.equal(h.rows.chat_sessions.length,1);});
test('session token cannot be rebound to another analytics identity',async()=>{const h=await harness();assert.equal((await h.call('session',{body:{visitor_id:'other',session_id:'session'}})).statusCode,409);});
test('session requires linked identities',async()=>{const h=await harness();assert.equal((await h.call('session',{body:{}})).statusCode,400);});
for(const headers of [{},{'x-chat-token':'b'.repeat(64)},{'x-chat-token':'short'}])test(`ownership required ${JSON.stringify(headers).slice(0,30)}`,async()=>{const h=await harness();const r=await h.call('message',{method:'GET',headers,query:{chat_session_id:ID}});assert.ok([401,403].includes(r.statusCode));});
test('public endpoint rejects admin impersonation',async()=>{const h=await harness();assert.equal((await h.call('message',{body:visitor({sender:'admin'})})).statusCode,403);assert.equal(h.rows.chat_messages.length,0);});
test('public endpoint rejects assistant impersonation',async()=>{const h=await harness();assert.equal((await h.call('message',{body:visitor({sender:'assistant'})})).statusCode,403);});
for(const message of ['', ' '.repeat(5), 'x'.repeat(4001),42])test(`invalid message rejected (${typeof message}/${String(message).length})`,async()=>{const h=await harness();assert.equal((await h.call('message',{body:visitor({message})})).statusCode,400);assert.equal(h.calls.mail.length,0);});
test('message requires idempotency key',async()=>{const h=await harness();assert.equal((await h.call('message',{body:visitor({request_id:null})})).statusCode,400);});
test('first message sends alert to existing operational fallback immediately',async()=>{const h=await harness();const r=await h.call('message',{body:visitor()});assert.equal(r.statusCode,200);assert.equal(h.calls.mail.length,1);const mail=JSON.parse(h.calls.mail[0].body);assert.deepEqual(mail.to,['ops@example.test']);assert.equal(mail.from,'hotel@example.test');assert.match(mail.subject,/primeira/);assert.equal(h.rows.chat_alerts[0].state,'sent');});
test('repeated visitor messages do not repeat first alert',async()=>{const h=await harness();await h.call('message',{body:visitor()});await h.call('message',{body:visitor({request_id:crypto.randomUUID(),message:'More'})});assert.equal(h.calls.mail.length,1);});
test('duplicate transport retry does not repeat message or email',async()=>{const h=await harness();await h.call('message',{body:visitor()});await h.call('message',{body:visitor()});assert.equal(h.rows.chat_messages.length,1);assert.equal(h.calls.mail.length,1);});
test('priority request as first message generates two distinct alerts',async()=>{const h=await harness();await h.call('message',{body:visitor({message:'Quero falar com gerente'})});assert.equal(h.calls.mail.length,2);assert.equal(h.rows.chat_sessions[0].handoff_state,'requested');assert.match(JSON.parse(h.calls.mail[1].body).subject,/PRIORIDADE/);});
for(const text of ['Quero falar com o responsável','Falar com operações','Can I speak with reservations?','I want a human','Gerente, por favor','Preciso falar com uma pessoa','Me passe para a equipe de reservas','Contact operations please'])test(`priority classification: ${text}`,async()=>{const h=await harness();const {isHumanRequest}=await h.module('server/chat/chat-store.js');assert.equal(isHumanRequest(text),true);});
for(const text of ['Quero reservar uma casa','The manager helped us last year','Não quero falar com humano','Qual o preço?'])test(`not a handoff: ${text}`,async()=>{const h=await harness();const {isHumanRequest}=await h.module('server/chat/chat-store.js');assert.equal(isHumanRequest(text),false);});
test('email timeout preserves message and pending alert',async()=>{const h=await harness({mailError:true});assert.equal((await h.call('message',{body:visitor()})).statusCode,200);assert.equal(h.rows.chat_messages.length,1);assert.equal(h.rows.chat_alerts[0].state,'pending');});
test('provider rejection preserves pending alert',async()=>{const h=await harness({mailReject:true});await h.call('message',{body:visitor()});assert.equal(h.rows.chat_alerts[0].state,'pending');});
test('retry uses stable provider idempotency key and payload',async()=>{const h=await harness({mailError:true});await h.call('message',{body:visitor()});await h.call('message',{body:visitor()});assert.equal(h.calls.mail[0].headers['Idempotency-Key'],h.calls.mail[1].headers['Idempotency-Key']);assert.equal(h.calls.mail[0].body,h.calls.mail[1].body);});
test('missing email config queues without dropping conversation',async()=>{const h=await harness({env:{RESEND_API_KEY:''}});const r=await h.call('message',{body:visitor()});assert.equal(r.statusCode,200);assert.equal(r.body.alerts.pending,true);assert.equal(h.calls.mail.length,0);assert.equal(h.rows.chat_alerts[0].state,'pending');});
test('explicit chat env overrides existing email fallback',async()=>{const h=await harness({env:{CHAT_NOTIFICATION_EMAIL:'chat@example.test',CHAT_FROM_EMAIL:'concierge@example.test'}});await h.call('message',{body:visitor()});const mail=JSON.parse(h.calls.mail[0].body);assert.deepEqual(mail.to,['chat@example.test']);assert.equal(mail.from,'concierge@example.test');});
test('failed delivery acknowledgement is not reported as message failure',async()=>{const h=await harness({finishError:true});const r=await h.call('message',{body:visitor()});assert.equal(r.statusCode,200);assert.equal(r.body.alerts.pending,true);});
test('old ambiguous alert is never sent automatically',async()=>{const h=await harness({expired:true});await h.call('message',{body:visitor()});assert.equal(h.calls.mail.length,0);});
test('admin requires existing access credential',async()=>{const h=await harness();assert.equal((await h.call('admin',{method:'GET'})).statusCode,401);});
test('admin reply takes over without sending visitor alert',async()=>{const h=await harness();const r=await h.call('admin',{headers:{'x-admin-token':'admin-test'},body:{action:'reply',chat_session_id:ID,request_id:REQ,message:'Equipe aqui'}});assert.equal(r.statusCode,200);assert.equal(h.rows.chat_messages[0].sender,'admin');assert.equal(h.rows.chat_sessions[0].handoff_state,'human_active');assert.equal(h.calls.mail.length,0);});
test('admin can claim and explicitly resume Olivia',async()=>{const h=await harness();for(const [action,state]of [['claim','human_active'],['resume_bot','bot']]){await h.call('admin',{headers:{'x-admin-token':'admin-test'},body:{action,chat_session_id:ID}});assert.equal(h.rows.chat_sessions[0].handoff_state,state);}});
test('admin excludes opening-only legacy sessions',async()=>{const h=await harness();h.rows.chat_messages.push({chat_session_id:ID,sender:'admin',message:'Welcome'});const r=await h.call('admin',{method:'GET',headers:{'x-admin-token':'admin-test'}});assert.equal(r.body.sessions.length,0);});
test('admin preserves legacy real conversations without exposing token hashes',async()=>{const h=await harness({message:'Legacy question'});const r=await h.call('admin',{method:'GET',headers:{'x-admin-token':'admin-test'}});assert.equal(r.body.sessions.length,1);assert.equal(r.body.sessions[0].access_token_hash,undefined);assert.equal(h.calls.mail.length,0);});
for(const state of ['requested','human_active'])test(`Olivia does not generate during ${state}`,async()=>{const h=await harness({message:'Olá',state});const r=await h.call('assistant',{body:{session_id:ID,message:'Olá',message_id:MSG}});assert.equal(r.statusCode,200);assert.equal(r.body.suppressed,true);assert.equal(h.calls.llm,0);});
test('Olivia requires owned, stored visitor message',async()=>{const h=await harness();assert.equal((await h.call('assistant',{body:{session_id:ID,message:'Fake',message_id:MSG}})).statusCode,400);assert.equal(h.calls.llm,0);});
test('Olivia persists response as assistant server-side',async()=>{const h=await harness({message:'Olá'});const r=await h.call('assistant',{body:{session_id:ID,message:'Olá',message_id:MSG}});assert.equal(r.statusCode,200);assert.equal(h.rows.chat_messages.at(-1).sender,'assistant');assert.equal(h.calls.mail.length,0);});
test('handoff while LLM was running suppresses its late response',async()=>{const h=await harness({message:'Olá',race:true});const r=await h.call('assistant',{body:{session_id:ID,message:'Olá',message_id:MSG}});assert.equal(r.statusCode,200);assert.equal(r.body.suppressed,true);assert.equal(h.rows.chat_messages.length,1);});
test('Olivia retry returns existing persisted response',async()=>{const h=await harness({message:'Olá'});const req={body:{session_id:ID,message:'Olá',message_id:MSG}};await h.call('assistant',req);await h.call('assistant',req);assert.equal(h.calls.llm,1);});
test('DB errors do not expose internal details',async()=>{const h=await harness({dbError:true});const r=await h.call('message',{body:visitor()});assert.equal(r.statusCode,500);assert.doesNotMatch(JSON.stringify(r.body),/secret/);});
async function frontend({ blocked = false, stored = {}, rotate = false } = {}) {
  const values=new Map(Object.entries(stored)); const writes=[]; const requests=[];
  const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>{writes.push(k);values.set(k,v);}};
  const window={location:{pathname:'/pt/',href:'http://localhost/pt/'},trackSiteEvent(){if(rotate)values.set('cdv_session_id','rotated-session');}};
  if(blocked){for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{get(){throw new Error('Storage disabled');}});}
  else {window.localStorage=storage;window.sessionStorage=storage;}
  const context=vm.createContext({window,crypto:crypto.webcrypto,document:{addEventListener(){}},console,
    fetch:async(url,opts)=>{requests.push({url,opts});return {ok:true,json:async()=>({chat_session:{id:ID},message:{id:MSG},handoff_state:'bot',messages:[]})};}});
  const source=await readFile('assets/js/live-chat.js','utf8');
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.chatTest = { identity, getSessionRecord, createSession, saveMessage, fetchMessages };})();'),context);
  return {helpers:context.chatTest,writes,requests};
}
test('frontend tolerates unavailable storage and keeps in-memory ownership',async()=>{const h=await frontend({blocked:true});const first=h.helpers.identity();assert.equal(h.helpers.identity().visitor_id,first.visitor_id);assert.equal(await h.helpers.createSession(),ID);assert.equal(await h.helpers.createSession(),ID);assert.equal(h.requests.length,1);assert.equal(h.helpers.getSessionRecord().token.length,64);});
test('frontend reads exact analytics keys without writing them',async()=>{const h=await frontend({stored:{cdv_visitor_id:'visitor-analytics',cdv_session_id:'session-analytics'}});const id=h.helpers.identity();assert.equal(id.visitor_id,'visitor-analytics');assert.equal(id.session_id,'session-analytics');assert.equal(id.identity_source,'analytics');assert.equal(h.writes.length,0);});
test('frontend does not adopt obsolete unowned session cache',async()=>{const h=await frontend({stored:{casas_live_chat_session_id:ID}});assert.equal(h.helpers.getSessionRecord(),null);});
test('fallback identity is explicitly chat-specific',async()=>{const h=await frontend();assert.equal(h.helpers.identity().identity_source,'chat');assert.ok(h.writes.every(k=>k.startsWith('cdv_chat_')));});
for (const endpoint of ['message','admin']) test(`${endpoint}: pagination includes newest message beyond API cap`,async()=>{
 const h=await harness({apiCap:73});
 h.rows.chat_sessions[0].first_visitor_message_at='now';
 for(let n=0;n<1207;n++)h.rows.chat_messages.push({id:String(n),chat_session_id:ID,sender:'visitor',message:`message ${n}`});
 const req=endpoint==='message'?{method:'GET',query:{chat_session_id:ID}}:{method:'GET',headers:{'x-admin-token':'admin-test'}};
 const r=await h.call(endpoint,req);assert.equal(r.statusCode,200);assert.equal(r.body.messages.length,1207);assert.equal(r.body.messages.at(-1).message,'message 1206');
});
test('pagination failure never returns truncated success',async()=>{
 const h=await harness({apiCap:1,pageError:true,message:'First'});
 const r=await h.call('message',{method:'GET',query:{chat_session_id:ID}});assert.equal(r.statusCode,500);assert.equal(r.body.messages,undefined);
});
test('analytics rotation during send preserves credential for following poll',async()=>{
 const h=await frontend({rotate:true,stored:{cdv_visitor_id:'visitor',cdv_session_id:'original'}});
 await h.helpers.createSession();await h.helpers.saveMessage(ID,'Olá');await h.helpers.fetchMessages(ID);
 assert.ok(h.requests.every(r=>r.opts.headers['x-chat-token']===h.requests[0].opts.headers['x-chat-token']));
 assert.equal(JSON.parse(h.requests[0].opts.body).session_id,'original');
});

for (const [label, options, kind, status] of [
 ['domain rejection',{mailReject:true,mailStatus:403,mailBody:'{"name":"validation_error","message":"Domain not verified"}'},'provider_http_error',403],
 ['scope rejection',{mailReject:true,mailStatus:401,mailBody:'{"name":"restricted_api_key"}'},'provider_http_error',401],
 ['malformed payload rejection',{mailReject:true,mailStatus:422,mailBody:'{"name":"validation_error"}'},'provider_http_error',422],
 ['non JSON response',{mailBody:'<html>Bad gateway</html>'},'invalid_json_response',200],
 ['missing id',{mailBody:'{}'},'missing_message_id',200],
 ['empty id',{mailBody:'{"id":""}'},'missing_message_id',200],
 ['transport failure',{mailError:true},'transport_error',null]
]) test('email diagnostics: '+label,async()=>{
 const h=await harness(options);const r=await h.call('message',{body:visitor()});
 const finish=h.calls.rpc.find(x=>x.name==='chat_finish_alert');const d=JSON.parse(finish.args.p_error);
 assert.equal(d.kind,kind);assert.equal(d.status,status);assert.equal(d.responseBody,options.mailBody??null);
 assert.equal(r.body.alerts.pending,true);assert.equal(r.body.alerts.accepted,0);assert.equal(r.body.alerts.failed,1);
 assert.equal(h.calls.mail.length,1);assert.equal(h.rows.chat_alerts[0].state,'pending');
 assert.ok(!JSON.stringify(r.body).includes('responseBody'));
});
test('email diagnostics redact secrets and bound provider body',async()=>{
 const h=await harness({env:{RESEND_API_KEY:'secret-for-test'},mailReject:true,mailBody:'secret-for-test Bearer token-value re_exampleKey '+ 'x'.repeat(9000)});
 await h.call('message',{body:visitor()});const raw=h.calls.rpc.find(x=>x.name==='chat_finish_alert').args.p_error;
 assert.ok(!raw.includes('secret-for-test'));assert.ok(!raw.includes('token-value'));assert.ok(!raw.includes('re_exampleKey'));
 assert.equal(JSON.parse(raw).responseBody.length,8192);
});
test('provider acceptance is distinct from delivery',async()=>{
 const h=await harness();const r=await h.call('message',{body:visitor()});assert.equal(r.body.alerts.accepted,1);assert.equal(r.body.alerts.failed,0);assert.equal(r.body.alerts.pending,false);assert.equal(r.body.alerts.delivered,undefined);
});
