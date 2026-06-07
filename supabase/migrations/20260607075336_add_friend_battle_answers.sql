-- Friend battle prototype persistence.
-- Extends private room links so anonymous prototype players can join, answer, and reveal only after judging.

alter table public.friend_battle_rooms
  add column if not exists prompt text,
  add column if not exists host_presence_id text,
  add column if not exists guest_presence_id text,
  add column if not exists host_name text not null default 'Host',
  add column if not exists guest_name text,
  add column if not exists host_submitted boolean not null default false,
  add column if not exists guest_submitted boolean not null default false,
  add column if not exists ai_winner_presence_id text,
  add column if not exists ai_reason text,
  add column if not exists point_delta integer not null default 18;

create table public.friend_battle_answers (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references public.friend_battle_rooms(room_code) on delete cascade,
  player_presence_id text not null,
  player_name text not null default 'Player',
  answer text not null check (char_length(answer) <= 280),
  submitted_at timestamptz not null default now(),
  unique (room_code, player_presence_id)
);

create index friend_battle_rooms_presence_idx
  on public.friend_battle_rooms (host_presence_id, guest_presence_id, created_at desc);

create index friend_battle_answers_room_idx
  on public.friend_battle_answers (room_code, submitted_at);

alter table public.friend_battle_answers enable row level security;

create policy "Prototype users can create friend rooms by link"
  on public.friend_battle_rooms for insert
  to anon, authenticated
  with check (
    status = 'waiting'
    and host_presence_id is not null
    and guest_presence_id is null
    and char_length(room_code) between 4 and 16
    and char_length(host_presence_id) between 8 and 80
    and (prompt is null or char_length(prompt) between 10 and 500)
  );

create policy "Prototype users can read active friend rooms by code"
  on public.friend_battle_rooms for select
  to anon, authenticated
  using (status in ('waiting', 'active', 'judged') and expires_at > now());

create policy "Prototype users can update friend room state"
  on public.friend_battle_rooms for update
  to anon, authenticated
  using (status in ('waiting', 'active') and expires_at > now())
  with check (
    status in ('waiting', 'active', 'judged', 'cancelled')
    and (
      guest_presence_id is null
      or char_length(guest_presence_id) between 8 and 80
    )
  );

create policy "Friend players can submit answers"
  on public.friend_battle_answers for insert
  to anon, authenticated
  with check (
    char_length(answer) <= 280
    and exists (
      select 1
      from public.friend_battle_rooms room
      where room.room_code = friend_battle_answers.room_code
        and room.status in ('active', 'waiting')
        and friend_battle_answers.player_presence_id in (room.host_presence_id, room.guest_presence_id)
    )
  );

create policy "Friend answers reveal only after judgment"
  on public.friend_battle_answers for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.friend_battle_rooms room
      where room.room_code = friend_battle_answers.room_code
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
      and tablename = 'friend_battle_answers'
  ) then
    execute 'alter publication supabase_realtime add table public.friend_battle_answers';
  end if;
end
$$;
