# Firebase notifications

The admin dashboard and customer account now share a MongoDB inbox and an asynchronous FCM delivery pipeline. Email and MSG91 WhatsApp delivery remain independent.

## Deployment configuration

Use Firebase project **ancient-trails-e598a** for both browser applications and the backend.

Backend environment (never `NEXT_PUBLIC_*`):

```dotenv
FIREBASE_PROJECT_ID=ancient-trails-e598a
FIREBASE_CLIENT_EMAIL=<service-account client_email>
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
PUSH_REGISTRATION_ENCRYPTION_KEY=<stable random secret, at least 32 bytes>
```

Alternatively, set `GOOGLE_APPLICATION_CREDENTIALS` to a securely mounted service-account JSON file instead of the email/private-key pair. On a managed Google runtime with an attached service account, use `FIREBASE_USE_APPLICATION_DEFAULT=true`. Grant the service account the Firebase Cloud Messaging API Admin permission for this project. Do not place service-account files in either browser application's public directory or commit them.

`PUSH_REGISTRATION_ENCRYPTION_KEY` encrypts FIDs and keys their lookup hashes. Keep it stable across instances and restarts. The existing JWT secret is the fallback if this setting is absent. Changing the encryption key requires users to re-enable browser notifications; old encrypted registrations cannot be reused. Do not rotate it as part of routine JWT rotation.

