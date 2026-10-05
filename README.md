# SkillLink v9 — production-oriented foundation

## What was audited
The v8 build was inspected for frontend routes, backend routes, Supabase schema, authentication, referrals, CEO controls, payments, withdrawals and the uploaded visual assets.

## v9 fixes included
- Real learner hero image and SkillLink loading scene preserved.
- Package, course and masterclass artwork preserved.
- More polished login/sign-up UI with learner visual, password visibility, password-strength hint, referral field and clearer security messaging.
- Razorpay checkout integration added to the backend/frontend flow.
- Server creates Razorpay orders from the database price; the browser cannot choose the final amount.
- Razorpay callback signature and payment amount are verified on the backend.
- Razorpay webhook endpoint validates HMAC signatures and handles captured/failed/refunded events.
- Verified package/course payments create the corresponding enrollment.
- Eligible package referral commissions are created only after verified payment; commission value is controlled by the CEO in the database.
- Partner withdrawal request endpoints added with ₹100 minimum and server-side available-balance validation.
- User order history endpoint added.
- Migration `003_payments_and_checkout.sql` adds provider-order/event tracking and CEO-controlled package partner commission.

## Razorpay placement
Payment code lives in:
- `backend/server.js` → `/api/payments/create-order`
- `backend/server.js` → `/api/payments/verify`
- `backend/server.js` → `/api/payments/webhook`
- `frontend/src/App.jsx` → `BuyButton`

### Render backend environment
Set these server-only variables:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Never put the secret in Vite `VITE_*` variables or GitHub/frontend code.

### Supabase
Run, in order:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_ceo_control_center.sql`
3. `supabase/migrations/003_payments_and_checkout.sql`

### Razorpay webhook
Configure the webhook URL as:
`https://YOUR-RENDER-BACKEND/api/payments/webhook`

Use the same secret as `RAZORPAY_WEBHOOK_SECRET`. Enable the payment events required by the current Razorpay dashboard, especially captured/failed/refund events used by this implementation.

## Important test status
- Backend JavaScript syntax: PASS.
- ZIP integrity: PASS.
- Frontend production build: NOT VERIFIED in this environment because npm dependency installation timed out and offline packages were not cached.
- Live Supabase authentication: NOT VERIFIED here.
- Live Razorpay transaction: NOT VERIFIED here; it requires your Razorpay test credentials and deployed HTTPS backend.

## Known remaining product work
The existing project still contains foundation-level areas that should not be described as fully finished until implemented and tested end-to-end: instructor authoring/review workflow, complete student learning/progress UI, full workshop registration/attendance/resource flow, complete admin permission enforcement beyond CEO-managed records, QR attribution UI, certificates generation/delivery, support workflow, and comprehensive automated integration tests.


## Registration + Package Pricing
- New account registration bundle: ₹99 registration fee + one selected package fee.
- Current package prices: Aarambh ₹499, Udaan ₹999, Pragati ₹1,999, Brahmastra ₹3,999, Shikhar ₹6,999.
- Existing members see Upgrade Package in Dashboard. Upgrade charges only the server-calculated difference to a higher package and never charges the ₹99 registration fee again.
- Run migration `004_registration_and_package_upgrades.sql` after migrations 001–003.
- Razorpay keys remain server-side in Render environment variables.
