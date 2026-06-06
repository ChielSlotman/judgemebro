-- Initial Supabase schema for judgemebro.com.
-- Created manually because the Supabase CLI is not installed locally.
-- Apply with the Supabase SQL editor or create a CLI migration after installing the CLI.

create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  overall_rating integer not null default 1128,
  battles_left_today integer not null default 5,
  daily_streak integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.category_ratings (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  category_id text not null,
  rating integer not null default 1000,
  wins integer not null default 0,
  losses integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, category_id)
);

create table public.battle_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  mode text not null check (mode in ('ranked', 'friend', 'bot', 'streamer')),
  category_id text not null,
  category_name text not null,
  prompt text not null,
  opponent_name text not null,
  your_answer text not null,
  opponent_answer text not null,
  you_win boolean not null,
  point_delta integer not null default 0,
  ai_reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.friend_battle_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  category_id text not null,
  host_user_id uuid references auth.users(id) on delete set null,
  guest_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'judged', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours'
);

create table public.streamer_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  room_name text not null,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  category_id text not null default 'dating',
  current_prompt text,
  is_live boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.streamer_viewer_answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.streamer_rooms(id) on delete cascade,
  room_code text not null,
  viewer_user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  answer text not null check (char_length(answer) <= 280),
  hidden boolean not null default false,
  selected_for_stream boolean not null default false,
  selected_for_official_battle boolean not null default false,
  created_at timestamptz not null default now()
);

create index battle_results_user_created_idx on public.battle_results (user_id, created_at desc);
create index battle_results_category_created_idx on public.battle_results (category_id, created_at desc);
create index friend_battle_rooms_code_idx on public.friend_battle_rooms (room_code);
create index streamer_rooms_code_idx on public.streamer_rooms (room_code);
create index streamer_viewer_answers_room_created_idx on public.streamer_viewer_answers (room_code, created_at desc);

alter table public.profiles enable row level security;
alter table public.category_ratings enable row level security;
alter table public.battle_results enable row level security;
alter table public.friend_battle_rooms enable row level security;
alter table public.streamer_rooms enable row level security;
alter table public.streamer_viewer_answers enable row level security;

create policy "Profiles are visible to their owner"
  on public.profiles for select
  to authenticated
  using (user_id = auth.uid());

create policy "Profiles can be inserted by their owner"
  on public.profiles for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Profiles can be updated by their owner"
  on public.profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Category ratings are visible to their owner"
  on public.category_ratings for select
  to authenticated
  using (user_id = auth.uid());

create policy "Category ratings can be upserted by their owner"
  on public.category_ratings for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Category ratings can be updated by their owner"
  on public.category_ratings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can insert their own battle results"
  on public.battle_results for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Anonymous prototype battle results can be inserted"
  on public.battle_results for insert
  to anon
  with check (user_id is null);

create policy "Users can read their own battle results"
  on public.battle_results for select
  to authenticated
  using (user_id = auth.uid());

create policy "Room participants can read friend rooms"
  on public.friend_battle_rooms for select
  to authenticated
  using (host_user_id = auth.uid() or guest_user_id = auth.uid());

create policy "Authenticated users can create friend rooms"
  on public.friend_battle_rooms for insert
  to authenticated
  with check (host_user_id = auth.uid());

create policy "Hosts can update friend rooms"
  on public.friend_battle_rooms for update
  to authenticated
  using (host_user_id = auth.uid())
  with check (host_user_id = auth.uid());

create policy "Active streamer rooms are joinable by room code"
  on public.streamer_rooms for select
  to anon, authenticated
  using (is_live = true);

create policy "Streamers can create their own rooms"
  on public.streamer_rooms for insert
  to authenticated
  with check (host_user_id = auth.uid());

create policy "Streamers can update their own rooms"
  on public.streamer_rooms for update
  to authenticated
  using (host_user_id = auth.uid())
  with check (host_user_id = auth.uid());

create policy "Viewers can submit visible answers to live rooms"
  on public.streamer_viewer_answers for insert
  to anon, authenticated
  with check (
    char_length(answer) <= 280
    and hidden = false
    and exists (
      select 1
      from public.streamer_rooms room
      where room.room_code = streamer_viewer_answers.room_code
        and room.is_live = true
    )
  );

create policy "Streamers can read answers for their rooms"
  on public.streamer_viewer_answers for select
  to authenticated
  using (
    exists (
      select 1
      from public.streamer_rooms room
      where room.room_code = streamer_viewer_answers.room_code
        and room.host_user_id = auth.uid()
    )
  );

create policy "Streamers can moderate answers for their rooms"
  on public.streamer_viewer_answers for update
  to authenticated
  using (
    exists (
      select 1
      from public.streamer_rooms room
      where room.room_code = streamer_viewer_answers.room_code
        and room.host_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.streamer_rooms room
      where room.room_code = streamer_viewer_answers.room_code
        and room.host_user_id = auth.uid()
    )
  );
