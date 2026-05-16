-- =========================================
-- Últimos acessos
-- =========================================

select
  created_at at time zone 'America/Sao_Paulo' as created_at_br,
  event_type,
  page_path,
  page_title,
  referrer,
  language,
  timezone,
  is_bot_suspected
from site_events
order by created_at desc
limit 100;


-- =========================================
-- Páginas mais visitadas
-- =========================================

select
  page_path,
  count(*) as views
from site_events
where event_type = 'page_view'
  and is_bot_suspected = false
group by page_path
order by views desc;


-- =========================================
-- Origem dos acessos
-- =========================================

select
  coalesce(nullif(referrer, ''), 'direct / unknown') as referrer,
  count(*) as visits
from site_events
where is_bot_suspected = false
group by referrer
order by visits desc;


-- =========================================
-- Sessões reais
-- =========================================

select
  session_id,
  count(*) as pages_viewed,
  min(created_at at time zone 'America/Sao_Paulo') as first_seen_br,
  max(created_at at time zone 'America/Sao_Paulo') as last_seen_br
from site_events
where is_bot_suspected = false
group by session_id
order by last_seen_br desc;


-- =========================================
-- Tráfego suspeito bloqueado ou marcado
-- =========================================

select
  user_agent,
  timezone,
  count(*) as total
from site_events
where is_bot_suspected = true
group by user_agent, timezone
order by total desc;