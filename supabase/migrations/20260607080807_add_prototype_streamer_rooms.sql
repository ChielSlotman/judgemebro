-- Prototype streamer room persistence.
-- Allows no-auth streamers to create live rooms while preserving authenticated ownership policies.

alter table public.streamer_rooms
  alter column host_user_id drop not null,
  add column if not exists host_presence_id text,
  add column if not exists selected_answer_id uuid references public.streamer_viewer_answers(id) on delete set null;

create index streamer_rooms_presence_idx
  on public.streamer_rooms (host_presence_id, created_at desc);

create policy "Prototype streamers can create live rooms"
  on public.streamer_rooms for insert
  to anon, authenticated
  with check (
    host_presence_id is not null
    and host_user_id is null
    and is_live = true
    and char_length(room_code) between 4 and 16
    and char_length(room_name) between 1 and 80
    and char_length(host_presence_id) between 8 and 80
  );

create policy "Prototype streamers can update their live rooms"
  on public.streamer_rooms for update
  to anon, authenticated
  using (host_presence_id is not null and is_live = true)
  with check (host_presence_id is not null);

create policy "Prototype streamers can read answers for their rooms"
  on public.streamer_viewer_answers for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.streamer_rooms room
      where room.room_code = streamer_viewer_answers.room_code
        and room.host_presence_id is not null
        and room.is_live = true
    )
  );

create policy "Prototype streamers can moderate answers for their rooms"
  on public.streamer_viewer_answers for update
  to anon, authenticated
  using (
    exists (
      select 1
      from public.streamer_rooms room
      where room.room_code = streamer_viewer_answers.room_code
        and room.host_presence_id is not null
        and room.is_live = true
    )
  )
  with check (
    exists (
      select 1
      from public.streamer_rooms room
      where room.room_code = streamer_viewer_answers.room_code
        and room.host_presence_id is not null
        and room.is_live = true
    )
  );
