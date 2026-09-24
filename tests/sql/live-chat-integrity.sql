\set ON_ERROR_STOP on
begin;
create function pg_temp.assert(ok boolean,label text) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL: %',label; end if;
 raise notice 'PASS: %',label;
end $$;
select pg_temp.assert((select count(*)=1 from public.chat_sessions),'legacy session preserved');
select pg_temp.assert((select message='Legacy greeting' from public.chat_messages),'legacy message preserved');
select pg_temp.assert((select count(*)=0 from public.chat_alerts),'no historical alert backfill');
select pg_temp.assert((select first_visitor_message_at is null from public.chat_sessions),'opening is not real conversation');
do $$ declare r text; f regprocedure; t text; begin
 foreach r in array array['anon','authenticated'] loop
  foreach t in array array['chat_sessions','chat_messages','chat_alerts'] loop
   perform pg_temp.assert(not has_table_privilege(r,'public.'||t,'SELECT,INSERT,UPDATE,DELETE'),r||' cannot access '||t);
  end loop;
  for f in select oid::regprocedure from pg_proc where proname in ('chat_record_message','chat_set_handoff','chat_claim_alert','chat_finish_alert') loop
   perform pg_temp.assert(not has_function_privilege(r,f,'EXECUTE'),r||' cannot execute '||f);
  end loop;
 end loop;
 for f in select oid::regprocedure from pg_proc where proname in ('chat_record_message','chat_set_handoff','chat_claim_alert','chat_finish_alert') loop
  perform pg_temp.assert(has_function_privilege('service_role',f,'EXECUTE'),'service_role executes '||f);
 end loop;
end $$;
select pg_temp.assert((select count(*)=4 from pg_proc where proname in ('chat_record_message','chat_set_handoff','chat_claim_alert','chat_finish_alert') and prosecdef and proconfig @> array['search_path=""']),'definer and safe search_path');
select pg_temp.assert((select count(*)=3 from pg_class where oid in ('public.chat_sessions'::regclass,'public.chat_messages'::regclass,'public.chat_alerts'::regclass) and relrowsecurity),'RLS enabled');
insert into public.chat_sessions(id,visitor_id,session_id,access_token_hash) values('20000000-0000-4000-8000-000000000001','visitor','session',repeat('a',64));
set local role service_role;
select pg_temp.assert(public.chat_record_message('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','visitor','Olá')->>'conversation_started'='true','first message returns conversation event flag');
reset role;
select pg_temp.assert((select count(*)=1 from public.chat_alerts),'first human creates one alert');
select pg_temp.assert((select first_visitor_message_at is not null from public.chat_sessions where visitor_id='visitor'),'first message marks real conversation');
select pg_temp.assert((select payload->>'visitor_id'='visitor' and payload->>'session_id'='session' from public.chat_alerts),'linked identity in alert');
select public.chat_record_message('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','visitor','Olá');
select pg_temp.assert((select count(*)=1 from public.chat_messages where sender='visitor'),'duplicate request does not repeat message');
select pg_temp.assert((select count(*)=1 from public.chat_alerts),'duplicate request does not repeat alert');
do $$ begin
 begin perform public.chat_record_message('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','visitor','Changed'); raise exception 'Accepted invalid duplicate'; exception when invalid_parameter_value then null; end;
 perform pg_temp.assert(true,'changed duplicate rejected');
