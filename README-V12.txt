SKILLLINK V12 DATABASE/BACKEND FIX

1. Replace Render backend server.js with server.js from this package.
2. Run SkillLink-profile-auth-migration.sql in Supabase SQL Editor.
3. Redeploy Render.
4. Refresh Vercel and log in again.

IMPORTANT:
- Migration `004_registration_and_package_upgrades.sql` adds `registration_fee_paid` and `registration_fee_paid_at`; run migrations in order.
- V12 derives registration payment state from public.orders where order_purpose=registration_bundle and status=paid.
- New/missing Auth users are automatically given a normal student profile.
- The migration deliberately does NOT grant CEO/Admin privileges automatically.
- Existing CEO profile for Sikander Singh (CEO001) remains unchanged.
- If a missing account is intended to be CEO/Admin, assign that role only through an authorized CEO workflow after confirming the account.
