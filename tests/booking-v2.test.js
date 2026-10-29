import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createDatabase } from "../server/db.js";
import { createApp } from "../server/app.js";
import { seed } from "../server/seed-legacy.js";
let db, app, temp;
const post = (a, p, b = {}) =>
  a
    .post("/api" + p)
    .set("X-HostelHub-Client", "test")
    .send(b);
const date = (n) =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
beforeEach(async () => {
  temp = mkdtempSync(join(tmpdir(), "hostel-v2-test-"));
  db = await createDatabase({ client: "sqlite", path: ":memory:" });
  await seed(db);
  app = createApp(db, { demo: true, uploads: temp });
});
afterEach(async () => {
  await db.close();
  assert(
    resolve(temp).startsWith(resolve(tmpdir())) &&
      temp.includes("hostel-v2-test-"),
  );
  rmSync(temp, { recursive: true, force: true });
});
async function login(role = "user") {
  const a = request.agent(app);
  await post(a, "/auth/login", {
    email: role + "@hostelhub.test",
    password: "HostelHub@123",
  }).expect(200);
  return a;
}
async function register(role = "user") {
  const a = request.agent(app);
  const email = randomUUID() + "@example.test";
  const r = await a
    .post("/api/auth/register")
    .set("X-HostelHub-Client", "test")
    .field("name", "Independent Member")
    .field("email", email)
    .field("password", "StrongPass@123")
    .field("role", role)
    .field("document_type", "college_id")
    .field("consent", "true")
    .attach("document", Buffer.from("%PDF-1.4\nDemo identity"), "identity.pdf")
    .expect(201);
  const admin = await login("admin");
  await post(
    admin,
    `/admin/identity-verifications/${r.body.verification.id}/review`,
    { status: "approved", note: "Test identity verified" },
  ).expect(200);
  await post(a, "/auth/login", {
    email,
    password: "StrongPass@123",
  }).expect(200);
  return { a, user: r.body.user };
}
async function book(a, extra = {}) {
  return (
    await post(a, "/bookings", {
      room_id: "hostel-1-room-3",
      start_date: date(5),
      end_date: date(65),
      ...extra,
    }).expect(201)
  ).body.booking;
}
async function approve(b) {
  const owner = await login("owner");
  await post(owner, `/bookings/${b.id}/action`, {
    action: "approve",
    expected_status: "pending_owner",
  }).expect(200);
  return owner;
}
async function pay(a, b, outcome = "success", method = "upi") {
  const r = await post(a, `/bookings/${b.id}/payment-attempts`, {
    method,
    outcome,
    idempotency_key: randomUUID(),
  }).expect(201);
  await db.run(
    "UPDATE payment_attempts SET ready_at='2020-01-01T00:00:00.000Z' WHERE id=?",
    [r.body.attempt.id],
  );
  return (
    await post(a, `/payment-attempts/${r.body.attempt.id}/complete`).expect(200)
  ).body.attempt;
}
test("first month quote is server calculated; approval is required before payment", async () => {
  const guest = await login();
  await db.run(
    "UPDATE hostels SET food_charge=2000,service_charge=400,tax_percent=5 WHERE id='hostel-1'",
  );
  const b = await book(guest, { quantity: 2, total: 1 });
  assert.equal(b.status, "pending_owner");
  assert.equal(b.rent, 12350);
  assert.equal(b.deposit, 6000);
  assert.equal(b.food_charge, 4000);
  assert.equal(b.service_charge, 800);
  assert.equal(b.tax_amount, 858);
  assert.equal(b.total, 24008);
  await post(guest, `/bookings/${b.id}/payment-attempts`, {
    method: "upi",
    outcome: "success",
    idempotency_key: randomUUID(),
  }).expect(409);
  await post(guest, `/bookings/${b.id}/pay`, { outcome: "success" }).expect(
    409,
  );
  await approve(b);
  assert.equal(
    (await guest.get("/api/bookings/" + b.id)).body.booking.status,
    "awaiting_payment",
  );
  await pay(guest, b);
  const d = (await guest.get("/api/bookings/" + b.id)).body;
  assert.equal(d.booking.status, "confirmed");
  assert.equal(d.booking.payment_method, "upi");
  assert.equal(d.attempts.length, 1);
  assert.deepEqual(
    d.events.map((e) => e.event),
    ["reserved", "approve", "payment_started", "payment_received"],
  );
  const receipt = await guest.get(`/api/bookings/${b.id}/receipt`).expect(200);
  assert.match(receipt.headers["content-disposition"], /attachment/);
  assert.match(receipt.text, /no money transferred/);
  assert.match(receipt.text, /24008/);
});
test("processing, retry and replay record exactly one successful payment", async () => {
  const a = await login(),
    b = await book(a);
  await approve(b);
  const key = randomUUID(),
    payload = { method: "card", outcome: "failure", idempotency_key: key };
  const first = (
    await post(a, `/bookings/${b.id}/payment-attempts`, payload).expect(201)
  ).body.attempt;
  assert.equal(
    (await post(a, `/payment-attempts/${first.id}/complete`)).body.attempt
      .status,
    "processing",
  );
  assert.equal(
    (await post(a, `/bookings/${b.id}/payment-attempts`, payload)).body.attempt
      .id,
    first.id,
  );
  await post(a, `/bookings/${b.id}/payment-attempts`, {
    ...payload,
    method: "upi",
  }).expect(409);
  await db.run(
    "UPDATE payment_attempts SET ready_at='2020-01-01T00:00:00Z' WHERE id=?",
    [first.id],
  );
  assert.equal(
    (await post(a, `/payment-attempts/${first.id}/complete`)).body.attempt
      .status,
    "failed",
  );
  const paid = await pay(a, b, "success", "netbanking");
  await post(a, `/payment-attempts/${paid.id}/complete`).expect(200);
  assert.equal(
    (
      await db.get("SELECT COUNT(*) AS n FROM payments WHERE booking_id=?", [
        b.id,
      ])
    ).n,
    1,
  );
  assert.equal(
    (
      await db.get(
        "SELECT COUNT(*) AS n FROM booking_events WHERE booking_id=? AND event='payment_received'",
        [b.id],
      )
    ).n,
    1,
  );
});
test("rejection requires a reason and releases an unpaid request without a refund", async () => {
  const a = await login(),
    owner = await login("owner"),
    b = await book(a);
  await post(owner, `/bookings/${b.id}/action`, { action: "reject" }).expect(
    400,
  );
  await post(owner, `/bookings/${b.id}/action`, {
    action: "reject",
    reason: "Planned maintenance during these dates",
    expected_refund_amount: 0,
  }).expect(200);
  const d = (await a.get("/api/bookings/" + b.id)).body;
  assert.equal(d.booking.status, "rejected");
  assert.equal(d.booking.refund_amount, 0);
  assert.equal(d.booking.payment_id, null);
  assert.equal(d.events.at(-1).note, "Planned maintenance during these dates");
});
test("expired request and approved payment holds release capacity and reject decisions", async () => {
  const a = await login(),
    owner = await login("owner"),
    b = await book(a);
  await db.run(
    "UPDATE bookings SET expires_at='2020-01-01T00:00:00Z' WHERE id=?",
    [b.id],
  );
  await post(owner, `/bookings/${b.id}/action`, { action: "approve" }).expect(
    409,
  );
  assert.deepEqual(
    (await a.get("/api/bookings/" + b.id)).body.booking.allowed_actions,
    [],
  );
  const second = await book(a);
  await approve(second);
  await db.run(
    "UPDATE bookings SET expires_at='2020-01-01T00:00:00Z' WHERE id=?",
    [second.id],
  );
  await post(a, `/bookings/${second.id}/payment-attempts`, {
    method: "upi",
    outcome: "success",
    idempotency_key: randomUUID(),
  }).expect(409);
  const third = await book(a);
  assert.equal(third.status, "pending_owner");
});
test("multi-bed requests cannot oversell during concurrent reservations or capacity edits", async () => {
  await db.run("UPDATE rooms SET capacity=3 WHERE id='hostel-1-room-3'");
  const a = await login(),
    { a: other } = await register();
  const payload = {
    room_id: "hostel-1-room-3",
    start_date: date(5),
    end_date: date(35),
    quantity: 2,
  };
  const result = await Promise.all([
    post(a, "/bookings", payload),
    post(other, "/bookings", payload),
  ]);
  assert.deepEqual(result.map((r) => r.status).sort(), [201, 409]);
  const owner = await login("owner");
  await owner
    .patch("/api/owner/rooms/hostel-1-room-3")
    .set("X-HostelHub-Client", "test")
    .send({ name: "Triple", sharing: 3, rent: 6500, capacity: 1, ac: false })
    .expect(409);
});
test("minimum stay, room sharing and quantity are validated", async () => {
  const a = await login();
  await post(a, "/bookings", {
    room_id: "hostel-1-room-3",
    start_date: date(1),
    end_date: date(8),
  }).expect(400);
  await post(a, "/bookings", {
    room_id: "hostel-1-room-3",
    start_date: date(1),
    end_date: date(40),
    quantity: 5,
  }).expect(400);
  const owner = await login("owner");
  await post(owner, "/owner/hostels/hostel-1/rooms", {
    name: "Four sharing",
    sharing: 4,
    rent: 5000,
    capacity: 8,
    ac: false,
  }).expect(201);
  assert(
    (await request(app).get("/api/hostels?sharing=4")).body.hostels.some(
      (h) => h.id === "hostel-1",
    ),
  );
});
test("foreign owners and guests cannot view bookings, receipts, payment attempts or portfolio", async () => {
  const a = await login(),
    b = await book(a),
    { a: other } = await register(),
    { a: otherOwner } = await register("owner");
  await approve(b);
  const p = await pay(a, b);
  for (const actor of [other, otherOwner]) {
    await actor.get("/api/bookings/" + b.id).expect(404);
    await actor.get(`/api/bookings/${b.id}/receipt`).expect(404);
    await post(actor, `/bookings/${b.id}/action`, { action: "cancel" }).expect(
      404,
    );
    assert(
      !(await actor.get("/api/payments")).body.payments.some(
        (p) => p.booking_id === b.id,
      ),
    );
  }
  await post(other, `/payment-attempts/${p.id}/complete`).expect(404);
  await otherOwner.get("/api/portfolio?hostel_id=hostel-1").expect(404);
  assert.equal(
    (await otherOwner.get("/api/portfolio")).body.properties.length,
    0,
  );
});
test("cancellation during processing cannot later be charged", async () => {
  const a = await login(),
    b = await book(a);
  await approve(b);
  const attempt = (
    await post(a, `/bookings/${b.id}/payment-attempts`, {
      method: "upi",
      outcome: "success",
      idempotency_key: randomUUID(),
    })
  ).body.attempt;
  await post(a, `/bookings/${b.id}/action`, {
    action: "cancel",
    expected_refund_amount: 0,
  }).expect(200);
  await db.run(
    "UPDATE payment_attempts SET ready_at='2020-01-01T00:00:00Z' WHERE id=?",
    [attempt.id],
  );
  assert.equal(
    (await post(a, `/payment-attempts/${attempt.id}/complete`)).body.attempt
      .status,
    "expired",
  );
  assert.equal(
    (
      await db.get("SELECT COUNT(*) AS n FROM payments WHERE booking_id=?", [
        b.id,
      ])
    ).n,
    0,
  );
});
test("stale approval and refund quotes fail without partial updates", async () => {
  const a = await login(),
    b = await book(a),
    owner = await approve(b);
  await pay(a, b);
  await post(owner, `/bookings/${b.id}/action`, {
    action: "reject",
    reason: "Stale decision",
    expected_status: "pending_owner",
  }).expect(409);
  await db.run("UPDATE bookings SET start_date='2020-01-01' WHERE id=?", [
    b.id,
  ]);
  await post(a, `/bookings/${b.id}/action`, {
    action: "cancel",
    expected_refund_amount: b.total,
  }).expect(409);
  await post(a, `/bookings/${b.id}/action`, {
    action: "cancel",
    expected_refund_amount: b.deposit,
    reason: "Moving closer to campus",
  }).expect(200);
  const admin = await login("admin");
  await post(admin, `/bookings/${b.id}/action`, {
    action: "refund",
    expected_refund_amount: b.total,
  }).expect(409);
  assert.equal(
    (await db.get("SELECT status FROM payments WHERE booking_id=?", [b.id]))
      .status,
    "paid",
  );
  await post(admin, `/bookings/${b.id}/action`, {
    action: "refund",
    expected_refund_amount: b.deposit,
  }).expect(200);
  await post(admin, `/bookings/${b.id}/action`, { action: "refund" }).expect(
    409,
  );
  const portfolio = (await owner.get("/api/portfolio")).body;
  assert.equal(portfolio.stats.refunds, b.deposit);
  assert.equal(portfolio.stats.net, 11500 + b.rent);
});
test("future paid cancellation refunds the entire initial payment", async () => {
  const a = await login(),
    b = await book(a);
  await approve(b);
  await pay(a, b);
  assert.equal(
    (await a.get("/api/bookings/" + b.id)).body.booking.cancellation.amount,
    b.total,
  );
  await post(a, `/bookings/${b.id}/action`, {
    action: "cancel",
    expected_refund_amount: b.total,
  }).expect(200);
  assert.equal(
    (await a.get("/api/bookings/" + b.id)).body.booking.refund_amount,
    b.total,
  );
});
test("legacy bookings keep original amounts and complete their original workflow", async () => {
  const a = await login(),
    b = await book(a);
  await db.run(
    "UPDATE bookings SET flow_version=1,status='awaiting_payment',rent=20000,total=23000 WHERE id=?",
    [b.id],
  );
  await post(a, `/bookings/${b.id}/pay`, { outcome: "success" }).expect(200);
  const owner = await login("owner");
  await post(owner, `/bookings/${b.id}/action`, { action: "approve" }).expect(
    200,
  );
  const d = (await a.get("/api/bookings/" + b.id)).body.booking;
  assert.equal(d.status, "confirmed");
  assert.equal(d.total, 23000);
  assert.equal(d.flow_version, 1);
});
test("completed stays leave owner queue and reviews remain unique", async () => {
  const a = await login(),
    b = await book(a),
    owner = await approve(b);
  await pay(a, b);
  await db.run(
    "UPDATE bookings SET start_date='2020-01-01',end_date='2020-02-01' WHERE id=?",
    [b.id],
  );
  assert(
    (
      await owner.get("/api/bookings/" + b.id)
    ).body.booking.allowed_actions.includes("complete"),
  );
  await post(owner, `/bookings/${b.id}/action`, { action: "complete" }).expect(
    200,
  );
  await post(a, "/reviews", {
    booking_id: b.id,
    rating: 4,
    body: "The room was comfortable and the caretaker helpful.",
  }).expect(201);
  assert.deepEqual(
    (await a.get("/api/bookings/" + b.id)).body.booking.allowed_actions,
    [],
  );
});
