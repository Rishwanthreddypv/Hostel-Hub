import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4000";
const apiAudit = JSON.parse(readFileSync("test-results/mysql-api-audit.json", "utf8"));
const run = `browser${Date.now().toString(36)}`;
const email = `${run}@example.test`;
const ownerEmail = `${run}.owner@example.test`;
const password = "BrowserAudit@123";
const checks = [];
const errors = [];
const failedResponses = [];
const check = (name, detail = "") => checks.push({ name, status: "PASS", detail });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error" && !/ERR_NAME_NOT_RESOLVED|tile\.openstreetmap|401 \(Unauthorized\)/.test(m.text())) errors.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 500) failedResponses.push(`${r.status()} ${r.url()}`);
});
mkdirSync("test-results/mysql-browser", { recursive: true });

async function capture(name) {
  await page.screenshot({ path: `test-results/mysql-browser/${name}.png`, fullPage: false });
}
async function logout() {
  await context.request.post(base + "/api/auth/logout", { headers: { "X-HostelHub-Client": "audit" } }).catch(() => {});
}
async function login(loginEmail, loginPassword = "HostelHub@123") {
  await logout();
  await page.goto(base + "/login");
  await page.getByLabel("Email address").fill(loginEmail);
  await page.getByLabel("Password", { exact: true }).fill(loginPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.includes("login"));
}
async function noOverflow(name) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} has horizontal overflow`);
  check(`${name} responsive width`);
}

try {
  await page.goto(base + "/");
  await page.locator(".hostel-card").first().waitFor();
  assert((await page.locator(".hostel-card").count()) >= 20);
  assert(await page.getByText("COLLEGE PROJECT DEMO", { exact: false }).isVisible());
  check("public home loads MySQL listings and demo disclosure");
  await page.getByLabel("Search city, neighbourhood or college").fill("Chennai");
  await page.getByRole("button", { name: "Find my space", exact: true }).click();
  await page.waitForURL(/q=Chennai/);
  await page.locator(".hostel-card").first().waitFor();
  check("public search navigation and results");
  await page.getByRole("button", { name: "More filters", exact: true }).click();
  await page.getByLabel("Room sharing").selectOption("2");
  await page.getByLabel("Cooling").selectOption("true");
  await page.getByLabel("Sort homes").selectOption("price-low");
  check("advanced filters and sorting controls");
  await page.getByLabel("Find my kind of home").click();
  await page.getByLabel("Ask the hostel assistant").fill("Girls hostel in Chennai under 10k with food");
  await page.getByLabel("Send question").click();
  await page.locator(".assistant-message.assistant").nth(1).waitFor();
  assert(await page.getByText("Local search assistant · demo", { exact: true }).isVisible());
  check("local assistant responds from MySQL inventory");
  await page.getByLabel("Close assistant").click();
  await capture("01-public-discovery");

  await page.goto(base + "/register");
  await page.getByLabel("Full name").fill("MySQL Browser Resident");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.waitForURL(base + "/");
  check("guest registration through browser");
  await page.goto(base + "/profile");
  await page.getByLabel("Phone").fill("+91 98888 00000");
  await page.getByLabel("A little about you").fill(`Browser MySQL audit ${run}`);
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await page.getByText("Profile updated.", { exact: true }).waitFor();
  check("profile update through browser");

  await page.goto(base + "/hostels/csv-hostel-01");
  await page.getByRole("heading", { level: 1 }).waitFor();
  assert(await page.getByLabel("Map showing hostel locations").isVisible());
  await page.getByRole("button", { name: /Save home|Saved home/ }).click();
  await page.goto(base + "/wishlist");
  await page.locator(".hostel-card").first().waitFor();
  check("wishlist save and dedicated page");
  await page.goto(base + "/hostels/csv-hostel-01");
  const compareButton = page.getByRole("button", { name: /compare/i }).first();
  if (await compareButton.count()) {
    await compareButton.click();
    await page.goto(base + "/compare");
    check("comparison page navigation");
  }
  await page.goto(base + "/hostels/csv-hostel-01");
  await page.getByLabel("Note to the owner (optional)").fill("Browser audit arrival after 5 PM.");
  const bookingResponse = page.waitForResponse((r) => r.url().endsWith("/api/bookings") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Request your space", exact: true }).click();
  const booking = (await (await bookingResponse).json()).booking;
  assert(booking.id);
  await page.locator(".booking-card").getByText("pending owner", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Pay now", exact: true }).count(), 0);
  check("booking request waits for owner before payment");
  await capture("02-booking-request");

  await login("priya.raman@hostelhub.test");
  await page.getByLabel("Portfolio property").waitFor();
  await page.getByLabel("Portfolio property").selectOption("csv-hostel-01");
  check("owner portfolio and property filter");
  await page.goto(base + "/owner");
  await page.getByText("Your properties", { exact: true }).waitFor();
  check("owner management dashboard");
  await page.goto(base + "/bookings");
  await page.getByLabel("Search bookings").fill(booking.id);
  await page.locator(".booking-card").first().waitFor();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("button", { name: "Confirm approve", exact: true }).click();
  await page.locator(".booking-card").getByText("awaiting payment", { exact: true }).waitFor();
  check("correct owner approves booking in browser");
  await page.goto(base + "/messages");
  await page.getByLabel("Filter conversations by property").waitFor();
  check("owner messages workspace");
  await page.goto(base + "/payments");
  await page.getByLabel("Search payments").waitFor();
  check("owner payment ledger workspace");
  await page.goto(base + "/owner/plans");
  await page.getByRole("heading", { name: "Two clear plans. One complete workflow.", exact: true }).waitFor();
  check("owner plans page");
  await capture("03-owner-workspace");

  await login("arjun.menon@hostelhub.test");
  await page.goto(base + "/bookings");
  await page.getByLabel("Search bookings").fill(booking.id);
  await page.getByText("No bookings match this view", { exact: true }).waitFor();
  check("independent owner cannot see another owner's booking");

  await logout();
  await page.goto(base + "/register?role=owner");
  await page.getByLabel("Full name").fill("MySQL Browser Plan Owner");
  await page.getByLabel("Email address").fill(ownerEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.waitForURL(base + "/owner");
  await page.goto(base + "/owner/plans");
  await page.getByRole("heading", { name: "Basic", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Advanced", exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Pro", exact: true }).count(), 0);
  check("new owner starts on a two-plan Basic and Advanced catalog");
  await page.getByRole("button", { name: "Upgrade to Advanced", exact: true }).click();
  const planDialog = page.getByRole("dialog", { name: "Activate Advanced" });
  await planDialog.getByRole("button", { name: "Card", exact: true }).click();
  await planDialog.getByLabel("Demo bank response").selectOption("failure");
  await planDialog.getByRole("checkbox").check();
  await planDialog.getByRole("button", { name: /^Pay/ }).click();
  await planDialog.getByText(/Payment declined/).waitFor();
  check("Advanced checkout failure preserves Basic plan and allows retry");
  await planDialog.getByRole("button", { name: "UPI", exact: true }).click();
  await planDialog.getByLabel("Demo bank response").selectOption("success");
  await planDialog.getByRole("button", { name: /^Pay/ }).click();
  await page.getByRole("dialog", { name: "Advanced is active" }).waitFor();
  check("Advanced checkout success activates plan in browser");
  const planReceipt = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download receipt", exact: true }).click();
  assert.match((await planReceipt).suggestedFilename(), /hostel-hub-plan-/);
  check("Advanced subscription receipt downloads");
  await page.getByRole("button", { name: "Return to plans", exact: true }).click();
  await page.getByRole("button", { name: "Move to Basic", exact: true }).click();
  await page.getByRole("button", { name: "Confirm Basic plan", exact: true }).click();
  await page.getByRole("button", { name: "Your current plan", exact: true }).waitFor();
  check("owner can downgrade to Basic with data-preservation notice");

  await login(email, password);
  await page.goto(base + "/bookings");
  await page.getByLabel("Search bookings").fill(booking.id);
  await page.locator(".booking-card").first().waitFor();
  await page.getByRole("button", { name: "Pay now", exact: true }).click();
  await page.getByRole("dialog", { name: "Complete your booking" }).waitFor();
  assert(await page.getByText("Demo payment — no money transferred", { exact: true }).isVisible());
  await page.getByRole("button", { name: "Card", exact: true }).click();
  await page.getByLabel("Demo bank response").selectOption("failure");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /^Pay ₹/ }).click();
  await page.getByText(/Payment declined/).waitFor();
  check("browser checkout displays failed card attempt");
  await page.getByRole("button", { name: "Net banking", exact: true }).click();
  await page.getByLabel("Demo bank response").selectOption("success");
  await page.getByRole("button", { name: /^Pay ₹/ }).click();
  await page.getByText("Your payment is successful", { exact: true }).waitFor();
  check("browser checkout retry succeeds");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download receipt", exact: true }).click();
  assert.match((await download).suggestedFilename(), /receipt/);
  check("receipt downloads from browser");
  await page.getByRole("button", { name: "Back to bookings", exact: true }).click();
  await page.getByRole("button", { name: "Booking details & history", exact: true }).click();
  await page.getByText("Owner approved the request", { exact: true }).waitFor();
  await page.getByText("Payment attempt failed", { exact: true }).waitFor();
  check("booking timeline shows approval and payment attempts");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Cancel booking", exact: true }).click();
  await page.getByLabel("Reason for cancellation (optional, shared with owner)").fill("Browser audit cancellation.");
  await page.getByRole("button", { name: "Confirm cancel", exact: true }).click();
  await page.locator(".booking-card").getByText("refund pending", { exact: true }).waitFor();
  check("guest cancellation creates refund queue");
  await page.goto(base + "/notifications");
  await page.getByText(/Payment received|Booking/).first().waitFor();
  check("guest notifications page");
  await page.goto(base + "/messages");
  await page.getByText(/Conversations|Messages/i).first().waitFor();
  check("guest messages page");
  await page.goto(base + "/support");
  await page.getByRole("button", { name: /New support request/i }).waitFor();
  check("guest support page");
  await capture("04-guest-history");

  await login("admin@hostelhub.test");
  await page.goto(base + "/admin");
  await page.getByLabel("Portfolio property").waitFor();
  check("admin analytics and portfolio page");
  await page.getByRole("button", { name: "CSV imports", exact: true }).click();
  await page.getByText(/inserted.*updated.*preserved or unchanged/).first().waitFor();
  check("admin CSV import history");
  await page.goto(base + "/bookings");
  await page.getByLabel("Search bookings").fill(booking.id);
  await page.locator(".booking-card").first().waitFor();
  await page.getByRole("button", { name: "Process demo refund", exact: true }).click();
  await page.getByRole("button", { name: "Confirm refund", exact: true }).click();
  await page.locator(".booking-card").getByText("refunded", { exact: true }).waitFor();
  check("admin processes refund in browser");
  await page.goto(base + "/payments");
  await page.getByLabel("Search payments").fill("MySQL Browser Resident");
  await page.getByRole("link", { name: "Receipt", exact: true }).first().waitFor();
  check("admin payment ledger and receipt link");
  await page.goto(base + "/support");
  await page.getByText(/Support|requests/i).first().waitFor();
  check("admin support management page");
  await capture("05-admin-workspace");

  for (const [role, route, loginEmail, loginPassword] of [
    ["guest", "/bookings", email, password],
    ["owner", "/owner", "priya.raman@hostelhub.test", "HostelHub@123"],
    ["admin", "/admin", "admin@hostelhub.test", "HostelHub@123"],
  ]) {
    await login(loginEmail, loginPassword);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + route);
    await page.locator("main").waitFor();
    await noOverflow(`${role} mobile ${route}`);
    await capture(`mobile-${role}`);
    await page.setViewportSize({ width: 1440, height: 1050 });
  }

  await logout();
  await page.goto(base + "/bookings");
  await page.waitForURL(/\/login/);
  check("protected route redirects signed-out visitor");

  assert.deepEqual(errors, [], `Browser errors: ${errors.join(" | ")}`);
  assert.deepEqual(failedResponses, [], `Server failures: ${failedResponses.join(" | ")}`);
  check("no JavaScript page errors or HTTP 5xx responses");
  const report = { run, apiRun: apiAudit.run, passed: checks.length, failed: 0, bookingId: booking.id, checks, errors, failedResponses };
  writeFileSync("test-results/mysql-browser-audit.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await capture("failure");
  const report = { run, apiRun: apiAudit.run, passed: checks.length, failed: 1, checks, errors, failedResponses, error: error.stack || error.message };
  writeFileSync("test-results/mysql-browser-audit.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
