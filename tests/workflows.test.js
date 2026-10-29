import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createDatabase } from "../server/db.js";
import { createApp } from "../server/app.js";
import { seed } from "../server/seed-legacy.js";
import { recordBookingEvent } from "../server/booking-workflow.js";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
let db, app, temp;
beforeEach(async () => {
  temp = mkdtempSync(join(tmpdir(), "hostel-hub-test-"));
  db = await createDatabase({ client: "sqlite", path: ":memory:" });
  await seed(db);
  app = createApp(db, {
    demo: true,
    client: "sqlite",
    secret: "test-secret-only-do-not-use-in-production",
    uploads: temp,
  });
});
afterEach(async () => {
  await db.close();
  const path = resolve(temp);
  assert(
    path.startsWith(resolve(tmpdir()) + "\\") ||
      path.startsWith(resolve(tmpdir()) + "/"),
  );
  assert(path.includes("hostel-hub-test-"));
  rmSync(path, { recursive: true, force: true });
});
const post = (agent, path, body) =>
  agent
    .post("/api" + path)
    .set("X-HostelHub-Client", "test")
    .send(body);
const patch = (agent, path, body) =>
  agent
    .patch("/api" + path)
    .set("X-HostelHub-Client", "test")
    .send(body);
async function login(role = "user") {
  const agent = request.agent(app);
  await post(agent, "/auth/login", {
    email: `${role}@hostelhub.test`,
    password: "HostelHub@123",
  }).expect(200);
  return agent;
}
async function register(role = "user") {
  const a = request.agent(app);
  const email = `${randomUUID()}@example.test`;
  const r = await a
    .post("/api/auth/register")
    .set("X-HostelHub-Client", "test")
    .field("name", "Test Member")
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
async function activateAdvanced(agent, outcome = "success") {
  const started = await post(agent, "/owner/subscription-attempts", {
    plan: "Advanced",
    method: "upi",
    outcome,
    idempotency_key: randomUUID(),
  }).expect(201);
  await db.run("UPDATE subscription_attempts SET ready_at=? WHERE id=?", [
    "2000-01-01T00:00:00.000Z",
    started.body.attempt.id,
  ]);
  return post(
    agent,
    `/subscription-attempts/${started.body.attempt.id}/complete`,
    {},
  ).expect(200);
}
const dates = { start_date: "2027-01-01", end_date: "2027-01-31" };
async function book(a, room = "hostel-1-room-3", range = dates) {
  return (await post(a, "/bookings", { room_id: room, ...range }).expect(201))
    .body.booking;
}

test("public search hides unpublished listings and filters room price, gender, facilities and dates", async () => {
  const all = await request(app).get("/api/hostels").expect(200);
  assert.equal(all.body.hostels.length, 6);
  assert(!all.body.hostels.some((h) => h.id === "hostel-7"));
  const filtered = await request(app)
    .get(
      "/api/hostels?q=Chennai&gender=Girls&budget=8000&facilities=Wi-Fi,Food",
    )
    .expect(200);
  assert.equal(filtered.body.hostels.length, 1);
  assert.equal(filtered.body.hostels[0].name, "Olive House");
  await request(app).get("/api/hostels/hostel-7").expect(404);
  await request(app)
    .get("/api/hostels?start=2027-02-30&end=2027-03-30")
    .expect(400);
  const distance = await request(app)
    .get("/api/hostels?lat=12.8996&lng=80.2279&distance=1")
    .expect(200);
  assert.equal(distance.body.hostels.length, 1);
});
test("authentication validates input, blocks admin registration and enforces roles", async () => {
  await post(request(app), "/auth/register", {
    name: "Bad",
    email: "invalid",
    password: "short",
    role: "admin",
  }).expect(400);
  await post(request(app), "/auth/login", {
    email: "user@hostelhub.test",
    password: "wrong",
  }).expect(401);
  await request(app).get("/api/bookings").expect(401);
  const a = await login();
  await a.get("/api/dashboard").expect(403);
  await post(a, "/owner/hostels", {}).expect(403);
  const r = await a.get("/api/auth/me").expect(200);
  assert.equal(r.body.user.password, undefined);
  assert.equal(r.body.user.token_version, undefined);
});
test("new accounts require private identity review and rejected applicants can resubmit", async () => {
  const applicant = request.agent(app);
  const email = `${randomUUID()}@example.test`;
  const registration = await applicant
    .post("/api/auth/register")
    .set("X-HostelHub-Client", "test")
    .field("name", "Identity Applicant")
    .field("email", email)
    .field("password", "StrongPass@123")
    .field("role", "user")
    .field("document_type", "masked_aadhaar")
    .field("consent", "true")
    .attach(
      "document",
      Buffer.from("%PDF-1.4\nMasked demo identity"),
      "masked-id.pdf",
    )
    .expect(201);
  assert.equal(registration.body.user.status, "pending_verification");
  await post(applicant, "/auth/login", {
    email,
    password: "StrongPass@123",
  })
    .expect(403)
    .expect((r) =>
      assert.match(r.body.error, /awaiting administrator approval/),
    );
  const verificationId = registration.body.verification.id;
  const first = await db.get(
    "SELECT * FROM identity_verifications WHERE id=?",
    [verificationId],
  );
  assert.equal(first.status, "pending");
  assert(existsSync(join(temp, "private", first.path)));
  const guest = await login();
  await guest
    .get(`/api/identity-verifications/${verificationId}/document`)
    .expect(403);
  await request(app).get(`/uploads/private/${first.path}`).expect(404);
  const admin = await login("admin");
  await admin
    .get(`/api/identity-verifications/${verificationId}/document`)
    .expect(200);
  const dashboard = await admin.get("/api/dashboard").expect(200);
  assert.equal(dashboard.body.stats.pending_accounts, 1);
  assert.equal(dashboard.body.identity_verifications[0].user_email, email);
  await post(admin, `/admin/identity-verifications/${verificationId}/review`, {
    status: "rejected",
    note: "The uploaded image is not clear enough",
  }).expect(200);
  await post(applicant, "/auth/login", {
    email,
    password: "StrongPass@123",
  })
    .expect(403)
    .expect((r) => assert.match(r.body.error, /not clear enough/));
  await applicant
    .post("/api/auth/verification/resubmit")
    .set("X-HostelHub-Client", "test")
    .field("email", email)
    .field("password", "StrongPass@123")
    .field("document_type", "college_id")
    .field("consent", "true")
    .attach(
      "document",
      Buffer.from("%PDF-1.4\nClear demo identity"),
      "college-id.pdf",
    )
    .expect(200);
  const replacement = await db.get(
    "SELECT * FROM identity_verifications WHERE id=?",
    [verificationId],
  );
  assert.equal(replacement.status, "pending");
  assert.equal(replacement.review_note, "");
  assert.notEqual(replacement.path, first.path);
  assert.equal(existsSync(join(temp, "private", first.path)), false);
  await post(admin, `/admin/identity-verifications/${verificationId}/review`, {
    status: "approved",
    note: "Replacement document verified",
  }).expect(200);
  await post(applicant, "/auth/login", {
    email,
    password: "StrongPass@123",
  }).expect(200);
  assert.equal(
    (await applicant.get("/api/auth/me")).body.user.status,
    "active",
  );
  await post(admin, `/admin/identity-verifications/${verificationId}/review`, {
    status: "approved",
    note: "Duplicate decision",
  }).expect(409);
});
test("CSRF rejects missing client header and foreign origin", async () => {
  await request(app).post("/api/auth/login").send({}).expect(403);
  await request(app)
    .post("/api/auth/login")
    .set("X-HostelHub-Client", "test")
    .set("Origin", "https://attacker.example")
    .send({})
    .expect(403);
});
test("reviews require an eligible stay, reject duplicates and support moderation", async () => {
  const a = await login();
  await post(a, "/reviews", {
    booking_id: "made-up",
    rating: 5,
    body: "Great",
  }).expect(403);
  await post(a, "/reviews", {
    booking_id: "booking-demo",
    rating: 5,
    body: "Bright rooms and helpful staff.",
  }).expect(201);
  await post(a, "/reviews", {
    booking_id: "booking-demo",
    rating: 4,
    body: "Again",
  }).expect(409);
  let h = await request(app).get("/api/hostels/hostel-1");
  assert.equal(h.body.hostel.rating, 5);
  const admin = await login("admin");
  const r = await db.get("SELECT id FROM reviews LIMIT 1");
  await post(admin, "/admin/reviews/" + r.id, { status: "hidden" }).expect(200);
  h = await request(app).get("/api/hostels/hostel-1");
  assert.equal(h.body.reviews.length, 0);
});
test("wishlist and messages remain scoped to each account", async () => {
  const a = await login(),
    { a: other } = await register(),
    owner = await login("owner");
  await post(a, "/wishlist/hostel-1", {}).expect(200);
  assert.deepEqual((await a.get("/api/wishlist")).body.ids, ["hostel-1"]);
  assert.deepEqual((await other.get("/api/wishlist")).body.ids, []);
  await post(a, "/messages", {
    hostel_id: "hostel-1",
    body: "Is food included?",
  }).expect(201);
  assert.equal((await other.get("/api/messages")).body.messages.length, 0);
  await post(owner, "/messages", {
    hostel_id: "hostel-1",
    recipient_id: "user-demo",
    body: "Yes, meals are included.",
  }).expect(201);
  assert.equal((await a.get("/api/messages")).body.messages.length, 2);
});
test("document verification cannot be bypassed, documents are private and uploads validate content", async () => {
  const owner = await login("owner"),
    admin = await login("admin"),
    { a: other } = await register("owner"),
    guest = await login();
  await post(admin, "/admin/hostels/hostel-7/review", {
    status: "approved",
    note: "Checked",
  }).expect(400);
  await owner
    .post("/api/uploads/photo")
    .set("X-HostelHub-Client", "test")
    .attach("file", Buffer.from("<script>alert(1)</script>"), "fake.jpg")
    .expect(400);
  const up = await owner
    .post("/api/owner/hostels/hostel-7/documents")
    .set("X-HostelHub-Client", "test")
    .attach("file", Buffer.from("%PDF-1.4\nSample document only"), "sample.pdf")
    .expect(201);
  await guest.get("/api/documents/" + up.body.id).expect(403);
  await other.get("/api/documents/" + up.body.id).expect(404);
  await admin.get("/api/documents/" + up.body.id).expect(200);
  await request(app)
    .get("/uploads/private/" + up.body.id + ".pdf")
    .expect(404);
  await post(owner, "/owner/hostels/hostel-7/submit", {}).expect(200);
  await post(admin, "/admin/hostels/hostel-7/review", {
    status: "approved",
    note: "Demo document reviewed",
  }).expect(200);
  await request(app).get("/api/hostels/hostel-7").expect(200);
  assert.equal((await request(app).get("/api/hostels")).body.hostels.length, 7);
});
test("owner can create/edit listing and room type, other owners cannot edit it", async () => {
  const owner = await login("owner"),
    { a: other } = await register("owner");
  await activateAdvanced(owner);
  const h = (await owner.get("/api/hostels/hostel-1")).body.hostel;
  const data = {
    ...h,
    name: "New demo home",
    photos: [],
    rooms: [{ name: "Twin", sharing: 2, rent: 8000, capacity: 4, ac: true }],
  };
  const created = await post(owner, "/owner/hostels", data).expect(201);
  await request(app)
    .get("/api/hostels/" + created.body.id)
    .expect(404);
  await patch(other, "/owner/hostels/" + created.body.id, data).expect(404);
  await patch(owner, "/owner/hostels/" + created.body.id, data).expect(200);
  await post(owner, "/owner/hostels/" + created.body.id + "/rooms", {
    name: "Private",
    sharing: 1,
    rent: 10000,
    capacity: 2,
    ac: false,
  }).expect(201);
  assert.equal(
    (await owner.get("/api/hostels/" + created.body.id)).body.hostel.rooms
      .length,
    2,
  );
});
test("Basic and Advanced limits, offers and downgrade preservation stay consistent", async () => {
  const { a: owner } = await register("owner");
  const source = (await request(app).get("/api/hostels/hostel-1")).body.hostel;
  const photo = () => `/uploads/${randomUUID()}.jpg`;
  const listing = {
    ...source,
    name: "Plan limit home",
    discount: 0,
    photos: Array.from({ length: 8 }, photo),
    rooms: [{ name: "Twin", sharing: 2, rent: 8000, capacity: 4, ac: true }],
  };
  await post(owner, "/owner/hostels", {
    ...listing,
    photos: [...listing.photos, photo()],
  }).expect(400);
  await post(owner, "/owner/hostels", { ...listing, discount: 5 }).expect(403);
  await post(owner, "/owner/hostels", listing).expect(201);
  await post(owner, "/owner/hostels", {
    ...listing,
    name: "Second Basic home",
  }).expect(403);

  await activateAdvanced(owner);
  const advanced = await post(owner, "/owner/hostels", {
    ...listing,
    name: "Advanced home",
    discount: 10,
    photos: [...listing.photos, photo()],
  }).expect(201);
  await post(owner, "/owner/subscription", { plan: "Basic" }).expect(200);
  const existing = {
    ...listing,
    name: "Advanced home preserved",
    discount: 10,
    photos: [...listing.photos, photo()],
  };
  await patch(owner, `/owner/hostels/${advanced.body.id}`, existing).expect(
    200,
  );
  await patch(owner, `/owner/hostels/${advanced.body.id}`, {
    ...existing,
    photos: [...existing.photos, photo()],
  }).expect(400);
  await patch(owner, `/owner/hostels/${advanced.body.id}`, {
    ...existing,
    discount: 11,
  }).expect(403);
  assert.equal((await owner.get("/api/owner/hostels")).body.hostels.length, 2);
});
test("subscriptions, complaints and CSV reports work across roles", async () => {
  const owner = await login("owner"),
    a = await login(),
    admin = await login("admin");
  await activateAdvanced(owner, "failure");
  assert.equal((await owner.get("/api/auth/me")).body.user.plan, "Basic");
  const activated = await activateAdvanced(owner);
  assert.equal((await owner.get("/api/auth/me")).body.user.plan, "Advanced");
  assert.equal(activated.body.payment.plan_code, "Advanced");
  await owner
    .get(`/api/subscription-payments/${activated.body.payment.id}/receipt`)
    .expect(200);
  await post(owner, "/owner/subscription-attempts", {
    plan: "Advanced",
    method: "upi",
    outcome: "success",
    idempotency_key: randomUUID(),
  }).expect(409);
  await post(owner, "/owner/subscription", { plan: "Pro" }).expect(400);
  await post(a, "/complaints", {
    subject: "Need help",
    body: "Please explain the deposit.",
  }).expect(201);
  const c = (await admin.get("/api/complaints")).body.complaints[0];
  await post(admin, "/admin/complaints/" + c.id, {
    resolution:
      "The deposit is refunded under the displayed cancellation rules.",
  }).expect(200);
  assert.equal(
    (await a.get("/api/complaints")).body.complaints[0].status,
    "resolved",
  );
  await a.get("/api/reports/bookings.csv").expect(403);
  const csv = await owner.get("/api/reports/bookings.csv").expect(200);
  assert(csv.text.includes("booking-demo"));
  await post(owner, "/owner/subscription", { plan: "Basic" }).expect(200);
  assert.equal((await owner.get("/api/auth/me")).body.user.plan, "Basic");
  await owner.get("/api/reports/bookings.csv").expect(403);
});
test("suspension revokes existing sessions; password change and logout revoke tokens", async () => {
  const { a, user } = await register(),
    admin = await login("admin");
  await post(admin, "/admin/users/" + user.id + "/status", {
    status: "suspended",
  }).expect(200);
  await a.get("/api/bookings").expect(401);
  await post(admin, "/admin/users/admin-demo/status", {
    status: "suspended",
  }).expect(400);
  const guest = await login();
  await post(guest, "/profile/password", {
    current: "HostelHub@123",
    password: "NewPassword@123",
  }).expect(200);
  await guest.get("/api/bookings").expect(401);
  await post(guest, "/auth/login", {
    email: "user@hostelhub.test",
    password: "NewPassword@123",
  }).expect(200);
  await post(guest, "/auth/logout", {}).expect(200);
  await guest.get("/api/bookings").expect(401);
});
test("assistant uses actual inventory and clearly identifies local mode", async () => {
  const r = await post(request(app), "/assistant", {
    message: "Girls hostel in Chennai under 8k with food",
  }).expect(200);
  assert.equal(r.body.mode, "local");
  assert.equal(r.body.hostels.length, 1);
  assert.equal(r.body.hostels[0].name, "Olive House");
});
test("SQLite records survive closing and reopening the database", async () => {
  const path = join(temp, "persistence.sqlite");
  const one = await createDatabase({ client: "sqlite", path });
  await seed(one);
  await one.run("UPDATE users SET name=? WHERE id=?", [
    "Persistent name",
    "user-demo",
  ]);
  // Simulate a database created before the additive history migration.
  await one.run("DROP TABLE booking_events");
  await one.close();
  const two = await createDatabase({ client: "sqlite", path });
  assert.equal(
    (await two.get("SELECT name FROM users WHERE id=?", ["user-demo"])).name,
    "Persistent name",
  );
  assert.equal(
    (await two.get("SELECT status FROM bookings WHERE id='booking-demo'"))
      .status,
    "completed",
  );
  assert.equal(
    (await two.get("SELECT COUNT(*) AS n FROM booking_events")).n,
    0,
  );
  await recordBookingEvent(
    two,
    "booking-demo",
    { id: "owner-demo", name: "Recorded owner", role: "owner" },
    "complete",
    "completed",
    "Persistence check",
  );
  await two.close();
  const three = await createDatabase({ client: "sqlite", path });
  const event = await three.get(
    "SELECT * FROM booking_events WHERE booking_id='booking-demo'",
  );
  assert.equal(event.note, "Persistence check");
  assert.equal(event.actor_name, "Recorded owner");
  await three.close();
});
