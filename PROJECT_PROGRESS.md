# Arooohi — Progress Report

> SRS source: `Misc./Arooohi_Complete_SRS_Report.pdf`. Roadmap + backlog: [`PROJECT_PLAN.md`](./PROJECT_PLAN.md).
> Statuses: ✅ done · 🔶 partial · ❌ not started. Updated **2026-10-30** (code-smell Phases 1–3 complete; pytest **66/66**; e2e **53/53, 0 console errors**; Phase 4 deferred).

## 1. Overall

**20 / 20 SRS features complete (100%).** Auth, safety, Ornab's 5 modules (cost
splitter, trusted contacts, ride chat, eco tracker, peak-hour surge) and the
Sprint 2/3 completion pass (female-only mode, smart matching, scheduled booking,
multi-stop, hotspots) are shipped. No SRS features remain outstanding; the backlog is now non-functional work
(tests, real-time tracking, deployment) rather than features.

**Sprint status: Sprints 1-4 are now fully closed** (2/2, 4/4, 5/5, 5/5).
**All five sprints are now closed** (2/2, 4/4, 5/5, 5/5, 4/4). Sprint 4 was
completed on 2026-09-01 with #9 Wallet & bKash, #16 Driver Earnings and #10 Ride
History; Sprint 5 followed the same day with #18 Cancellation Policy and #7
Driver Rating & Review. Every SRS feature is implemented. Note that two Sprint-5 features (#17 Admin Complaint Panel,
#20 Eco Tracker) were also delivered ahead of sequence; nothing from an earlier
sprint is outstanding, so no downstream work is blocked.

## 2. Feature status

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | BRACU Student Verification | ✅ | `@g.bracu.ac.bd` + 6-digit OTP (demo: OTP shown in UI/console) |
| 2 | Live GPS Ride Tracking | ✅ | 5s polling via `/track/[token]`, share link + live map |
| 3 | Female-Only Ride Mode | ✅ | Driver creation & passenger join/search gender filtering + verified gating |
| 4 | In-App SOS Button | ✅ | `sos_alerts` table; mock notification; admin resolve |
| 5 | Ride Cost Splitter | ✅ | `GET /api/rides/{id}/split` — fare × surge, seat-weighted largest-remainder split (sums exactly to total) |
| 6 | Campus Zone Smart Matching | ✅ | `/api/rides/match` multi-factor scoring (route, timetable, intermediate stops, female-only) |
| 7 | Driver Rating & Review | ✅ | 1-5 stars + comment after a completed ride; one review per rider per ride (UNIQUE index); post-ride prompt on Ride History; average, histogram and comments on the driver profile |
| 8 | Scheduled Ride Booking | ✅ | `rides.scheduled_at` field + advance booking validation & UI selector |
| 9 | Wallet & bKash Integration | ✅ | Prepaid `wallets` + append-only `transactions` ledger; simulated bKash tokenized checkout behind a `PaymentGateway` interface (no live client — credentials need merchant onboarding); auto-settlement at ride end; cash-out; reconciliation endpoint |
| 10 | Ride History & Receipt Log | ✅ | Both-role trip log + per-ride receipt (print-to-PDF and `.txt` download); ledger-backed amounts; participants-only |
| 11 | Driver Vehicle Verification | ✅ | Doc upload + admin approve/reject + role flip |
| 12 | Trusted Contact Sharing | ✅ | DB-backed CRUD; auto-share on tracking start (mock delivery) |
| 13 | Peak Hour Surge Indicator | ✅ | Seeded 24h + live ride-volume bump; Asia/Dhaka timezone |
| 14 | Campus Pickup Hotspots | ✅ | Categorized hotspots (Gates, Academic, Transit) + `/api/rides/hotspots` API + Interactive TrackingMap & selector UI |
| 15 | Ride Chat (In-App Messaging) | ✅ | WS `/ws/chat/{ride_id}` + REST history + UI |
| 16 | Driver Earnings Dashboard | ✅ | Reads the wallet ledger (`ride_credit`); 8-week Asia/Dhaka bar chart, per-ride breakdown, unsettled rides surfaced separately, payout-ready balance |
| 17 | Admin Complaint Panel | ✅ | Full CRUD + statuses + stats + admin notes |
| 18 | Ride Cancellation Policy & Penalty | ✅ | Free before dispatch, 20% fee after (clamped BDT 20-150); driver cancels the ride, passenger cancels their seat; charged to the wallet as a `penalty` row; warning dialog previews the exact amount |
| 19 | Multi-Stop Ride Support | ✅ | `ride_stops` table + waypoint status tracking + passenger pickup/drop-off stop joining |
| 20 | Eco/Footprint Tracker | ✅ | CO₂ saved vs solo, trees + fuel equivalents, gamified UI |

## 3. Sprint completion (SRS §7 mapping)

| Sprint | Score | Detail |
|--------|-------|--------|
| 1 — Auth | 2/2 ✅ | Verification (#1), Driver verification (#11) |
| 2 — Matching & Logistics | 4/4 ✅ | Hotspots (#14), Matching (#6), Scheduled (#8), Multi-Stop (#19) complete |
| 3 — Tracking & Safety | 5/5 ✅ | GPS (#2), SOS (#4), Contacts (#12), Chat (#15), Female-Only (#3) complete |
| 4 — Payments & Earnings | 5/5 ✅ | Splitter (#5), Surge (#13), Wallet & bKash (#9), Driver Earnings (#16), Ride History (#10) — **sprint complete** |
| 5 — Admin & Quality | 4/4 ✅ | Complaints (#17), Eco (#20), Cancellation (#18), Driver Rating (#7) — **sprint complete** |

## 4. Verification evidence (2026-07-31; re-verified 2026-10-07, 2026-10-09 and 2026-10-30)

### Backend
- `import app.main` boots cleanly; `init_db()` idempotent (tables + surge seed + admin).
- Full API flow verified end-to-end (throwaway DB): register/verify → contacts CRUD +
  auto-share + share history → surge current/schedule (with `is_current`) → ride
  create (w/ `total_seats`)/join (capacity-checked)/accept/start/end → seat-weighted
  split (sums exactly to total) → WS chat broadcast + persistence → 4401/4403/4429
  close codes → eco for driver AND rider → leaderboard → SOS resolve 404 → tracking
  ownership/token → complaints + rate limiting.
- Session-9 test pass: **backend 54/54 checks** (TestClient, throwaway DB) + **live API
  smoke** (register, surge `is_current`, total_seats, 32-hex token, share history,
  login rate-limit 429).

### Frontend (Node v24.18.0, user-local; re-verified 2026-10-07 on a fresh Node 24.18.0 fetch)
- `npm run lint` — **0 problems** (4 errors found and fixed 2026-10-07; see §5 "Test & repair pass").
- `npx tsc --noEmit` — **clean**.
- `npm run build` — **success, all routes compile** (21 routes).
- Backend pytest — **66/66** on Python 3.14 (2026-10-30; was 53/53 before the
  Phase 1–2 additions). `pip install -r requirements-dev.txt`, then
  `python -m pytest -q` from `backend/`.

### Runtime state (checked recent sessions)
- **One-command launcher (Session 12):** `./launch.py` / `./launch.sh` / `launch.bat`
  boot backend + frontend, render the Arooohi logo, open the site fullscreen in the
  default browser, and auto-stop + WAL-checkpoint the DB when the browser closes.
  The app uses explicit IPv4 `127.0.0.1` (`frontend/lib/api.ts` `API`/`WS`/`API_BASE`;
  CORS allows `localhost:3000` + `127.0.0.1:3000`) — fixes a gecko/Firefox
  `localhost`→IPv6-`::1` failure. Desktop-installer attempt (Session 13) was reverted.
- Backend `:8000` (with `--reload`) and frontend `:3000` were **running**; the app is
  started/stopped with the launcher.
- `arooohi.db`: carries live user/test data (driver approved, completed ride,
  resolved SOS/complaint) — kept for the demo; pre-test backup at
  `Misc./arooohi.db.backup-20260731-214145`.
- `git status` — HEAD `91a90c0`; the Phase 1–3 work is **uncommitted as of
  2026-10-30**: backend security/structure changes (XSS escaping, fail-closed
  `DEMO_MODE`, `db_session()`, `hotspots`/`geo`/`matching`/`cancellation`/
  `rate_limit` modules, 3 new test files), the frontend shared libs
  (`lib/client.ts`, `lib/useApi.ts`, `lib/format.ts`, `lib/badges.tsx`), the
  `dashboard/rides/` feature folder, the `data-testid` + e2e locator migration,
  `backend/seed_e2e.py`, `.github/workflows/ci.yml`, and these docs.

### Live browser test (Session 10, Playwright)
- Full end-to-end run of the live UI on both running servers: **45/45 passed,
  0 failed** across auth, contacts, GPS tracking, SOS, rides, cost splitter,
  surge, chat, driver verification, complaints, eco, and security gates.
- One bug found + fixed during the run: chat spam-guard path closed with HTTP
  403 instead of WS close code 4429 — now `await websocket.close(4429)` +
  `break` (`routes/chat.py`), matching `API.md`.
- Harness: `/tmp/opencode/e2e/live-test.js` (Playwright, `--headed`,
  executablePath `/opt/helium/chrome`); machine-readable report at
  `/tmp/opencode/e2e/report.json`; runtime logs `backend.log`/`frontend.log`.
- 34 screenshots captured → committed to `demo/live-test-screenshots/`.
- Test accounts (all `secret1/2/3`): `driver.live@g.bracu.ac.bd` (Test Driver),
  `rider.live@g.bracu.ac.bd` (Rider Person), `intruder.live@g.bracu.ac.bd`
  (Nosy User); admin `admin@g.bracu.ac.bd` / `admin123`.

### Live browser test (2026-10-09, harness now in-repo; re-run 2026-10-30) — **53/53**

- **2026-10-30 re-run after Phase 3:** fresh seeded DB
  (`backend/seed_e2e.py`), production build (`npm run build` + `npm start`),
  `HEADLESS=1 node e2e/live-test.js` → **53/53 passed, 0 console errors**.
  The suite now locates elements by `data-testid` instead of `.glass-card`
  scoping. The run found one dead link (`/dashboard/track`, no such route) that
  made Next prefetch a 404 on every rides render; fixed to `/dashboard`. This
  was the last console-hygiene failure.
- The old `/tmp` harness was wiped with the temp dir, so it was rebuilt from
  scratch and **ported into the repo**: `e2e/live-test.js` (Playwright driving
  Helium, `executablePath /opt/helium/chrome`, headed). Run it with
  `node e2e/live-test.js` while `./launch.sh --no-browser` is up; it writes
  `e2e/report.json` + `e2e/screenshots/` (both gitignored) and exits non-zero
  on any failure.
- **Result: 53/53 passed, 0 console errors**, covering auth (fresh
  registration → OTP → verify), driver verification, surge/peak strip,
  the full ride lifecycle (offer → request → accept → start → chat →
  splitter → end + wallet settlement), bidirectional WebSocket chat,
  bKash top-up through the hosted gateway, GPS tracking + public share link +
  SOS, history/receipt/rating, eco/complaints/earnings, the four API security
  gates + chat 4403 UX, and the admin panel (complaint resolve, SOS log,
  driver list).
- One real bug found + fixed during the runs: the backend 404'd the browser's
  automatic `/favicon.ico` request on the server-rendered bKash gateway page
  → now `302` to the frontend icon (`app/main.py`, hidden from OpenAPI);
  backend tests stayed 53/53.

## 5. Recent fixes (already applied)

### Code-smell fix pass (2026-10-30) — Phases 1–3
- **XSS**: the demo gateway page escapes `?error=` and the payment id before
  rendering (`views/checkout.py`); regression tests added.
- **`DEMO_MODE` now fail-closed**: unset means non-demo. `launch.py`,
  `seed_sprint3.py` and `tests/conftest.py` opt in explicitly, so local demo
  behaviour is unchanged while a bare production import refuses the default
  `SECRET_KEY` and does not mount `/bkash/*`.
- **Notifications centralized**: `models/notifications.py` uses the
  `arooohi.notifications` logger instead of `print()`; SOS, trusted-contact
  sharing and driver cancellation now actually call it.
- **Chat over-length is rejected**, not truncated: server raises
  `DomainError(400)` and the WS sends `message_rejected`; the chat page shows an
  inline error and pre-validates at 500 chars.
- **Dependencies**: `passlib[bcrypt]` dropped for a direct `bcrypt==5.0.0` pin.
- **`rides.py` split**: 1159 → 574 lines. New `models/hotspots.py` (data),
  `geo.py` (pure distance math), `matching.py` (smart matching) and
  `cancellation.py` (policy/cancel); `rides.py` re-exports the same names, so the
  OpenAPI contract test still passes.
- **Connection lifecycle**: new `db_session()` context manager in
  `models/database.py` (commit on success, rollback + close on error); ~100
  manual `conn.close()` calls removed across the models.
- **Seat overbooking closed**: `join_ride` opens `BEGIN IMMEDIATE`, and a
  concurrent-join pytest asserts only one rider can take the last seat.
- **Rate limiting isolated**: `models/rate_limit.py` (`SlidingWindowLimiter`) now
  backs the auth login/OTP limits and the chat spam guard. Single-worker
  constraint documented in `backend/API.md` and awaiting the Redis swap.
- **Tests**: suite grew 53 → 66, adding `test_participants.py`,
  `test_notifications.py` and `test_security_hardening.py`, plus reusable
  `make_user` / `make_ride` / `add_passenger` fixtures.
- **e2e**: `HEADLESS=1` is honoured; default stays headed for the demo.
- **Rides page split (Phase 3)**: `dashboard/rides/page.tsx` 1530 → 320 lines.
  New `rides/` feature folder: `types.ts`, `useRides.ts` (state + all network
  calls), `RideCard.tsx`, `StopProgress.tsx`, `OfferForm.tsx`, `MatchTab.tsx`,
  `JoinRideModal.tsx`, `CancelRideModal.tsx`; the route file is now just the
  header, tabs and browse layout. UI and copy are unchanged.
- **Shared frontend libs**: `lib/client.ts` (`apiFetch` injects the token,
  parses `{detail}`, clears the session + redirects on 401), `lib/useApi.ts`
  (AbortController-aware fetching), `lib/format.ts` (`fmtMoney`,
  `fmtMoneyShort`, `fmtDateTime`, `fmtDate`, `fmtPhone`) and `lib/badges.tsx`
  (status-badge maps). Dashboard, wallet, admin complaints/drivers/SOS,
  dashboard complaints/driver, earnings/history/receipt and the callback page
  now use them; the copy-pasted `statusBadge` maps and `taka()` helpers are gone.
- **e2e selectors**: `data-testid` hooks on ride cards, ride actions, tabs,
  join/cancel modals and the chat input/send button; `e2e/live-test.js`
  locates by test id instead of `.glass-card` scoping where possible.
- **Dead tracking link fixed**: the ride card's "Live Map Tracking" button
  pointed at `/dashboard/track` (no such route), producing a Next.js prefetch
  404 on every rides render — the last two console-hygiene failures. It now
  points at `/dashboard`. e2e is **53/53 with 0 console errors**.
- **CI**: `.github/workflows/ci.yml` gates every push/PR on backend pytest +
  frontend lint / `tsc --noEmit` / build. The browser e2e job is
  `workflow_dispatch`-only (it needs both servers, Chromium and seeded data).
- **e2e seed**: `backend/seed_e2e.py` idempotently creates the fixed
  driver/rider/intruder accounts (approved driver profile) the suite logs in as.

- **Surge timezone bug**: hour lookup was UTC, seed is BD-local (UTC+6) → now `Asia/Dhaka` (`surge.py`).
- **Ride detail permission leak**: `GET /api/rides/{id}` now 403s non-participants (`rides.py`).
- **Chat WS close codes**: server now accepts-then-closes so 4401/4403 reach clients
  (was HTTP 403 → frontend retried forever) (`chat.py`).
- **Chat spam-guard close (Session 10)**: rate-limit path now uses WS close
  `4429` + `break` instead of HTTP 403, so the code the frontend/API.md expect
  actually reaches the client (`chat.py`).
- **Frontend reconnect**: auto-reconnect on WS drop, no retry on 4401/4403 (`chat/[rideId]/page.tsx`).
- **TypeScript/lint cleanup**: `any` → interfaces across 17 frontend files.
- **Gateway-page favicon 404 (2026-10-09)**: the backend 404'd the browser's
  automatic `/favicon.ico` on the server-rendered bKash page → now `302` to
  the frontend icon, hidden from the OpenAPI schema (`app/main.py`).

### Session 9 hardening pass (2026-07-31) — security + correctness
- **Auth**: default-secret fail-fast (when `DEMO_MODE!=1`); OTP hint only in DEMO_MODE;
  per-IP+email rate limiting for login/OTP (5/5 min → 429); inactive/nonexistent
  accounts rejected in `get_current_user_id`; password min 6 chars.
- **Tracking**: 32-hex share token; owner-only session read; stop on inactive → 404;
  frontend stops polling when ride ends; map auto-follow + re-center.
- **Surge**: `/schedule` now flags one `is_current` hour; live bump applies only to it.
- **Splitter**: seat-weighted shares, largest-remainder paisa rounding (sums exactly);
  join enforces capacity via `total_seats` (default 4).
- **Rides**: `end_ride` uses the FULL path length of the most recent inactive session.
- **Contacts**: BD phone validation; auto-share persists to `contact_shares` + share history.
- **Eco**: NULL-distance guard; top-10 leaderboard.
- **Chat**: spam guard (20 msgs/10s → 4429) + 500-char cap.
- **SOS/complaints/drivers**: 404 on missing resolve; `reported_id` existence check;
  `?status=` filter for pending drivers; upload ext from MIME.
- **DB**: WAL mode + FK indexes; `rides.total_seats` migration; `contact_shares` table.
- **Frontend**: rides page rewritten (surge schedule strip, seats, inline errors,
  participant-gated chat); eco/contacts/chat/admin error states; dashboard GPS
  double-post + interval-leak fixed.

### Sprint 2/3 completion pass (after 2026-08-03) — 5 features closed
- **#3 Female-Only Ride Mode** — `rides.female_only` column + migration; only female
  drivers may create such a ride, only female riders may join; `/api/rides/match` and the
  ride listing filter them out for everyone else; UI toggle on the rides page.
- **#6 Campus Zone Smart Matching** — `GET /api/rides/match` multi-factor scorer
  (exact pickup +50, ≤1.5 km haversine proximity +35, direct destination +50,
  intermediate-stop match +45, ±30 min class-time +15; <50 dropped when both filters set),
  returning `match_score` + human-readable `match_reasons`.
- **#8 Scheduled Ride Booking** — `rides.scheduled_at` with ISO parsing, past-time
  rejection on create, and class-time window matching.
- **#14 Campus Pickup Hotspots** — promoted from 🔶 to ✅: `GET /api/rides/hotspots`
  serves 12 categorized points (gates / academic / residential / transit) whose
  coordinates also drive #6's proximity scoring.
- **#19 Multi-Stop Ride Support** — `ride_stops` (`sequence`, `status` pending/reached/
  departed) + per-passenger `pickup_stop`/`dropoff_stop` on join + driver-only stop-progress
  endpoint; columns added idempotently via `_ensure_column()`.
- **First committed tests** — `backend/tests/test_campus_features.py`, 5 pytest cases
  covering exactly these features against an isolated throwaway DB.

### Feature 9 — Wallet & bKash Integration (2026-09-01)
- **Schema:** `wallets` (cached balance), `transactions` (append-only signed ledger with
  `platform_fee`), `bkash_payments` (one row per checkout attempt), plus three unique
  indexes that enforce idempotency.
- **Gateway layer:** `app/payments/` — `base.py` (interface), `mock_bkash.py` (simulated,
  deterministic test numbers), `factory.py` (returns it, and raises if `DEMO_MODE=0`
  rather than pretending a simulator handles real money). No live client is included:
  bKash issues credentials only through merchant onboarding.
- **Simulated checkout page:** served by the BACKEND at `/bkash/checkout/{paymentID}` so the
  browser genuinely leaves Arooohi to authenticate, exactly as a real gateway forces.
  Mounted only when `DEMO_MODE=1`.
- **Settlement:** `end_ride` debits each accepted passenger their seat-weighted share and
  credits the driver — atomically and idempotently — reusing the exact numbers `/split`
  displays. `rides.py::_split_total` now delegates to `wallet_service.split_total`, which
  also clears the duplication flagged in PLAN §6.3.
- **Join gating:** joining now returns **402** with the exact shortfall when the wallet
  cannot cover the projected share.
- **Verified:** 20+ live checks — full 4-step top-up; redirect-alone-credits-nothing;
  double execute (idempotent); all four failure test-numbers; balance gate; settlement
  matching the splitter exactly; re-settlement no-op; cash-out plus overdraft refusal;
  reconciliation balanced for both parties. Full browser run of the UI flow with 0 console
  errors. `npx tsc --noEmit` clean; `npm run build` clean (19 routes).
- **Post-build audit (22 adversarial checks, all passing):** input validation, forged
  callback, cross-user payment theft, 6-way concurrent execute, 5-way concurrent
  `end_ride`, spend-down-after-join, and ledger reconciliation for every party.
  **One real bug found and fixed:** the simulated gateway held state only in memory, so
  an authorised-but-unexecuted payment became permanently unexecutable after a restart
  (and `--reload` restarts on every edit). It now rehydrates from `bkash_payments`.
- **Known demo-only weakness:** `/bkash/checkout/{id}/confirm|cancel` are unauthenticated
  by design (they stand in for a third party), so anyone who learns a paymentID can
  cancel a *pending* top-up. They cannot credit or steal anything — crediting still
  requires the owner's authenticated execute. A real gateway solves this with a
  single-use signed checkout URL.
- **Out of scope by design:** refunds / cancellation penalties belong to #18; the `refund`
  ledger kind is reserved for it.

### Feature 16 — Driver Earnings Dashboard (2026-09-01)
- **No new schema.** Reads `transactions.kind = 'ride_credit'` — the wallet ledger — so the
  earnings figure and the wallet balance are the same number by construction. The
  `rides`-recomputation approach originally sketched in PLAN §4 was dropped for this reason.
- **Endpoints:** `GET /api/earnings/summary`, `/weekly?weeks=8` (1-26), `/rides?limit=25`.
- **Unsettled rides surfaced, not hidden:** completed rides with no credit (pre-wallet, or a
  passenger who could not pay) get their own warning band with the uncollected amount and are
  excluded from all totals. The demo DB has exactly one such ride, which is what made this
  case obvious.
- **Weeks bucketed in Asia/Dhaka**, Monday start, empty weeks preserved so idle stretches
  read as idle.
- **Chart:** single-series bars; fill `#00a888` chosen because `--primary` failed the
  dark-mode lightness band (L 0.775 vs the 0.48-0.67 band) in the palette validator. Round
  axis ticks, direct labels only on peak + current week, hover tooltip on every bar, and a
  table toggle for non-visual reading.
- **Verified:** 19 backend checks — totals matching the sum of credits, unsettled excluded,
  payout == wallet balance, weekly bucketing with gaps, one current week, weekly total ==
  summary total, riders see an empty dashboard rather than an error, unauthenticated 401.
  Browser run: 8 bars rendered, hover tooltip works, table toggle shows 8 rows, 0 console
  errors. `tsc --noEmit` clean; `npm run build` clean (20 routes).

### Feature 10 — Ride History & Receipt Log (2026-09-01) — closes Sprint 4
- **No new schema.** Reads `rides`, `ride_passengers`, `ride_stops`, `transactions`.
- **Both roles:** `GET /api/history?role=all|driver|passenger&status=completed|all`,
  `GET /api/history/summary` (lifetime trips / spent / earned / net / distance), and
  `GET /api/history/{ride_id}/receipt`.
- **Ledger-backed amounts**, matching #9 and #16 — settled rides report the real
  transaction; unsettled ones report the amount *owed* and are flagged, never shown as 0.
- **Shared receipt number** `ARH-YYYYMMDD-XXXXXX`, deterministic from the ride id, so a
  driver and rider quoting the same trip quote the same number — with role-appropriate
  lines on each side.
- **Downloadable:** `window.print()` + a print stylesheet that hides the sidebar and
  action buttons, plus a Blob `.txt` download named after the receipt number.
- **Verified:** 27 backend checks — riders' shares summing exactly to the driver's credit
  and the splitter total, a 2-seat rider paying exactly double a 1-seat rider, per-passenger
  pickup/drop-off stops on the receipt, unsettled rides flagged with the owed amount,
  non-participant 403, unknown ride 404, unauthenticated 401, role filters, lifetime
  summary. Browser run confirmed the print view hides the chrome and the `.txt` download
  produces a correct file. 0 console errors; `tsc --noEmit` clean; `npm run build` clean
  (21 routes).
- **One bug found by rendering it:** `issued_at` carries a `+06:00` offset while ledger
  timestamps are naive UTC; the formatter appended `Z` unconditionally and printed
  "Invalid Date". Both history pages now detect an existing offset before normalising.

### Sprint 4 cross-feature audit (2026-09-01)
Audited #9, #16 and #10 together, since the interesting failures are three features
disagreeing about the same money. **Zero disagreements** — wallet balance, earnings
total, weekly series, per-ride nets and history totals all reconcile exactly, and both
parties' ledgers stayed balanced throughout. **Three real issues found and fixed**, all
one family: *partial settlement was invisible.*

- **Earnings under-reported uncollected fares (bug).** `_unsettled()` tested
  `NOT EXISTS (... ride_credit)` — all-or-nothing. A ride where one passenger paid and
  another could not HAS a credit row, so its shortfall vanished: a driver owed 400 who
  received 200 saw `unsettled_value = 0`. Replaced with `_uncollected()`, which compares
  the splitter's expected total against what was actually credited (gross of fee, so a
  commission is never mistaken for a shortfall) and reports the difference. Summary now
  also splits `fully_unpaid_rides` vs `partially_paid_rides`.
- **Receipts claimed "Paid" on a partially settled ride.** Added `fully_paid` and
  `shortfall`; the badge now reads "Partially settled", the payment method is qualified,
  and both the HTML and `.txt` receipts state how much was never received.
- **Receipts were issued for rides that had not happened.** `GET /history/{id}/receipt`
  served a document for `scheduled`/`active` rides — proof of payment for a trip that
  never occurred. Now **400** with a clear message.

Verified after the fixes: owed(400) == received(200) + uncollected(200); all three earlier
suites re-run green (#9 22 checks, #16 19, #10 27) with no regressions; `npm run build`
clean (21 routes).

### Feature 18 — Ride Cancellation Policy & Penalty (2026-09-01)
- **Rule:** free before dispatch (`status = 'scheduled'`), charged after (`'active'`).
- **Fee:** 20% of the canceller's fare exposure, clamped to BDT 20-150. A driver is
  exposed to the whole ride total; a passenger only to their seat-weighted share.
- **Endpoints:** `GET /api/rides/{id}/cancellation-policy` (preview, no side effects) and
  `POST /api/rides/{id}/cancel`. Both call the same `_cancellation_quote()`, so the warning
  and the charge cannot diverge.
- **Scope:** driver cancels the whole ride and every passenger is marked cancelled; a
  passenger cancels only their own seat and the ride continues.
- **Cannot pay:** the cancellation still succeeds and the fee is reported uncollected --
  no negative balances, no invented money, consistent with unsettled fares.
- **Schema:** added `penalty` to `transactions.kind` (SQLite cannot ALTER a CHECK, so
  `init_db()` rebuilds the table once, transactionally, only when needed — verified on the
  live demo DB with all 30 existing rows preserved), plus `rides.cancelled_at/cancelled_by/
  cancel_reason` and `ride_passengers.cancelled_at/penalty_amount`.
- **UI:** a Cancel button on cancellable rides opens a dialog showing the exact fee, the
  reason, the policy rates and the wallet balance — warning the user *before* anything is
  charged, and flagging when the balance will not cover it.
- **Verified:** 31 checks — free before dispatch, 20% after for both roles, quoted amount ==
  charged amount, ledger row written and reconciling, guards (already-cancelled 400,
  completed 400, outsider 403, unauthenticated 401, unknown 404), the cannot-pay path, and
  cancelled rides not polluting earnings or history. Browser run charged BDT 126.00 exactly
  as quoted (wallet 2135 -> 2009), 0 console errors. All Sprint 4 suites re-run green.

### Feature 7 — Driver Rating & Review (2026-09-01) — closes Sprint 5
- **Schema:** `reviews` (ride_id, reviewer_id, reviewee_id, stars 1-5, comment) with
  `UNIQUE(ride_id, reviewer_id, reviewee_id)` — the anti-abuse rule lives in the index, not
  in application logic, so a duplicate is impossible rather than merely discouraged.
- **Endpoints:** `POST /api/reviews`, `GET /api/reviews/pending` (rides still awaiting a
  review), `GET /api/reviews/me`, `GET /api/reviews/driver/{id}`.
- **Rules:** completed rides only; both parties must have been on the ride; no self-reviews;
  stars clamped 1-5; reviews are never edited or deleted.
- **UI:** post-ride prompt + star/comment dialog on Ride History; the driver's own average,
  star histogram and recent comments on their Earnings page.
- **Verified:** 24 checks — the prompt appearing and then disappearing, averages across
  multiple reviews, histogram, and every anti-gaming rule (duplicate 409, stars out of
  range 400, non-participant 403, reviewing a non-participant 400, self-review 400, unknown
  ride 404, unauthenticated 401, in-progress ride 400). Browser run: prompt → 4 stars →
  submitted → prompt gone, 0 console errors. All six existing suites re-run green.

### Test & repair pass (2026-10-07)
Full-project test pass on a fresh environment (Python 3.14.7, Node 24.18.0),
then repairs for everything it exposed. Session log: `.arooohi-dev/SESSION.md`.

- **Faults found:** (1) pinned `pydantic==2.9.2` has no cp314 wheels —
  `pip install -r requirements.txt` failed without a Rust toolchain;
  (2) `test_public_api_contract_is_unchanged` failed — the OpenAPI fixture
  was stale vs. current FastAPI/Pydantic output; (3) `npm run lint` had
  **4 errors** (3 × `react-hooks/set-state-in-effect`, 1 ×
  `no-explicit-any`) — the notes' "0 problems" claim no longer held under
  eslint-plugin-react-hooks v6; (4) 30 `datetime.utcnow()` deprecation
  warnings; (5) the demo DB and its backup are tracked in git on the
  public repo.
- **Repairs:** requirements re-pinned to the verified Python 3.14 set;
  OpenAPI fixture regenerated; `utcnow()` → `now(timezone.utc)
  .replace(tzinfo=None)` in 10 files (naive-UTC semantics kept);
  frontend lint fixed with lazy `useState` initializers, a setState-free
  `fetchRideData()`, and a `MatchCandidate` interface; `.gitignore`
  now blocks `*.db*`.
- **Verified after repairs:** backend **53/53** pytest (was 52/53),
  0 project-code warnings; frontend **lint 0 problems**, `tsc --noEmit`
  clean, `npm run build` clean (21 routes); live boot smoke of both
  servers green; demo DB row counts unchanged.
- **Still open:** purging the committed demo DBs from git history
  (`git filter-repo` — decision pending with Ornab).

## 6. Known gaps & accepted deviations

| Area | Gap | Mitigation / plan |
|------|-----|-------------------|
| Real-time tracking | GPS is 5s polling, not WebSockets (NFR-1 <2s) | Reuse chat WS as template; planned in `PROJECT_PLAN.md` §4 |
| Database | SQLite (SRS: PostgreSQL/PostGIS/MongoDB) | Accepted for demo; WAL + `busy_timeout` + FK indexes done. Postgres/PostGIS + Alembic tracked as Phase 4 of `Code_issues(smells).md` |
| Payments | Simulated gateway only; a live bKash client needs merchant credentials + an HTTPS callback | Routes depend on the `PaymentGateway` interface, so a live client can be added without touching routes, tables or pages |
| Notifications | SOS + auto-share delivery still mocked | ✅ Logic centralized in `app/models/notifications.py` (2026-10-30); swapping in a real sender (SMS/push) only touches that service |
| Verification | Manual doc review (SRS: manual/automated) | Accepted; OCR automation out of scope |
| Mobile | Web only (SRS: React Native) | Future work |
| Tests | Backend: `backend/tests/` (**66 cases**, pytest) in `requirements-dev.txt`, `TemporaryDirectory` conftest (runs on any OS). Browser: `e2e/live-test.js` in-repo, **53 checks, 53/53 with 0 console errors** on 2026-10-30 (Helium; CI uses Playwright Chromium). | The old 54-check regression script was lost when `/tmp` was wiped — pytest covers that ground. Remaining: run the suite against a second browser engine (Firefox/Zen). |
| Code-smell backlog | Verified smells documented with file:line evidence (XSS on demo gateway, `DEMO_MODE` fail-open, god files, no shared API client, TOCTOU join, in-memory state, …) | 4-phase plan in [`Code_issues(smells).md`](./Code_issues(smells).md): **Phases 1–3 ✅ done (2026-10-30)**; Phase 4 (SQLite→Postgres, Alembic, Redis-backed limits/rooms, naive-UTC→`timestamptz`) deferred until the platform migration. |

## 7. Not-yet-fixed defects (tracked in PROJECT_PLAN.md §6)

The 🔴 security/correctness backlog from the Session-8 audit was cleared in the
Session-9 hardening pass (see §5), and the 2026-10-30 code-smell pass closed
Phases 1–3. Remaining gaps are the accepted deviations in §6:
console-mock notification *delivery* (logic centralized in
`app/models/notifications.py`, the sender itself is still a mock), 5s polling
tracking instead of WebSockets (NFR-1 <2s), SQLite instead of
PostgreSQL/PostGIS, a single demo-scale worker (in-memory rate limits + chat
rooms), the demo DBs still present in git history (decision pending), the
unbounded client `points` array, and e2e having run only on Chromium/Helium so
far. Phase 4 of [`Code_issues(smells).md`](./Code_issues(smells).md) collects the
DB/migration items.

## 8. Next actions (priority order)

1. ✅ Done (Sessions 9–13) — see HISTORY/PLAN. Live-browser tests 45/45 (Session 10);
   cross-platform launcher + IPv4 fix (Session 12); desktop-installer attempt reverted (Session 13).
2. ✅ Done — the Session-12 launcher + IPv4 work is committed (HEAD `fcc3cb8`).
3. **All 20 SRS features are implemented.** What remains is non-functional:
   WebSocket live tracking (NFR-1), the SQLite → PostgreSQL question, and
   running the (now in-repo) e2e harness against a second browser engine.
   - Shared `is_ride_participant()` helper created and used across `rides.py` + `chat.py`
   - Mock notifications service consolidated into `app/models/notifications.py`
4. ~~Make the committed test suite runnable~~ — **done 2026-10**: `pytest` + `httpx` pinned in `requirements-dev.txt`, conftest derives the DB path from `TemporaryDirectory`, and the OpenAPI contract fixture was regenerated for current FastAPI/Pydantic (now 66/66 on Python 3.14).
5. ~~Extend coverage: port the Playwright e2e harness~~ — **done 2026-10-09**:
   rebuilt as `e2e/live-test.js` (53 checks, Helium-verified 53/53); re-verified
   53/53 with 0 console errors on 2026-10-30 after the `data-testid` migration.
   The 54-check regression script (`/tmp/opencode/test_backend.py`) was lost
   with the temp dir — the committed pytest suite covers the same ground;
   rebuild only if a gap appears. Remaining: run the e2e against BOTH browser
   engines.
6. Upgrade live tracking to WebSockets (NFR-1).
7. Decide on `git filter-repo` to purge the demo DBs from the public repo's history.
8. ✅ Done — Sprint 5 (Driver Rating #7, Cancellation #18) closed 2026-09-01; all five sprints complete.
9. ✅ Done 2026-10-30 — code-smell Phases 1–3 in
   [`Code_issues(smells).md`](./Code_issues(smells).md): backend
   security/structure, the frontend shared libs + rides split, the e2e
   `data-testid` migration, CI and the e2e seed script. Phase 4 waits for the
   Postgres/Redis migration.
10. **Commit the Phase 1–3 work** (70 files currently uncommitted), then keep
    Phase 4 bundled with the database migration rather than as a standalone pass.
11. Cheap follow-ups once committed: move `init_db()` to the FastAPI lifespan,
    cap/retain tracking points, run e2e on Firefox, and promote the
    `workflow_dispatch` e2e job to a nightly `schedule`.
