// Runs only in a fresh, network-isolated local PostgreSQL 17 container.
import { spawnSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const name = `cdv-live-chat-sql-${process.pid}`;
let passed = 0;
function docker(args, input) {
  const r = spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 5e6 });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || r.error);
  return r.stdout + r.stderr;
}
const args = ['exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','cdv_live_chat_test'];
function sql(query) { return docker(args, query); }
function concurrent(query) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args);
    let out=''; let err='';
    child.stdout.on('data', x => out+=x); child.stderr.on('data', x => err+=x);
    child.on('error',reject); child.on('exit',code=>code===0?resolve(out):reject(new Error(err)));
    child.stdin.end(query);
  });
}
try {
  docker(['run','--name',name,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB=cdv_live_chat_test','-d','postgres:17']);
  let ready = false;
  for (let i=0;i<120;i++) {
    const r=spawnSync('docker',['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']);
    if(r.status===0) { ready = true; break; }
    await new Promise(r=>setTimeout(r,250));
  }
  assert.ok(ready, 'Final PostgreSQL server must accept TCP connections after bootstrap');
  console.log(sql('show server_version;'));
  sql(readFileSync(new URL('./sql/live-chat-fixture.sql', import.meta.url),'utf8'));
  const migration=readFileSync(new URL('../sql/006_live_chat_integrity.sql',import.meta.url),'utf8');
  sql(migration); sql(migration);
  const out=sql(readFileSync(new URL('./sql/live-chat-integrity.sql',import.meta.url),'utf8'));
  passed=(out.match(/PASS:/g)||[]).length;
  console.log(out.split('\n').filter(x=>x.includes('PASS:')).join('\n'));
  const id='60000000-0000-4000-8000-000000000001';
  sql(`insert into public.chat_sessions(id,visitor_id,session_id) values('${id}','concurrent','session');`);
  await Promise.all([1,2].map(n=>concurrent(`begin; select public.chat_record_message('${id}','70000000-0000-4000-8000-00000000000${n}','visitor','Message ${n}',true); select pg_sleep(0.2); commit;`)));
  assert.equal(sql(`select count(*) from public.chat_messages where chat_session_id='${id}';`).trim(),'2'); passed++;
  assert.equal(sql(`select count(*) from public.chat_alerts where chat_session_id='${id}';`).trim(),'2'); passed++;
  await Promise.all([1,2].map(()=>concurrent(`select public.chat_record_message('${id}','70000000-0000-4000-8000-000000000003','visitor','Same request',true);`)));
  assert.equal(sql(`select count(*) from public.chat_messages where chat_session_id='${id}';`).trim(),'3'); passed++;
  const leases=await Promise.all([1,2].map(()=>concurrent(`select public.chat_claim_alert(id,gen_random_uuid()) from public.chat_alerts where chat_session_id='${id}' and kind='first_message';`)));
  assert.equal(leases.filter(x=>x.trim()).length,1); passed++;
  console.log('PASS: concurrent first messages / handoffs / duplicate requests / alert claims (4 assertions)');
  const rollback = readFileSync(new URL('../sql/006_live_chat_integrity_rollback.sql',import.meta.url),'utf8');
  // The preceding concurrent lease test left one active send. Refuse rollback.
  assert.throws(()=>sql(rollback), /ABORT rollback: active email lease/); passed++;
  assert.equal(sql("select has_function_privilege('service_role','public.chat_record_message(uuid,uuid,text,text,boolean,uuid)','EXECUTE');").trim(),'t'); passed++;
  sql("update public.chat_alerts set locked_until=now()-interval '1 minute';");
  const snapshot=()=>sql("select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,'')) from public.chat_messages t; select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,'')) from public.chat_sessions t; select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,'')) from public.chat_alerts t;");
  const before=snapshot(); sql(rollback); sql(rollback);
  assert.equal(snapshot(),before); passed++;
  for(const role of ['anon','authenticated','service_role']) {
    assert.equal(sql(`select has_function_privilege('${role}','public.chat_record_message(uuid,uuid,text,text,boolean,uuid)','EXECUTE');`).trim(),'f'); passed++;
    assert.equal(sql(`select has_table_privilege('${role}','public.chat_messages','INSERT,UPDATE,DELETE,TRUNCATE');`).trim(),'f'); passed++;
  }
  assert.equal(sql("select has_table_privilege('service_role','public.chat_messages','SELECT');").trim(),'t'); passed++;
  sql(migration);
  assert.equal(snapshot(),before); passed++;
  assert.equal(sql("select has_function_privilege('service_role','public.chat_record_message(uuid,uuid,text,text,boolean,uuid)','EXECUTE');").trim(),'t'); passed++;
  await concurrent(`select public.chat_record_message('${id}','70000000-0000-4000-8000-000000000003','visitor','Same request',true);`);
  assert.equal(snapshot(),before); passed++;
  console.log('PASS: rollback guard, grants, preservation, repeatability and safe reactivation');
  console.log(`SQL: ${passed} PASS, 0 FAIL; migration/rollback reapplied; network=none`);
} finally { docker(['rm','-f',name]); }
