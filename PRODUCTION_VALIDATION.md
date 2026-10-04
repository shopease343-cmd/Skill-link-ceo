# SkillLink Production Candidate — Validation

This package is a production-oriented candidate based on the supplied V10 source and migrations.

## Verified locally
- Backend `server.js` passes Node syntax validation.
- All API paths referenced by `frontend/src/App.jsx` have matching backend routes.
- Old `skill-link-12.onrender.com` backend reference is absent.
- No live Supabase service-role or Razorpay secret values are included.
- Frontend API client uses the Supabase access token as a Bearer token.
- `/api/me` returns the server-side profile and registration payment fields.
- `/api/dashboard` returns live role-specific data for `ceo`, `admin`, `partner`, `instructor`, and `student`.
- Admin protected data endpoints require both admin role and a matching CEO-granted permission.
- Package checkout is restricted to student accounts.
- Razorpay secret remains server-side.

## Important limitation
No software can honestly be guaranteed to be 100% bug-free or 100% safe from a static review alone. The frontend production bundle could not be built in this environment because dependency installation timed out. Final acceptance must include a successful Vercel build and live tests against the actual Supabase/Razorpay configuration.

## Required production environment
### Vercel
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_API_URL=https://ceo.onrender.com/api`
- `VITE_RAZORPAY_KEY_ID` (public key only)

### Render
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGIN=https://YOUR-VERCEL-DOMAIN.vercel.app`
- `PUBLIC_APP_URL=https://YOUR-VERCEL-DOMAIN.vercel.app`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Run all Supabase migrations in order before deployment.
