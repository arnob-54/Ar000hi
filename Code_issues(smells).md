# Code Issues (Smells) — Audit & Fix Plan

> A pass over backend (`backend/app/`), frontend (`frontend/app/`, `lib/`)
> and `e2e/` looking for code smells. **Every item below is verified** —
> no hearsay; file\:line evidence included so a future session can execute
> without re-analysis.
>
> - Audited: **2026-10-16** (session log: `.arooohi-dev/SESSION.md`)
> - No code changed during the audit.
> - Acceptance gate for **every** phase: backend pytest **66/66** (was 53/53 at
>   audit time) +
>   e2e `node e2e/live-test.js` **53/53, 0 console errors** +
>   `npm run lint` / `tsc --noEmit` / `npm run build` all clean.
>   (After Phase 1+2 the backend gate was **66/66** — see Tracking.)
> - ⚠️ Before touching any frontend file, read the relevant guide in
>   `frontend/node_modules/next/dist/docs/` — this project runs
>   **Next 16.2.11**, and `frontend/AGENTS.md` warns that APIs/conventions
>   differ from older training data.

Statuses: 🔴 fix soon · 🟡 improve · 🟢 nice-to-have.

---

## Phase 1 — quick wins (🔴, ~half a session, do first)

> **Status: ✅ done (2026-10-30).** Backend suite: 66 passed.

| Smell | Evidence | Fix |
|---|---|---|
| ✅ **Reflected XSS on gateway page** (demo-only but real): `error` (from `?error=`) and `payment_id` are interpolated into the server-rendered HTML unescaped | `backend/app/views/checkout.py:49,51,53,78-82`; `backend/app/controllers/bkash_checkout.py:34-41` | `html.escape()` both values in `_render()`; add a pytest asserting `<script>` in `?error=` renders escaped |
| ✅ **`DEMO_MODE` fails open** — unset env defaults to demo mode (`"1"`), which leaks OTP hints in register responses and mounts the unauthenticated gateway | `backend/app/models/auth.py:13`, `backend/app/models/identity.py:16`, `backend/app/main.py:86` | Invert default to fail-closed (`DEMO_MODE` unset ⇒ 0) and set it explicitly in `launch.py`, seed scripts and test conftest; pytest after — 53/53 must hold |
| ✅ **Notifications via bare `print()`** — unstructured, lost in stdout, prints phone numbers; not log-level controllable | `backend/app/models/notifications.py:16-23,34-36` | Swap to the `logging` module (`logger.info("...")`, single source of truth); behavior stays mock, PII redactable later |
| ✅ **Chat silently truncates at 500 chars** — the user loses the tail of their message without warning | `backend/app/models/chat.py:41` | Reject `>500` with a `DomainError(400)` (frontend already renders inline errors) instead of slicing |
| ✅ **`passlib[bcrypt]==1.7.4` pinned but never imported** — exists only to pull `bcrypt` transitively (PROJECT_PLAN §6.3) | `backend/requirements.txt:8`, `backend/app/models/identity.py:3` | Pin `bcrypt` explicitly, drop passlib, re-run pytest |
| ✅ **New modules lack direct tests** — `participants.py`, `notifications.py` shipped with 0 dedicated cases | `grep participants\|notifications backend/tests/` → none | 2 small pytest files (helper permutations; capsys for the logger output) |
| ✅ **e2e cannot run headless** — harness hard-codes `headless: false`, so CI can't drive it | `e2e/live-test.js` (chromium launch call) | Honour a `HEADLESS=1` env (default stays headed/visible for the demo) |

---

## Phase 2 — backend structure (🟡, one session)

> **Status: ✅ done (2026-10-30).** `rides.py` 1159 → 574 lines; every manual
> `conn.close()` in `app/models/` except the two owners (`database.py`,
> `participants.py`) is gone; concurrent-join test added.

