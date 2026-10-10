# Hostel Hub — Task Report

Scope: the three requested tasks, performed against the **existing** codebase. No rebuild, no
restyling, no stack change, no file reorganisation.

Verified on: Windows / Node v22.23.2 (project declares `>=24`) / local MySQL 8.0.42.
Date of verification runs: 2026-10-10.

---

## 1. Summary

| Task | Status |
| --- | --- |
| 1. End-to-end testing | **Complete.** Existing app verified working frontend→backend. 1 real bug found and fixed. |
| 2. CSV/XSV storage → MySQL | **Complete.** `hostel_hub` on your MySQL 8.0.42 initialized (16 tables) and seeded from the 17 CSVs with exact row counts. See §4.5. |
| 3. Complete the subscription section | **Complete** for the agreed scope (ledger visibility fix only). See §5. |

Code files modified: **1** — `server/payments.js`.

---

## 2. Step 1 — Audit

### 2.1 Architecture as actually built

```
React 19 + TypeScript (Vite SPA)
      │  same-origin JSON + HttpOnly cookie, X-HostelHub-Client header
      ▼
Express 5 API  (server/app.js, Zod validation, JWT/bcrypt, Helmet, rate limiting)
      │
      ▼
server/db.js  ──►  SQLite  (default, node:sqlite)
              └─►  MySQL   (mysql2 adapter, DB_CLIENT=mysql + DATABASE_URL)
```

Supporting modules: `server/booking-workflow.js` (states, permissions, cancel quotes, history),
`server/payments.js` (payment attempts, receipts, ledger), `server/portfolio.js` (owner/admin
summaries), `server/migrations.js` (additive migrations), `server/seed-import.js` (CSV import).

### 2.2 Important correction: there is no CSV/XSV runtime storage

I searched the whole project before changing anything:

- **17 `.csv` files** live in `seed-data/`. They are **source/seed data** consumed by
  `server/seed-import.js` → imported into the database once on first start.
- **No `.xsv` files exist anywhere** in the project.
- The only CSV *written* at runtime is the download at `GET /api/reports/bookings.csv`
  (`server/app.js:1467`) — an export, not storage.
- `server/csv.js` is a parser/serialiser used only by the import pipeline.

**Conclusion:** the application already stores all data in a database. A "CSV → MySQL migration"
is therefore not the right description of the remaining work. The accurate description is:
*the MySQL half of the existing database layer has never been executed or verified.*
This report treats Task 2 that way.

### 2.3 What works (verified, not assumed)

| Check | Command / method | Result |
| --- | --- | --- |
| Dependency install | `npm ci` | 229 packages, 0 vulnerabilities (`EBADENGINE` warning only — Node 22 vs required 24) |
| Type-check + production bundle | `npm run build` | **Pass** — `tsc --noEmit` clean, Vite built `dist/` |
| Automated workflow/import tests | `npm test` | **26 / 26 pass** |
| API end-to-end over real HTTP (SQLite default) | 20-check script: search → register → book → owner approve → payment fail → retry → confirm → receipt → timeline → subscription → portfolio → admin refund → assistant → wishlist → suspension | **20 / 20 pass** |
| Frontend end-to-end in a real browser | `npm run test:browser` (headless Edge, desktop 1440px + mobile 390px) | **Pass** — no `pageerror`s, no mobile horizontal overflow |
| First-start schema + CSV import, then restart | started app on default SQLite twice | Pass — import runs once, second start leaves data alone |
| CSV dataset validation | `npm run db:validate` | 17 files, all relationships valid |

### 2.4 What fails — one real bug (fixed)

**B1 — Owner subscription charges were invisible in the owner payment ledger.**

- `GET /api/payments` (`server/payments.js`) scoped owners with `h.owner_id=?`, where `h` is
  reached through `bookings`. Subscription rows have `booking_id = NULL`, so they could never
  match and were always excluded.
- Measured live before the fix: owner `/payments` → **0** subscription rows; owner `/dashboard`
  → **7** (dashboard uses different SQL that *does* include them).
- The frontend `Payments` page (`src/portfolio.tsx:264`) calls `/payments` and even renders a
  `"Subscription"` label (`src/portfolio.tsx:345`) that could never appear.
