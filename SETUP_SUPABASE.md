# Supabase Setup for Aura MVP

## 1. Start the app

From the workspace root:

```bash
npm run dev
```

Local runtime:

```text
http://localhost:3000
```

## 2. Configure `app/.env`

```env
SESSION_SECRET=replace-with-a-random-long-string
SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_anon_key
DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require
OWNER_UNION_ID=supabase:YOUR_SUPABASE_AUTH_USER_ID
```

Important:

- `DATABASE_URL` must be real and reachable from the backend.
- If `db.<project>.supabase.co` fails to resolve, use the pooled connection string from the Supabase dashboard.
- `SUPABASE_URL` and `VITE_SUPABASE_URL` must target the same project.

## 3. Create the schema

Run [supabase/init.sql](/C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/supabase/init.sql) in the Supabase SQL Editor.

This creates:

- `users`
- `conversations`
- `messages`
- `vault_files`

## 4. Enable Google auth

In Supabase:

1. Open `Authentication > Providers`.
2. Enable `Google`.
3. Add the Google client ID and secret.
4. Add this redirect URL:

```text
http://localhost:3000/auth/callback
```

For deployed environments, also add the deployed origin with `/auth/callback`.

## 5. Verify the MVP flow

Successful setup means:

1. Login page loads and shows the runtime callback URL.
2. Google sign-in returns to `/auth/callback`.
3. `auth.syncSession` succeeds.
4. A `users` row is created or updated.
5. `/chat` and `/vault` work after refresh.

## 6. Common failures

- `Backend setup error: DATABASE_URL is missing or invalid`
  Fix the env var format first.
- `getaddrinfo ENOTFOUND db...supabase.co`
  The DB host is wrong or not resolvable; switch to the Supabase pooler host.
- Login succeeds in Supabase but app stays unauthenticated
  The browser session exists, but backend session sync failed. Check `DATABASE_URL`, `SESSION_SECRET`, and API logs.
- Vault uploads do not contain file contents
  Expected for this MVP; only vault metadata is stored.
