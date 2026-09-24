-- Local candidate only. Apply with the matching chat handlers after approval.
-- Additive: legacy sessions/messages remain untouched. A widget opening is not a conversation.
begin;
set local lock_timeout = '5s';
alter table public.chat_sessions
  add column if not exists access_token_hash text,
  add column if not exists identity_source text,
  add column if not exists first_visitor_message_at timestamptz,
  add column if not exists handoff_requested_at timestamptz,
  add column if not exists handoff_state text not null default 'bot';
create unique index if not exists chat_sessions_access_token_uq on public.chat_sessions(access_token_hash) where access_token_hash is not null;
alter table public.chat_messages
  add column if not exists request_id uuid,
  add column if not exists reply_to uuid references public.chat_messages(id);
create unique index if not exists chat_messages_request_uq on public.chat_messages(chat_session_id,request_id) where request_id is not null;
create unique index if not exists chat_messages_assistant_reply_uq on public.chat_messages(reply_to) where sender='assistant' and reply_to is not null;
create index if not exists chat_messages_session_time_idx on public.chat_messages(chat_session_id,created_at,id);
create table if not exists public.chat_alerts (
  id uuid primary key default gen_random_uuid(),
  chat_session_id uuid not null references public.chat_sessions(id),
  kind text not null check (kind in ('first_message','human_handoff')),
  payload jsonb not null,
  state text not null default 'pending' check (state in ('pending','sending','sent','needs_review')),
  created_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  locked_until timestamptz,
  lease_id uuid,
  attempts integer not null default 0,
  sent_at timestamptz,
  provider_id text,
  last_error text,
  unique(chat_session_id,kind)
);
create index if not exists chat_alerts_pending_idx on public.chat_alerts(created_at) where state in ('pending','sending');
-- All browser access now goes through ownership-checked server endpoints.
-- Existing PUBLIC policies cannot bypass revoked table privileges.
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_alerts enable row level security;
revoke all on public.chat_sessions,public.chat_messages,public.chat_alerts from public,anon,authenticated;
grant select,insert,update on public.chat_sessions,public.chat_messages,public.chat_alerts to service_role;