- **Fix:** owner scope is now `(h.owner_id=? OR p.user_id=?)` with `[id, id]`, mirroring the
  dashboard. Admin and guest scopes are untouched.
- **Verified after fix:** owner `/payments` 0 → **7** subscription rows on SQLite, and
  subscription rows visible on the MySQL instance too. `npm test` still **26/26**.

No other defects were found. Nothing else was changed.

### 2.5 Could not be tested

| Item | Why |
| --- | --- |
| **Your MySQL 8 on `127.0.0.1:3306`** | No `.env` exists in the project and the `hostelhub` account rejects a passwordless login. See §4. |
| Optional AI provider adapter | Requires `AI_API_KEY`. Without it the app correctly runs its labelled **local** search assistant. |
| Email/SMS delivery, real card/UPI money movement, live Razorpay | Not connected by design — this build uses a simulated payment ledger. |

---

## 3. Step 2 — Files that needed changes

| File | Change | Why |
| --- | --- | --- |
| `server/payments.js` | Owner scope in `/api/payments` includes own subscription rows | B1 defect found in Task 1 / Task 3 |
| `.env` (project root) | **Not created** — needs your credentials | Task 2 config. Never hardcoded, never committed (`.gitignore` already lists `.env`) |
| `server/db.js`, `server/migrations.js`, `server/app.js` | **No change needed** | The MySQL path required no code fixes — see §4.2 |

No UI, styling, schema, stack or file-layout changes. `seed-data/*.csv` are untouched.

---

## 4. Task 2 — MySQL

### 4.1 What was already there

`server/db.js` already selects MySQL with `DB_CLIENT=mysql` and connects with
`mysql.createPool(process.env.DATABASE_URL)`. `server/migrations.js` already handles MySQL
(`SHOW COLUMNS` instead of `PRAGMA table_info`). `compose.yaml` and `README.md` already describe
the deployment. What was missing was any proof that it actually works.

### 4.2 Verified on a real, isolated MySQL 8.0.42 instance

To avoid touching your server and to avoid substituting a different engine, I started a
**throwaway real MySQL 8.0.42** (`mysqld --initialize-insecure`, its own datadir and port,
`--defaults-file` so it could not inherit your config), created `hostel_hub` plus a restricted
`hostelhub` user on the MySQL 8 default `caching_sha2_password` plugin, and ran the app against it.

| Verification | Result |
| --- | --- |
| Server + restricted app account login | Pass — `hostelhub` reaches only `hostel_hub` |
| Schema creation on MySQL (14 tables) | Pass — all created |
| Additive migrations on MySQL (`SHOW COLUMNS` path) | Pass — `hostels.min_stay_days/food_charge/service_charge/tax_percent`, `bookings.flow_version/quantity/monthly_rent/guest_note/approved_at`, `payments.method/refunded_at` all present |
| Foreign keys | Pass — 23 foreign-key columns across 12 tables |
| CSV import into MySQL | **Pass — exact row counts** |
| Referential integrity | Pass — 0 orphan bookings/payments, 0 amount-reconciliation errors |
| UTF-8 (`utf8mb4`) | Pass — multibyte content stored correctly |
| API end-to-end on MySQL | **20 / 20 pass** (incl. transactional booking, capacity `FOR UPDATE` locking, payment fail→retry→confirm, refund, subscription) |
| SPA served from MySQL-backed app | Pass |

CSV import counts matched the documented dataset exactly:

```
users 73 · hostels 24 · rooms 96 · documents 23 · bookings 240
payment_attempts 271 · payments 188 · booking_events 867 · reviews 100
messages 160 · notifications 490 · complaints 20 · audit_log 344 · wishlist 60
```

Runtime tables: `seed_imports` 1, `seed_records` 2953.

**The `.env` mechanism itself was also proven:** I temporarily placed a project `.env` containing
`DB_CLIENT=mysql` + `DATABASE_URL`, launched the app with an otherwise empty environment, and
confirmed it held 11 live MySQL connections on `hostel_hub` while the SQLite file was untouched.
That temporary `.env` has been **deleted** (see §7).

### 4.3 Connecting to your server — resolved

