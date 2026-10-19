# Razorpay Smart Collect deployment and operation

## Scope and compatibility

Bank transfers are opt-in and use the same configured Razorpay key pair as the existing checkout. No secrets, virtual accounts, or live payments are provisioned by the source changes or automated tests.

Booking references still come from the existing model and counter: `AT-D0001` / `AT-I0001`. Initial bank bookings reuse the existing booking schema validation, accommodation pricing snapshot, GST calculation, deposit configuration, airfare rules and confirmation services. A configured 40% advance remains 40%; fixed deposits and other configured deposit rates are preserved. The current repository does not contain an independent TCS computation, so this integration does not invent or change a TCS rule. Any tax already present in the saved total is collected once.

Money in the new account and transfer ledgers is stored in integer paise. Existing booking totals and payment/airfare logic use whole rupees. Requests are therefore whole-rupee amounts. Unexpected transfers containing paise are recorded in full as **review**, without rounding, automatic confirmation, or automatic refund.

Bank detail generation does not confirm a booking and does not reserve seats. Partial payments accumulate without a permanent seat hold. Once the configured initial payment is satisfied, the existing seat reservation helper runs in the same transaction as the credit. No availability means review, not confirmation. Expired/cancelled bookings and transfers after identifier closure/expiry never reactivate automatically.

## Required configuration

Set these on the backend deployment, without committing secret values:

| Variable | Purpose |
| --- | --- |
| `RAZORPAY_KEY_ID` | Existing checkout key; `rzp_test_` / `rzp_live_` determines mode |
| `RAZORPAY_KEY_SECRET` | Existing matching key secret |
| `RAZORPAY_SMART_COLLECT_ENABLED=true` | Enables generating identifiers and customer payment choices; default is disabled |
| `RAZORPAY_SMART_COLLECT_WEBHOOK_SECRET` | Secret configured for the new webhook endpoint; falls back to existing `RAZORPAY_WEBHOOK_SECRET` if omitted |
| `RAZORPAY_SMART_COLLECT_EXPIRY_HOURS` | Optional identifier validity; defaults to 48 hours, bounded to 1?720 hours and the unpaid booking expiry |
| `FRONTEND_URL` | Existing public HTTPS customer origin for instruction links |
| Existing SMTP settings | Reused by the existing email service |
| Existing `MSG91_*` settings | Reused by `sendBookingPaymentLinkWhatsapp`; the already-approved payment-link template must support the bank-transfer instructions link |

No new frontend environment variable or credential is required. Customer payment choices read `GET /api/bookings/bank-transfer/config`.

Ask Razorpay to enable Smart Collect / bank-account Customer Identifiers on the merchant account before enabling the flag. Both environments must be configured and tested separately. Merchant activation and test bank-payment simulation must be completed in the Razorpay dashboard; these cannot be verified by mocked tests.

Mode and merchant-key isolation uses a SHA-256 fingerprint of the configured key ID, never the secret. Account lookup, reconciliation and transfer IDs are scoped to that fingerprint. If rotating keys, reconcile and close outstanding identifiers with the old configuration first; do not overwrite the scope or move accounts between test/live. Keep each deployment's webhook secret and database access appropriately isolated.

## Webhook configuration

Configure an HTTPS POST webhook in the matching Razorpay dashboard mode:

`https://YOUR_BACKEND/api/bookings/bank-transfer/webhook`

Subscribe to:

- `virtual_account.credited`
- `virtual_account.closed`

Use the configured Smart Collect webhook secret. The endpoint validates the original raw request bytes with HMAC-SHA256 and constant-time comparison before parsing JSON. Do not route it through JSON-parsing middleware or a proxy that changes the body. The existing `/api/bookings/payment/webhook` remains unchanged.

A credit is also fetched from Razorpay's payment, bank-transfer and identifier APIs. Payment ID, captured INR bank-transfer status, amount, virtual account ID, ownership notes, and current key scope must agree. An event signature alone cannot confirm a booking.

Razorpay may retry deliveries. Return failures are intentionally retriable; a unique transfer ledger and MongoDB transaction prevent repeated credits.

## API endpoints

All admin endpoints retain the existing `requireAdmin` middleware.

| Method | Endpoint | Access / behavior |
| --- | --- | --- |
| GET | `/api/bookings/bank-transfer/config` | Public feature availability |
| POST | `/api/bookings/bank-transfer` | Existing booking form payload; returns booking, identifier details and private access token |
| GET | `/api/bookings/:id/bank-transfer` | Customer login owning a paid booking, or private bank/confirmation token in `?token=` |
| POST | `/api/bookings/:id/bank-transfer` | Same customer access; request advance, full, partial, final, or already-added additional charges |
| POST | `/api/bookings/bank-transfer/webhook` | Signed raw Razorpay webhook |
| GET | `/api/admin/bookings/:id/bank-transfer` | Admin identifier and transfer history |
| POST | `/api/admin/bookings/:id/bank-transfer` | Admin creates or updates the requested amount |
| POST | `/api/admin/bookings/:id/bank-transfer/:accountId/refresh` | Admin fetches and reconciles all identifier payment pages |
| POST | `/api/admin/bookings/:id/bank-transfer/:accountId/close` | Admin closes at Razorpay, then reconciles in-flight payments |

Existing-booking POST body:

```json
{ "purpose": "partial", "amount": 1000 }
```

Valid purposes: `advance`, `full`, `partial`, `final`, `additional`. Only partial requires an explicit amount. Amounts cannot exceed the authoritative outstanding balance. Additional charges must already have been added through the existing booking/airfare controls; generating a bank identifier never invents another charge.

Customer page: `/bank-transfer/:bookingId?token=PRIVATE_TOKEN`