create or replace function public.chat_record_message(
 p_chat_id uuid,p_request_id uuid,p_sender text,p_message text,
 p_handoff boolean default false,p_reply_to uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.chat_sessions%rowtype; m public.chat_messages%rowtype; latest_id uuid; started boolean := false; escalated boolean := false;
begin
 if p_request_id is null or p_sender not in ('visitor','admin','assistant') or p_sender is null
    or p_message is null or length(btrim(p_message)) not between 1 and 4000 then
   raise exception 'Invalid message' using errcode='22023';
 end if;
 select * into s from public.chat_sessions where id=p_chat_id for update;
 if not found then raise exception 'Chat not found' using errcode='22023'; end if;
 select * into m from public.chat_messages where chat_session_id=p_chat_id and request_id=p_request_id;
 if found then
   if m.sender<>p_sender or m.message<>p_message then raise exception 'Idempotency conflict' using errcode='22023'; end if;
   return jsonb_build_object('message',to_jsonb(m),'handoff_state',s.handoff_state,'duplicate',true);
 end if;
 if p_sender='assistant' then
   if s.handoff_state<>'bot' then return jsonb_build_object('suppressed',true,'handoff_state',s.handoff_state); end if;
   select id into latest_id from public.chat_messages where chat_session_id=p_chat_id and sender='visitor' order by created_at desc,id desc limit 1;
   if p_reply_to is null or latest_id is distinct from p_reply_to then
     return jsonb_build_object('suppressed',true,'handoff_state',s.handoff_state);
   end if;
   select * into m from public.chat_messages where reply_to=p_reply_to and sender='assistant';
   if found then return jsonb_build_object('message',to_jsonb(m),'duplicate',true,'handoff_state',s.handoff_state); end if;
 end if;
 insert into public.chat_messages(chat_session_id,request_id,sender,message,is_read,reply_to,created_at)
 values(p_chat_id,p_request_id,p_sender,p_message,p_sender<>'visitor',case when p_sender='assistant' then p_reply_to end,clock_timestamp()) returning * into m;
 if p_sender='visitor' then
   if s.first_visitor_message_at is null then
     started := true;
     update public.chat_sessions set first_visitor_message_at=now() where id=p_chat_id;
     insert into public.chat_alerts(chat_session_id,kind,payload) values(p_chat_id,'first_message',
       jsonb_build_object('message',p_message,'visitor_id',s.visitor_id,'session_id',s.session_id,'page_path',s.page_path)) on conflict do nothing;
   end if;
   if p_handoff then
     escalated := s.handoff_requested_at is null;
     update public.chat_sessions set handoff_requested_at=coalesce(handoff_requested_at,now()),
       handoff_state=case when handoff_state='human_active' then 'human_active' else 'requested' end where id=p_chat_id;
     insert into public.chat_alerts(chat_session_id,kind,payload) values(p_chat_id,'human_handoff',
       jsonb_build_object('message',p_message,'visitor_id',s.visitor_id,'session_id',s.session_id,'page_path',s.page_path)) on conflict do nothing;
   end if;
 elsif p_sender='admin' then
   update public.chat_sessions set handoff_state='human_active' where id=p_chat_id;
   update public.chat_messages set is_read=true where chat_session_id=p_chat_id and sender='visitor' and not is_read;
 end if;
 update public.chat_sessions set updated_at=now() where id=p_chat_id returning * into s;
 return jsonb_build_object('message',to_jsonb(m),'handoff_state',s.handoff_state,'duplicate',false,'conversation_started',started,'handoff_requested',escalated);
end $$;

create or replace function public.chat_set_handoff(p_chat_id uuid,p_state text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_state is null or p_state not in ('human_active','bot') then raise exception 'Invalid handoff state'; end if;
 perform 1 from public.chat_sessions where id=p_chat_id for update;
 if not found then raise exception 'Chat not found'; end if;
 update public.chat_sessions set handoff_state=p_state,updated_at=now() where id=p_chat_id;
 if p_state='human_active' then
   update public.chat_messages set is_read=true where chat_session_id=p_chat_id and sender='visitor' and not is_read;
 end if;
end $$;

-- Lease + provider idempotency protect concurrent sends and retries after timeouts.
-- Never automatically resend outside Resend's 24h idempotency window.
create or replace function public.chat_claim_alert(p_id uuid,p_lease uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.chat_alerts%rowtype;
begin
 select * into a from public.chat_alerts where id=p_id for update;
 if not found or a.state in ('sent','needs_review') or a.locked_until>now() then return null; end if;
 if a.first_attempt_at < now()-interval '23 hours' then
   update public.chat_alerts set state='needs_review',last_error='idempotency_window_elapsed' where id=p_id;
   return null;
 end if;
 update public.chat_alerts set state='sending',lease_id=p_lease,locked_until=now()+interval '1 minute',
   first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 where id=p_id returning * into a;
 return to_jsonb(a);
end $$;
create or replace function public.chat_finish_alert(p_id uuid,p_lease uuid,p_provider_id text,p_error text)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.chat_alerts set state=case when p_provider_id is not null then 'sent' else 'pending' end,
 sent_at=case when p_provider_id is not null then now() end,provider_id=p_provider_id,last_error=p_error,locked_until=null
 where id=p_id and lease_id=p_lease and state='sending';
end $$;
revoke all on function public.chat_record_message(uuid,uuid,text,text,boolean,uuid),public.chat_set_handoff(uuid,text),public.chat_claim_alert(uuid,uuid),public.chat_finish_alert(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.chat_record_message(uuid,uuid,text,text,boolean,uuid),public.chat_set_handoff(uuid,text),public.chat_claim_alert(uuid,uuid),public.chat_finish_alert(uuid,uuid,text,text) to service_role;
commit;
