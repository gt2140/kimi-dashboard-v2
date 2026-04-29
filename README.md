# Aura MVP

Aura is a React + Hono + tRPC web app backed by Supabase Auth and Postgres.
This stabilized MVP supports:

- Google login through Supabase
- backend session synchronization with an app cookie
- persisted user conversations
- persisted vault metadata per authenticated user

Out of scope for the stable MVP:

- predictions / token economy
- persistent per-agent settings
- real vault file upload, parsing, or retrieval beyond metadata

## Local development

From the workspace root:

```bash
npm run dev
```

The app runs on:

```text
http://localhost:3000
```

## Required environment

Create `app/.env` with:

```env
SESSION_SECRET=replace-with-a-random-long-string
SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_anon_key
DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require
OWNER_UNION_ID=supabase:YOUR_SUPABASE_AUTH_USER_ID
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
DEEPSEEK_API_KEY=
KIMI_API_KEY=
```

Notes:

- `SUPABASE_URL` and `VITE_SUPABASE_URL` should point to the same project.
- Prefer the current Supabase pooled Postgres connection string for local development if the direct `db.<project>.supabase.co` host is unreliable.
- `DATABASE_URL` must be a real connection string, not a placeholder.
- `OWNER_UNION_ID` is optional unless you want your own account promoted to `admin`.
- Model provider API keys are optional until we connect a real model gateway.

## Supabase setup

1. In Supabase SQL Editor, run [supabase/init.sql](/C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/supabase/init.sql).
2. In `Authentication > Providers`, enable Google.
3. Add this redirect URL:

```text
http://localhost:3000/auth/callback
```

The frontend now derives the callback origin from `window.location.origin`, so production environments should add their own deployed `/auth/callback` URL as well.

## Auth flow

1. User signs in with Google via Supabase.
2. Supabase creates the browser auth session.
3. The frontend exchanges that for a backend app session by calling `auth.syncSession`.
4. The backend validates the Supabase token, upserts the `users` row, and sets the `kimi_sid` cookie.
5. Protected routes only count as authenticated after both the browser session and backend session are ready.

If the browser session exists but backend sync fails, the UI now blocks protected screens and shows a setup/runtime error instead of acting half-logged-in.

## Database and schema

The MVP schema is:

- `users`
- `conversations`
- `messages`
- `vault_files`

Auth, chat, and vault rely on this schema being present and reachable from the backend.

## Troubleshooting

- `getaddrinfo ENOTFOUND db.<project>.supabase.co`
  Use the current pooled Supabase Postgres connection string instead of the direct host, or verify the direct host exactly matches your project.
- `Backend setup error: DATABASE_URL...`
  The backend could not parse or reach the database URL.
- Login returns to the app but protected routes fail
  Check the browser session, backend `auth.status`, and whether `auth.syncSession` can upsert the user.
- Vault works but file contents are not available
  Expected in this MVP. Only metadata is persisted.

## Tooling

- Recommended Node: `22.12+`
- `tsc -b` is the main compile check used during stabilization.
- Vitest coverage is included in the repo, but execution may still depend on local process spawn permissions in this environment.
