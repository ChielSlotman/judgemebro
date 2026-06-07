-- Ranked matchmaking prototype tables.
-- These tables support anonymous/prototype matchmaking without exposing answers before a room is judged.

create table public.ranked_matchmaking_tickets (
  id uuid primary key default gen_random_uuid(),
  category_id text not null,
  player_presence_id text not null,
  player_name text not null default 'Player',
  status text not null default 'waiting' check (status in ('waiting', 'matched', 'cancelled', 'expired')),
  battle_room_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 seconds'
);

create table public.ranked_battle_rooms (
  id uuid primary key default gen_random_uuid(),
  category_id text not null,
  prompt text not null,
  host_ticket_id uuid references public.ranked_matchmaking_tickets(id) on delete set null,
  guest_ticket_id uuid references public.ranked_matchmaking_tickets(id) on delete set null,
  host_presence_id text not null,
  guest_presence_id text not null,
  host_name text not null default 'Player 1',
  guest_name text not null default 'Player 2',
  host_submitted boolean not null default false,
  guest_submitted boolean not null default false,
  status text not null default 'active' check (status in ('active', 'judging', 'judged', 'cancelled')),
  ai_winner_presence_id text,
  ai_reason text,
  point_delta integer not null default 18,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ranked_matchmaking_tickets
  add constraint ranked_matchmaking_tickets_battle_room_fk
  foreign key (battle_room_id) references public.ranked_battle_rooms(id) on delete set null;

create table public.ranked_battle_answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.ranked_battle_rooms(id) on delete cascade,
  player_presence_id text not null,
  answer text not null check (char_length(answer) <= 280),
  submitted_at timestamptz not null default now(),
  unique (room_id, player_presence_id)
);

create index ranked_matchmaking_waiting_idx
  on public.ranked_matchmaking_tickets (category_id, status, created_at)
  where status = 'waiting';

create index ranked_matchmaking_presence_idx
  on public.ranked_matchmaking_tickets (player_presence_id, created_at desc);

create index ranked_battle_rooms_presence_idx
  on public.ranked_battle_rooms (host_presence_id, guest_presence_id, created_at desc);

create index ranked_battle_answers_room_idx
  on public.ranked_battle_answers (room_id, submitted_at);

alter table public.ranked_matchmaking_tickets enable row level security;
alter table public.ranked_battle_rooms enable row level security;
alter table public.ranked_battle_answers enable row level security;

create policy "Prototype players can create matchmaking tickets"
  on public.ranked_matchmaking_tickets for insert
  to anon, authenticated
  with check (
    status = 'waiting'
    and battle_room_id is null
    and char_length(player_presence_id) between 8 and 80
    and char_length(player_name) between 1 and 40
  );

create policy "Prototype players can read active matchmaking tickets"
  on public.ranked_matchmaking_tickets for select
  to anon, authenticated
  using (status in ('waiting', 'matched') and expires_at > now());

create policy "Prototype players can update matchmaking tickets"
  on public.ranked_matchmaking_tickets for update
  to anon, authenticated
  using (status in ('waiting', 'matched') and expires_at > now())
  with check (status in ('matched', 'cancelled', 'expired'));

create policy "Prototype players can create ranked battle rooms"
  on public.ranked_battle_rooms for insert
  to anon, authenticated
  with check (
    status = 'active'
    and char_length(prompt) between 10 and 500
    and host_presence_id <> guest_presence_id
  );

create policy "Room participants can read ranked battle rooms"
  on public.ranked_battle_rooms for select
  to anon, authenticated
  using (status in ('active', 'judging', 'judged', 'cancelled'));

create policy "Prototype players can update ranked battle room state"
  on public.ranked_battle_rooms for update
  to anon, authenticated
  using (status in ('active', 'judging', 'judged'))
  with check (status in ('active', 'judging', 'judged', 'cancelled'));

create policy "Prototype players can submit ranked answers"
  on public.ranked_battle_answers for insert
  to anon, authenticated
  with check (
    char_length(answer) <= 280
    and exists (
      select 1
      from public.ranked_battle_rooms room
      where room.id = ranked_battle_answers.room_id
        and room.status in ('active', 'judging')
        and ranked_battle_answers.player_presence_id in (room.host_presence_id, room.guest_presence_id)
    )
  );

create policy "Ranked answers reveal only after judgment"
  on public.ranked_battle_answers for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.ranked_battle_rooms room
      where room.id = ranked_battle_answers.room_id
        and room.status = 'judged'
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    execute 'create publication supabase_realtime';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ranked_matchmaking_tickets'
  ) then
    execute 'alter publication supabase_realtime add table public.ranked_matchmaking_tickets';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ranked_battle_rooms'
  ) then
    execute 'alter publication supabase_realtime add table public.ranked_battle_rooms';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ranked_battle_answers'
  ) then
    execute 'alter publication supabase_realtime add table public.ranked_battle_answers';
  end if;
end
$$;
