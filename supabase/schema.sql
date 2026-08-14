-- Run this in the Supabase SQL Editor (SQL Editor -> New query) once per project.
-- No auth is used: any client with the anon key can read/write these tables.
-- Fine for personal use; do not reuse this schema/policy setup for a public app.
-- Schema changes after the initial setup live in supabase/migrations/ — run those too.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  item_id text not null,
  status text not null check (status in ('learning', 'mastered')),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id)
);

alter table users enable row level security;
alter table progress enable row level security;

create policy "anon full access to users" on users
  for all
  to anon
  using (true)
  with check (true);

create policy "anon full access to progress" on progress
  for all
  to anon
  using (true)
  with check (true);
