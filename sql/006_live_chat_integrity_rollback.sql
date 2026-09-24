-- SAFE OPERATIONAL ROLLBACK, not a destructive schema downgrade.
-- First suspend chat routes and drain requests. Never restore legacy public
-- handlers/policies. Preserve messages, alert history, credentials and indexes.
-- Booking and analytics grants/functions are not touched.
begin;
set local lock_timeout = '5s';
lock table public.chat_sessions, public.chat_messages, public.chat_alerts in access exclusive mode;
do $$ begin
  if exists(select 1 from public.chat_alerts where state='sending' and locked_until>clock_timestamp()) then
    raise exception 'ABORT rollback: active email lease; wait for in-flight sends and reconcile before retry';
  end if;
end $$;
-- Retain read access for reconciliation. Prevent both RPC and direct writes.
revoke all on function public.chat_record_message(uuid,uuid,text,text,boolean,uuid),
 public.chat_set_handoff(uuid,text),public.chat_claim_alert(uuid,uuid),
 public.chat_finish_alert(uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on public.chat_sessions,public.chat_messages,public.chat_alerts from public,anon,authenticated;
revoke insert,update,delete,truncate on public.chat_sessions,public.chat_messages,public.chat_alerts from service_role;
-- Reapplying 006 after a corrected candidate is approved re-enables only the
-- intended server path. Pending/uncertain emails retain their idempotency keys.
commit;
