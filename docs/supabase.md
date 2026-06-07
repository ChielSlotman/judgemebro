# Supabase Setup

This prototype is wired to keep working without Supabase credentials. When `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are present, the app can persist battle results and streamer viewer submissions.

## Environment

Copy `.env.example` to `.env.local` and fill:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code.

After `.env.local` is filled, sync the public Supabase client values to Vercel:

```bash
npm run sync:vercel-env -- --dry-run
npm run sync:vercel-env
```

The sync script only sends `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. It ignores `SUPABASE_SERVICE_ROLE_KEY`.

## Schema

The initial schema is in:

```text
supabase/migrations/20260606230000_initial_judgemebro_schema.sql
```

After installing the CLI and linking a project, preview and push the checked-in migrations with:

```bash
supabase link
supabase db push --dry-run
supabase db push
```

If the CLI is not available, apply the checked-in SQL files through the Supabase SQL editor in timestamp order.

## Security Model

- RLS is enabled on every `public` table.
- Profile, category rating, friend-room, and streamer-room ownership uses `auth.uid()`.
- Anonymous inserts are only allowed for prototype battle results with `user_id is null` and streamer viewer answers for live rooms.
- Viewer answers are not AI judged by default. The schema tracks `selected_for_official_battle` separately so only manually selected answers should trigger paid AI judgment.

## Realtime

The second migration enables Postgres Changes on the tables that need live UI updates:

```text
supabase/migrations/20260607002000_enable_realtime_game_tables.sql
```

Realtime-enabled tables:

- `friend_battle_rooms`
- `streamer_rooms`
- `streamer_viewer_answers`
- `battle_results`

The client helper functions live in `src/lib/gameRepository.js`:

- `subscribeToStreamerAnswers(roomCode, onChange)`
- `subscribeToFriendRoom(roomCode, onChange)`

RLS still applies to Realtime visibility. Streamer answer subscriptions are intended for authenticated streamers who own the room; viewer submissions can remain cheap inserts and do not trigger AI judging unless selected.

## Setup Check

Run:

```bash
npm run test:supabase
npm run setup:check
npm run check:providers
npm run launch:audit
```

`test:supabase` statically verifies the local migrations for the prototype security and Realtime invariants. `setup:check` reports whether local Git, Vercel, and Supabase tooling is present. `check:providers` reports whether account-side Vercel env vars, custom-domain DNS, GitHub remote, and Supabase auth are complete.

## GitHub Migration Workflow

After the GitHub repository exists, add these repository secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_REF`

Then run the manual `Supabase Migrations` workflow. Keep `apply` as `false` for the first run so GitHub Actions performs `supabase db push --dry-run`. Re-run with `apply` set to `true` only after the dry run shows the expected migration list.

## Prototype Tables

- `profiles`
- `category_ratings`
- `battle_results`
- `friend_battle_rooms`
- `streamer_rooms`
- `streamer_viewer_answers`
