# SkillLink API Route Audit

The frontend uses `/api` by default. Local Vite proxies `/api` to `http://localhost:4000`; Vercel rewrites `/api/*` to the configured Render backend.

The no-network contract checker is:

```bash
node scripts/check-api-contract.mjs
```

It verifies that frontend `api(...)` call patterns have matching Express routes and that no `501` placeholder route remains.

## Required local variables

Backend: copy `backend/.env.example` to `backend/.env` and fill the server-only Supabase service-role key and payment secrets.

Frontend: copy `frontend/.env.example` to `frontend/.env.local` and fill only the Supabase URL and publishable key.

Never put `SUPABASE_SERVICE_ROLE_KEY`, Razorpay secret, webhook secret, database password, or any JWT/private secret in frontend variables or Git.
