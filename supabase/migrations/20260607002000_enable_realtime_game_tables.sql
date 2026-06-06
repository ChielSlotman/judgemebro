-- Enable Supabase Realtime Postgres Changes for tables that drive live play.
-- This keeps viewer submissions, streamer rooms, and friend-room status observable.

do $$
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    execute 'create publication supabase_realtime';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'friend_battle_rooms'
  ) then
    execute 'alter publication supabase_realtime add table public.friend_battle_rooms';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'streamer_rooms'
  ) then
    execute 'alter publication supabase_realtime add table public.streamer_rooms';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'streamer_viewer_answers'
  ) then
    execute 'alter publication supabase_realtime add table public.streamer_viewer_answers';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'battle_results'
  ) then
    execute 'alter publication supabase_realtime add table public.battle_results';
  end if;
end
$$;
