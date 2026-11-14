<div align="center">

# Arooohi

### A campus ride-sharing platform for the BRAC University community

**A safety-conscious, student-to-student web application for coordinating shared rides, managing trip logistics, and making campus journeys more accessible.**

[Features](#features) · [Architecture](#architecture) · [Getting started](#getting-started) · [Testing](#testing) · [Documentation](#documentation)

</div>

---

## Overview

Arooohi is a web-based ride-sharing project designed around the needs of the BRAC University community. It brings riders and student drivers together in a university-focused environment, with tools for finding compatible trips, coordinating multi-stop journeys, and sharing essential ride information.

The project treats trust, safety, and transparent trip costs as core product concerns—not merely interface features. University-email verification, driver review, role-aware access controls, trusted contacts, SOS workflows, and ride-specific communication complement its matching, booking, and payment capabilities.

Arooohi is implemented as a separate Next.js frontend and FastAPI backend. Its documented functional scope comprises **20 requirements from the project’s software requirements specification (SRS)**. The repository also includes an implementation roadmap, progress report, API reference, architecture guide, automated tests, and a cross-platform local launcher.

> **Project and deployment status:** Arooohi is a demonstration and academic project, not a production transportation or financial service. Its current implementation uses SQLite, simulated bKash checkout, and mocked notification delivery. GPS tracking uses periodic polling. The current state and known gaps are recorded in [`PROJECT_PROGRESS.md`](./PROJECT_PROGRESS.md) and [`PROJECT_PLAN.md`](./PROJECT_PLAN.md); consult those documents before relying on any status figures in this README.

## Features

The feature set is organized below by user and system purpose. The project progress report records all 20 SRS features as implemented; implementation status does not imply that external integrations or production-scale operations are complete.

### Identity and trust

- **BRAC University student verification** using university email and a one-time verification code.
- **Driver and vehicle-document review** with an administrative approval workflow.
- **Female-only ride mode**, with eligibility enforced by the backend.
- **Trusted-contact management** and ride-share history.
- **SOS alerts** with a workflow for administrative review and resolution.

### Ride planning and coordination

- **Campus-aware ride matching** using pickup, destination, timing, and route information.
- **Campus pickup hotspots** and selectable locations.
- **Scheduled bookings**, seat-aware ride requests, and capacity checks.
- **Multi-stop trips** with ordered stops and progress updates.
- **Ride-specific chat** using WebSockets, with persisted message history and participant checks.
- **Live ride tracking** with a shareable tracking link. The current implementation polls periodically rather than streaming GPS updates over WebSockets.

### Payments, accountability, and impact

- **Fare estimation and passenger cost splitting**, including seat-weighted allocation and rounding designed to preserve the total.
- **Peak-hour demand indicators** using the `Asia/Dhaka` timezone.
- **Wallet ledger and simulated bKash checkout** behind a payment-gateway interface. No live bKash integration is included.
- **Ride history and receipts** for riders and drivers.
- **Driver earnings summaries** based on wallet-ledger entries.
- **Post-ride driver ratings and reviews**.
- **Ride cancellation policy and penalties** with a preview before cancellation.
- **Complaint administration** and an **eco/footprint tracker** for estimated emissions savings.

## Technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Leaflet, React Leaflet |
| Backend | Python 3.14, FastAPI, Pydantic, Uvicorn |
| Persistence | SQLite (`sqlite3`), with WAL-mode and database constraints used by the current implementation |
| Authentication | JWT (HS256) and bcrypt password hashing |
| Realtime features | WebSockets for ride chat; periodic HTTP polling for GPS tracking |
| Testing | pytest, HTTPX, Playwright-based end-to-end harness, ESLint, TypeScript checks |
| Local development | Cross-platform Python launcher for Linux, macOS, and Windows |

## Architecture

Arooohi separates its web interface from its API and applies an API-oriented MVC organization to the backend:

```text
Browser
  └── Next.js / React interface
        ├── Pages, components, forms, and maps
        └── REST and WebSocket requests
              └── FastAPI controllers
                    ├── Authentication and request validation
                    └── Domain models and business rules
                          └── SQLite persistence / payment gateway interface
```

- **View:** `frontend/app/` and `frontend/components/` render pages and interactive UI.
- **Controller:** `backend/app/controllers/` handles HTTP and WebSocket endpoints, authentication dependencies, and response dispatch.
- **Model:** `backend/app/models/` contains domain behavior, business rules, and persistence operations.
- **Schemas:** `backend/app/schemas/` defines and validates request data.
- **Infrastructure:** `backend/app/payments/` defines the gateway abstraction and simulated checkout implementation.

This is a separate React frontend with an MVC-organized API backend, rather than a traditional server-rendered MVC application. See [`MVC_ARCHITECTURE.md`](./MVC_ARCHITECTURE.md) for a fuller explanation and a traced booking flow.

## Repository layout

```text
.
├── backend/
│   ├── app/                  # FastAPI application, controllers, models, schemas, views
│   ├── tests/                # Backend pytest suite
│   ├── API.md                # API and demo deployment notes
│   ├── requirements.txt      # Backend runtime dependencies
│   └── requirements-dev.txt  # Backend test dependencies
├── e2e/
│   └── live-test.js          # Browser end-to-end test harness
├── frontend/
│   ├── app/                  # Next.js routes and pages
│   ├── components/           # Shared UI and map components
│   └── lib/                  # API configuration and shared frontend utilities
├── scripts/                  # Project helper scripts
├── launch.py                 # Cross-platform launcher
├── launch.sh                 # Unix launcher wrapper
├── launch.bat                # Windows launcher wrapper
├── MVC_ARCHITECTURE.md       # Architecture and demonstration guide
├── PROJECT_PLAN.md           # Roadmap, design decisions, and known backlog
└── PROJECT_PROGRESS.md       # Feature status and verification notes
```

## Getting started

### Prerequisites

- Python **3.14** (the checked-in backend dependency pins are documented as verified for this version).
- Node.js and npm; the progress report documents verification with Node.js 24.
- A modern web browser.

The Python launcher starts the backend and frontend and can open the application in a browser. It expects Python, Node.js, npm, and the backend/frontend dependencies to be available. The first run may take time while the frontend installs or builds its local dependencies, depending on your environment.

### Option A: use the launcher

From the repository root:

```bash
python launch.py
```

On systems where Python 3 is invoked as `python3`:

```bash
python3 launch.py
```

The launcher starts the FastAPI backend at `http://127.0.0.1:8000` and the Next.js frontend at `http://127.0.0.1:3000`. By default it opens the site in a browser; use `--no-browser` to leave the servers running without opening one, `status` to inspect launcher-managed servers, or `stop` to shut them down. Run `python launch.py --help` for browser and window options.

### Option B: start the services manually

#### 1. Set up the backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```bash
# Linux / macOS
source .venv/bin/activate

# Windows PowerShell
.venv\Scripts\Activate.ps1
```

Install runtime dependencies and start the API in explicit demo mode:

```bash
python -m pip install -r requirements.txt
DEMO_MODE=1 python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

For Windows Command Prompt, set the environment variable separately before starting Uvicorn:

```bat
set DEMO_MODE=1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The backend API documentation is available at `http://127.0.0.1:8000/docs` when the service is running. The health endpoint is `http://127.0.0.1:8000/api/health`.

#### 2. Set up the frontend

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://127.0.0.1:3000` in your browser. The frontend defaults to the local API at `http://127.0.0.1:8000`. To use another backend address, set `NEXT_PUBLIC_API_URL` in the frontend environment before starting or building Next.js, for example:

```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npm run dev
```

The optional `frontend/.env.example` documents `NEXT_PUBLIC_CARTO_BASEMAP_KEY` for the CARTO raster basemap. Add any real key to a local environment file or hosting-provider settings; **never commit secrets**.

### Demo mode and configuration

`DEMO_MODE` is deliberately **fail-closed**: if unset or set to `0`, demo-only behavior is disabled. The local launcher opts into demo mode if the variable is not already set. Demo mode enables the simulated bKash checkout and demo-oriented verification behavior; it does not connect to a live payment provider.

Useful backend settings documented by the project include:

| Variable | Purpose |
| --- | --- |
| `DEMO_MODE` | Set to `1` only for local demonstration and testing; use `0` outside demo use. |
| `SECRET_KEY` | Required for non-demo operation; use a strong, private value. Do not commit it. |
| `DATABASE_PATH` | SQLite database location; defaults to `backend/arooohi.db`. |
| `FRONTEND_PUBLIC_URL` | Public frontend base URL used by the backend for redirects; defaults to the local frontend address. |
| `NEXT_PUBLIC_API_URL` | Frontend's backend base URL; defaults to `http://127.0.0.1:8000`. |
| `NEXT_PUBLIC_CARTO_BASEMAP_KEY` | Optional map basemap key, configured in the frontend environment. |

For a demo, the backend documentation recommends **a single Uvicorn worker**. Some rate-limit, WebSocket-room, and simulated-gateway state is process-local; multiple workers can therefore produce inconsistent behavior. This application has not been hardened or validated for production deployment.

## Testing

### Backend tests

Install development dependencies and run the test suite from the repository root:

```bash
python -m pip install -r backend/requirements-dev.txt
python -m pytest backend/tests -q
```

The test configuration uses an isolated temporary database. It is designed to avoid exercising the local demonstration database.

### Frontend checks

```bash
cd frontend
npm ci
npm run lint
npx tsc --noEmit
npm run build
```

### Browser end-to-end tests

The repository includes `e2e/live-test.js`. The documented workflow uses a running backend and frontend plus seeded end-to-end data; see [`PROJECT_PROGRESS.md`](./PROJECT_PROGRESS.md) for the recorded setup and test notes. The harness requires a compatible Chromium browser installation. It writes its report and screenshots under `e2e/`; consult the test file and ignore rules for runtime details before running it.

The repository also contains a GitHub Actions workflow at [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) for automated checks. The browser test has separate runtime prerequisites; see the workflow and project test notes for its execution mode.

## API and project documentation

- [Backend API reference](./backend/API.md) — endpoints, authentication expectations, WebSocket chat, and demo deployment constraints.
- [MVC architecture guide](./MVC_ARCHITECTURE.md) — responsibilities, a booking trace, and testing notes.
- [Project plan and roadmap](./PROJECT_PLAN.md) — requirements mapping, implementation decisions, and remaining work.
- [Project progress report](./PROJECT_PROGRESS.md) — feature status, verification evidence, and known limitations.
- [Code-quality audit](./Code_issues(smells).md) — documented code-quality findings and follow-up phases.
- [Faculty demonstration guide](./Faculty_Demo_Guide.pdf) — presentation-oriented material.
- Interactive API docs while running: `http://127.0.0.1:8000/docs`.

## Limitations and responsible use

Arooohi is an academic/demo implementation. In particular:

- **No live payments:** the bKash flow is simulated; do not enter real payment credentials or treat the wallet as real money.
- **No real emergency dispatch:** SOS and trusted-contact notifications use mocked delivery. They do not contact emergency services or guarantee that another person receives an alert.
- **Tracking is not continuous real-time streaming:** location updates use periodic polling, and share links should be treated as sensitive.
- **Demo operation is not production operation:** SQLite, in-process state, demo verification behavior, and single-worker constraints limit deployment and scaling options.
- **Not a safety guarantee:** the application cannot verify the identity or conduct of every user or guarantee the safety, availability, legality, or suitability of any ride.

Do not use the project as the sole means of emergency communication, as a live payment service, or as a production transport platform without substantial security, operational, legal, and integration work.

## Roadmap

The project progress report records all 20 SRS features as implemented. Work that remains is primarily non-functional: evaluating a PostgreSQL/PostGIS migration, upgrading GPS delivery, replacing mocked notifications with a real provider, and improving multi-process scalability and browser coverage. See [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) and [`PROJECT_PROGRESS.md`](./PROJECT_PROGRESS.md) for the maintained details; implementation and verification status may evolve.

## Contributing

Contributions, issue reports, and thoughtful design feedback are welcome. Before proposing a change:

1. Review the [architecture guide](./MVC_ARCHITECTURE.md) and the relevant [API documentation](./backend/API.md).
2. Check the [project plan](./PROJECT_PLAN.md) and [progress report](./PROJECT_PROGRESS.md) for existing decisions and known limitations.
3. Keep business rules and authorization checks on the backend; frontend controls alone are not security boundaries.
4. Add or update tests, and run the backend and frontend checks relevant to your change.
5. Never include secrets, personal data, real payment credentials, or unneeded database files in a commit.

## License

No license file is currently identified in the repository. Unless and until a license is added, all rights remain with the copyright holder; reuse, redistribution, and modification are not granted by this README. Please contact the repository owner regarding permissions.

---

<div align="center">

**Arooohi — making campus journeys more collaborative, transparent, and thoughtfully designed.**

</div>