Admin page: `/bookings/bank-transfer/?bookingId=BOOKING_ID`, available through the booking's **Bank Transfer** action.

Tokens are strong bearer credentials. Do not share them outside the customer notification channel, record query strings in analytics, or put bank-detail pages into search indexes. The customer page sets no-referrer/no-index metadata; API detail/token responses disable caching.

## Database and processing

New collections:

- `SmartCollectAccount`: booking, reference, key scope, remote identifier, bank details, cumulative request/received/applied/review amounts, expiry, state, notification claims.
- `SmartCollectTransfer`: one record per merchant-key fingerprint and Razorpay payment ID, with received/applied/review amounts, UTR, mode, reason and processing time.

The booking schema only adds an optional private bank-transfer token and the new payment mode/method enum value. Existing documents need no backfill. Unique account indexes are created before identifier generation; the transfer primary key is intrinsically unique. The deployment database user must have create-index rights. Existing MongoDB replica-set transactions are required, as they already are for checkout.

A local identifier row is created before calling Razorpay. Unknown creation outcomes are reconciled by the local ID stored in Razorpay notes; they are never blindly re-POSTed. Definitive creation rejections remain visible as failed requests. Close identifiers with an unknown creation outcome only after reconciliation can locate the remote account.

Payment credits, ledger records, account totals, and any seat reservation are committed atomically. Confirmation is queued only after commit. Individual transfers can partially apply up to the outstanding balance; excess money remains visible for review. Unverified or failed transfers never credit a booking. Refunded transfers, deleted-booking transfers, late transfers and paise anomalies are review items. No automatic refunds are performed.

A bank cannot be prevented from sending an excess or in-flight transfer. This integration caps booking credits, automatically closes settled identifiers, and tracks unapplied funds rather than pretending excess funds were not received.

While an identifier remains active or its creation outcome is unresolved, the existing booking collection lock prevents another checkout/payment link or booking-price edit from competing with the transfer. Reconcile and close identifiers before switching methods or changing prices. The booking cancellation flow remains available; later credits go to review. Avoid manual amount-paid edits for bank transfers; use the verified ledger.

The existing five-minute maintenance loop performs bounded reconciliation batches, rotates attempts, closes expired/settled/cancelled identifiers, and recovers missed webhooks. Closed identifiers remain available for delayed reconciliation. Admin Refresh performs immediate reconciliation. Customer Check Status reads verified local state; it never treats a browser claim as proof of payment.

## Notifications

Instruction email uses the existing SMTP transport and includes full bank details and expiry. WhatsApp reuses the existing approved payment-link template with a private instructions-page URL. Each account/channel has an atomic send claim. Verified transfers have per-payment email receipts; the existing idempotent booking email/MSG91 confirmation services run when the booking qualifies for confirmation.

Ambiguous or failed notification sends are marked for review, not automatically resent, to avoid duplicate messages. Check the displayed instruction statuses and provider logs; a missing notification does not alter payment correctness or hide details from the customer page.

## Verification and release checklist

Run `npm test` in backend and the existing TypeScript checks in admin/frontend. Smart Collect tests mock Razorpay and MongoDB; they do not prove merchant activation, live bank settlement, SMTP delivery or MSG91 template approval.

Before enabling production, exercise these in the Razorpay test environment with a replica-set database:

1. Initial advance/full bank booking produces the correct reference, receiver details and unpaid status without decrementing seats.
2. Multiple transfers reach the configured deposit/full threshold; one seat reservation and one confirmation occur.
3. Replayed and concurrent webhook deliveries cannot duplicate a credit.
4. A final payment and separately-added airfare update the saved balance without reapplying taxes.
5. Sold-out, expired, cancelled, overpaid, failed and closed-identifier transfers remain review items where applicable.
6. Admin Refresh finds missed deliveries, paginates payments, and Close reconciles outstanding transfers.
7. Existing UPI/Card checkout and Cash/Cheque offline flows still complete.
8. Verify actual email/WhatsApp delivery and ensure API access logs redact private tokens.

No live resources have been created by this implementation.

## Modified areas

- `backend/src/controllers/booking.controller.ts`, `models/booking.model.ts`: reuse existing helpers, add bank draft creation and collection guards.
- `backend/src/controllers/smartCollect.controller.ts`, `models/smartCollect.model.ts`, `services/smart-collect/*`: new bank transfer APIs, gateway, ledger, policy, notifications, reconciliation.
- `backend/src/app.ts`, `routes/booking.routes.ts`, `server.ts`: raw webhook registration, routes, maintenance.
- `backend/src/services/booking-confirmation-email.service.ts`: bank instruction/receipt sender using existing transport.
- `frontend/lib/bank-transfer.ts`, `components/bank-transfer-page.tsx`, `app/bank-transfer/[bookingId]/page.tsx`: customer bank details and history.
- Existing single-tour and user booking payment views: opt-in bank payment choices.
- `admin/lib/bank-transfer.ts`, `components/admin-bank-transfer-page.tsx`, `app/bookings/bank-transfer/page.tsx`: admin bank views.
- Existing admin booking action/types: Bank Transfer link and compatible enum values.
- Backend regression tests and package test command.

## Razorpay references

- [Create a Customer Identifier with a bank account receiver](https://razorpay.com/docs/api/payments/smart-collect/create-cust-id-bank-account)
- [Smart Collect webhook payloads and raw signature requirements](https://razorpay.com/docs/webhooks/payloads/smart-collect/)
- [Fetch payments for an identifier](https://razorpay.com/docs/api/payments/smart-collect/fetch-payments-cust-id)
- [Verify a payment's bank-transfer details](https://razorpay.com/docs/api/payments/smart-collect/fetch-payments-bank-transfer)
- [Close a Customer Identifier](https://razorpay.com/docs/api/payments/smart-collect/close/)
