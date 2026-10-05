# SkillLink Final Static Audit — API Routes Fixed

## Fixed in this release
1. `scripts/check-api-contract.mjs`
   - No longer depends on the current working directory.
   - Detects dynamic CEO `paths[...]` API calls.
   - Checks missing API routes and duplicate same-method definitions.
   - Checks for obvious frontend secret exposure and 501 placeholders.
2. `backend/server.js`
   - Referral commission ledger insert now supplies canonical `type='commission'` plus compatibility `transaction_type`.
   - Payment order creation now persists `order_purpose`, `registration_fee`, `package_price`, and `upgrade_from_package_id`.
   - Successful registration-bundle fulfilment now persists `profiles.registration_fee_paid` and its timestamp.
3. `frontend/src/App.jsx`
   - Signup package selector now loads live package names/prices from `/api/packages`; hardcoded package prices are no longer used for checkout selection.
   - Course search, category filter, and sorting controls now perform real filtering/sorting instead of being inert buttons.
4. `supabase/migration/006_production_safety.sql`
   - Non-destructive signup-trigger hardening: a missing full name falls back safely instead of violating `profiles.full_name NOT NULL`.
   - Reattaches the expected auth trigger exactly once.
5. Documentation was corrected where it described stale registration fields/build assumptions.
6. Root `.gitignore` added so local secrets, dependencies, and build output are not pushed accidentally.

## Checks completed
- `node --check backend/server.js` — PASS
- `node --check scripts/check-api-contract.mjs` — PASS
- API contract checker — PASS: 35 frontend API call patterns, 60 backend route definitions
- No 501 placeholders found
- No obvious service-role/Razorpay-secret values found in frontend source
- No duplicate same-method backend route definitions found
- SQL migration 006 is non-destructive and intended to run after migration 005

## Environment limitation
A full frontend production build and live backend startup could not be completed in this isolated environment because project dependencies were not installed; the dependency installation attempt timed out. Therefore this ZIP is statically audited and syntax-checked on the backend, but it is **not claimed as fully E2E-tested** against the user's Supabase/Razorpay/Render environment.

## Deployment order
1. Apply Supabase migrations in order, including `006_production_safety.sql` after `005_api_contract_compatibility.sql`.
2. Push this project to GitHub.
3. Deploy backend with the server-only Render variables from `backend/.env.example`.
4. Deploy frontend with the safe Vercel variables from `frontend/.env.example`.
5. Verify `/api/health`, signup/login, package checkout, payment verification, role dashboard, partner commission, withdrawal approval, and CEO controls against the live environment.
