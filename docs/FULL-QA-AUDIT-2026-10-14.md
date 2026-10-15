# Hostel Hub full QA audit — 14 October 2026

## Result

The application was tested end to end against the configured `hostel_hub` MySQL database. CSV files were used only as seed input. Runtime registration, profiles, listings, rooms, bookings, payments, messages, reviews, complaints, notifications, subscription changes and administration were read from and written to MySQL.

The earlier subscription inconsistency was fixed with one shared Basic/Advanced plan catalogue. All tested workflows passed. All temporary QA accounts, properties, bookings, plan attempts and uploaded test files were removed after testing, leaving the seeded MySQL dataset intact.

## Evidence summary

| Test group | Result | Coverage |
|---|---:|---|
| Live MySQL API audit | 147 passed, 0 failed | Authentication, authorization, all roles, listings, enforced plans, rooms, documents, booking state machine, capacity, payments, refunds, reviews, messages, complaints, notifications, reports and suspension |
| Live browser journey | 38 passed, 0 failed | Guest registration through admin refund, plus failed/successful Advanced checkout, plan receipt, downgrade and responsive role dashboards |
| UI surface audit | 31 passed, 0 failed | Compare limit/table, map switch, Google Maps link and all guest/owner/admin routes |
| Automated regression | 27 passed, 0 failed | Unit/integration workflows with isolated SQLite test databases |
| MySQL integrity audit | 26 passed, 0 failed | Hashing, uniqueness, plan/payment values, relations, amounts, statuses, InnoDB and foreign keys |
| Production build | Passed with warning | TypeScript and Vite production bundle |
| Restart persistence | Passed | MySQL counts and QA records survived a server restart; the seed import was not repeated |

Detailed machine-readable results are written locally under `test-results/`.

## Functional coverage

### Public discovery

- Home page, listing detail, photos, facilities, nearby places and owner details
- Search by city/text, budget, gender, AC, food, Wi-Fi, distance, rating, sharing and availability dates
- Sorting, list/map switch, OpenStreetMap rendering and external Google Maps link
- Wishlist isolation, comparison table, removal and the three-property comparison limit
- Local inventory assistant and its demo disclosure

### Authentication and user account

- Registration, login, logout, duplicate registration and invalid credentials
- Admin self-registration rejection and role-based route/API protection
- Profile update, password change, old-token revocation and account suspension/reactivation
- CSRF client-header/origin checks and protected-route redirects
- Multiple independent users with isolated bookings, wishlist, messages and receipts

### Owner workflow

- Separate owner logins and independent portfolios
- Multiple properties under one eligible owner account
- Create/edit listing, add/edit room type, capacities, pricing, charges, discounts and availability
- Image count rules, document upload MIME validation and private document access
- Submission, admin verification, approval/publication and re-review after material edits
- Booking approval/rejection, owner-scoped messages, booking lists, payments, reports and notifications
- Basic and Advanced quotas, Advanced checkout/retry/receipt, downgrade preservation, priority discovery and Advanced-only reports/analytics/offers
- Cross-owner attempts to read or change another portfolio returned the expected denial/not-found result

### Booking and demo payment

- Minimum stay, room sharing, quantity and server-side price calculation
- Quantity-weighted capacity, date overlap and transactional inventory checks
- Owner approval gate before payment and fresh payment expiry window
- Card failure, retry with net banking, processing state and successful confirmation
- Idempotency, one final payment per booking, references, ledgers and downloadable receipts
- Cancellation quote, cancellation, refund queue, admin refund and duplicate-refund prevention
- Rejected and expired unpaid bookings, stale action/quote rejection and booking event history

### Reviews, communication and support

- Review eligibility after a completed stay, duplicate prevention and admin moderation
- Guest/owner messaging permissions and conversation isolation
- Complaint creation, admin handling and resolution
- Role-scoped notifications and read state

### Administration and data

- User and owner management, listing approval/rejection and private verification documents
- Booking/refund/payment oversight, support moderation, reports, analytics and CSV exports
- CSV import history and dashboard responses without password hashes
- Seed import repeatability and preservation of live edits
- MySQL foreign keys, orphan checks, hash checks and financial consistency checks

## Resolved defect

The former three-plan inconsistency is resolved. `server/plans.js` is now the shared catalogue used by API validation, listing and photo limits, discounts, search priority, analytics, report exports, frontend cards, seed validation and tests. The application exposes only Basic and Advanced. Existing data remains available after a downgrade, while Basic limits apply to future additions.

## Improvements found during testing

### Medium priority

1. **Prevent stale frontend builds.** `Start-HostelHub.ps1` builds only when `dist/index.html` is missing. After a pull that changes React code, the launcher can serve the old bundle. Build on source changes, always build for the normal launcher, or separate explicit development and production-start commands.
2. **Add pagination before larger datasets.** Current list/report APIs return complete local datasets. This works for the seeded project but will slow down as users, bookings, messages and audit records grow.
3. **Split the frontend bundle.** Vite reports a chunk-size warning. Lazy-load role dashboards, checkout, maps and administrative pages.

### Low priority

1. The MySQL process still prints Node's experimental SQLite warning because `node:sqlite` is imported unconditionally. Load the SQLite adapter only when SQLite is selected.
2. Add a versioned migration tool and backup/restore procedure before production use. The current additive migration helper is suitable for the college/demo scope but does not provide migration history or rollback.
3. Add email verification, forgotten-password recovery and optional stronger admin authentication if the application will accept real external users.
4. Move listing/document media to managed object storage with scanning, retention and backup if the app will be deployed beyond a single machine.

## Intentional demo boundaries

- Payment behavior is realistic but no money moves. A real launch needs a payment provider, signed webhooks, reconciliation and provider-side refunds.
- The assistant searches local inventory and clearly labels itself as a demo; it is not a hosted AI service.
- OpenStreetMap tiles require internet access, while listing/location data remains in MySQL.

## Database state after the audit

The cleanup restored the seeded core counts: 103 users, 44 hostels, 176 rooms, 480 bookings, 388 payments (376 booking payments and 12 realistic Advanced subscription payments), 200 reviews, 1,000 notifications and zero active subscription attempts. Three idempotent import history rows remain. Final integrity checks passed, and the application remains running at `http://localhost:4000`.