> **RESOLVED.** After the `.env` credential was corrected, a read-only connection test against
> `127.0.0.1:3306` **succeeded**:
>
> ```
> RESULT: CONNECTED
>   server version      : 8.0.42
>   authenticated as    : hostelhub@localhost
>   connected database  : hostel_hub
>   tables in database  : 0
> ```
>
> `DB_CLIENT=mysql` and `DATABASE_URL` are both configured correctly. The database is currently
> **empty** (0 tables) — the schema has not been created yet. Stopped there deliberately: no schema
> creation, no import, no record changes. §4.4 is retained below as the historical record of the
> authentication failure and how it was fixed.

**Earlier attempt (historical) — `.env` present but the credential was rejected.**

```
RESULT: FAIL — authentication/connection error
  code:    ER_ACCESS_DENIED_ERROR
  errno:   1045
  message: Access denied for user 'hostelhub'@'localhost' (using password: YES)
```

Confirmed diagnostics (all read-only, no credentials printed or logged):

| Check | Result |
| --- | --- |
| `DATABASE_URL` shape | `mysql://hostelhub:***@127.0.0.1:3306/hostel_hub` — exactly one `@` in the URL, so the `@` inside the password is correctly percent-encoded and decodes to a 10-character password |
| Server identity on 3306 (raw handshake banner) | `8.0.42` — the MySQL 8 target you described |
| Server on 3307 (for comparison) | `5.5.5-10.4.32-MariaDB` |
| Same credentials via `mysql2` (as `server/db.js` connects) | `1045` |
| Same credentials via the native `mysql.exe` client | `1045` — identical, so this is **not** a driver or auth-plugin issue |
| Same credentials without a database qualifier | `1045` — rules out a missing-database error (`1049`), so the rejection happens at the account level |
| Server reachable on 3306 | yes (a bogus user also returns `1045`, the normal no-leak response) |

Because authentication fails, **execution stopped here, as instructed: no schema was created, no
CSV import was run, the test suites were not pointed at MySQL, and the application was not started
against your server.** `data/` and `uploads/` were not created. `.env` was not read into any log,
and no credentials were printed.

I did **not** touch your MySQL 8 server in any way — no databases, users, grants or data were
created, altered or deleted on `127.0.0.1:3306`.

**Most likely cause:** the password in `.env` does not match the `hostelhub` account, or the
account does not exist for the host MySQL resolves the client to (`localhost`). MySQL returns the
same `1045` for both cases, so they cannot be told apart from the client side. Fix with §4.4.

### 4.4 Minimum steps to resolve (Task 2)

`.env` is already in place and correctly shaped — the only open item is the `hostelhub` credential.
Do these three checks in your MySQL 8 admin tool (I am not asking you to share anything):

**1. Does the account exist, and for which host?**

```sql
SELECT user, host, plugin FROM mysql.user WHERE user = 'hostelhub';
```

The TCP client on `127.0.0.1` is resolved by MySQL to `localhost`, so you need an account for
`'hostelhub'@'localhost'` (or for `'%'`). If the query returns no rows:

```sql
CREATE USER 'hostelhub'@'localhost' IDENTIFIED BY '<the-same-password-as-in-.env>';
GRANT ALL PRIVILEGES ON hostel_hub.* TO 'hostelhub'@'localhost';
FLUSH PRIVILEGES;
```

**2. Does that password actually authenticate?** Try it directly — if this prompts and succeeds,
the `.env` value is the thing to correct:

```
mysql -u hostelhub -p -h 127.0.0.1 -P 3306 hostel_hub -e "SELECT CURRENT_USER(), DATABASE();"
```

**3. If you change the password**, keep the URL-encoding rules in `.env`:
`@`→`%40`, `:`→`%3A`, `/`→`%2F`, `#`→`%23`. (The current value already encodes its `@` correctly,
so encoding is not the problem — the value itself is what is being rejected.)

Then start it: `npm start` (or `.\Start-HostelHub.ps1`). Schema and additive migrations are applied
automatically; the 17 CSV files are imported once and later starts leave the data alone.

Sanity check after a successful start:
`GET /api/health` → `{"ok":true,"payments":"demo"}` ·
`GET /api/hostels` → 20 approved listings ·
`GET /api/config` → `demo_accounts` has 13 entries.

Tell me once the account authenticates and I will re-run the connection test, schema verification,
seed import, row-count checks, the test suites and the application startup against your server.

No `.env` has been created for you, because I do not know your password and must not guess it or
hardcode credentials.

