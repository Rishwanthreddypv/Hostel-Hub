# API reference

Base: `/api`. JSON requests use `Content-Type: application/json` and `X-HostelHub-Client: web`. Session cookie `hh_session` is HttpOnly. The browser client includes credentials. Errors return `{ "error": "message" }` with 400, 401, 403, 404, 409, 429 or 503 as appropriate. Property uploads use multipart field `file`; account identity uploads use `document`. Both require the custom client header.

| Method | Route                                      | Access / purpose                                                                                                               |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/health`, `/config`                       | Public health, demo/assistant configuration                                                                                    |
| GET    | `/auth/me`                                 | Optional current user                                                                                                          |
| POST   | `/auth/register`                           | Public multipart; name, email, password, role=user/owner, document_type, consent=true and required private identity `document` |
| POST   | `/auth/verification/resubmit`              | Public multipart with email/password; replaces a rejected or pending identity document                                         |
| POST   | `/auth/login`                              | Public; email, password                                                                                                        |
| POST   | `/auth/logout`                             | Signed in; revokes tokens                                                                                                      |
| PATCH  | `/profile`                                 | Own name, phone, bio                                                                                                           |
| POST   | `/profile/password`                        | Own current/new password                                                                                                       |
| GET    | `/hostels`                                 | Public approved listings; q, gender, budget, facilities, rating, sharing, ac, sort, start/end, lat/lng/distance                |
| GET    | `/hostels/:id`                             | Public approved detail; owner/admin can inspect unpublished listings                                                           |
| GET    | `/wishlist`                                | Own saved hostel IDs                                                                                                           |
| POST   | `/wishlist/:id`                            | Toggle own saved hostel                                                                                                        |
| POST   | `/bookings`                                | Guest; room_id, start_date, end_date, quantity (1–4), guest_note                                                               |
| GET    | `/bookings`                                | Own bookings / bookings on owned properties / all for admin                                                                    |
| GET    | `/bookings/:id`                            | Same ownership scope; booking details, permitted actions, refund quote and timeline                                            |
| POST   | `/bookings/:id/pay`                        | Legacy bookings only; outcome=success/failure, demo only                                                                       |
| POST   | `/bookings/:id/payment-attempts`           | Booking guest; method=upi/card/netbanking, outcome=success/failure, idempotency_key=UUID; demo only                            |
| POST   | `/payment-attempts/:id/complete`           | Booking guest; finalize or retrieve an existing attempt; demo only                                                             |
| GET    | `/bookings/:id/receipt`                    | Booking guest, property owner or admin; downloadable HTML receipt                                                              |
| GET    | `/payments`                                | Role-scoped payment ledger                                                                                                     |
| GET    | `/portfolio`                               | Owner/admin; optional hostel_id, scoped property operations and collections                                                    |
| POST   | `/bookings/:id/action`                     | Guest cancel; owner approve/reject/complete; admin refund                                                                      |
| POST   | `/reviews`                                 | Guest; booking_id, rating 1–5, body; eligible stay only                                                                        |
| POST   | `/uploads/photo`                           | Owner; image upload                                                                                                            |
| GET    | `/owner/hostels`                           | Owner’s full listing inventory                                                                                                 |
| POST   | `/owner/hostels`                           | Owner; hostel details and at least one room type                                                                               |
| PATCH  | `/owner/hostels/:id`                       | Owner; saves material edits as draft                                                                                           |
| POST   | `/owner/hostels/:id/rooms`                 | Owner; new room type                                                                                                           |
| PATCH  | `/owner/rooms/:id`                         | Owner; name, sharing, rent, capacity, ac                                                                                       |
| POST   | `/owner/hostels/:id/documents`             | Owner; private PDF/image upload                                                                                                |
| GET    | `/documents/:id`                           | Document owner or admin; private download                                                                                      |
| POST   | `/owner/hostels/:id/submit`                | Owner; requires documents and photos                                                                                           |
| GET    | `/owner/subscription-attempts`             | Owner; recent simulated Advanced checkout attempts                                                                             |
| POST   | `/owner/subscription-attempts`             | Owner; start Advanced checkout with method, outcome and idempotency key                                                        |
| POST   | `/subscription-attempts/:id/complete`      | Owner; complete/retrieve the simulated checkout attempt                                                                        |
| POST   | `/owner/subscription`                      | Owner; downgrade to Basic while preserving existing data                                                                       |
| GET    | `/subscription-payments/:id/receipt`       | Payment owner or admin; downloadable demo plan receipt                                                                         |
| GET    | `/dashboard`                               | Owner-scoped or admin aggregates, payment activity and management data                                                         |
| GET    | `/notifications`                           | Own notifications                                                                                                              |
| POST   | `/notifications/read`                      | Mark own notifications read                                                                                                    |
| GET    | `/messages`                                | Conversations where current user participates                                                                                  |
| POST   | `/messages`                                | hostel_id, body; owners include recipient_id to reply                                                                          |
| GET    | `/complaints`                              | Own requests / all for admin                                                                                                   |
| POST   | `/complaints`                              | subject, body, optional owned booking_id                                                                                       |
| POST   | `/admin/hostels/:id/review`                | Admin; status=approved/rejected and note                                                                                       |
| GET    | `/identity-verifications/:id/document`     | Admin-only private identity-document download                                                                                  |
| POST   | `/admin/identity-verifications/:id/review` | Admin; approves/rejects a pending account with required note                                                                   |
| POST   | `/admin/users/:id/status`                  | Admin; active/suspended; protects admin accounts                                                                               |
| POST   | `/admin/reviews/:id`                       | Admin; published/hidden                                                                                                        |
| POST   | `/admin/complaints/:id`                    | Admin; resolution, marks resolved and notifies                                                                                 |
| GET    | `/reports/bookings.csv`                    | Advanced-owner-scoped or admin CSV export                                                                                      |
| POST   | `/assistant`                               | Public; message; returns answer, hostel shortlist, mode                                                                        |

## Account verification

Registration accepts JPEG, PNG or PDF identity documents up to 5 MB, validates the file signature and creates `users.status=pending_verification` without issuing a session. Admin approval changes the account to `active`; rejection changes it to `rejected`. Login returns the pending or rejection explanation instead of a cookie. A rejected applicant can authenticate to the resubmission endpoint with the same email/password, replace the file and return to the pending queue. Existing seeded accounts remain active demo accounts.

## Booking decisions

New bookings use `flow_version=2`: unpaid `pending_owner` for 24 hours, then owner approval creates `awaiting_payment` for a fresh 24 hours. Successful demo payment produces `confirmed`. Both unpaid states expire and release capacity. Rejection produces `rejected` without a refund. Existing version-1 bookings retain their original payment-before-approval workflow.

`GET /bookings` returns `{bookings, server_time}`. Each booking includes `allowed_actions`, payment status/reference, `review_id`, quantity, price components and a `cancellation` quote (`amount`, `explanation`) when available. Unpaid expired reservations have status `expired` and no permitted actions. `GET /bookings/:id` returns `{booking, events, attempts, server_time}`; unrelated accounts receive 404. Event notes are shared with the booking guest, property owner and administrators.

Payment attempts remain `processing` for at least 1.5 seconds. Completion is idempotent and checks authorization, the current booking state and deadline again inside a transaction. Failures can be retried with a new UUID; reusing a UUID with a different payload is rejected. The ledger contains successful payments and processed refund amounts, while attempts capture failures separately. No money is transferred.

`POST /bookings/:id/action` accepts `action`, optional `reason` (trimmed, maximum 1,000 characters), `expected_status` and `expected_refund_amount` (integer INR). Rejection requires a reason of at least five characters. The UI fetches current details before confirmation and sends status/refund preconditions. A stale precondition returns 409 and rolls back all writes. Existing clients may omit preconditions; authorization, state transitions and server-calculated amounts still apply. Version-2 requests cannot be approved after their move-in date has passed. Unpaid cancellation creates no refund; paid cancellation uses the server-calculated policy.

`GET /dashboard` adds `booking_requests`, `stays_to_complete`, `pending_refunds` and `refund_total` to `stats`, scoped to the owner's properties or all properties for admins. Dates and cancellation policy boundaries use UTC calendar dates.

## Listing payload

`name, city, area, address, description, gender, facilities[], photos[], deposit, discount, latitude, longitude, nearby, check_in, check_out, contact, refund_policy, min_stay_days, food_charge, service_charge, tax_percent`. Creation also requires `rooms[]`, each with `name, sharing` (1–4), `rent` (monthly INR per bed), `capacity` (beds), `ac` (boolean). Uploaded image URLs are returned by `/uploads/photo`.

Version-2 checkout snapshots discounted first-month rent, deposit, monthly food/services and tax for the selected bed quantity. It does not charge the entire stay in advance or automatically collect subsequent months. Charges are calculated on the server in integer INR.

Queries return complete small local datasets; cursor pagination and bulk reporting should be added for a large deployment.
