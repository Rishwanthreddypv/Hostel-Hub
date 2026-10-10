import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { createDatabase } from "../server/db.js";
import { createApp } from "../server/app.js";
import { seed } from "../server/seed.js";
const uploads = mkdtempSync(join(tmpdir(), "hostel-hub-browser-"));
const db = await createDatabase({ client: "sqlite", path: ":memory:" });
await seed(db, { uploads });
const server = createApp(db, { demo: true, uploads }).listen(0, "127.0.0.1");
await once(server, "listening");
const base = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
mkdirSync("test-results", { recursive: true });
async function login(email) {
  await context.request.post(base + "/api/auth/logout", {
    headers: { "X-HostelHub-Client": "test" },
  });
  await page.goto(base + "/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("HostelHub@123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.includes("login"));
}
async function searchBooking(id) {
  await page.goto(base + "/bookings");
  await page.getByLabel("Search bookings").fill(id);
  await page.locator(".booking-card").first().waitFor();
}
async function capture(name) {
  await page.screenshot({
    path: "test-results/" + name + ".png",
    fullPage: false,
  });
}
try {
  await page.goto(base);
  await page.locator(".hostel-card").first().waitFor();
  assert.equal(await page.locator(".hostel-card").count(), 20);
  await capture("realistic-home");
  await page.getByRole("button", { name: "For her", exact: true }).click();
  await page.waitForURL("**gender=Girls");
  await page.waitForFunction(
    () => document.querySelectorAll(".hostel-card").length < 20,
  );
  await page.goto(base + "/register");
  await page.getByLabel("Full name").fill("Browser Test Resident");
  await page.getByLabel("Email address").fill("browser.resident@example.test");
  await page.getByLabel("Password", { exact: true }).fill("HostelHub@123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL(base + "/");
  await page.goto(base + "/hostels/csv-hostel-01");
  await page
    .getByRole("button", { name: "Request your space", exact: true })
    .waitFor();
  await page
    .getByLabel("Note to the owner (optional)")
    .fill("Arriving after my afternoon train.");
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/api/bookings") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Request your space", exact: true })
    .click();
  const booking = (await (await created).json()).booking;
  assert(booking.id);
  await page
    .locator(".booking-card")
    .getByText("pending owner", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Pay now", exact: true }).count(),
    0,
  );
  await capture("request-before-approval");
  await login("priya.raman@hostelhub.test");
  await page.getByLabel("Portfolio property").waitFor();
  await page.getByLabel("Portfolio property").selectOption("csv-hostel-01");
  await page.locator(".portfolio-workspace tbody tr").first().waitFor();
  await capture("owner-portfolio");
  await searchBooking(booking.id);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm approve", exact: true })
    .click();
  await page
    .locator(".booking-card")
    .getByText("awaiting payment", { exact: true })
    .waitFor();
  await login("arjun.menon@hostelhub.test");
  await page.goto(base + "/bookings");
  await page.getByLabel("Search bookings").fill(booking.id);
  await page
    .getByText("No bookings match this view", { exact: true })
    .waitFor();
  await login("browser.resident@example.test");
  await searchBooking(booking.id);
  await page.getByRole("button", { name: "Pay now", exact: true }).click();
  await page.getByRole("dialog", { name: "Complete your booking" }).waitFor();
  await capture("realistic-checkout");
  await page.getByRole("button", { name: "Card", exact: true }).click();
  await page.getByLabel("Demo bank response").selectOption("failure");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /^Pay ₹/ }).click();
  await page
    .getByText(
      "Payment declined. No charge was recorded. Choose another method or retry before the deadline.",
      { exact: true },
    )
    .waitFor();
  await page.getByRole("button", { name: "UPI", exact: true }).click();
  await page.getByLabel("Demo bank response").selectOption("success");
  await page.getByRole("button", { name: /^Pay ₹/ }).click();
  await page.getByText("Your payment is successful", { exact: true }).waitFor();
  await capture("payment-success");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Download receipt", exact: true })
    .click();
  assert.match((await downloaded).suggestedFilename(), /receipt/);
  await page
    .getByRole("button", { name: "Back to bookings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Booking details & history", exact: true })
    .click();
  await page.getByText("Owner approved the request", { exact: true }).waitFor();
  await page.getByText("Payment attempt failed", { exact: true }).waitFor();
  await capture("realistic-booking-history");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("button", { name: "Cancel booking", exact: true })
    .click();
  await page
    .getByLabel("Reason for cancellation (optional, shared with owner)")
    .fill("My joining date has moved.");
  await page
    .getByRole("button", { name: "Confirm cancel", exact: true })
    .click();
  await page
    .locator(".booking-card")
    .getByText("refund pending", { exact: true })
    .waitFor();
  await login("admin@hostelhub.test");
  await page.getByRole("button", { name: "CSV imports", exact: true }).click();
  await page.getByText(/inserted.*updated.*preserved or unchanged/).waitFor();
  await capture("admin-imports");
  await searchBooking(booking.id);
  await page
    .getByRole("button", { name: "Process demo refund", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm refund", exact: true })
    .click();
  await page
    .locator(".booking-card")
    .getByText("refunded", { exact: true })
    .waitFor();
  await page.goto(base + "/payments");
  await page.getByLabel("Search payments").fill("Browser Test Resident");
  await page.getByRole("link", { name: "Receipt", exact: true }).waitFor();
  await capture("payment-ledger");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/admin");
  await page.getByLabel("Portfolio property").waitFor();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Mobile admin overflow",
  );
  await capture("mobile-portfolio");
  await login("browser.resident@example.test");
  await searchBooking(booking.id);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Mobile booking overflow",
  );
  await capture("mobile-realistic-bookings");
  assert.deepEqual(errors, []);
  console.log(
    "Browser QA passed: realistic inventory, registration, independent owners, request/approval, payment failure/retry, receipt download, history, cancellation/refund, import report, ledger and mobile layouts.",
  );
} catch (e) {
  await page.screenshot({
    path: "test-results/browser-failure.png",
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  await db.close();
  assert(
    resolve(uploads).startsWith(resolve(tmpdir())) &&
      uploads.includes("hostel-hub-browser-"),
  );
  rmSync(uploads, { recursive: true, force: true });
}
