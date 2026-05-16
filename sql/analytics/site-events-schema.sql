-- =========================================
-- Casas da Vila — Site Analytics
-- =========================================

create table if not exists public.site_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  event_type text not null default 'page_view',

  page_url text,
  page_path text,
  page_title text,
  referrer text,

  language text,
  locale text,
  timezone text,

  user_agent text,
  screen_width integer,
  screen_height integer,

  visitor_id text,
  session_id text,

  is_bot_suspected boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

alter table public.site_events enable row level security;

drop policy if exists "Allow public site event inserts" on public.site_events;

create policy "Allow public site event inserts"
on public.site_events
for insert
to anon
with check (true);

create index if not exists site_events_created_at_idx
on public.site_events (created_at desc);

create index if not exists site_events_event_type_idx
on public.site_events (event_type);

create index if not exists site_events_page_path_idx
on public.site_events (page_path);

create index if not exists site_events_session_id_idx
on public.site_events (session_id);

create index if not exists site_events_visitor_id_idx
on public.site_events (visitor_id);

create index if not exists site_events_is_bot_idx
on public.site_events (is_bot_suspected);