# Realistic local dataset

The CSV files in `seed-data/` are editable source data for this local application. They describe fictional people and properties in real Indian neighbourhoods. Coordinates identify approximate neighbourhoods, photographs are illustrative, reviews are synthetic, and every payment is a simulation. Phone numbers are left blank instead of inventing callable numbers. Account emails use the reserved `.test` domain.

## Included records

| CSV | Rows | Purpose |
| --- | ---: | --- |
| owners.csv | 10 | Separate owner accounts with 2–3 properties each |
| guests.csv | 60 | Resident accounts and profiles |
| hostels.csv | 24 | Properties across Chennai, Bengaluru, Hyderabad, Pune and Coimbatore |
| rooms.csv | 96 | Single, twin, triple and four-sharing room types |
| hostel_photos.csv | 72 | Ordered local image references |
| hostel_amenities.csv | 136 | One amenity per property per row |
| documents.csv | 23 | Fictional property declarations for the review workflow |
| bookings.csv | 240 | Historical stays, residents, future stays, requests and cancellations |
| payment_attempts.csv | 271 | Successful and declined demo attempts |
| payments.csv | 188 | One successful payment per paid booking, including processed refunds |
| booking_events.csv | 867 | Actor, timestamp and decision history |
| reviews.csv | 100 | Reviews connected to completed stays |
| messages.csv | 160 | Guest/owner conversations |
| notifications.csv | 490 | Booking and portfolio updates |
| complaints.csv | 20 | Open and resolved resident requests |
| audit_log.csv | 344 | Recorded booking decisions |
| wishlist.csv | 60 | Saved property references |

There are 20 published listings, two pending review, one draft and one rejected. Published properties cover all five cities. Data uses stable IDs prefixed with `csv-` so it can coexist with earlier demo records. Existing records are not deleted or reassigned. The database may therefore contain more properties and accounts than the CSV totals.

## Sign in

All generated accounts initially use `HostelHub@123`, unless `DEMO_SEED_PASSWORD` is configured before their first import. Passwords are hashed when accounts are created and are never stored in the CSV files. Later imports never reset passwords. Demo shortcut buttons assume the default password; use the ordinary sign-in form if you changed it.

| Owner | Email |
| --- | --- |
| Priya Raman | priya.raman@hostelhub.test |
| Arjun Menon | arjun.menon@hostelhub.test |
| Kavitha Narayanan | kavitha.narayanan@hostelhub.test |
| Rohan Deshmukh | rohan.deshmukh@hostelhub.test |
| Nandini Rao | nandini.rao@hostelhub.test |
| Vikram Iyer | vikram.iyer@hostelhub.test |
| Meera Shah | meera.shah@hostelhub.test |
| Sanjay Reddy | sanjay.reddy@hostelhub.test |
| Ananya Krishnan | ananya.krishnan@hostelhub.test |
| Farhan Ahmed | farhan.ahmed@hostelhub.test |

Guests use `resident.001@hostelhub.test` through `resident.060@hostelhub.test`. The last guest account is suspended to exercise account restrictions. Admin uses `admin@hostelhub.test`. The original `user@hostelhub.test` and `owner@hostelhub.test` accounts remain available. Guest and Owner shortcuts select the first populated CSV personas. The login page includes a selector for independent owner accounts.

## Edit and import

Use Node 24 or newer. On this computer, the explicit runtime is `C:\Program Files\nodejs\node.exe`.

```powershell
cd C:\FSD\hostel-hub
& 'C:\Program Files\nodejs\node.exe' scripts/seed-cli.mjs --validate
& 'C:\Program Files\nodejs\node.exe' server/seed.js
```

With Node 24 on PATH, the equivalents are `npm run db:validate` and `npm run db:seed`. Stop the app before importing to avoid competing SQLite connections and create a backup of `data/` and `uploads/` first. Startup imports the dataset once; subsequent startups leave it alone. Later source edits require the explicit import command.

CSV uses UTF-8, a header row and standard double-quote escaping. Spreadsheet editors should import ID, email, timestamp and date columns as text. Monetary values are whole INR, without symbols or commas. Boolean fields use 0 or 1. Each ID stays stable when editing an existing row. Never rename a referenced ID without updating all dependent files.

The importer checks headers, duplicate identifiers/emails, enum values, foreign references, dates, prices, totals, review eligibility and overlapping bed capacity. Errors identify the file and record row. Database writes run inside a single transaction. A failed import rolls back its data writes and records the failure in `seed_imports`; generated sample declaration files may remain and are harmless. The admin portfolio displays recent success/failure summaries.

On repeated imports, unchanged rows are skipped. Managed owner, guest, property and document fields can update if they have not been edited in the app. Room types with active bookings are preserved. Financial records and activity history are insert-only after their first import; revised historical scenarios belong in a fresh database. Rows changed in the application are preserved and listed in the command summary. Removing a CSV row does not delete database data. Existing email conflicts cause the whole import to roll back rather than merging account identities.

## File relationships and fields

Each file's header is its exact schema. The validator rejects missing or extra columns.

| Relationship | Fields |
| --- | --- |
| Account → property | `hostels.owner_id` references `owners.id` |
| Property → inventory | `rooms.hostel_id` references `hostels.id` |
| Guest → booking | `bookings.user_id` references `guests.id` |
| Booking → property/room | `bookings.hostel_id`, `bookings.room_id` must describe the same property |
| Booking → finance/history | `booking_id` in attempts, payments, events, reviews and complaints |
| Photos/amenities/documents | `hostel_id` references a property |
| Conversation | `sender_id` and `recipient_id`; one must be the property's owner |

`rooms.capacity` is the number of beds available across that room type, not the number of physical rooms. `sharing` is occupants per physical room (1–4). `rent` is monthly rent per bed. Property deposit, food and service charges are also per bed. Booking quantity is 1–4 beds. Booking amounts are snapshots and must reconcile: `total = rent + deposit + food_charge + service_charge + tax_amount`. `rent` already includes the discount. The seed has zero configured tax; the tax field is a configurable demo calculation, not a tax determination.

New bookings use `flow_version=2`. The source represents the first month plus deposit, not full-stay prepayment. Later monthly charges are displayed but are not automatically collected. A refund never exceeds the amount actually paid. Do not add payments to unpaid, rejected or expired requests. Reviews must reference the same guest/property as an eligible stay.

Photo paths reference bundled `/images/*.jpg` assets. Private sample declarations are generated as clearly labelled text files under `uploads/private/`. For real owner testing, use the existing authenticated image/PDF upload workflow. The synthetic importer does not load identity documents or real payment credentials.

## Dates and fresh scenarios

`manifest.json` records the CSV reference date. On the first successful import into a database, timestamps and stay dates shift together to that import's UTC date. The chosen date is stored and reused on later imports, so repeat imports cannot move existing bookings forward in time. Requests naturally expire after their deadline. Use a fresh database to get a new set of current requests later.

```powershell
& 'C:\Program Files\nodejs\node.exe' scripts/seed-cli.mjs --fresh realistic-demo-2.sqlite
```

This creates a new database under `data/` and refuses to overwrite an existing file. Set `DATABASE_PATH=./data/realistic-demo-2.sqlite` in your private `.env` and restart to switch. The previous database remains recoverable. This replaces a destructive reset with an explicit fresh-dataset workflow.

`scripts/build-seed-csv.mjs` generated the initial files. Normal editing is done in the CSVs. Regeneration requires `--replace-generated` and overwrites those source CSVs, so use it only when you intend to discard source edits. Synthetic imports are disabled in production.