For **both** `frontend` and `admin`, configure the public web settings from the project's Firebase web app:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=<Firebase web API key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ancient-trails-e598a.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ancient-trails-e598a
NEXT_PUBLIC_FIREBASE_APP_ID=<Firebase web app ID>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<Firebase project number>
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BLZ8YsuZ1vE9jX3SjaqkRclVi0lmROBesIhUqjvSTjby9fx444hrSHVvgJvKTEBcI083pzoewIe25oUwYIieBWw
```

The sender ID falls back to the project-number component of `APP_ID`. Public Firebase configuration and the VAPID public key are safe in browser bundles. Verify that the supplied VAPID key belongs to this project's Cloud Messaging Web Push certificate. Configure permitted production origins/referrer restrictions in Firebase/Google Cloud as appropriate. Rebuild/restart both Next applications after changing public environment values.

Enable Firebase Cloud Messaging, the FCM Registration API (`fcmregistrations.googleapis.com`), and the Firebase Installations API for the project. If the public API key has API restrictions, allow these registration/installation services as well as the existing authentication services. Production browsers require HTTPS; localhost works during development. Keep the root `/firebase-messaging-sw.js` route publicly accessible with JavaScript content type and no authentication redirect. It registers with scope `/` and has no fetch interceptor. Do not install a second root-scope service worker without integrating these handlers.

The installed Firebase JS SDK 12.16 and Admin SDK 14.2 support FID delivery: the browser uses `onRegistered` + `register`, and the backend sends `{ fid }`. This integration does not mix the new registration API with deprecated `getToken` registrations.

Official references: [web registration](https://firebase.google.com/docs/cloud-messaging/web/get-started), [receiving web messages](https://firebase.google.com/docs/cloud-messaging/js/receive), [Admin SDK setup](https://firebase.google.com/docs/admin/setup), [delivery error codes](https://firebase.google.com/docs/cloud-messaging/error-codes).

## User experience

The real notification bell appears in the common admin shell (desktop and mobile) and customer account top bar. It supports unread counts, unread filtering, pagination, individual read/unread changes, marking all read, timestamps, and links to relevant records. Cancellation/refund updates have an authenticated customer detail page so they remain readable even when a cancelled booking is excluded from the existing active-booking view.

Users explicitly click **Enable browser notifications** inside the panel. Loading a page does not request permission. Previously opted-in browsers can refresh their registration without a prompt. Multiple browsers can register independently. Foreground messages silently refresh the inbox; the service worker shows background messages. Push previews use a generic body instead of exposing payment details on a lock screen.

Signing out disables that browser binding, clears the worker binding and notifications, and unregisters FCM. Delayed messages and clicks require the current account binding. A browser capability is required to move an existing FID between accounts. Browser identifiers are encrypted at rest and omitted from ordinary responses.

## Business events

Admin inbox: new registered traveller, confirmed booking, advance payment, full payment, cancellation, verified refund, and an offline submission awaiting verification.

Customer inbox: booking confirmation, advance payment, seven-day remaining-payment reminder, full payment, cancellation, verified refund, and important booked-tour updates. Recipients resolve through the registered, verified **lead traveller's phone** and are pinned to that user ID. Editable booking emails alone do not confer inbox ownership. Unregistered contacts continue receiving existing email/WhatsApp messages but do not get a customer inbox.

Online payments use the existing verified checkout/webhook paths; bank transfers use verified Smart Collect credits; offline confirmations follow the existing admin verification path. Merely choosing a payment method or generating bank details does not count as payment. Fare edits reuse the same receipt event key and cannot resend payment notices.

For refunds, enable `refund.processed` on the existing Razorpay webhook endpoint. The signature is checked before enqueueing; the worker fetches the refund and associated payment with the existing Razorpay client, checks processed status, IDs, INR amounts, and booking association, then creates refund notices. Pending/failed refunds do not produce success notices. This feature does not initiate refunds or change the existing booking's financial ledger.

Reminders reuse `paymentLifecycleState`, including the India-calendar seven-day window, existing due-date fallback, balance checks and cancellation/full-payment exclusions. A reminder is sent once per booking/due-date, including catch-up within that seven-day window after downtime. The worker rechecks eligibility before creating a reminder and again before delivering a queued reminder push, so a later full payment or due-date change suppresses stale push messages.

Tour/itinerary/date/status edits enqueue important updates only for customers with confirmed, paid bookings of that tour/departure. Completed trips with known past dates and bookings created after an update are excluded. Seat availability changes from ordinary bookings do not trigger tour updates. Admins can also use **Notifications → Send an important tour update** to compose a targeted message. Submission IDs make retries idempotent.

## Reliability and operations

- `Notification`: one immutable event/recipient/audience inbox entry, with separate read state.
- `PushRegistration`: encrypted per-browser FID, keyed hashes, owner/audience, account binding, activity and last-seen time. Up to 50 active browsers per user/audience; registrations inactive for 90 days are excluded from fanout.
- `NotificationEvent`: durable source outbox, atomic leases, attempts, backoff, terminal failures.
- `PushDelivery`: unique notification/device/binding delivery jobs, with the same lease/retry protection.
- `NotificationCursor`: deployment activation, durable reconciliation checkpoints and tour-content fingerprints.

The backend checks for work every 15 seconds and reconciles sources approximately every minute. Deferred hooks never await Firebase in a booking/payment response. Reconciliation recovers source commits missed by a restart and replays a 15-minute overlap around the durable checkpoint to catch transactions that commit after another record advances that checkpoint. Existing historical registrations/payments are not replayed on first deployment; upcoming eligible balance reminders still work. Run the backend continuously for reminders to be timely. Multiple backend instances share database claims; jobs have a two-minute renewable lease.

Transport is at-least-once. Mongo unique identifiers prevent duplicate inbox/job entries; browser notification tags and a bounded seen cache collapse repeated deliveries. Temporary errors retry with at least a one-minute exponential delay plus jitter, up to ten attempts. Only explicit invalid-registration errors deactivate a device; credentials, permission, quota, malformed-payload and transient server errors do not erase registrations. Inbox delivery works without Firebase credentials; push jobs retry until credentials are configured or the attempt limit is reached.

Monitor `notificationevents` and `pushdeliveries` for `status: "failed"` and their sanitized `error` codes. An authenticated admin can retry terminal failures using:

```http
POST /api/notifications/admin/retry-failed
Authorization: Bearer <admin JWT>
```

Do this after fixing credentials/configuration or provider errors. Restart the backend after adding credentials. Do not log request bodies for `/registrations`, private identifiers, bearer tokens, or provider credential objects.

## Authenticated API

All endpoints are under `/api/notifications/:audience`, where audience is `admin` or `customer`. Every request verifies the JWT and current MongoDB user status/roles. Inbox queries and changes always constrain both recipient and audience; a client cannot select another recipient.

| Method | Suffix | Purpose |
| --- | --- | --- |
| GET | `/` | Inbox; `limit` (1–50), `cursor`, `unreadOnly=true` |
| GET | `/:id` | Own notification details |
| PATCH | `/:id/read` | `{ "read": true/false }` |
| PATCH | `/read-all` | Mark the current recipient's existing notices read |
| POST | `/registrations` | `{ "fid": "...", "deviceKey": "64 hex characters" }` |
| DELETE | `/registrations` | Disable this browser, using its `deviceKey` |
| POST | `/tour-updates` | Admin only: `tourId`, optional `departureId`, `title`, `body`, UUID `requestId` |
| POST | `/retry-failed` | Admin only: retry terminal background failures |

## Verification

Run `npm test` in `backend`, `npm run test:notifications` in `admin` (exercises both browser clients), and type checks/lint in both Next applications. Notification tests cover encryption/tampering, ownership/roles, multi-device deduplication, payment/reminder policy, refund signature/provider verification, FID targeting, invalid registrations, retries and worker account-binding behavior.

For a live smoke test after configuring credentials: sign in as an admin and a verified registered traveller in separate browser profiles; enable browser notifications in each panel; create a sandbox booking and complete a verified payment; check inbox and unread/read behavior, then background delivery. Replay the webhook to confirm no duplicate inbox entries. Sign out before a queued delivery to verify it is suppressed. Use Razorpay test mode for refund checks; never create real charges solely to test push.
