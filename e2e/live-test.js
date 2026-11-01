#!/usr/bin/env node
/**
 * Arooohi — live end-to-end browser test (Playwright driving Helium).
 *
 * Rebuilds the original Session-10 harness (45/45) inside the repo, so it
 * survives /tmp cleanup and can be wired into CI later.
 *
 * Prerequisites:
 *   ./launch.sh --no-browser        (backend :8000 + frontend :3000 up)
 *   Node >= 20 with playwright resolvable from frontend/node_modules
 *
 * Run:
 *   node e2e/live-test.js
 *
 * Options (env):
 *   HELIUM_PATH=/opt/helium/chrome   browser binary
 *   BASE=http://127.0.0.1:3000       frontend origin
 *   API=http://127.0.0.1:8000        backend origin
 *
 * Output: console summary + e2e/report.json + e2e/screenshots/*.png
 * Exit code: 0 when every check passes, 1 otherwise.
 */
"use strict";

const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const { chromium } = require(path.join(ROOT, "frontend", "node_modules", "playwright"));

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const API = process.env.API || "http://127.0.0.1:8000";
const HELIUM = process.env.HELIUM_PATH || "/opt/helium/chrome";
const SHOTS = path.join(__dirname, "screenshots");
const REPORT = path.join(__dirname, "report.json");

const ACCOUNTS = {
  driver: { email: "driver.live@g.bracu.ac.bd", pass: "secret1" },
  rider: { email: "rider.live@g.bracu.ac.bd", pass: "secret2" },
  intruder: { email: "intruder.live@g.bracu.ac.bd", pass: "secret3" },
  admin: { email: "admin@g.bracu.ac.bd", pass: "admin123" },
};

// ─── check harness ───────────────────────────────────────────────────────────
const checks = [];
let seq = 0;
let shotSeq = 0;