### 4.5 Database initialized and seeded on your MySQL 8 — verified

`npm start` was run from the project root against the corrected `.env`. Before running, the startup
path was inspected and confirmed non-destructive: `server/db.js` uses only
`CREATE TABLE IF NOT EXISTS`, `server/migrations.js` only `ALTER TABLE … ADD COLUMN` guarded by a
column-existence check, and there is **no `DROP`/`TRUNCATE` anywhere in `server/`**. The only
`DELETE` statement in the codebase is the wishlist-toggle endpoint (a user action), and the only
`DROP TABLE` lives in `tests/workflows.test.js` on an in-memory database. The app also never
touches the SQLite file when `DB_CLIENT=mysql` (no `data/` directory was created).

| Check | Result |
| --- | --- |
| Database state before start | empty — 0 tables |
| Tables after start | **16** (14 data tables + `seed_records` + `seed_imports`) |
| Seed import | `seed_imports` row: **status `success`**, `inserted=2953 updated=0 skipped=0 rejected=0` |
| CSV files read | **17 / 17** |
| Row counts vs CSV-derived expectations | **14 / 14 data tables exact** |
| Foreign keys | 23 foreign-key columns across 12 tables |
| Referential integrity | 0 orphan bookings/payments, 0 amount-reconciliation errors |
| Errors / failed imports | none in the startup log, and no `failed` rows in `seed_imports` |
| Read-only API smoke | `/api/health` ok · `/api/config` demo, 13 demo accounts · `/api/hostels` 20 listings |

Per-table counts: `users 73` (70 CSV accounts + 3 bootstrap demo accounts), `hostels 24`,
`rooms 96`, `documents 23`, `bookings 240`, `payment_attempts 271`, `payments 188`,
`booking_events 867`, `reviews 100`, `messages 160`, `notifications 490`, `complaints 20`,
`audit_log 344`, `wishlist 60`, `seed_records 2953`, `seed_imports 1`.

The importer also generated the 23 fictional sample declaration files under `uploads/private/`
(additive only; it skips files that already exist). Full end-to-end tests were deliberately not run.

### 4.6 Backups preserved

`seed-data/*.csv` (17 files) are untouched. The SQLite store and `uploads/` directory are
auto-created at runtime by the app and were removed after verification so your tree is as you
left it (see §7).

---

## 5. Task 3 — Subscription section

### 5.1 Already implemented (verified working)

| Layer | Component |
| --- | --- |
| Database | `users.plan`; `payments` ledger with `kind='subscription'` |
| API | `POST /api/owner/subscription` — validates `plan ∈ {Basic, Pro, Advanced}`, rejects re-selecting the current plan (409), refuses when demo mode is off (503), updates `users.plan`, writes a ledger row with a `PLAN-…` reference, notifies the owner |
| Frontend | `/owner/plans` → `Plans` (`src/management.tsx:1027`) — three plans, confirmation modal, busy state, error toast |
| Display | Owner plan badge on the listing detail (`src/homes.tsx:767`), admin member table Plan column, owner dashboard payment history |

Verified live: `Basic→Pro→Advanced` persists to `users.plan`, writes a ledger row of the right
amount (Pro 499 / Advanced 999), and survives a fresh request. Same-plan reselection returns 409.

### 5.2 The gap that was closed

B1 (§2.4): the owner **Payments** page could not display subscription charges. Fixed and verified.

### 5.3 Deliberately NOT added

Per your instruction ("fix the ledger bug only") and the existing design, I did **not** add
plan-based feature gating, quotas, expiry or auto-renewal. The project documents this explicitly:
plans "demonstrate the subscription workflow; feature limits are not enforced in this college
edition". Adding enforcement would have changed unrelated owner workflows, which the project's own
strict rules forbid. `DEMO_MODE=false` still disables the subscription simulation.

---

## 6. Step 4 — Actual test results

| Suite | Command | Result |
| --- | --- | --- |
| Type-check + build | `npm run build` | Pass (after fix, unchanged) |
| Unit / integration | `npm test` | **26 / 26 pass** (before and after the fix) |
| API end-to-end, SQLite | custom 20-check script | **20 / 20 pass** |
| Browser end-to-end | `npm run test:browser` | Pass — Edge, desktop + mobile, no page errors |
| API end-to-end, MySQL 8.0.42 | same 20-check script against the MySQL instance | **20 / 20 pass** |
| MySQL import integrity | row counts + FK + orphan + reconciliation queries | Pass, exact counts |

