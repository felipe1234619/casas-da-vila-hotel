-- Minimal production-compatible chat schema; synthetic data only.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create table public.chat_sessions (
 id uuid primary key default gen_random_uuid(),visitor_id text,session_id text,page_path text,page_url text,
 country text,city text,status text default 'open',created_at timestamptz default now(),updated_at timestamptz default now()
);
create table public.chat_messages (
 id uuid primary key default gen_random_uuid(),chat_session_id uuid references public.chat_sessions(id) on delete cascade,
 sender text not null,message text not null,is_read boolean default false,created_at timestamptz default now()
);
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
grant all on public.chat_sessions,public.chat_messages to anon,authenticated,service_role;
create policy "Public can create chat messages" on public.chat_messages for insert with check(true);
create policy "Public can read chat messages" on public.chat_messages for select using(true);
create policy "Public can create chat sessions" on public.chat_sessions for insert with check(true);
create policy "Public can read own chat sessions" on public.chat_sessions for select using(true);
create policy "Public can update chat sessions" on public.chat_sessions for update using(true);
insert into public.chat_sessions(id,visitor_id,session_id) values('10000000-0000-4000-8000-000000000001','legacy-visitor','legacy-session');
insert into public.chat_messages(chat_session_id,sender,message) values('10000000-0000-4000-8000-000000000001','admin','Legacy greeting');
