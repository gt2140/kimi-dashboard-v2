# Aura MVP

Aura is a React + Hono + tRPC web app backed by Supabase Auth and Postgres.
This stabilized MVP supports:

- Google login through Supabase
- backend session synchronization with an app cookie
- persisted user conversations
- Venice-first generalist chat turns through `VeniceFirstConversationTurnRuntime`
- persisted vault files, extracted text, chunk indexing, and per-file ingestion traces

Out of scope for the stable MVP:

- predictions / token economy
- persistent per-agent settings
- Kimi/OpenAI chat execution, medical runtime branching, and multi-agent orchestration

## Local development

From the workspace root:

```bash
npm run dev
```

The app runs on:

```text
http://localhost:3000
```

Development now requires `http://localhost:3000` specifically.
If that port is already occupied, `npm run dev` fails fast with guidance instead of silently moving to another port.
This keeps the browser session, local API, and Supabase callback origin aligned to one runtime.

## Required environment

Create `app/.env` with:

```env
SESSION_SECRET=replace-with-a-random-long-string
SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_anon_key
DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require
OWNER_UNION_ID=supabase:YOUR_SUPABASE_AUTH_USER_ID
VENICE_API_KEY=
VENICE_INFERENCE_KEY=
VENICE_MODEL=zai-org-glm-5
```

Notes:

- `SUPABASE_URL` and `VITE_SUPABASE_URL` should point to the same project.
- The backend can fall back to `VITE_SUPABASE_URL` for Supabase token validation, but keeping both variables set is still the safest Vercel configuration.
- Prefer the current Supabase pooled Postgres connection string for local development if the direct `db.<project>.supabase.co` host is unreliable.
- `DATABASE_URL` must be a real connection string, not a placeholder.
- `OWNER_UNION_ID` is optional unless you want your own account promoted to `admin`.
- Venice is the only required model provider for the Stage 1 chat backend.
- For Venice, prefer `VENICE_API_KEY`. The backend also accepts `VENICE_INFERENCE_KEY` as an alias for inference keys created in Venice.
- Legacy provider variables may remain in local environments for older code paths, but they are not required for the primary chat runtime.

## Vercel deployment

Set these project environment variables in Vercel for `Production` and `Preview`:

```env
SESSION_SECRET=replace-with-a-random-long-string
DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_supabase_publishable_anon_key
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_anon_key
VENICE_API_KEY=your_venice_api_key
VENICE_INFERENCE_KEY=your_venice_inference_key
VENICE_MODEL=zai-org-glm-5
```

Also add each deployed `https://<your-domain>/auth/callback` URL to the Supabase Google OAuth redirect allow-list.

For Venice on Vercel:

- Set either `VENICE_API_KEY` or `VENICE_INFERENCE_KEY`. The backend accepts both, but only one is needed.
- Keep Venice secrets only in local `app/.env` and Vercel project environment variables. Do not commit them to GitHub.
- `VENICE_MODEL` is optional. If you omit it, the backend defaults to `zai-org-glm-5`.

## GitHub and deploy checklist

Before pushing the repo:

- Keep `.env` out of GitHub.
- Confirm `app/.env.example` has placeholders only.
- Make sure local `npm run check` and focused chat tests are green.

Before promoting the Vercel project:

- Verify Supabase callback URLs include the deployed domain.
- Add the Venice secret to both `Preview` and `Production`.
- Open `https://<your-domain>/api/health` and confirm `ok: true`; the payload reports missing environment categories without exposing secret values.
- Run one authenticated `POST /api/chat/stream` turn with an explicit `requestedModelName` after deploy.

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
- `vault_chunks`
- `vault_ingestion_events`

Auth, chat, and vault rely on this schema being present and reachable from the backend.

## Troubleshooting

- `getaddrinfo ENOTFOUND db.<project>.supabase.co`
  Use the current pooled Supabase Postgres connection string instead of the direct host, or verify the direct host exactly matches your project.
- `Backend setup error: DATABASE_URL...`
  The backend could not parse or reach the database URL.
- Login returns to the app but protected routes fail
  Check the browser session, backend `auth.status`, and whether `auth.syncSession` can upsert the user.
- Vault works but file contents are not available
  Check the file lifecycle fields and `vault_ingestion_events` to see whether the file is only uploaded, already extracted, indexed, or context-eligible.

## Tooling

- Recommended Node: `22.12+`
- `tsc -b` is the main compile check used during stabilization.
- Vitest coverage is included in the repo, but execution may still depend on local process spawn permissions in this environment.