### 6.1 Full verification against the running MySQL-backed app (final run)

Run against the already-running instance on `http://localhost:4000`, no duplicate server started.

| Suite | Command | Result |
| --- | --- | --- |
| CSV dataset validation | `npm run db:validate` | **Pass** — 17 files, `valid: true` |
| Type-check + production build | `npm run build` | **Pass** — `tsc` clean, Vite bundled |
| Automated tests | `npm test` | **26 / 26 pass**, exit 0 |
| Browser end-to-end | `npm run test:browser` | **Pass**, exit 0 — 10 screenshots in `test-results/` |
| Health endpoint | `GET /api/health` | `{"ok":true,"payments":"demo"}` |
| MySQL (not SQLite) confirmation | no `data/` directory exists; 11 live MySQL connections as `hostelhub` (10 on `hostel_hub`) | Confirmed |
| Major workflows against MySQL | authentication (guest/owner/admin, 401 + suspended 403), browsing/filters, booking → approval → payment decline → retry → confirm → receipt → timeline, cancellation → admin refund, payment ledger + dashboard | **11 / 11 pass** |
| **REQ: subscription payments in `GET /api/payments`** | owner subscribes (Pro) → `GET /api/payments` | **Pass** — 1 subscription row, `PLAN-…`, INR 499; also present in `/dashboard` |

**Data safety.** Row counts were snapshotted before and after. **No table decreased.** All 14
CSV-seeded tables kept their original rows; `seed_records` stayed at **2953** and `seed_imports` at
**1**. Increases were only the isolated test data the run created: `users +2`, `bookings +1`,
`payments +2` (one booking + one subscription), `payment_attempts +2`, `booking_events +8`,
`notifications +11`, `audit_log +3`. Seeded owners were not modified — the subscription test used a
newly registered test owner rather than changing a seeded owner's plan.

**Hazard identified (not run).** `npm run db:seed` (`server/seed.js`) and `scripts/seed-cli.mjs`
without `--validate`/`--fresh` call `createDatabase()` with no arguments, which reads `.env` — so
they would run a **forced import against the live MySQL database**. `npm run db:validate` is safe
(it exits before any database work). `npm run db:seed` was deliberately **not executed**.

Repeatability note: the API exercises a sliding rate limiter (300 req/min, and 40 logins/15 min),
so rapid successive runs return HTTP 429. This is intended behaviour, not a defect. Restarting the
server resets the in-memory limiter.

---

## 7. Housekeeping — what was left behind

Removed (all were my own scratch artifacts, none pre-existed):

- the temporary `.env` used to prove the `.env` → MySQL mechanism
- the throwaway MySQL 8 instance (process stopped, temp datadir deleted; your 3306 untouched)
- `data/` (SQLite store, auto-created at runtime by the app)
- `uploads/` (auto-created at runtime)
- helper scripts and `*.log` / `*.err` files created during verification

Kept: `node_modules/` and `dist/` (both needed to run, both gitignored), `test-results/`
(browser-QA screenshots, gitignored), and all original project files including the 17 CSVs.

---

## 8. Environment notes / still needs manual configuration

1. **`.env` for MySQL** — resolved. The database is initialized and seeded (§4.5).
2. **Node.js version** — the project requires `>=24` (README and `package.json`). This machine has
   **v22.23.2** on PATH. Everything verified here ran on 22 because `node:sqlite` is available, but
   `npm ci` prints `EBADENGINE`. Install Node 24+ to match the declared requirement.
3. **Docker** — not installed, so the `compose.yaml` MySQL container path is unavailable. Not
   needed: MySQL 8.0.42 is already installed and running locally on 3306.
4. **`JWT_SECRET`** — set it in `.env`, otherwise the development secret changes on every restart
   and sessions are invalidated.
5. **AI assistant** — optional; without `AI_API_KEY` the app runs its labelled local search
   assistant.
6. **MySQL 8.0.42 vs compose's 8.4** — the verified instance was 8.0.42. The schema, migrations and
   queries used are compatible with 8.x; nothing version-specific appeared.
