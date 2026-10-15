import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4000";
const checks = [];
const pageErrors = [];
const serverErrors = [];
const pass = (name, detail = "") => checks.push({ name, status: "PASS", detail });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("response", (response) => {
  if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
});

async function login(email) {
  await context.request.post(base + "/api/auth/logout", { headers: { "X-HostelHub-Client": "audit" } }).catch(() => {});
  await page.goto(base + "/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("HostelHub@123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("login"));
}

async function crawl(role, routes) {
  for (const route of routes) {
    await page.goto(base + route, { waitUntil: "networkidle" });
    await page.locator("main").waitFor();
    assert(!page.url().includes("/login"), `${role} was redirected from ${route}`);
    pass(`${role} route ${route}`);
  }
}

try {
  await page.goto(base + "/");
  await page.locator(".hostel-card").nth(3).waitFor();
  const compareInputs = page.locator(".compare-check input");
  assert((await compareInputs.count()) >= 4);
  await compareInputs.nth(0).check();
  await compareInputs.nth(1).check();
  await compareInputs.nth(2).check();
  assert.equal(await page.locator(".compare-float b").textContent(), "3");
  await compareInputs.nth(3).click();
  await page.getByText("You can compare up to 3 homes.", { exact: true }).waitFor();
  assert.equal(await page.locator(".compare-float b").textContent(), "3");
  pass("comparison selection and three-home limit");
  await page.locator(".compare-float").click();
  await page.waitForURL(/\/compare/);
  await page.locator(".compare-head").first().waitFor();
  assert.equal(await page.locator(".compare-head").count(), 3);
  await page.locator(".compare-head .icon-button").first().click();
  assert.equal(await page.locator(".compare-head").count(), 2);
  pass("comparison table and remove action");

  await page.goto(base + "/");
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await page.getByLabel("Map showing hostel locations").waitFor();
  pass("public list/map switch and map rendering");
  await page.goto(base + "/hostels/csv-hostel-01");
  const mapsLink = page.getByRole("link", { name: /Open in Google Maps/ });
  assert.match((await mapsLink.getAttribute("href")) || "", /^https:\/\/www\.google\.com\/maps\/search/);
  pass("hostel detail external Google Maps link");

  await login("resident.001@hostelhub.test");
  await crawl("guest", ["/", "/wishlist", "/compare", "/bookings", "/payments", "/notifications", "/messages", "/support", "/profile"]);
  await login("priya.raman@hostelhub.test");
  await crawl("owner", ["/", "/owner", "/owner/plans", "/bookings", "/payments", "/notifications", "/messages", "/support", "/profile"]);
  await login("admin@hostelhub.test");
  await crawl("admin", ["/", "/admin", "/bookings", "/payments", "/notifications", "/messages", "/support", "/profile"]);

  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(" | ")}`);
  assert.deepEqual(serverErrors, [], `server errors: ${serverErrors.join(" | ")}`);
  pass("all route surfaces completed without page errors or HTTP 5xx");
  const report = { passed: checks.length, failed: 0, checks, pageErrors, serverErrors };
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/mysql-ui-surface-audit.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  const report = { passed: checks.length, failed: 1, checks, pageErrors, serverErrors, error: error.stack || error.message };
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/mysql-ui-surface-audit.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
