-- Run this in the Supabase SQL Editor after schema.sql has already been applied.
-- Adds conversation/transcript storage and turns `progress.status` into a 1-10 score
-- so repeated correct use can move an item further than a single use without
-- changing the three-bucket (gray/yellow/green) UI.

-- progress: status text ('learning'|'mastered') -> score int (1-10)
-- 1-6 = learning (yellow), 7-10 = mastered (green); no row = untouched (gray).
alter table progress drop constraint if exists progress_status_check;
alter table progress rename column status to score;
alter table progress alter column score type int using (case score when 'mastered' then 8 else 3 end);
alter table progress alter column score set default 3;
alter table progress add constraint progress_score_check check (score between 1 and 10);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists transcript_turns (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  turn_index int not null,
  role text not null check (role in ('user', 'model')),
  text text not null,
  created_at timestamptz not null default now(),
  unique (conversation_id, turn_index)
);

-- Audit trail of what caused a progress score to move, so scoring logic can
-- be improved later and replayed without re-deriving from raw transcripts.
create table if not exists progress_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  item_id text not null,
  conversation_id uuid references conversations(id) on delete set null,
  delta int not null,
  evidence text,
  created_at timestamptz not null default now()
);

alter table conversations enable row level security;
alter table transcript_turns enable row level security;
alter table progress_events enable row level security;

create policy "anon full access to conversations" on conversations
  for all
  to anon
  using (true)
  with check (true);

create policy "anon full access to transcript_turns" on transcript_turns
  for all
  to anon
  using (true)
  with check (true);

create policy "anon full access to progress_events" on progress_events
  for all
  to anon
  using (true)
  with check (true);
