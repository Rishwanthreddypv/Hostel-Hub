# Requirements traceability

Sources: supplied `full stack (3).pptx` (6 slides), handwritten role/workflow sketch, and the user’s expanded feature list. Content in the deck was treated as project material, not as instructions to the assistant. The user selected **Local app with demo payments and setup guide**.

| Requirement | Implementation / qualification |
| --- | --- |
| User, owner, admin | Three roles with server authorization and role-specific navigation |
| Register/login/profile | Working cookies/JWT/bcrypt, profile editor, password change |
| Search/place/filter/photos/details | Working database search, galleries and all listed basic filters |
| Budget, gender, AC, food, Wi-Fi, distance, rating, sharing | Supported; distance uses supplied coordinates |
| Wishlist, history, cancellation | Persisted per account |
| Map and compare | Leaflet/OpenStreetMap, Google Maps link, three-home comparison |
| Call/chat owner | Phone links and persisted in-app messages/replies |
| Ratings/reviews/moderation | Eligible booking check, unique review per stay, admin hide/restore |
| Room availability | Date overlap and transactional peak-capacity check, expiring holds |
| Owner details/photos/facilities/pricing | Full create/edit, uploaded local images, room editor, discount percentage |
| Room types | Single/double/triple/four sharing, monthly rent, total beds and AC |
| Independent owner accounts | Forty seeded owners, independent portfolios and server-enforced ownership; Advanced owners may manage multiple properties |
| Realistic editable seed data | Eighteen CSV files: 40 owners, 60 guests, 44 properties, 176 room types, 480 bookings and related history; validation and safe repeat imports |
| Monthly booking costs | First-month rent, deposit, food/services, discount and tax; bed quantity and property minimum stay |
| Booking approval/rejection | Action queues, required rejection reasons, protected history, refund previews and stale-decision checks |
| Revenue and notifications | Net demo booking revenue and payment ledger; in-app polling |
| Document verification | Private upload → submission → admin review → publication |
| Admin users/owners | Active/suspended controls; suspension revokes sessions and hides owner's listings |
| Reports/analytics/complaints/refunds | Dashboard totals, CSV bookings, support resolutions, demo refund processing |
| Hostel information | All named descriptive fields; availability from room reservations |
| Refund policies | Consistent enforced platform cancellation rules plus visible additional house policy |
| User → request → owner approval → payment → confirmation | Complete demo flow, 24-hour request/payment deadlines, idempotent processing, decline/retry and downloadable receipts |
| Subscription plans | Basic and Advanced only; enforced quotas and capabilities, simulated ₹999 checkout, failure/retry, receipt, downgrade preservation and admin history |
| AI chatbot | Functional local search/help; optional provider adapter, not live-tested |
| Unlimited photos | Bounded local implementation: 8 MB/file, 200 references/listing |
| High visibility | Searchable approved listings; no external SEO ranking guarantee |
| Email/SMS from diagram | Not connected; in-app equivalents work |
| MySQL | Active runtime adapter, migration and seed workflow verified end to end |
| Razorpay | Not connected; user-selected demo payment mode works end to end |

## Validation

- TypeScript validation and Vite production build.
- 26 automated workflow/import tests, including concurrency, authorization, verification, payments/refunds, private history, stale decisions, expiry, review moderation, CSV relations, import rollback, preservation of live edits and persistence.
- Playwright browser flow: search, registration, booking request, owner approval and isolation, failed card payment, UPI retry, receipt download, history, cancellation, admin refund/import history, filtered payment ledger and mobile layouts.
- Desktop and mobile screenshots are produced in `test-results/` for visual review.

Live payment processing, externally delivered notifications, recurring subscriptions and production deployment are separate integration work. The application does not silently substitute fake external success for those services.
