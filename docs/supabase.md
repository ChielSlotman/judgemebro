# Supabase Setup

This prototype is wired to keep working without Supabase credentials. When `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are present, the app can persist battle results and streamer viewer submissions.

## Environment

Copy `.env.example` to `.env.local` and fill:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code.

## Schema

The initial schema is in:

```text
supabase/migrations/20260606230000_initial_judgemebro_schema.sql
```

The local Supabase CLI was not installed when this file was created, so this migration is intentionally marked as manually created. After installing the CLI, prefer:

```bash
supabase migration new initial_judgemebro_schema
supabase db push
```

or apply the checked-in SQL through the Supabase SQL editor.

## Security Model

- RLS is enabled on every `public` table.
- Profile, category rating, friend-room, and streamer-room ownership uses `auth.uid()`.
- Anonymous inserts are only allowed for prototype battle results with `user_id is null` and streamer viewer answers for live rooms.
- Viewer answers are not AI judged by default. The schema tracks `selected_for_official_battle` separately so only manually selected answers should trigger paid AI judgment.

## Prototype Tables

- `profiles`
- `category_ratings`
- `battle_results`
- `friend_battle_rooms`
- `streamer_rooms`
- `streamer_viewer_answers`
