# Hostel Hub

A working local full-stack college-project application for discovering and booking hostels and PGs, with guest, owner and administrator workspaces. Built from the supplied presentation, notebook photo and feature list.

**Payments and provider subscriptions are simulations. The seeded properties, addresses, verification badges and account details are demonstration data. No real bookings or charges occur.**

## Run on this computer

The project is at `C:\FSD\hostel-hub`. Node **24+** is required (the backend uses Node's built-in SQLite driver). This computer has both Node 20 and Node 24; the launcher selects a suitable runtime automatically.

```powershell
cd C:\FSD\hostel-hub
.\Start-HostelHub.ps1
```

On Windows, you can also double-click `Start-HostelHub.cmd`. This launcher works
when PowerShell's script execution policy blocks direct `.ps1` execution and
keeps the window open when startup fails.

Open **http://localhost:4000**. Keep the terminal running; Ctrl+C stops the server. If a server is already running on port 4000, open that URL instead of launching another instance.

For development with hot reload:

```powershell
.\Start-HostelHub.ps1 -Dev
```

Open **http://127.0.0.1:5173**. Frontend requests are proxied to the API on port 4000. Use one hostname consistently so browser cookies stay with the same origin.

## Portable setup

With Node 24+ selected in your terminal:

```sh
npm ci
npm run build
npm start
```

The first local start creates the schema and demo dataset automatically. No database installation or API credentials are required. Copy `.env.example` to `.env` only when you want to override defaults.

| Role         | Email                         | Password        |
| ------------ | ----------------------------- | --------------- |
| Guest        | `resident.001@hostelhub.test` | `HostelHub@123` |
| Hostel owner | `priya.raman@hostelhub.test`  | `HostelHub@123` |
| Admin        | `admin@hostelhub.test`        | `HostelHub@123` |

The sign-in page has Guest, Owner and Admin shortcuts and an independent-account selector. Each owner has a separate login and owns several properties; other owners cannot access their bookings, payments or documents. New guest and owner registrations require a private JPEG, PNG or PDF identity document and remain pending until an admin approves them. Rejected applicants can replace the document and resubmit. Public admin registration is unavailable. Existing demo accounts remain active.

The editable dataset contains **40 owners, 60 guests, 44 properties across several Indian cities, 176 room types and 480 bookings**, with related payment attempts, subscription payments, reviews, messages and history. All people and businesses are fictional. See the [CSV data guide](docs/CSV-DATA-GUIDE.md) for every file, account, validation rule and safe import command. Existing databases retain their earlier records alongside this dataset.

## Included workflows

- Search by city, neighbourhood, hostel or nearby institution; filter budget, gender, AC, facilities, rating, room sharing, dates and distance from supplied coordinates. Sort by price or rating.
- Photo galleries, facility lists, room types, deposits, discounts, check-in/out times, contact phone, nearby places and refund terms.
- Interactive OpenStreetMap locations, Google Maps links, saved homes and comparison of up to three listings.
- Registration with private identity upload, admin approval/rejection, rejected-document resubmission, login, editable profiles, password change, booking history, cancellations and reviews after an eligible stay.
- Request 1–4 beds, receive owner approval, then pay the first month and deposit within 24 hours. Simulated UPI/card/net-banking checkout includes processing, decline/retry, payment references and downloadable receipts. Inventory uses quantity-weighted peak occupancy and transactional capacity checks.
- Separate owner portfolios with property filters, residents, arrivals/departures, review and message summaries, gross collections, refunds and net collections. Admins can inspect CSV import history.
- Booking workspaces with attention/refund queues, property/status filters, guest or booking-ID search, sorting and payment-hold countdowns. Owner/admin dashboards link directly to pending work.
- Private booking timelines and payment references, required rejection reasons, optional cancellation notes, and exact refund previews checked again on submission. Lists refresh every 15 seconds while visible.
- Owner property editor, image uploads, room pricing/capacity, document upload, submission for admin verification, booking decisions, payment activity and CSV export.
- Admin account-identity and hostel-listing verification, approval/rejection, member suspension, review moderation, complaint resolution, refund processing, analytics, payment history and audit history.
- In-app guest/owner messages, notifications refreshed every 20 seconds, support requests and a database-backed local search assistant.
- Basic and Advanced plans with enforced property/photo limits, priority discovery, simulated upgrade checkout, downgrade preservation, receipts and an admin-visible subscription ledger.

## Try a complete booking

1. Sign in as Guest, open a published property belonging to Priya Raman, select a room, beds and dates meeting its minimum stay, then request a booking.
2. Sign out, sign in as Priya, open Booking requests and approve the request within 24 hours. Approval opens a fresh 24-hour payment window.
3. Sign back in as Guest and open checkout. Choose a method and **Decline payment to test retry**, then retry with **Approve payment**. No real credentials or money are involved.
4. Payment confirms the booking. Download its receipt; both accounts receive notifications.
5. Cancel it, review the exact refund amount and optionally leave a reason. Sign in as Admin, open the refund queue, and process the demo refund.
6. Open **Booking details & history** to see the payment, owner decision, cancellation note and refund. Existing bookings are preserved; decisions made before history tracking was added have no fabricated timeline entries.

To try account verification, register a new guest or owner with a fictional sample document, then sign in as Admin and open **Account verification**. Approve the account and use its new credentials to sign in. Rejecting the application exposes a replacement-document flow on the login page. To try listing verification, use an active Owner account to add a property, upload an illustrative photo and sample registration document, then submit. Never upload real identity documents into this demo.

## Persistence and backups

- SQLite database: `data/hostel-hub.sqlite` (with WAL/SHM companion files while running).
- Uploaded public photos: `uploads/`.
- Private account-identity and ownership documents: `uploads/private/`; inaccessible through the public upload route and downloadable only through authenticated, role-checked API endpoints.
- Stop the application before copying the complete `data/` and `uploads/` directories for a consistent local backup. Keep their access restricted. Restore while the application is stopped.
- CSV imports are transactional and idempotent. Managed profile/listing rows can receive CSV edits if unchanged in the application; live edits and existing booking/payment history are preserved. Tests use isolated databases. See the CSV guide before editing or importing.
- A generated development JWT secret changes on server restart. Set a private `JWT_SECRET` in `.env` to preserve sessions across restarts.

## MySQL 8

The backend includes a MySQL adapter using `mysql2`, prepared statements and transactions. SQLite is the tested default in this environment. **MySQL and Docker were not available here, so that deployment path has not been executed.**

Create a database and a restricted application user using your MySQL administration tool. Or install Docker and set `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD` privately in `.env`, then run:

```sh
docker compose up -d mysql
```

Configure:

```dotenv
DB_CLIENT=mysql
DATABASE_URL=mysql://hostelhub:YOUR_URL_ENCODED_PASSWORD@localhost:3306/hostel_hub
```

Start the app. Initial tables and additive migrations are applied automatically; local demo data is seeded only outside production. MySQL bookings lock the selected room row during capacity checks. Do not point automated SQLite tests at your live database. The initial schema lives in `server/db.js`, with compatibility migrations in `server/migrations.js`.

## Optional AI responses

With no key, `/api/assistant` parses a city, gender, food preference and simple budget, then searches actual approved inventory. It also explains bookings and cancellation. It is visibly labeled **Local search assistant**, rather than pretending to use an LLM.

To enable the optional provider adapter, put `AI_API_KEY`, `AI_API_URL`, and `AI_MODEL` in your private `.env` and restart. The default URL is the OpenAI Chat Completions API; choose a model available to your account. Keys stay on the server. Only the question and a small public listing shortlist are sent. The adapter has a 12-second timeout and falls back to local search on failure. It never books or charges on behalf of a visitor.

The adapter follows the [official Chat Completions API request/response contract](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create). The live provider path has not been tested with credentials.

## What is deliberately simulated or external

| Capability             | Delivered behavior                                                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payments/refunds       | Working demo ledger and booking transitions. No Razorpay money movement.                                                                                                                                          |
| Provider plans         | Basic is free with one property and eight photos. Advanced is a simulated ₹999 payment with ten properties, 200 photos, priority discovery, detailed analytics, booking exports and offers. No automatic renewal. |
| AI assistant           | Working local inventory search; optional generative adapter needs credentials and provider testing.                                                                                                               |
| Maps                   | OpenStreetMap tiles need internet. Google Maps opens an external location link; no paid Maps API key needed.                                                                                                      |
| Notifications/messages | Stored in-app and polled periodically; SMTP email and SMS delivery are not connected.                                                                                                                             |
| Verification           | Admin document-review workflow. Seeded verification is illustrative, not an assertion about real businesses.                                                                                                      |
| Photos                 | Local file uploads, up to 8 MB each and 200 references per listing. This is a bounded local gallery, not literally unlimited storage.                                                                             |
| Search visibility      | Local search and listing pages; no guarantee of external search-engine rankings.                                                                                                                                  |

Live Razorpay support requires server-side order creation, signature verification, captured-payment webhook reconciliation, idempotent refunds, sandbox testing and merchant credentials. The [official Razorpay integration guide](https://razorpay.com/docs/payments/server-integration/nodejs/) describes that separate integration. Setting `DEMO_MODE=false` disables payment and subscription simulation; it does **not** activate real payments.

## Tests and project structure

```sh
npm run build     # TypeScript validation and production frontend bundle
npm test          # 26 workflow/import tests, isolated SQLite databases
npm run test:browser # Headless Edge, isolated demo server, desktop/mobile screenshots
npm run db:validate # Validate all editable seed CSV files without importing
npm run db:seed    # Apply CSV edits while preserving live changes
npm run db:fresh -- fresh-demo.sqlite # Create a separate database; never overwrite
npm run format    # Consistent source formatting
```

Browser QA requires installed Microsoft Edge, or adjust its Playwright channel in `scripts/browser-qa.mjs`. It uses temporary data, with no external account or payment. Screenshots are written to ignored `test-results/`.

```
src/               React + TypeScript interface and responsive styles
server/app.js      Validated Express API, auth and business workflows
server/db.js       SQLite/MySQL schema and transaction adapter
server/seed.js     Demo account bootstrap and first-start CSV import
server/seed-import.js  Validated, transactional, conflict-aware CSV import
server/payments.js Payment attempts, finalization and receipts
server/portfolio.js Owner/admin operational summaries
seed-data/        Editable CSV source files and dataset manifest
server/create-admin.js  Controlled administrator bootstrap
tests/            API integration and concurrency tests
scripts/          Browser QA, asset downloaders
public/           Bundled illustrative photographs and licensed fonts
docs/             Architecture, requirements traceability, API and assets
```

Read [architecture and ER diagram](docs/ARCHITECTURE.md), [API reference](docs/API.md), [requirements status](docs/REQUIREMENTS.md) and [asset attribution](docs/ASSETS.md).

## Before a public launch

This delivery is the requested local demonstration. It has not been deployed publicly or certified as production-ready. Production startup requires a private `JWT_SECRET` of at least 32 characters, disables demo seeding and payments, and uses secure cookies requiring HTTPS. A Dockerfile is included as a starting point; set `HOST=0.0.0.0` only where you intentionally want network access.

Create an administrator with private `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment values, then run `node server/create-admin.js`. Remove the bootstrap password from the environment afterward. Do not reuse the public demo accounts in a public deployment.

Before serving real residents, complete real payment/webhook integration, notification delivery, email verification/password recovery, upload scanning, retention/backup controls, operational monitoring, scalable session/rate-limit storage and a security review. The current local filesystem and per-process request serialization are intended for one local app instance.