| Smell | Evidence | Fix |
|---|---|---|
| ✅ **God file `app/models/rides.py`** — 1152 lines / 21 functions mixing geo math, ~150 lines of hardcoded `HOTSPOTS`+`ZONES` aliases, a 200-line `match_rides` (l.514), splitting, cancellation and chat-read helpers | `wc -l backend/app/models/rides.py` → 1152; `grep -n "^def"` | Split into `geo.py` (haversine/estimate/path — pure functions, unit-testable), `hotspots.py` (the ZONES/HOTSPOTS data — first step toward the seeded-table item in PROJECT_PLAN §6.3), `matching.py`, `cancellation.py`; keep `rides.py` as the ride CRUD orchestrator (the new `hotspots.py` also completes PROJECT_PLAN §6.3's separate "Hardcoded `ZONES`" to-do). `/api` contract must not move (the OpenAPI contract test guards this) |
| ✅ **142 manual `conn.close()` sites, only 2 files use try/finally** — every early `raise` before close leaks the connection; it is also 142 copies of pure boilerplate | 49 in `rides.py` alone; `grep -c "conn.close()" backend/app/models/*.py` | Add a `get_db()` **context manager** to `database.py` (commit on success, close+rollback on exception), then sweep file-by-file: rides → auth → wallet → reviews → tracking … pytest after each file. This is PROJECT_PLAN §6.3's "manual conn.close()" item, now scoped |
| ✅ **Capacity check-then-insert race (TOCTOU) in `join_ride`** — the `SUM(seats)` read and the insert are not atomic; concurrent requests can overbook (single-worker demo masks it) | `backend/app/models/rides.py:291-345` | Inside the new context manager, wrap check+insert in an explicit `BEGIN IMMEDIATE` transaction; add a concurrent-join pytest attempt |
| ✅ **In-memory global state** — login/OTP rate limits live in a module dict; WS chat rooms live in memory too; breaks silently if `uvicorn --workers > 1` is ever used | `backend/app/models/auth.py:20-48` | Isolate behind an `app/models/rate_limit.py` module now (same dict + lock behind an interface); document the single-worker constraint in README; a Redis swap then rides along with the Postgres migration |

---

## Phase 3 — frontend structure (🟡, one session — **read the Next 16 docs first**, see the warning above)

> **Status: ✅ done (2026-10-30).** Rides page 1530 → 320 lines; shared
> `lib/client.ts` / `lib/useApi.ts` / `lib/format.ts` / `lib/badges.tsx` in
> place; e2e **53/53, 0 console errors**; lint / `tsc --noEmit` / build clean.

| Smell | Evidence | Fix |
|---|---|---|
| ✅ **God component** — rides page is 1530 lines with **30 `useState`**, 14 fetch sites, 3 tabs and 3 modals in one file | `frontend/app/dashboard/rides/page.tsx` (1530 lines) | Split into a `dashboard/rides/` feature folder: `ride-card`, `offer-form`, `match-tab`, `modals/{join,cancel,stop}` + a `useRides` hook; keep the UI identical so `e2e/live-test.js` stays green without selector changes |
| ✅ **No shared API client** — 26 hand-rolled `fetch("${API}/…", { headers: authHeaders() })` sites; token read from `localStorage` in 21 files; no global 401 handling (only the chat WS knows close code 4401) | `grep -rn authHeaders frontend/app \| wc -l` → 26 | Add `lib/client.ts`: `apiFetch(path, opts)` injects the token, normalizes `{detail}` errors, and on 401 clears the session and routes to `/login`; add an optional `useApi(url, deps)` hook; migrate page-by-page (wallet + dashboard first) |
| ✅ **Fetches without `AbortController`** — in-flight requests are not cancelled on unmount; a stale response can overwrite newer state after a quick navigation (minor, masked by demo pacing) | every page's `useEffect` + `fetch` chain (e.g. `dashboard/page.tsx`, `history/page.tsx`) | Fold into the new `useApi` hook: pass an `AbortSignal` into `fetch`, call `controller.abort()` in the effect's cleanup; verify under React strict-mode double-mounting |
| ✅ **Duplicated formatting/labels** — 13× `toLocaleString` money/date variants; 3 copy-pasted `statusBadge` maps | `grep -rn toLocaleString frontend/app` | `lib/format.ts` (`fmtMoney`, `fmtDate`, `fmtPhone`) + `lib/badges.tsx`; delete the copies |
| ✅ **e2e relies on presentation classes and 60 `.first()` fallbacks** — `.glass-card` scoping breaks if styling changes; element-order assumptions are brittle | `grep -c ".first()" e2e/live-test.js` → 60 | Add `data-testid` to ride cards + primary buttons on the rides/chat pages, then replace the class-scoped locators; drop `.first()` where the locator becomes unique — run the suite after each swap |
| ✅ **No CI workflow** — all verification is run by hand (pytest, lint, tsc, build, e2e); nothing gates a push | no `.github/workflows/` exists | Add a GitHub Action: backend pytest → `npm run lint && npx tsc --noEmit && npm run build` → `HEADLESS=1 node e2e/live-test.js` (enabled by the Phase-1 headless flag). e2e needs both servers, so either boot them in the workflow or split that step out once the harness supports a self-contained mode |

**Phase 3 follow-ups found while executing:**
- ✅ **Dead `/dashboard/track` link** — the ride card's "Live Map Tracking"
  button pointed at a route that never existed, so Next prefetched a 404 on
  every rides render (the last console-hygiene failures). It now targets
  `/dashboard`, where tracking actually lives.
- The e2e job in `.github/workflows/ci.yml` is `workflow_dispatch`-only:
  backend + frontend lint/tsc/build gate each push, while the browser suite
  needs both servers, a seeded DB and Chromium, so it runs on demand.
- `backend/seed_e2e.py` creates the fixed driver/rider/intruder accounts the
  browser suite assumes (idempotent; admin comes from `init_db()`).

---

## Phase 4 — deferred until the platform leap (with Postgres/Redis)

| Smell | Evidence | Plan |
|---|---|---|
| **SQLite + 11 ad-hoc `_ensure_column()` migrations** — schema drift managed by idempotent patchwork | `grep -rc ensure_column backend/app` | When Postgres lands: port the schema, adopt **Alembic**, freeze migrations in place; then revisit naive-UTC datetimes → `timestamptz` in the same pass (accepted deviation — must not straddle migrations) |
| **`SELECT *` ×30** — couples code to schema shape | `grep -rn "SELECT \*" backend/app` | Opportunistic only — enumerate columns when already touching a function |
| **f-string SQL fragments** — `status_sql` is a hardcoded dual-literal (safe today), but the pattern invites injection if copied | `backend/app/models/history.py:37-41,62-68` | Prefer parameterized booleans or whitelisted fragments; add a comment marker if the pattern spreads |
| **Naive-UTC datetimes (documented tradeoff)** | `SESSION.md` (2026-10-07 repairs) | Timestamps carry `tzinfo=None` by design; single Alembic conversion when the DB migrates |

---

## Tracking

- Flip table rows ✅ as phases land, and mirror anything user-visible into
  `PROJECT_PROGRESS.md` §5 (Recent fixes).
- **2026-10-30:** Phase 1 ✅, Phase 2 ✅ and Phase 3 ✅. Backend suite at
  66 passed (was 53); e2e 53/53 with 0 console errors; lint / `tsc --noEmit` /
  build clean. Phase 4 stays deferred by design (Postgres/Redis migration).
- Phase 1 could be bundled with any small session; Phases 2 and 3 each got a
  dedicated session. All three are done; the work is **uncommitted as of
  2026-10-30** and ready for review/commit.
- Phase 2 ran in the planned order: context-manager first (`rides.py`), then
  the `rides.py` split.
- Phase 4 should stay bundled with the Postgres/Redis migration, not run as a
  standalone SQLite pass.

## Related

- `PROJECT_PLAN.md` §6 — the wider code-quality backlog (points here for §6.5).
- `.arooohi-dev/SESSION.md` — the audit session's log.
- `.arooohi-dev/HISTORY.md` — running session history.
