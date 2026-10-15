import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createDatabase } from "../server/db.js";

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4000";
const password = "AuditPass@123";
const run = `qa${Date.now().toString(36)}`;
const results = [];
const context = { run };

function record(area, name, status, detail = "") {
  results.push({ area, name, status, detail: String(detail || "") });
}
function pass(area, name, detail = "") {
  record(area, name, "PASS", detail);
}
function fail(area, name, detail = "") {
  record(area, name, "FAIL", detail);
}
function verify(area, name, condition, detail = "") {
  if (!condition) {
    fail(area, name, detail || "Assertion failed");
    throw new Error(`${area}: ${name}: ${detail || "Assertion failed"}`);
  }
  pass(area, name, detail);
}
const day = (offset) =>
  new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

class Client {
  constructor(label) {
    this.label = label;
    this.cookie = "";
  }
  async request(path, { method = "GET", body, form, headers = {} } = {}) {
    const h = { ...headers };
    if (this.cookie) h.cookie = this.cookie;
    if (method !== "GET" && method !== "HEAD") h["X-HostelHub-Client"] = "audit";
    if (body !== undefined) h["content-type"] = "application/json";
    const response = await fetch(base + path, {
      method,
      headers: h,
      body: form || (body === undefined ? undefined : JSON.stringify(body)),
      redirect: "manual",
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";", 1)[0];
    const type = response.headers.get("content-type") || "";
    const value = type.includes("application/json")
      ? await response.json()
      : await response.text();
    return { response, value, type };
  }
  get(path) {
    return this.request(path);
  }
  post(path, body) {
    return this.request(path, { method: "POST", body });
  }
  patch(path, body) {
    return this.request(path, { method: "PATCH", body });
  }
  postForm(path, form) {
    return this.request(path, { method: "POST", form });
  }
}

async function expect(area, name, promise, status, predicate) {
  const result = await promise;
  const okStatus = Array.isArray(status)
    ? status.includes(result.response.status)
    : result.response.status === status;
  if (!okStatus) {
    const detail = `expected ${status}, received ${result.response.status}: ${JSON.stringify(result.value).slice(0, 500)}`;
    fail(area, name, detail);
    throw new Error(`${area}: ${name}: ${detail}`);
  }
  if (predicate && !predicate(result.value, result.response)) {
    const detail = `response assertion failed: ${JSON.stringify(result.value).slice(0, 500)}`;
    fail(area, name, detail);
    throw new Error(`${area}: ${name}: ${detail}`);
  }
  pass(area, name, `HTTP ${result.response.status}`);
  return result;
}

async function register(client, role, name) {
  const email = `${run}.${client.label}@example.test`;
  const result = await expect(
    "Authentication",
    `register ${client.label} as ${role}`,
    client.post("/api/auth/register", { name, email, password, role }),
    201,
    (v) => v.user?.email === email && v.user?.role === role && !v.user.password,
  );
  client.user = result.value.user;
  client.email = email;
  return result.value.user;
}
async function activateAdvanced(client, label, outcome = "success") {
  const started = await expect(
    "Plans",
    `${label} starts Advanced checkout`,
    client.post("/api/owner/subscription-attempts", {
      plan: "Advanced",
      method: "upi",
      outcome,
      idempotency_key: randomUUID(),
    }),
    201,
    (value) => value.attempt?.status === "processing",
  );
  await db.run("UPDATE subscription_attempts SET ready_at=? WHERE id=?", [
    "2000-01-01T00:00:00.000Z",
    started.value.attempt.id,
  ]);
  return expect(
    "Plans",
    `${label} completes Advanced checkout`,
    client.post(`/api/subscription-attempts/${started.value.attempt.id}/complete`, {}),
    200,
  );
}

async function login(client, email, pass = password) {
  const result = await expect(
    "Authentication",
    `login ${client.label}`,
    client.post("/api/auth/login", { email, password: pass }),
    200,
    (v) => v.user?.email === email,
  );
  client.user = result.value.user;
  client.email = email;
  return result.value.user;
}

const db = await createDatabase();
const guest1 = new Client("guest1");
let guest2 = new Client("guest2");
const owner1 = new Client("owner1");
const owner2 = new Client("owner2");
const admin = new Client("admin");
const anonymous = new Client("anonymous");

try {
  const baseline = {};
  for (const table of ["users", "hostels", "rooms", "bookings", "payments"])
    baseline[table] = Number((await db.get(`SELECT COUNT(*) n FROM ${table}`)).n);
  context.baseline = baseline;

  await expect("Infrastructure", "API health", anonymous.get("/api/health"), 200, (v) => v.ok && v.payments === "demo");
  await expect("Infrastructure", "frontend root", anonymous.get("/"), 200, (_, r) => (r.headers.get("content-type") || "").includes("text/html"));
  await expect("Infrastructure", "public configuration", anonymous.get("/api/config"), 200, (v) => v.demo === true && Array.isArray(v.demo_accounts));
  const noHeader = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  verify("Security", "mutation without client header is rejected", noHeader.status === 403, `HTTP ${noHeader.status}`);
  const foreignOrigin = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "X-HostelHub-Client": "audit", Origin: "https://attacker.example" }, body: "{}" });
  verify("Security", "foreign origin is rejected", foreignOrigin.status === 403, `HTTP ${foreignOrigin.status}`);

  await expect("Authentication", "invalid login fails", anonymous.post("/api/auth/login", { email: "nobody@example.test", password: "WrongPassword123" }), 401);
  await expect("Authentication", "admin self-registration blocked", anonymous.post("/api/auth/register", { name: "Bad Admin", email: `${run}.admin-register@example.test`, password, role: "admin" }), 400);
  await register(guest1, "user", "QA Resident One");
  await register(guest2, "user", "QA Resident Two");
  await register(owner1, "owner", "QA Portfolio Owner One");
  await register(owner2, "owner", "QA Portfolio Owner Two");
  await expect("Authentication", "duplicate email blocked", anonymous.post("/api/auth/register", { name: "Duplicate", email: guest1.email, password, role: "user" }), 409);
  await login(admin, "admin@hostelhub.test", "HostelHub@123");

  await expect("Profile", "update guest profile", guest1.patch("/api/profile", { name: "QA Resident One Updated", phone: "+91 90000 12345", bio: `MySQL audit ${run}` }), 200, (v) => v.user?.name.endsWith("Updated"));
  const profileRow = await db.get("SELECT name,phone,bio FROM users WHERE id=?", [guest1.user.id]);
  verify("MySQL persistence", "profile update stored in MySQL", profileRow?.bio === `MySQL audit ${run}` && profileRow.phone === "+91 90000 12345");
  await expect("Profile", "wrong current password blocked", guest2.post("/api/profile/password", { current: "incorrect", password: "NewAuditPass@123" }), 400);
  await expect("Profile", "password change succeeds", guest2.post("/api/profile/password", { current: password, password: "NewAuditPass@123" }), 200);
  await expect("Profile", "password change revokes old session", guest2.get("/api/bookings"), 401);
  const oldGuest2 = new Client("guest2-old-password");
  await expect("Profile", "old password rejected", oldGuest2.post("/api/auth/login", { email: guest2.email, password }), 401);
  guest2 = new Client("guest2-new-password");
  await login(guest2, `${run}.guest2@example.test`, "NewAuditPass@123");

  const publicList = await expect("Discovery", "approved listings load", anonymous.get("/api/hostels?sort=price-low"), 200, (v) => v.hostels?.length >= 20);
  const seeded = publicList.value.hostels[0];
  await expect("Discovery", "search and facility filters", anonymous.get(`/api/hostels?q=${encodeURIComponent(seeded.city)}&facilities=Wi-Fi&sharing=2`), 200, (v) => Array.isArray(v.hostels));
  await expect("Discovery", "invalid dates rejected", anonymous.get("/api/hostels?start=2026-02-30&end=2026-03-30"), 400);
  await expect("Discovery", "distance filter works", anonymous.get(`/api/hostels?lat=${seeded.latitude}&lng=${seeded.longitude}&distance=5`), 200, (v) => v.hostels.every((h) => h.distance <= 5));
  await expect("Discovery", "listing detail includes rooms and reviews", anonymous.get(`/api/hostels/${seeded.id}`), 200, (v) => v.hostel?.rooms?.length && Array.isArray(v.reviews));

  await expect("Authorization", "guest cannot open owner dashboard", guest1.get("/api/dashboard"), 403);
  await expect("Authorization", "owner cannot create guest booking", owner1.post("/api/bookings", {}), 403);
  await expect("Authorization", "anonymous cannot list bookings", anonymous.get("/api/bookings"), 401);

  const owner1Plan = await activateAdvanced(owner1, "first owner");
  const subscription = await db.get("SELECT * FROM payments WHERE user_id=? AND kind='subscription' ORDER BY created_at DESC LIMIT 1", [owner1.user.id]);
  verify("MySQL persistence", "Advanced subscription payment stored", subscription?.amount === 999 && subscription.plan_code === "Advanced" && subscription.status === "paid");
  await expect("Plans", "subscription receipt downloads", owner1.get(`/api/subscription-payments/${owner1Plan.value.payment.id}/receipt`), 200);
  await expect("Plans", "duplicate plan activation blocked", owner1.post("/api/owner/subscription-attempts", { plan: "Advanced", method: "upi", outcome: "success", idempotency_key: randomUUID() }), 409);
  await expect("Plans", "removed Pro plan is rejected", owner1.post("/api/owner/subscription", { plan: "Pro" }), 400);
  await activateAdvanced(owner2, "second owner");

  const invalidPhoto = new FormData();
  invalidPhoto.append("file", new Blob(["not an image"], { type: "text/plain" }), "bad.txt");
  await expect("Uploads", "invalid photo content blocked", owner1.postForm("/api/uploads/photo", invalidPhoto), 400);
  const photoForm = new FormData();
  photoForm.append("file", new Blob([readFileSync("public/images/room-1.jpg")], { type: "image/jpeg" }), "qa-room.jpg");
  const photo = await expect("Uploads", "owner uploads photo", owner1.postForm("/api/uploads/photo", photoForm), 201, (v) => /^\/uploads\/.+\.jpg$/.test(v.url));

  const listing = {
    name: `QA MySQL Residency ${run}`,
    city: "Chennai",
    area: "Sholinganallur",
    address: "100 QA Test Avenue, Sholinganallur, Chennai",
    description: "A clearly labelled temporary listing used for the end-to-end MySQL audit.",
    gender: "Co-living",
    facilities: ["Wi-Fi", "Food", "Laundry", "Security", "Parking"],
    photos: [photo.value.url],
    deposit: 5000,
    discount: 10,
    latitude: 12.8996,
    longitude: 80.2279,
    nearby: "QA Technology Park · 1 km",
    check_in: "10:00",
    check_out: "09:00",
    contact: "Not available in QA",
    refund_policy: "Full demo refund before move-in; deposit only after move-in.",
    min_stay_days: 30,
    food_charge: 1500,
    service_charge: 300,
    tax_percent: 5,
    rooms: [{ name: "QA Twin", sharing: 2, rent: 8500, capacity: 4, ac: true }],
  };
  const created = await expect("Owner listings", "owner creates first property", owner1.post("/api/owner/hostels", listing), 201, (v) => !!v.id);
  context.hostelId = created.value.id;
  let ownerHomes = await expect("Owner listings", "owner retrieves own portfolio", owner1.get("/api/owner/hostels"), 200, (v) => v.hostels.some((h) => h.id === context.hostelId));
  context.roomId = ownerHomes.value.hostels.find((h) => h.id === context.hostelId).rooms[0].id;
  await expect("Owner isolation", "other owner cannot edit property", owner2.patch(`/api/owner/hostels/${context.hostelId}`, listing), 404);
  await expect("Owner isolation", "other owner cannot select property portfolio", owner2.get(`/api/portfolio?hostel_id=${context.hostelId}`), 404);
  await expect("Owner listings", "owner edits property", owner1.patch(`/api/owner/hostels/${context.hostelId}`, { ...listing, name: `${listing.name} Updated` }), 200);
  const extraRoom = await expect("Owner listings", "owner adds room type", owner1.post(`/api/owner/hostels/${context.hostelId}/rooms`, { name: "QA Four Sharing", sharing: 4, rent: 6200, capacity: 8, ac: false }), 201, (v) => !!v.id);
  await expect("Owner listings", "owner edits room type", owner1.patch(`/api/owner/rooms/${extraRoom.value.id}`, { name: "QA Four Sharing Updated", sharing: 4, rent: 6400, capacity: 8, ac: true }), 200);
  const listingRow = await db.get("SELECT name,status FROM hostels WHERE id=?", [context.hostelId]);
  verify("MySQL persistence", "listing edits stored in MySQL", listingRow?.name.endsWith("Updated") && listingRow.status === "draft");

  const secondListing = await expect("Owner listings", "Advanced owner creates multiple properties", owner1.post("/api/owner/hostels", { ...listing, name: `QA Second Property ${run}` }), 201, (v) => !!v.id);
  context.secondHostelId = secondListing.value.id;
  const owner2Listing = await expect("Owner listings", "Advanced owner creates property", owner2.post("/api/owner/hostels", { ...listing, name: `QA Advanced Property ${run}` }), 201, (v) => !!v.id);
  context.owner2HostelId = owner2Listing.value.id;
  const advancedSecond = await owner2.post("/api/owner/hostels", { ...listing, name: `QA Advanced Second ${run}` });
  if (advancedSecond.response.status === 201) pass("Plans", "Advanced owner can create multiple properties", "HTTP 201");
  else fail("Plans", "Advanced owner can create multiple properties", `HTTP ${advancedSecond.response.status}: ${advancedSecond.value?.error}`);

  await expect("Verification", "submission without document blocked", owner1.post(`/api/owner/hostels/${context.hostelId}/submit`, {}), 400);
  const docForm = new FormData();
  docForm.append("file", new Blob(["%PDF-1.4\nQA audit declaration"], { type: "application/pdf" }), "qa-declaration.pdf");
  const document = await expect("Verification", "owner uploads private document", owner1.postForm(`/api/owner/hostels/${context.hostelId}/documents`, docForm), 201, (v) => !!v.id);
  context.documentId = document.value.id;
  await expect("Verification", "other owner cannot download document", owner2.get(`/api/documents/${context.documentId}`), 404);
  await expect("Verification", "document owner can download document", owner1.get(`/api/documents/${context.documentId}`), 200, (_, r) => (r.headers.get("content-type") || "").includes("application/pdf"));
  await expect("Verification", "direct private upload URL blocked", anonymous.get(`/uploads/private/${context.documentId}.pdf`), 404);
  await expect("Verification", "owner submits listing", owner1.post(`/api/owner/hostels/${context.hostelId}/submit`, {}), 200);
  await expect("Verification", "unpublished listing hidden from public", anonymous.get(`/api/hostels/${context.hostelId}`), 404);
  await expect("Verification", "admin downloads private document", admin.get(`/api/documents/${context.documentId}`), 200);
  await expect("Verification", "admin approves submitted listing", admin.post(`/api/admin/hostels/${context.hostelId}/review`, { status: "approved", note: "QA documents reviewed" }), 200);
  await expect("Verification", "approved listing becomes public", anonymous.get(`/api/hostels/${context.hostelId}`), 200);
  await expect("Verification", "already reviewed listing cannot be reviewed again", admin.post(`/api/admin/hostels/${context.hostelId}/review`, { status: "approved", note: "Again" }), 409);

  await expect("Wishlist", "guest saves approved listing", guest1.post(`/api/wishlist/${context.hostelId}`, {}), 200, (v) => v.saved === true);
  await expect("Wishlist", "saved listing persists", guest1.get("/api/wishlist"), 200, (v) => v.ids.includes(context.hostelId));
  await expect("Wishlist", "second guest wishlist remains isolated", guest2.get("/api/wishlist"), 200, (v) => !v.ids.includes(context.hostelId));
  await expect("Wishlist", "guest removes saved listing", guest1.post(`/api/wishlist/${context.hostelId}`, {}), 200, (v) => v.saved === false);

  await expect("Messaging", "guest contacts property owner", guest1.post("/api/messages", { hostel_id: context.hostelId, body: `QA question ${run}` }), 201);
  await expect("Messaging", "unrelated guest cannot see conversation", guest2.get("/api/messages"), 200, (v) => !v.messages.some((m) => m.hostel_id === context.hostelId));
  await expect("Messaging", "owner receives guest message", owner1.get("/api/messages"), 200, (v) => v.messages.some((m) => m.body === `QA question ${run}`));
  await expect("Messaging", "owner replies to contacting guest", owner1.post("/api/messages", { hostel_id: context.hostelId, recipient_id: guest1.user.id, body: `QA reply ${run}` }), 201);
  await expect("Messaging", "owner cannot initiate unsolicited reply", owner1.post("/api/messages", { hostel_id: context.hostelId, recipient_id: guest2.user.id, body: "Unsolicited" }), 403);
  await expect("Messaging", "guest receives owner reply", guest1.get("/api/messages"), 200, (v) => v.messages.some((m) => m.body === `QA reply ${run}`));

  const bookingPayload = { room_id: context.roomId, start_date: day(10), end_date: day(50), quantity: 2, guest_note: `QA arrival ${run}` };
  await expect("Booking", "minimum stay enforced", guest1.post("/api/bookings", { ...bookingPayload, end_date: day(20) }), 400);
  const booking = await expect("Booking", "guest requests multiple beds", guest1.post("/api/bookings", bookingPayload), 201, (v) => v.booking?.status === "pending_owner" && v.booking.quantity === 2);
  context.bookingId = booking.value.booking.id;
  verify("Booking", "server calculates first-month total", booking.value.booking.total === 29845, `INR ${booking.value.booking.total}`);
  const bookingRow = await db.get("SELECT * FROM bookings WHERE id=?", [context.bookingId]);
  verify("MySQL persistence", "booking and guest note stored", bookingRow?.guest_note === `QA arrival ${run}` && bookingRow.quantity === 2);
  await expect("Booking", "overlapping duplicate booking blocked", guest1.post("/api/bookings", bookingPayload), 409);
  await expect("Inventory", "quantity-weighted overbooking blocked", guest2.post("/api/bookings", { ...bookingPayload, quantity: 3 }), 409);
  await expect("Owner isolation", "unrelated owner cannot view booking", owner2.get(`/api/bookings/${context.bookingId}`), 404);
  await expect("Owner isolation", "unrelated owner cannot approve booking", owner2.post(`/api/bookings/${context.bookingId}/action`, { action: "approve" }), 404);
  await expect("Payments", "payment before owner approval blocked", guest1.post(`/api/bookings/${context.bookingId}/payment-attempts`, { method: "upi", outcome: "success", idempotency_key: randomUUID() }), 409);
  await expect("Booking", "correct owner approves request", owner1.post(`/api/bookings/${context.bookingId}/action`, { action: "approve", expected_status: "pending_owner" }), 200);
  await expect("Booking", "approval opens payment window", guest1.get(`/api/bookings/${context.bookingId}`), 200, (v) => v.booking.status === "awaiting_payment" && v.booking.allowed_actions.includes("pay"));

  const failKey = randomUUID();
  const failedAttempt = await expect("Payments", "card payment starts processing", guest1.post(`/api/bookings/${context.bookingId}/payment-attempts`, { method: "card", outcome: "failure", idempotency_key: failKey }), 201, (v) => v.attempt?.status === "processing");
  await expect("Payments", "same idempotency key replays same attempt", guest1.post(`/api/bookings/${context.bookingId}/payment-attempts`, { method: "card", outcome: "failure", idempotency_key: failKey }), 201, (v) => v.attempt?.id === failedAttempt.value.attempt.id);
  await expect("Payments", "idempotency-key payload mismatch blocked", guest1.post(`/api/bookings/${context.bookingId}/payment-attempts`, { method: "upi", outcome: "failure", idempotency_key: failKey }), 409);
  await new Promise((r) => setTimeout(r, 1700));
  await expect("Payments", "declined payment records failure", guest1.post(`/api/payment-attempts/${failedAttempt.value.attempt.id}/complete`, {}), 200, (v) => v.attempt?.status === "failed");
  verify("Payments", "failed attempt creates no payment", !(await db.get("SELECT id FROM payments WHERE booking_id=?", [context.bookingId])));

  const successKey = randomUUID();
  const paidAttempt = await expect("Payments", "UPI retry starts", guest1.post(`/api/bookings/${context.bookingId}/payment-attempts`, { method: "upi", outcome: "success", idempotency_key: successKey }), 201);
  await expect("Payments", "early completion remains processing", guest1.post(`/api/payment-attempts/${paidAttempt.value.attempt.id}/complete`, {}), 200, (v) => v.attempt?.status === "processing");
  await new Promise((r) => setTimeout(r, 1700));
  await expect("Payments", "successful retry confirms booking", guest1.post(`/api/payment-attempts/${paidAttempt.value.attempt.id}/complete`, {}), 200, (v) => v.attempt?.status === "paid");
  await expect("Payments", "completion replay is safe", guest1.post(`/api/payment-attempts/${paidAttempt.value.attempt.id}/complete`, {}), 200, (v) => v.attempt?.status === "paid");
  verify("Payments", "exactly one successful payment stored", Number((await db.get("SELECT COUNT(*) n FROM payments WHERE booking_id=?", [context.bookingId])).n) === 1);
  await expect("Payments", "new payment after success blocked", guest1.post(`/api/bookings/${context.bookingId}/payment-attempts`, { method: "netbanking", outcome: "success", idempotency_key: randomUUID() }), 409);
  await expect("Payments", "guest downloads receipt", guest1.get(`/api/bookings/${context.bookingId}/receipt`), 200, (v, r) => v.includes("no money transferred") && (r.headers.get("content-disposition") || "").includes("attachment"));
  await expect("Payments", "property owner downloads receipt", owner1.get(`/api/bookings/${context.bookingId}/receipt`), 200);
  await expect("Payments", "admin downloads receipt", admin.get(`/api/bookings/${context.bookingId}/receipt`), 200);
  await expect("Payments", "unrelated guest cannot access receipt", guest2.get(`/api/bookings/${context.bookingId}/receipt`), 404);
  await expect("Payments", "guest ledger contains own payment", guest1.get("/api/payments"), 200, (v) => v.payments.some((p) => p.booking_id === context.bookingId));
  await expect("Payments", "unrelated guest ledger is isolated", guest2.get("/api/payments"), 200, (v) => !v.payments.some((p) => p.booking_id === context.bookingId));
  await expect("Payments", "owner ledger contains property payment", owner1.get("/api/payments"), 200, (v) => v.payments.some((p) => p.booking_id === context.bookingId));

  const cancelDetail = await expect("Cancellation", "full pre-move-in refund quoted", guest1.get(`/api/bookings/${context.bookingId}`), 200, (v) => v.booking.cancellation?.amount === v.booking.total);
  await expect("Cancellation", "stale refund amount blocked", guest1.post(`/api/bookings/${context.bookingId}/action`, { action: "cancel", expected_refund_amount: 1 }), 409);
  await expect("Cancellation", "guest cancels paid future stay", guest1.post(`/api/bookings/${context.bookingId}/action`, { action: "cancel", reason: `QA cancellation ${run}`, expected_refund_amount: cancelDetail.value.booking.total }), 200);
  await expect("Refunds", "non-admin cannot process refund", owner1.post(`/api/bookings/${context.bookingId}/action`, { action: "refund" }), 403);
  await expect("Refunds", "admin processes demo refund", admin.post(`/api/bookings/${context.bookingId}/action`, { action: "refund", expected_refund_amount: cancelDetail.value.booking.total }), 200);
  const refunded = await db.get("SELECT b.status,p.status payment_status,p.refunded_at FROM bookings b JOIN payments p ON p.booking_id=b.id WHERE b.id=?", [context.bookingId]);
  verify("MySQL persistence", "refund state stored", refunded?.status === "refunded" && refunded.payment_status === "refunded" && !!refunded.refunded_at);
  await expect("Refunds", "duplicate refund blocked", admin.post(`/api/bookings/${context.bookingId}/action`, { action: "refund" }), 409);

  const rejectedBooking = await expect("Booking", "second guest creates request", guest2.post("/api/bookings", { ...bookingPayload, quantity: 2, start_date: day(70), end_date: day(110), guest_note: "QA reject path" }), 201);
  context.rejectedBookingId = rejectedBooking.value.booking.id;
  await expect("Booking", "rejection requires reason", owner1.post(`/api/bookings/${context.rejectedBookingId}/action`, { action: "reject" }), 400);
  await expect("Booking", "owner rejects unpaid request", owner1.post(`/api/bookings/${context.rejectedBookingId}/action`, { action: "reject", reason: "QA planned maintenance" }), 200);
  const rejectedRow = await db.get("SELECT status,refund_amount FROM bookings WHERE id=?", [context.rejectedBookingId]);
  verify("MySQL persistence", "unpaid rejection stores no refund", rejectedRow?.status === "rejected" && rejectedRow.refund_amount === 0);

  const expiredBooking = await expect("Booking expiry", "guest creates request for expiry test", guest2.post("/api/bookings", { ...bookingPayload, quantity: 1, start_date: day(130), end_date: day(170), guest_note: "QA expiry path" }), 201);
  context.expiredBookingId = expiredBooking.value.booking.id;
  await db.run("UPDATE bookings SET expires_at='2020-01-01T00:00:00.000Z' WHERE id=?", [context.expiredBookingId]);
  await expect("Booking expiry", "expired request cannot be approved", owner1.post(`/api/bookings/${context.expiredBookingId}/action`, { action: "approve" }), 409);
  await expect("Booking expiry", "expired request exposes no actions", guest2.get(`/api/bookings/${context.expiredBookingId}`), 200, (v) => v.booking.status === "expired" && v.booking.allowed_actions.length === 0);

  const complaintSubject = `QA complaint ${run}`;
  await expect("Support", "guest creates booking-linked complaint", guest1.post("/api/complaints", { booking_id: context.bookingId, subject: complaintSubject, body: "QA support request" }), 201);
  const complaint = await db.get("SELECT * FROM complaints WHERE user_id=? AND subject=?", [guest1.user.id, complaintSubject]);
  verify("MySQL persistence", "complaint stored in MySQL", !!complaint && complaint.status === "open");
  await expect("Support", "other guest cannot link foreign booking", guest2.post("/api/complaints", { booking_id: context.bookingId, subject: "Foreign", body: "Should fail" }), 404);
  await expect("Support", "admin resolves complaint", admin.post(`/api/admin/complaints/${complaint.id}`, { resolution: "QA resolution recorded" }), 200);
  await expect("Support", "guest sees resolved complaint", guest1.get("/api/complaints"), 200, (v) => v.complaints.some((c) => c.id === complaint.id && c.status === "resolved"));

  const reviewCandidate = await db.get("SELECT b.id,u.email FROM bookings b JOIN users u ON u.id=b.user_id LEFT JOIN reviews r ON r.booking_id=b.id WHERE b.status='completed' AND u.status='active' AND r.id IS NULL LIMIT 1");
  verify("Reviews", "seed has completed unreviewed booking", !!reviewCandidate);
  const reviewer = new Client("seed-reviewer");
  await login(reviewer, reviewCandidate.email, "HostelHub@123");
  const reviewResult = await expect("Reviews", "eligible resident posts review", reviewer.post("/api/reviews", { booking_id: reviewCandidate.id, rating: 4, body: `QA verified review ${run}` }), 201);
  const review = await db.get("SELECT * FROM reviews WHERE booking_id=?", [reviewCandidate.id]);
  verify("MySQL persistence", "review stored in MySQL", review?.body === `QA verified review ${run}`);
  await expect("Reviews", "duplicate review blocked", reviewer.post("/api/reviews", { booking_id: reviewCandidate.id, rating: 5, body: "Duplicate" }), 409);
  await expect("Reviews", "admin hides review", admin.post(`/api/admin/reviews/${review.id}`, { status: "hidden" }), 200);
  verify("MySQL persistence", "review moderation stored", (await db.get("SELECT status FROM reviews WHERE id=?", [review.id])).status === "hidden");
  await expect("Reviews", "admin restores review", admin.post(`/api/admin/reviews/${review.id}`, { status: "published" }), 200);

  await expect("Notifications", "guest receives workflow notifications", guest1.get("/api/notifications"), 200, (v) => v.notifications.length >= 4);
  await expect("Notifications", "mark notifications read", guest1.post("/api/notifications/read", {}), 200);
  verify("MySQL persistence", "notification read state stored", Number((await db.get("SELECT COUNT(*) n FROM notifications WHERE user_id=? AND is_read=0", [guest1.user.id])).n) === 0);

  await expect("Portfolio", "owner portfolio is scoped", owner1.get("/api/portfolio"), 200, (v) => v.properties.length >= 2 && v.properties.every((h) => [context.hostelId, context.secondHostelId].includes(h.id)));
  await expect("Portfolio", "owner dashboard is scoped", owner1.get("/api/dashboard"), 200, (v) => v.users.length === 0 && v.hostels.every((h) => h.owner_id === owner1.user.id));
  await expect("Portfolio", "admin portfolio includes import history", admin.get("/api/portfolio"), 200, (v) => v.imports.length >= 1 && v.properties.length >= 44);
  await expect("Administration", "admin dashboard omits password hashes", admin.get("/api/dashboard"), 200, (v) => v.users.every((u) => !u.password && u.token_version === undefined));
  await expect("Reports", "guest cannot export bookings", guest1.get("/api/reports/bookings.csv"), 403);
  await expect("Reports", "owner exports only owned bookings", owner1.get("/api/reports/bookings.csv"), 200, (v) => v.includes(context.bookingId) && !v.includes("csv-booking-0001"));
  await expect("Reports", "admin exports complete booking report", admin.get("/api/reports/bookings.csv"), 200, (v) => v.includes(context.bookingId) && v.includes("csv-booking-"));

  await expect("Assistant", "local assistant searches MySQL inventory", anonymous.post("/api/assistant", { message: `co-living in Chennai under 20k with food` }), 200, (v) => v.mode === "local" && Array.isArray(v.hostels));

  await expect("Account controls", "admin suspends second guest", admin.post(`/api/admin/users/${guest2.user.id}/status`, { status: "suspended" }), 200);
  await expect("Account controls", "suspension revokes existing session", guest2.get("/api/bookings"), 401);
  const suspendedLogin = new Client("suspended-login");
  await expect("Account controls", "suspended user cannot log in", suspendedLogin.post("/api/auth/login", { email: guest2.email, password: "NewAuditPass@123" }), 403);
  await expect("Account controls", "admin cannot suspend administrator", admin.post(`/api/admin/users/${admin.user.id}/status`, { status: "suspended" }), 400);
  await expect("Account controls", "admin reactivates guest", admin.post(`/api/admin/users/${guest2.user.id}/status`, { status: "active" }), 200);
  guest2 = new Client("guest2-reactivated");
  await login(guest2, `${run}.guest2@example.test`, "NewAuditPass@123");
  await expect("Account controls", "logout succeeds", guest2.post("/api/auth/logout", {}), 200);
  await expect("Account controls", "logout revokes session", guest2.get("/api/bookings"), 401);

  const eventCount = Number((await db.get("SELECT COUNT(*) n FROM booking_events WHERE booking_id=?", [context.bookingId])).n);
  const auditCount = Number((await db.get("SELECT COUNT(*) n FROM audit_log WHERE actor_id=?", [admin.user.id])).n);
  verify("Audit history", "booking timeline persisted", eventCount >= 7, `${eventCount} events`);
  verify("Audit history", "administrative actions persisted", auditCount >= 4, `${auditCount} total admin audit rows`);

  const finalCounts = {};
  for (const table of ["users", "hostels", "rooms", "bookings", "payments"])
    finalCounts[table] = Number((await db.get(`SELECT COUNT(*) n FROM ${table}`)).n);
  context.finalCounts = finalCounts;
} catch (error) {
  context.fatal = error.stack || error.message;
} finally {
  const summary = {
    run,
    base,
    passed: results.filter((r) => r.status === "PASS").length,
    failed: results.filter((r) => r.status === "FAIL").length,
    context,
    results,
  };
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/mysql-api-audit.json", JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  await db.close();
  if (summary.failed || context.fatal) process.exitCode = 1;
}