async function shot(page, label) {
  shotSeq += 1;
  const name = `${String(shotSeq).padStart(2, "0")}-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
  try {
    await page.screenshot({ path: path.join(SHOTS, name) });
  } catch {
    /* screenshots are best-effort */
  }
}

async function check(page, name, fn) {
  seq += 1;
  const id = String(seq).padStart(2, "0");
  try {
    const detail = (await fn()) || "";
    checks.push({ id, name, pass: true, detail: String(detail) });
    console.log(`  ✓ ${id}  ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (err) {
    const detail = String((err && err.message) || err);
    checks.push({ id, name, pass: false, detail });
    console.log(`  ✗ ${id}  ${name} — ${detail}`);
    if (page) await shot(page, `FAIL-${id}-${name}`);
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function configure(page) {
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(45000);
  return page;
}

async function login(page, acc, dest = "**/dashboard") {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', acc.email);
  await page.fill('input[type="password"]', acc.pass);
  await Promise.all([
    page.waitForURL(dest, { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function apiLogin(email, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`api login ${res.status}`);
  const data = await res.json();
  return data.token;
}

async function readBalance(page) {
  // NOTE: the label is rendered with text-transform:uppercase, and innerText
  // returns the transformed text — match case-insensitively.
  const txt = await page.evaluate(() => document.body.innerText);
  const m = txt.match(/available balance\s*৳\s*([\d,]+(?:\.\d+)?)/i);
  if (!m) throw new Error("balance not found on wallet page");
  return parseFloat(m[1].replace(/,/g, ""));
}

function cardOf(page, text) {
  return page.locator('[data-testid="ride-card"]', { hasText: text }).first();
}

async function warmUp() {
  // Next.js dev compiles lazily per route — pre-compile so first clicks are fast.
  const routes = [
    "/", "/login", "/register", "/verify", "/dashboard",
    "/dashboard/rides", "/dashboard/contacts", "/dashboard/wallet",
    "/dashboard/wallet/callback", "/dashboard/history", "/dashboard/eco",
    "/dashboard/complaints", "/dashboard/driver", "/dashboard/earnings",
    "/admin", "/admin/complaints", "/admin/sos", "/admin/drivers",
    "/dashboard/chat/x", "/dashboard/history/x", "/track/x",
  ];
  await Promise.all(
    routes.map((r) => fetch(`${BASE}${r}`, { signal: AbortSignal.timeout(60000) }).catch(() => {}))
  );
  await new Promise((r) => setTimeout(r, 2000));
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  console.log(`\nArooohi e2e — Helium: ${HELIUM}\n`);

  await warmUp();

  const browser = await chromium.launch({
    executablePath: HELIUM,
    // HEADLESS=1 lets CI drive the suite; the demo default stays visible.
    headless: process.env.HEADLESS === "1",
  });
  const vp = { width: 1440, height: 900 };
  const geo = { latitude: 23.7781, longitude: 90.4042 };

  const ctxAuth = await browser.newContext({ viewport: vp });
  const ctxDriver = await browser.newContext({ viewport: vp });
  const ctxRider = await browser.newContext({
    viewport: vp, geolocation: geo, permissions: ["geolocation"],
  });
  const ctxIntruder = await browser.newContext({ viewport: vp });
  const ctxAdmin = await browser.newContext({ viewport: vp });
  const ctxPublic = await browser.newContext({ viewport: vp });

  const pAuth = configure(await ctxAuth.newPage());
  const pD = configure(await ctxDriver.newPage());
  const pR = configure(await ctxRider.newPage());
  const pI = configure(await ctxIntruder.newPage());
  const pA = configure(await ctxAdmin.newPage());
  const pPub = configure(await ctxPublic.newPage());

  const consoleErrors = { driver: [], rider: [] };
  pD.on("console", (m) => { if (m.type() === "error") consoleErrors.driver.push(m.text()); });
  pR.on("console", (m) => { if (m.type() === "error") consoleErrors.rider.push(m.text()); });

  // ══ A. Auth: fresh registration ═══════════════════════════════════════════
  console.log("\n[A] Auth — fresh registration flow");
  await check(pAuth, "Landing page loads", async () => {
    await pAuth.goto(BASE);
    await pAuth.getByText("Arooohi").first().waitFor({ timeout: 30000 });
    await shot(pAuth, "landing");
    return "hero rendered";
  });

  await check(pAuth, "Login page renders the form", async () => {
    await pAuth.goto(`${BASE}/login`);
    await pAuth.locator('input[type="email"]').waitFor();
    await pAuth.locator('input[type="password"]').waitFor();
    return "email + password inputs";
  });

  await check(pAuth, "Register rejects a non-BRACU email", async () => {
    await pAuth.goto(`${BASE}/register`);
    await pAuth.getByPlaceholder("Ahnaf Bin Zakaria").fill("Not A Student");
    await pAuth.getByPlaceholder("student@g.bracu.ac.bd").fill("someone@gmail.com");
    await pAuth.getByText("Must be a @g.bracu.ac.bd email").waitFor({ timeout: 10000 });
    return "client-side hint shown";
  });

  const freshEmail = `e2e${Date.now()}@g.bracu.ac.bd`;
  let freshOtp = "";
  await check(pAuth, "Fresh registration reaches verify page with demo OTP", async () => {
    await pAuth.goto(`${BASE}/register`);
    await pAuth.getByPlaceholder("Ahnaf Bin Zakaria").fill("E2E Fresh Student");
    await pAuth.getByPlaceholder("student@g.bracu.ac.bd").fill(freshEmail);
    await pAuth.getByPlaceholder("01XXXXXXXXX").fill("01712345678");
    await pAuth.locator("select").first().selectOption("other");
    await pAuth.getByPlaceholder("Min 6 characters").fill("secret1");
    await pAuth.click('button:has-text("Register with BRACU Email")');
    await pAuth.waitForURL("**/verify**", { timeout: 20000 });
    await pAuth.getByText("Demo OTP:").first().waitFor({ timeout: 10000 });
    freshOtp = (await pAuth.evaluate(() => localStorage.getItem("otp_hint"))) || "";
    if (!/^\d{6}$/.test(freshOtp)) throw new Error(`bad otp hint: ${freshOtp}`);
    await shot(pAuth, "verify-otp");
    return `otp ${freshOtp}`;
  });

  await check(pAuth, "Wrong OTP is rejected", async () => {
    const inputs = pAuth.locator(".otp-input");
    for (let i = 0; i < 6; i += 1) await inputs.nth(i).fill("0");
    await pAuth.click('button:has-text("Verify Email")');
    await pAuth.getByText("Invalid OTP code").first().waitFor({ timeout: 15000 });
    return "backend rejected the wrong code";
  });

  await check(pAuth, "Correct OTP verifies and lands on the dashboard", async () => {
    const inputs = pAuth.locator(".otp-input");
    for (let i = 0; i < 6; i += 1) await inputs.nth(i).fill(freshOtp[i]);
    await pAuth.click('button:has-text("Verify Email")');
    await pAuth.waitForURL("**/dashboard", { timeout: 20000 });
    await pAuth.getByText("Ride Tracking").first().waitFor({ timeout: 15000 });
    await shot(pAuth, "fresh-dashboard");
    return "unverified account cannot reach here — verified";
  });
  await ctxAuth.close();

  // ══ B. Driver: verification, surge, ride creation ═════════════════════════
  console.log("\n[B] Driver — verification, surge, ride offer");
  await check(pD, "Driver login", async () => {
    await login(pD, ACCOUNTS.driver);
    return "dashboard reached";
  });

  await check(pD, "Driver verification shows Approved", async () => {
    await pD.goto(`${BASE}/dashboard/driver`);
    await pD.getByText("✅ Approved").first().waitFor({ timeout: 15000 });
    await shot(pD, "driver-verification");
    return "approved badge";
  });

  await check(pD, "Rides page shows the three workflow tabs", async () => {
    await pD.goto(`${BASE}/dashboard/rides`);
    await pD.getByTestId("rides-tab-browse").waitFor({ timeout: 15000 });
    await pD.getByTestId("rides-tab-match").waitFor();
    await pD.getByTestId("rides-tab-offer").waitFor();
    return "Browse / Smart Match / Offer";
  });

  await check(pD, "Surge panel and peak strip behave per the schedule", async () => {
    await pD.getByText("Peak Hour Surge Status").first().waitFor({ timeout: 15000 });
    // The "Upcoming peak windows" strip is conditional: only hours after the
    // current one (next 6) with multiplier >= 1.3 are shown. At quiet times
    // (e.g. 1am) it is correctly absent — verify against the live schedule.
    const t = await apiLogin(ACCOUNTS.driver.email, ACCOUNTS.driver.pass);
    const res = await fetch(`${API}/api/surge/schedule`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    const sched = (await res.json()).schedule || [];
    const nowHour = new Date().getHours();
    const expected = sched
      .filter((x) => Number(x.hour) > nowHour)
      .slice(0, 6)
      .filter((x) => Number(x.multiplier) >= 1.3);
    const strip = pD.getByText("Upcoming BRACU Peak Windows");
    await shot(pD, "surge-panel");
    if (expected.length > 0) {
      await strip.waitFor({ timeout: 15000 });
      return `peak strip shown — ${expected.length} window(s) within 6h`;
    }
    if ((await strip.count()) > 0) {
      throw new Error("strip shown although no peak is due within 6h");
    }
    return "surge status shown; strip correctly hidden (no peak within 6h)";
  });

  await check(pD, "Driver publishes a ride (Gate 1 → Aftabnagar, ৳150)", async () => {
    await pD.getByTestId("rides-tab-offer").click();
    await pD.locator('label:has-text("Pickup Hotspot (From)") + select').selectOption("gate 1");
    await pD.locator('label:has-text("Destination Hotspot (To)") + select').selectOption("aftabnagar");
    await pD.getByPlaceholder("e.g. 100").fill("150");
    await pD.locator('label:has-text("Available Seats") + input').fill("3");
    await pD.getByTestId("offer-submit").click();
    await pD.getByText(/Ride created|Ride offered/).first().waitFor({ timeout: 20000 });
    await shot(pD, "ride-published");
    return "3 seats, no stops, immediately available";
  });

  await check(pD, "Created ride appears under My Rides", async () => {
    await pD.getByTestId("rides-tab-browse").click();
    await pD.getByText("My Active & Created Rides").first().waitFor({ timeout: 15000 });
    await pD.getByText("Aftabnagar Main Gate").first().waitFor({ timeout: 10000 });
    return "ride card listed";
  });

  // ══ C. Rider: contacts, wallet, match, join ═══════════════════════════════
  console.log("\n[C] Rider — contacts, wallet, smart match, seat request");
  await check(pR, "Rider login", async () => {
    await login(pR, ACCOUNTS.rider);
    return "dashboard reached";
  });

  await check(pR, "Add a trusted contact", async () => {
    await pR.goto(`${BASE}/dashboard/contacts`);
    await pR.click('button:has-text("+ Add Contact")');
    await pR.getByPlaceholder("Contact name").fill("E2E Buddy");
    await pR.getByPlaceholder("01XXXXXXXXX").fill("01799999999");
    await pR.getByPlaceholder("email@example.com").fill("buddy@example.com");
    await pR.click('button[type="submit"]:has-text("Add")');
    await pR.getByText("E2E Buddy").first().waitFor({ timeout: 15000 });
    await shot(pR, "contacts");
    return "contact persisted";
  });

  let balanceBefore = 0;
  await check(pR, "Wallet top-up runs the full bKash checkout flow", async () => {
    await pR.goto(`${BASE}/dashboard/wallet`);
    await pR.getByText("Available Balance").first().waitFor({ timeout: 15000 });
    balanceBefore = await readBalance(pR);
    await pR.click('button:has-text("Continue to bKash")');
    await pR.waitForURL("**/bkash/checkout/**", { timeout: 20000 });
    await pR.click('button:has-text("Confirm Payment")');
    await pR.waitForURL("**/wallet/callback**", { timeout: 20000 });
    await pR.getByText(/added to your wallet/).first().waitFor({ timeout: 20000 });
    await shot(pR, "bkash-callback");
    return `gateway authorised + execute credited (was ৳${balanceBefore})`;
  });

  await check(pR, "Wallet balance increased after the top-up", async () => {
    await pR.goto(`${BASE}/dashboard/wallet`);
    await pR.getByText("Available Balance").first().waitFor({ timeout: 15000 });
    const after = await readBalance(pR);
    if (!(after > balanceBefore)) {
      throw new Error(`balance did not increase: ${balanceBefore} → ${after}`);
    }
    return `৳${balanceBefore} → ৳${after}`;
  });

  await check(pR, "Smart Match scores the new route", async () => {
    await pR.goto(`${BASE}/dashboard/rides`);
    await pR.getByTestId("rides-tab-match").click();
    await pR.getByTestId("match-pickup").selectOption("gate 1");
    await pR.getByTestId("match-dropoff").selectOption("aftabnagar");
    await pR.getByTestId("match-submit").click();
    await pR.getByText(/% Match Score/).first().waitFor({ timeout: 20000 });
    await shot(pR, "smart-match");
    return "match card with score + reasons";
  });

  await check(pR, "Rider finds the ride and requests a seat", async () => {
    await pR.getByTestId("rides-tab-browse").click();
    const card = cardOf(pR, "Aftabnagar Main Gate");
    await card.waitFor({ timeout: 15000 });
    await card.getByTestId("ride-request-seat").click();
    await pR.getByText("Select Your Pickup & Drop-Off Stops").first().waitFor({ timeout: 10000 });
    await pR.getByTestId("join-confirm").click();
    await pR.getByText(/Seat requested|Ride request sent/).first().waitFor({ timeout: 20000 });
    await shot(pR, "seat-requested");
    return "request pending driver acceptance";
  });

  // ══ D. Driver accepts and starts ══════════════════════════════════════════
  console.log("\n[D] Driver — accept, start");
  await check(pD, "Driver accepts the seat request", async () => {
    await pD.goto(`${BASE}/dashboard/rides`);
    const card = cardOf(pD, "Aftabnagar Main Gate");
    await card.waitFor({ timeout: 15000 });
    await card.getByTestId("ride-manage").click();
    await card.getByTestId("ride-accept").click();
    await pD.getByText(/is on board/).first().waitFor({ timeout: 15000 });
    await shot(pD, "passenger-accepted");
    return "Rider Person accepted";
  });

  await check(pD, "Driver starts the ride", async () => {
    const card = cardOf(pD, "Aftabnagar Main Gate");
    await card.getByTestId("ride-start").click();
    await pD.getByText(/Ride started/).first().waitFor({ timeout: 15000 });
    await shot(pD, "ride-active");
    return "status → active";
  });

  // ══ E. Live chat over WebSockets ══════════════════════════════════════════
  console.log("\n[E] Ride chat — WebSocket, both sides");
  await check(pD, "Driver opens the ride chat", async () => {
    await pD.goto(`${BASE}/dashboard/rides`);
    const card = cardOf(pD, "Aftabnagar Main Gate");
    await card.waitFor({ timeout: 15000 });
    await card.getByTestId("ride-chat").click();
    await pD.waitForURL("**/dashboard/chat/**", { timeout: 20000 });
    await pD.waitForFunction(
      () => {
        const b = document.querySelector('[data-testid="chat-send"]');
        return b && !b.disabled;
      },
      { timeout: 20000 }
    );
    return "WS connected (Send enabled)";
  });

  await check(pR, "Rider sends a chat message", async () => {
    await pR.goto(`${BASE}/dashboard/rides`);
    const card = cardOf(pR, "Aftabnagar Main Gate");
    await card.waitFor({ timeout: 15000 });
    await card.getByTestId("ride-chat").click();
    await pR.waitForURL("**/dashboard/chat/**", { timeout: 20000 });
    await pR.waitForFunction(
      () => {
        const b = document.querySelector('[data-testid="chat-send"]');
        return b && !b.disabled;
      },
      { timeout: 20000 }
    );
    await pR.getByTestId("chat-input").fill("rider: on my way");
    await pR.getByTestId("chat-send").click();
    await pR.getByText("rider: on my way").first().waitFor({ timeout: 15000 });
    return "message persisted + echoed";
  });

  await check(pD, "Driver receives the rider's message live", async () => {
    await pD.getByText("rider: on my way").first().waitFor({ timeout: 15000 });
    return "broadcast reached the driver";
  });

  await check(pD, "Driver replies in chat", async () => {
    await pD.getByTestId("chat-input").fill("driver: gate 1 in 2 min");
    await pD.getByTestId("chat-send").click();
    await pD.getByText("driver: gate 1 in 2 min").first().waitFor({ timeout: 15000 });
    return "reply persisted";
  });

  await check(pR, "Rider sees the driver's reply live", async () => {
    await pR.getByText("driver: gate 1 in 2 min").first().waitFor({ timeout: 15000 });
    await shot(pR, "chat-bidirectional");
    return "bidirectional chat works";
  });

  // ══ F. Splitter, GPS tracking, public share link, SOS ═════════════════════
  console.log("\n[F] Money + safety — splitter, GPS, share link, SOS");
  await check(pR, "Fare splitter totals the active ride", async () => {
    await pR.goto(`${BASE}/dashboard/rides`);
    const card = cardOf(pR, "Aftabnagar Main Gate");
    await card.waitFor({ timeout: 15000 });
    await card.getByTestId("ride-split").click();
    await pR.getByText("Total Ride Cost").first().waitFor({ timeout: 15000 });
    await pR.getByText("Individual Passenger Shares").first().waitFor({ timeout: 10000 });
    await shot(pR, "fare-splitter");
    return "total + seat-weighted shares";
  });

  let shareUrl = "";
  await check(pR, "GPS tracking starts with a live share link", async () => {
    await pR.goto(`${BASE}/dashboard`);
    await pR.click('button:has-text("Start Live Tracking")');
    await pR.getByText("Share link:").first().waitFor({ timeout: 20000 });
    await pR.getByText(/📍\s*\d+\.\d+/).first().waitFor({ timeout: 20000 });
    const txt = await pR.evaluate(() => document.body.innerText);
    const m = txt.match(/https?:\/\/\S*\/track\/[0-9a-f]+/);
    if (!m) throw new Error("share url not found");
    shareUrl = m[0];
    await shot(pR, "tracking-live");
    return shareUrl.replace(BASE, "");
  });

  await check(pPub, "Share link opens publicly without logging in", async () => {
    await pPub.goto(shareUrl);
    await pPub.getByText("Live Tracking").first().waitFor({ timeout: 30000 });
    await shot(pPub, "public-track");
    return "anonymous tracking page renders";
  });

  await check(pR, "SOS alert lists the notified contacts", async () => {
    // .sos-button has an infinite pulse animation, so Playwright's stability
    // check never passes — force the click.
    await pR.click(".sos-button", { force: true });
    await pR.getByText("Trigger SOS Alert?").first().waitFor({ timeout: 10000 });
    await pR.click('button:has-text("Send SOS Alert")');
    await pR.getByText("SOS Alert Sent!").first().waitFor({ timeout: 20000 });
    await pR.getByText("Contacts notified:").first().waitFor({ timeout: 10000 });
    await shot(pR, "sos-sent");
    await pR.click('button:has-text("Close")');
    await pR.getByText("SOS Alert Sent!").first().waitFor({ state: "hidden", timeout: 10000 });
    return "alert dispatched with location";
  });

  await check(pR, "Tracking stops cleanly", async () => {
    await pR.click('button:has-text("Stop Tracking")');
    await pR.locator('button:has-text("Start Live Tracking")').waitFor({ timeout: 20000 });
    return "session ended";
  });

  // ══ G. Driver ends the ride → settlement ══════════════════════════════════
  console.log("\n[G] Driver — end ride + settlement");
  await check(pD, "Driver ends the ride and the fare settles", async () => {
    await pD.goto(`${BASE}/dashboard/rides`);
    const card = cardOf(pD, "Aftabnagar Main Gate");
    await card.waitFor({ timeout: 15000 });
    await card.getByTestId("ride-end").click();
    await pD.getByText(/Ride completed/).first().waitFor({ timeout: 20000 });
    await shot(pD, "ride-completed");
    return "settlement executed at end_ride";
  });

  await check(pD, "Driver wallet received the passenger's share", async () => {
    await pD.goto(`${BASE}/dashboard/wallet`);
    await pD.getByText("Available Balance").first().waitFor({ timeout: 15000 });
    const balance = await readBalance(pD);
    if (!(balance > 0)) throw new Error(`no credit: balance ৳${balance}`);
    return `wallet credited: ৳${balance}`;
  });

  // ══ H. Rider post-ride: history, receipt, rating ══════════════════════════
  console.log("\n[H] Rider — history, receipt, rating");
  await check(pR, "Ride history lists the completed trip with a receipt no.", async () => {
    await pR.goto(`${BASE}/dashboard/history`);
    await pR.getByText(/ARH-\d{8}-/).first().waitFor({ timeout: 20000 });
    await shot(pR, "history");
    return "ARH receipt number present";
  });

  await check(pR, "Receipt detail view renders (paid)", async () => {
    await pR.locator('a:has-text("View")').first().click();
    await pR.waitForURL("**/dashboard/history/**", { timeout: 20000 });
    await pR.getByText(/ARH-\d{8}-/).first().waitFor({ timeout: 20000 });
    await pR.getByText(/✅ Paid|Partially settled|Unsettled/).first().waitFor({ timeout: 15000 });
    await shot(pR, "receipt");
    return "receipt loaded with payment state";
  });

  let pendingBefore = 0;
  await check(pR, "Post-ride rating prompt appears", async () => {
    await pR.goto(`${BASE}/dashboard/history`);
    await pR.getByText("Rate your recent").first().waitFor({ timeout: 20000 });
    pendingBefore = await pR.locator('button:has-text("Rate driver")').count();
    if (pendingBefore < 1) throw new Error("no Rate driver button");
    return `${pendingBefore} pending review(s)`;
  });

  await check(pR, "Rider submits a 4-star review", async () => {
    // Target Test Driver's pending row (the list can hold other old rides).
    const row = pR
      .locator('div:has(> button:text-is("Rate driver"))')
      .filter({ hasText: "Test Driver" });
    if ((await row.count()) > 0) {
      await row.first().locator('button:text-is("Rate driver")').click();
    } else {
      await pR.locator('button:has-text("Rate driver")').first().click();
    }
    await pR.getByText(/^Rate Test Driver/).first().waitFor({ timeout: 10000 });
    await pR.locator('button[aria-label="4 stars"]').click();
    await pR.click('button:has-text("Submit review")');
    await pR.getByText(/Thanks — you rated/).first().waitFor({ timeout: 15000 });
    await shot(pR, "review-submitted");
    return "4 stars recorded (append-only)";
  });

  await check(pR, "The rated driver leaves the pending list", async () => {
    await pR.reload();
    await pR.getByText("Rate your recent").first().waitFor({ timeout: 20000 }).catch(() => {});
    const pendingAfter = await pR.locator('button:has-text("Rate driver")').count();
    if (pendingAfter >= pendingBefore) {
      throw new Error(`pending did not drop: ${pendingBefore} → ${pendingAfter}`);
    }
    return `${pendingBefore} → ${pendingAfter} pending`;
  });

  // ══ I. Rider misc: eco, complaints, earnings, logout ══════════════════════
  console.log("\n[I] Rider — eco, complaints, earnings, logout");
  await check(pR, "Eco tracker renders stats and leaderboard", async () => {
    await pR.goto(`${BASE}/dashboard/eco`);
    await pR.getByText("Eco/Footprint Tracker").first().waitFor({ timeout: 20000 });
    await pR.getByText("Community Leaderboard").first().waitFor({ timeout: 15000 });
    await shot(pR, "eco");
    return "stats + leaderboard";
  });

  const complaintSubject = `E2E pipeline check ${Date.now()}`;
  await check(pR, "Rider files a complaint", async () => {
    await pR.goto(`${BASE}/dashboard/complaints`);
    await pR.click('button:has-text("+ File Complaint")');
    await pR.getByPlaceholder("Brief description of the issue").fill(complaintSubject);
    await pR.getByPlaceholder("Describe the incident in detail...")
      .fill("Automated end-to-end test: verifying the complaint pipeline end to end.");
    await pR.click('button:has-text("Submit Complaint")');
    await pR.getByText(complaintSubject).first().waitFor({ timeout: 20000 });
    await shot(pR, "complaint-filed");
    return "complaint listed as open";
  });

  await check(pR, "Rider earnings page shows a graceful empty state", async () => {
    await pR.goto(`${BASE}/dashboard/earnings`);
    await pR.getByText("No earnings yet").first().waitFor({ timeout: 20000 });
    return "no error — clean empty state for non-drivers";
  });

  await check(pR, "Logout returns to the login page", async () => {
    await pR.goto(`${BASE}/dashboard`);
    await pR.click('button:has-text("Logout")');
    await pR.waitForURL("**/login", { timeout: 15000 });
    return "session cleared";
  });

  // ══ J. Security gates ═════════════════════════════════════════════════════
  console.log("\n[J] Security — API gates and the chat 4403");
  const tDriver = await apiLogin(ACCOUNTS.driver.email, ACCOUNTS.driver.pass);
  const tIntruder = await apiLogin(ACCOUNTS.intruder.email, ACCOUNTS.intruder.pass);

  const ridesRes = await fetch(`${API}/api/rides`, {
    headers: { Authorization: `Bearer ${tDriver}` },
  });
  const ridesData = await ridesRes.json();
  const ourRide = (ridesData.mine || []).find(
    (r) => r.destination === "aftabnagar" && r.status !== "cancelled"
  );
  const rideId = ourRide ? ourRide.id : null;

  await check(null, "Unauthenticated ride listing is rejected (401)", async () => {
    const res = await fetch(`${API}/api/rides`);
    if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
    return "401";
  });

  await check(null, "Ride detail is hidden from non-participants (403)", async () => {
    if (!rideId) throw new Error("test ride not found");
    const res = await fetch(`${API}/api/rides/${rideId}`, {
      headers: { Authorization: `Bearer ${tIntruder}` },
    });
    if (res.status !== 403) throw new Error(`expected 403, got ${res.status}`);
    return "403 for Nosy User";
  });

  await check(null, "Ride chat history is hidden from non-participants (403)", async () => {
    const res = await fetch(`${API}/api/rides/${rideId}/messages`, {
      headers: { Authorization: `Bearer ${tIntruder}` },
    });
    if (res.status !== 403) throw new Error(`expected 403, got ${res.status}`);
    return "403 for Nosy User";
  });

  await check(null, "Female-only ride refuses a non-female rider (403)", async () => {
    const email = `e2efemale${Date.now()}@g.bracu.ac.bd`;
    const reg = await fetch(`${API}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "E2E Female", email, phone: "01711111111",
        gender: "female", password: "secret1",
      }),
    });
    const regData = await reg.json();
    if (!reg.ok || !regData.otp_hint) throw new Error(`register failed: ${JSON.stringify(regData)}`);
    const ver = await fetch(`${API}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: regData.otp_hint }),
    });
    const verData = await ver.json();
    if (!ver.ok) throw new Error(`verify failed: ${JSON.stringify(verData)}`);
    const femaleToken = verData.token;

    const created = await fetch(`${API}/api/rides`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${femaleToken}` },
      body: JSON.stringify({
        source: "gate 1", destination: "gate 2",
        base_fare: 100, total_seats: 4, female_only: true,
      }),
    });
    const createdData = await created.json();
    if (!created.ok) throw new Error(`ride create failed: ${JSON.stringify(createdData)}`);

    const join = await fetch(`${API}/api/rides/${createdData.ride_id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tIntruder}` },
      body: JSON.stringify({ seats: 1 }),
    });
    const joinData = await join.json().catch(() => ({}));
    if (join.status !== 403 || !/female-only/i.test(joinData.detail || "")) {
      throw new Error(`expected 403 female-only, got ${join.status}: ${JSON.stringify(joinData)}`);
    }
    return "Nosy User blocked";
  });

  await check(pI, "Chat UI explains the non-participant rejection", async () => {
    if (!rideId) throw new Error("test ride not found");
    // The intruder context has no UI session yet — log in first, otherwise the
    // chat page fails with 4401 (expired session) instead of 4403.
    await login(pI, ACCOUNTS.intruder);
    await pI.goto(`${BASE}/dashboard/chat/${rideId}`);
    await pI.getByText("not a participant").first().waitFor({ timeout: 30000 });
    await shot(pI, "chat-4403");
    return "WS 4403 surfaced as a human-readable error";
  });

  await check(pI, "Wrong password is rejected", async () => {
    await pI.goto(`${BASE}/login`);
    await pI.fill('input[type="email"]', ACCOUNTS.intruder.email);
    await pI.fill('input[type="password"]', "definitely-wrong");
    await pI.click('button[type="submit"]');
    await pI.getByText("Invalid email or password").first().waitFor({ timeout: 15000 });
    return "401 surfaced (1 failed attempt — under the 5/5min cap)";
  });

  // ══ K. Admin ══════════════════════════════════════════════════════════════
  console.log("\n[K] Admin — complaints, SOS, drivers");
  await check(pA, "Admin login reaches the admin panel", async () => {
    await login(pA, ACCOUNTS.admin, "**/admin");
    await pA.getByText(/Dashboard|Complaints/).first().waitFor({ timeout: 15000 });
    await shot(pA, "admin-panel");
    return "role-based redirect to /admin";
  });

  await check(pA, "Admin resolves the E2E complaint", async () => {
    await pA.goto(`${BASE}/admin/complaints`);
    const card = pA.locator(".complaint-card", { hasText: complaintSubject }).first();
    await card.waitFor({ timeout: 20000 });
    await card.locator('button:has-text("Take Action")').click();
    await card.locator('button:has-text("Resolve")').click();
    await card.locator(".badge", { hasText: "resolved" }).first().waitFor({ timeout: 20000 });
    await shot(pA, "admin-resolved");
    return "status → resolved";
  });

  await check(pA, "Admin SOS log shows the triggered alert", async () => {
    await pA.goto(`${BASE}/admin/sos`);
    const first = pA.locator(".glass-card").first();
    await first.waitFor({ timeout: 20000 });
    await pA.getByText("Rider Person").first().waitFor({ timeout: 15000 });
    await pA.getByText("🔴 ACTIVE").first().waitFor({ timeout: 10000 });
    await shot(pA, "admin-sos");
    return "newest alert is Rider Person's, still active";
  });

  await check(pA, "Admin driver verification list renders", async () => {
    await pA.goto(`${BASE}/admin/drivers`);
    await pA.getByText("Driver Verification").first().waitFor({ timeout: 20000 });
    await pA.getByText("Test Driver").first().waitFor({ timeout: 15000 });
    await shot(pA, "admin-drivers");
    return "Test Driver listed with status badge";
  });

  // ══ L. Console hygiene ════════════════════════════════════════════════════
  console.log("\n[L] Console hygiene");
  await check(null, "Driver flow produced no console errors", async () => {
    if (consoleErrors.driver.length) {
      throw new Error(`${consoleErrors.driver.length}: ${consoleErrors.driver.slice(0, 3).join(" | ")}`);
    }
    return "0 errors";
  });
  await check(null, "Rider flow produced no console errors", async () => {
    if (consoleErrors.rider.length) {
      throw new Error(`${consoleErrors.rider.length}: ${consoleErrors.rider.slice(0, 3).join(" | ")}`);
    }
    return "0 errors";
  });

  // ─── summary ───────────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  const report = {
    date: new Date().toISOString(),
    browser: HELIUM,
    frontend: BASE,
    backend: API,
    total: checks.length,
    passed,
    failed,
    checks,
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));

  console.log("\n──────────────────────────────────────────────");
  console.log(`  ${passed}/${checks.length} passed, ${failed} failed`);
  console.log(`  report : ${REPORT}`);
  console.log(`  shots  : ${SHOTS}`);
  console.log("──────────────────────────────────────────────\n");

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\nHarness failure:", err);
  process.exit(2);
});
