-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Each wine / history entry is one row holding the app's object as jsonb.

create table if not exists public.wines (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.history (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Only signed-in users can reach the tables, and only their own rows.
alter table public.wines enable row level security;
alter table public.history enable row level security;

create policy "Own wines" on public.wines
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Own history" on public.history
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- New tables are not exposed to the Data API automatically in this project.
grant select, insert, update, delete on public.wines, public.history to authenticated;
