drop policy if exists "Prototype users can read active friend rooms by code" on public.friend_battle_rooms;
drop policy if exists "Prototype users can update friend room state" on public.friend_battle_rooms;
drop policy if exists "Friend answers reveal only after judgment" on public.friend_battle_answers;
drop policy if exists "Ranked answers reveal only after judgment" on public.ranked_battle_answers;

alter table public.friend_battle_rooms
  drop constraint if exists friend_battle_rooms_status_check;

alter table public.friend_battle_rooms
  add constraint friend_battle_rooms_status_check
  check (status in ('waiting', 'active', 'judging', 'judged', 'cancelled'));

create policy "Prototype users can read active friend rooms by code"
  on public.friend_battle_rooms for select
  to anon, authenticated
  using (status in ('waiting', 'active', 'judging', 'judged') and expires_at > now());

create policy "Prototype users can update friend room state"
  on public.friend_battle_rooms for update
  to anon, authenticated
  using (status in ('waiting', 'active', 'judging') and expires_at > now())
  with check (
    status in ('waiting', 'active', 'judging', 'judged', 'cancelled')
    and (
      guest_presence_id is null
      or char_length(guest_presence_id) between 8 and 80
    )
  );

create policy "Friend answers reveal when ready for AI judgment"
  on public.friend_battle_answers for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.friend_battle_rooms room
      where room.room_code = friend_battle_answers.room_code
        and room.status in ('active', 'judging', 'judged')
        and room.host_submitted = true
        and room.guest_submitted = true
    )
  );

create policy "Ranked answers reveal when ready for AI judgment"
  on public.ranked_battle_answers for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.ranked_battle_rooms room
      where room.id = ranked_battle_answers.room_id
        and room.status in ('judging', 'judged')
        and room.host_submitted = true
        and room.guest_submitted = true
    )
  );