end $$;
select public.chat_record_message('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','assistant','Hello',false,(select id from public.chat_messages where sender='visitor'));
select pg_temp.assert((select count(*)=1 from public.chat_alerts),'assistant never triggers first-human alert');
select public.chat_record_message('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','assistant','Another completion',false,(select id from public.chat_messages where sender='visitor'));
select pg_temp.assert((select count(*)=1 from public.chat_messages where sender='assistant'),'one AI reply per visitor message');
select public.chat_record_message('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','visitor','Quero falar com gerente',true);
select pg_temp.assert((select count(*)=2 from public.chat_alerts),'explicit handoff creates second alert');
select pg_temp.assert((select handoff_state='requested' from public.chat_sessions where visitor_id='visitor'),'handoff pauses bot');
select pg_temp.assert(public.chat_record_message('20000000-0000-4000-8000-000000000001',gen_random_uuid(),'assistant','Late reply')->>'suppressed'='true','in-flight bot suppressed after handoff');
select public.chat_record_message('20000000-0000-4000-8000-000000000001',gen_random_uuid(),'visitor','Gerente por favor',true);
select pg_temp.assert((select count(*)=2 from public.chat_alerts),'repeated handoff does not spam alerts');
select public.chat_set_handoff('20000000-0000-4000-8000-000000000001','human_active');
select pg_temp.assert((select bool_and(is_read) from public.chat_messages where sender='visitor'),'claim marks read');
select public.chat_record_message('20000000-0000-4000-8000-000000000001',gen_random_uuid(),'admin','Equipe presente');
select pg_temp.assert((select count(*)=2 from public.chat_alerts),'operator never generates visitor alert');
select public.chat_set_handoff('20000000-0000-4000-8000-000000000001','bot');
select pg_temp.assert((select handoff_state='bot' from public.chat_sessions where visitor_id='visitor'),'explicit release resumes bot');
select pg_temp.assert(public.chat_record_message('20000000-0000-4000-8000-000000000001',gen_random_uuid(),'assistant','Stale',false,'00000000-0000-0000-0000-000000000000')->>'suppressed'='true','stale completion suppressed');

-- Failure at outbox insert rolls back message and conversation marker together.
create function pg_temp.fail_alert() returns trigger language plpgsql as $$ begin raise exception 'forced_alert_failure'; end $$;
create trigger fail_alert before insert on public.chat_alerts for each row execute function pg_temp.fail_alert();
insert into public.chat_sessions(id) values('20000000-0000-4000-8000-000000000002');
do $$ begin
 begin perform public.chat_record_message('20000000-0000-4000-8000-000000000002',gen_random_uuid(),'visitor','Rollback me');
 exception when others then if sqlerrm<>'forced_alert_failure' then raise; end if; end;
 perform pg_temp.assert(not exists(select 1 from public.chat_messages where chat_session_id='20000000-0000-4000-8000-000000000002'),'message rolled back on queue failure');
 perform pg_temp.assert((select first_visitor_message_at is null from public.chat_sessions where id='20000000-0000-4000-8000-000000000002'),'conversation marker rolled back');
end $$;
drop trigger fail_alert on public.chat_alerts;

select public.chat_claim_alert(id,'50000000-0000-4000-8000-000000000001') from public.chat_alerts where kind='first_message';
select pg_temp.assert((select public.chat_claim_alert(id,gen_random_uuid()) is null from public.chat_alerts where kind='first_message'),'lease prevents concurrent email send');
select public.chat_finish_alert(id,'50000000-0000-4000-8000-000000000099','wrong-worker',null) from public.chat_alerts where kind='first_message';
select pg_temp.assert((select state='sending' from public.chat_alerts where kind='first_message'),'foreign lease cannot acknowledge');
select public.chat_finish_alert(id,'50000000-0000-4000-8000-000000000001',null,'network') from public.chat_alerts where kind='first_message';
select pg_temp.assert((select state='pending' from public.chat_alerts where kind='first_message'),'failure remains retryable');
select public.chat_claim_alert(id,'50000000-0000-4000-8000-000000000002') from public.chat_alerts where kind='first_message';
select public.chat_finish_alert(id,'50000000-0000-4000-8000-000000000002','mock-resend-id',null) from public.chat_alerts where kind='first_message';
select pg_temp.assert((select state='sent' and sent_at is not null from public.chat_alerts where kind='first_message'),'successful acknowledgement persisted');
select pg_temp.assert((select public.chat_claim_alert(id,gen_random_uuid()) is null from public.chat_alerts where kind='first_message'),'sent alert cannot be reclaimed');
update public.chat_alerts set first_attempt_at=now()-interval '24 hours' where kind='human_handoff';
select pg_temp.assert((select public.chat_claim_alert(id,gen_random_uuid()) is null from public.chat_alerts where kind='human_handoff'),'ambiguous old attempt not resent');
select pg_temp.assert((select state='needs_review' from public.chat_alerts where kind='human_handoff'),'expired provider dedupe window requires review');
rollback;
