





















































import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { parseCSV } from "./csv.js";
import { planFor } from "./plans.js";

const columns = {
  owners: "id,name,email,phone,bio,status,plan,created_at",
  guests: "id,name,email,phone,bio,status,plan,created_at",
  hostels:
    "id,owner_id,name,city,area,address,description,gender,deposit,discount,latitude,longitude,nearby,check_in,check_out,contact,refund_policy,status,verification_note,created_at,min_stay_days,food_charge,service_charge,tax_percent",
  rooms: "id,hostel_id,name,sharing,rent,capacity,ac",
  hostel_photos: "id,hostel_id,path,caption,position",
  hostel_amenities: "id,hostel_id,facility",
  documents: "id,hostel_id,owner_id,name,path,mime,created_at",
  bookings:
    "id,user_id,hostel_id,room_id,start_date,end_date,status,rent,deposit,total,refund_amount,expires_at,created_at,flow_version,quantity,monthly_rent,food_charge,service_charge,discount_amount,tax_amount,min_stay_days,guest_note,approved_at",
  payment_attempts:
    "id,booking_id,user_id,idempotency_key,method,outcome,status,amount,created_at,ready_at,completed_at",
  payments:
    "id,booking_id,user_id,kind,amount,status,provider,reference,created_at,method,refunded_at",
  subscription_payments:
    "id,user_id,plan_code,amount,status,provider,reference,created_at,method",
  booking_events:
    "id,booking_id,actor_id,actor_name,actor_role,event,status,note,created_at",
  reviews: "id,user_id,hostel_id,booking_id,rating,body,status,created_at",
  messages: "id,sender_id,recipient_id,hostel_id,body,created_at",
  notifications: "id,user_id,title,body,is_read,created_at",
  complaints: "id,user_id,booking_id,subject,body,status,resolution,created_at",
  audit_log: "id,actor_id,action,target_id,detail,created_at",
  wishlist: "user_id,hostel_id",
};
const numeric = new Set(
  "deposit discount latitude longitude min_stay_days food_charge service_charge tax_percent sharing rent capacity ac position total refund_amount flow_version quantity monthly_rent discount_amount tax_amount amount rating is_read".split(
    " ",
  ),
);
const enums = {
  "owners.status": ["active", "suspended"],
  "guests.status": ["active", "suspended"],
  "owners.plan": ["Basic", "Advanced"],
  "guests.plan": ["Basic"],
  "hostels.status": ["draft", "pending", "approved", "rejected"],
  "hostels.gender": ["Boys", "Girls", "Co-living"],
  "bookings.status": [
    "pending_owner",
    "awaiting_payment",
    "confirmed",
    "completed",
    "cancelled",
    "rejected",
    "expired",
    "refund_pending",
    "refunded",
  ],
  "payments.status": ["paid", "refunded"],
  "payments.kind": ["booking"],
  "payments.provider": ["demo"],
  "payment_attempts.status": ["processing", "paid", "failed", "expired"],
  "payment_attempts.outcome": ["success", "failure"],
  "reviews.status": ["published", "hidden"],
  "complaints.status": ["open", "resolved"],
  "hostel_amenities.facility": [
    "Wi-Fi",
    "Food",
    "Laundry",
    "Security",
    "Parking",
    "Power backup",
    "Gym",
    "Housekeeping",
    "Kitchen",
  ],
  "payments.method": ["upi", "card", "netbanking", "demo"],
  "subscription_payments.plan_code": ["Advanced"],
  "subscription_payments.status": ["paid"],
  "subscription_payments.provider": ["demo"],
  "subscription_payments.method": ["upi", "card", "netbanking"],
  "payment_attempts.method": ["upi", "card", "netbanking"],
  "booking_events.actor_role": ["user", "owner", "admin"],
};
const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const dateValid = (v) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !isNaN(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
const insert = async (db, table, row) => {
  const keys = Object.keys(row);
  await db.run(
    `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
    Object.values(row),
  );
};

export function loadSeedCSV(directory = resolve("seed-data")) {
  const manifest = JSON.parse(
    readFileSync(join(directory, "manifest.json"), "utf8"),
  );
  if (
    manifest.version !== 2 ||
    !manifest.synthetic ||
    !dateValid(manifest.reference_date)
  )
    throw new Error("Unsupported or invalid seed manifest");
  const data = {},
    errors = [];
  for (const [name, list] of Object.entries(columns)) {
    let rows;
    try {
      rows = parseCSV(
        readFileSync(join(directory, name + ".csv"), "utf8"),
        name + ".csv",
      );
    } catch (e) {
      errors.push(e.message);
      continue;
    }
    const ids = new Set();
    data[name] = rows.map((raw, i) => {
      const row = {};
      const error = (msg) => errors.push(`${name}.csv row ${i + 2}: ${msg}`);
      if (
        Object.keys(raw).sort().join(",") !== list.split(",").sort().join(",")
      )
        error("columns do not match the documented schema");
      for (const key of list.split(",")) {
        let v = raw[key] ?? "";
        if (numeric.has(key)) {
          if (!v.trim() || !Number.isFinite(Number(v)))
            error(`${key} must be a number`);
          v = Number(v);
          if (
            !["latitude", "longitude"].includes(key) &&
            (!Number.isInteger(v) || v < 0)
          )
            error(`${key} must be a non-negative integer`);
        }
        if (enums[name + "." + key] && !enums[name + "." + key].includes(v))
          error(`invalid ${key}: ${v}`);
        if (
          (key === "id" || key.endsWith("_id")) &&
          v &&
          !/^[a-zA-Z0-9-]{1,36}$/.test(v)
        )
          error(`${key} must be a stable ID of up to 36 characters`);
        if (
          [
            "id",
            "name",
            "email",
            "hostel_id",
            "user_id",
            "owner_id",
            "room_id",
            "booking_id",
          ].includes(key) &&
          !v &&
          !(key === "booking_id" && name === "complaints")
        )
          error(`${key} is required`);
        if (
          key.endsWith("_at") &&
          v &&
          (!/^\d{4}-\d\d-\d\dT/.test(v) || isNaN(Date.parse(v)))
        )
          error(`${key} must be an ISO timestamp`);
        if (key.endsWith("_date") && !dateValid(v))
          error(`${key} must be YYYY-MM-DD`);
        if (typeof v === "string" && v.length > 4000)
          error(`${key} is too long`);
        row[key] = v;
      }
      const key = row.id || `${row.user_id}:${row.hostel_id}`;
      if (ids.has(key)) error(`duplicate ID ${key}`);
      ids.add(key);
      if (row.email && !/^[^\s@]+@[^\s@]+\.test$/.test(row.email))
        error("synthetic account emails must use a .test domain");
      if (
        name === "hostels" &&
        (Math.abs(row.latitude) > 90 ||
          Math.abs(row.longitude) > 180 ||
          row.discount > 50 ||
          row.tax_percent > 30 ||
          row.min_stay_days < 30 ||
          row.min_stay_days > 180)
      )
        error("invalid coordinates, discount, tax or minimum stay");
      if (
        name === "rooms" &&
        (row.sharing < 1 ||
          row.sharing > 4 ||
          row.capacity < 1 ||
          row.capacity > 500 ||
          row.rent < 500 ||
          row.rent > 100000 ||
          ![0, 1].includes(row.ac))
      )
        error("invalid room sharing, rent, capacity or AC flag");
      if (name === "reviews" && (row.rating < 1 || row.rating > 5))
        error("rating must be 1–5");
      if (
        name === "hostel_photos" &&
        (!/^\/images\/[a-z0-9-]+\.jpg$/.test(row.path) ||
          !existsSync(resolve("public", "." + row.path)))
      )
        error("photo must reference a bundled local image");
      if (
        name === "documents" &&
        (!/^seed-csv-hostel-\d+\.txt$/.test(row.path) ||
          row.mime !== "text/plain")
      )
        error("only generated sample text declarations are supported");
      return row;
    });
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return { data, manifest };
}

export function validateRelations(
  data,
  admin = { id: "admin-demo", role: "admin" },
) {
  const errors = [];
  const maps = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, new Map(v.map((r) => [r.id, r]))]),
  );
  const users = new Map([
    ...data.owners.map((r) => [r.id, { ...r, role: "owner" }]),
    ...data.guests.map((r) => [r.id, { ...r, role: "user" }]),
    [admin.id, admin],
  ]);
  const check = (name, r, i) => {
    const err = (m) => errors.push(`${name}.csv row ${i + 2}: ${m}`);
    for (const [field, target] of [
      ["owner_id", "users"],
      ["user_id", "users"],
      ["actor_id", "users"],
      ["sender_id", "users"],
      ["recipient_id", "users"],
      ["hostel_id", "hostels"],
      ["room_id", "rooms"],
      ["booking_id", "bookings"],
    ])
      if (
        r[field] &&
        !(target === "users" ? users : maps[target]).has(r[field])
      )
        err(`unknown ${field}: ${r[field]}`);
    if (name === "hostels" && users.get(r.owner_id)?.role !== "owner")
      err("property must belong to an owner");
    if (
      name === "documents" &&
      maps.hostels.get(r.hostel_id)?.owner_id !== r.owner_id
    )
      err("document owner does not own the property");
    if (name === "bookings") {
      const h = maps.hostels.get(r.hostel_id),
        room = maps.rooms.get(r.room_id);
      if (room?.hostel_id !== r.hostel_id)
        err("room does not belong to the property");
      if (users.get(r.user_id)?.role !== "user")
        err("booking must belong to a guest");
      if (
        r.flow_version !== 2 ||
        r.quantity < 1 ||
        r.quantity > 4 ||
        r.end_date <= r.start_date ||
        (Date.parse(r.end_date) - Date.parse(r.start_date)) / 86400000 <
          r.min_stay_days
      )
        err("invalid stay dates, minimum stay, quantity or flow version");
      if (
        r.total !==
          r.rent +
            r.deposit +
            r.food_charge +
            r.service_charge +
            r.tax_amount ||
        r.monthly_rent !== r.rent ||
        r.refund_amount > r.total
      )
        err("booking amounts do not reconcile");
      if (
        [
          "confirmed",
          "completed",
          "pending_owner",
          "awaiting_payment",
        ].includes(r.status) &&
        h?.status !== "approved"
      )
        err("active/history stay requires an approved source property");
    }
    if (
      ["payments", "payment_attempts", "reviews", "booking_events"].includes(
        name,
      )
    ) {
      const b = maps.bookings.get(r.booking_id);
      if (b) {
        if (r.user_id && r.user_id !== b.user_id)
          err("guest does not match booking");
        if (r.amount !== undefined && r.amount !== b.total)
          err("payment amount differs from booking total");
        if (
          name === "reviews" &&
          (!["completed", "confirmed"].includes(b.status) ||
            r.hostel_id !== b.hostel_id)
        )
          err("review requires an eligible matching stay");
      }
    }
    if (name === "messages") {
      const h = maps.hostels.get(r.hostel_id);
      if (h && r.sender_id !== h.owner_id && r.recipient_id !== h.owner_id)
        err("message must include the property owner");
    }
    if (name === "subscription_payments") {
      const owner = users.get(r.user_id);
      if (owner?.role !== "owner" || owner.plan !== "Advanced")
        err("subscription payment requires an Advanced owner");
      if (r.amount !== 999) err("Advanced subscription amount must be 999");
    }
  };
  for (const [name, rows] of Object.entries(data))
    rows.forEach((r, i) => check(name, r, i));
  for (const field of ["email"]) {
    const all = [...data.owners, ...data.guests];
    if (new Set(all.map((r) => r[field].toLowerCase())).size !== all.length)
      errors.push(`Duplicate ${field} across accounts`);
  }
  for (const owner of data.owners) {
    const plan = planFor(owner.plan);
    const hostels = data.hostels.filter((h) => h.owner_id === owner.id);
    if (hostels.length > plan.maxProperties)
      errors.push(
        `owners.csv ${owner.id}: ${owner.plan} allows ${plan.maxProperties} properties, found ${hostels.length}`,
      );
    for (const hostel of hostels) {
      const photos = data.hostel_photos.filter(
        (photo) => photo.hostel_id === hostel.id,
      );
      if (photos.length > plan.maxPhotosPerProperty)
        errors.push(
          `hostel_photos.csv ${hostel.id}: ${owner.plan} allows ${plan.maxPhotosPerProperty} photos, found ${photos.length}`,
        );
      if (!plan.specialOffers && hostel.discount > 0)
        errors.push(
          `hostels.csv ${hostel.id}: discounts require the Advanced plan`,
        );
    }
  }
  for (const name of ["payments", "reviews"])
    if (new Set(data[name].map((r) => r.booking_id)).size !== data[name].length)
      errors.push(`${name}.csv: duplicate booking reference`);
  for (const b of data.bookings) {
    const p = data.payments.find((p) => p.booking_id === b.id);
    if (
      ["confirmed", "completed", "refund_pending", "refunded"].includes(
        b.status,
      ) &&
      !p
    )
      errors.push(`bookings.csv ${b.id}: paid booking has no payment`);
    if (
      p &&
      [
        "pending_owner",
        "awaiting_payment",
        "cancelled",
        "rejected",
        "expired",
      ].includes(b.status)
    )
      errors.push(`bookings.csv ${b.id}: unpaid state has a payment`);
    if (p && (p.status === "refunded") !== (b.status === "refunded"))
      errors.push(`payments.csv ${p.id}: refund state mismatch`);
  }
  for (const room of data.rooms) {
    const events = data.bookings
      .filter(
        (b) =>
          b.room_id === room.id &&
          ["confirmed", "pending_owner", "awaiting_payment"].includes(b.status),
      )
      .flatMap((b) => [
        [b.start_date, b.quantity],
        [b.end_date, -b.quantity],
      ])
      .sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]);
    let n = 0;
    for (const [, delta] of events) {
      n += delta;
      if (n > room.capacity) {
        errors.push(
          `rooms.csv ${room.id}: overlapping bookings exceed bed capacity`,
        );
        break;
      }
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
}

export async function importSeed(
  db,
  {
    directory = resolve("seed-data"),
    dryRun = false,
    uploads = resolve("uploads"),
    anchorDate = new Date().toISOString().slice(0, 10),
  } = {},
) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Synthetic seed imports are disabled in production");
  let data, manifest;
  try {
    ({ data, manifest } = loadSeedCSV(directory));
    validateRelations(data);
    const old = await db.get(
      "SELECT summary FROM seed_imports WHERE status='success' ORDER BY created_at LIMIT 1",
    );
    const anchor = old ? JSON.parse(old.summary).anchorDate : anchorDate;
    const delta = Date.parse(anchor) - Date.parse(manifest.reference_date);
    for (const rows of Object.values(data))
      for (const row of rows)
        for (const key of Object.keys(row))
          if (row[key] && (key.endsWith("_at") || key.endsWith("_date")))
            row[key] = new Date(Date.parse(row[key]) + delta)
              .toISOString()
              .slice(0, key.endsWith("_date") ? 10 : 24);
    const prepared = {
      users: [
        ...data.owners.map((r) => ({ ...r, role: "owner" })),
        ...data.guests.map((r) => ({ ...r, role: "user" })),
      ],
      hostels: data.hostels.map((h) => ({
        ...h,
        facilities: JSON.stringify(
          data.hostel_amenities
            .filter((a) => a.hostel_id === h.id)
            .map((a) => a.facility),
        ),
        photos: JSON.stringify(
          data.hostel_photos
            .filter((p) => p.hostel_id === h.id)
            .sort((a, b) => a.position - b.position)
            .map((p) => p.path),
        ),
      })),
      rooms: data.rooms,
      documents: data.documents,
      bookings: data.bookings,
      payment_attempts: data.payment_attempts,
      payments: [
        ...data.payments,
        ...data.subscription_payments.map((payment) => ({
          ...payment,
          booking_id: null,
          kind: "subscription",
          refunded_at: "",
        })),
      ],
      booking_events: data.booking_events,
      reviews: data.reviews,
      messages: data.messages,
      notifications: data.notifications,
      complaints: data.complaints,
      audit_log: data.audit_log,
      wishlist: data.wishlist,
    };
    const summary = {
      anchorDate: anchor,
      inserted: 0,
      updated: 0,
      skipped: 0,
      rejected: 0,
      preserved: [],
      counts: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v.length]),
      ),
      dryRun,
    };
    // Validation mode performs no writes, including no private files or import history.
    if (dryRun) return summary;
    const password = await bcrypt.hash(
      process.env.DEMO_SEED_PASSWORD || "HostelHub@123",
      12,
    );
    mkdirSync(join(uploads, "private"), { recursive: true });
    for (const d of data.documents)
      if (!existsSync(join(uploads, "private", d.path)))
        writeFileSync(
          join(uploads, "private", d.path),
          `FICTIONAL SAMPLE — NOT AN IDENTITY OR OWNERSHIP DOCUMENT\n\nProperty: ${data.hostels.find((h) => h.id === d.hostel_id).name}\nOwner: ${data.owners.find((o) => o.id === d.owner_id).name}\n\nThis declaration exists only to exercise the local verification workflow. No real registration number or identity data is included.\n`,
        );
    await db.transaction(async (tx) => {
      for (const [table, rows] of Object.entries(prepared))
        for (const row of rows) {
          const key = row.id || `${row.user_id}:${row.hostel_id}`,
            clause =
              table === "wishlist" ? "user_id=? AND hostel_id=?" : "id=?",
            args =
              table === "wishlist" ? [row.user_id, row.hostel_id] : [row.id];
          const existing = await tx.get(
              `SELECT * FROM ${table} WHERE ${clause}`,
              args,
            ),
            managed = await tx.get(
              "SELECT * FROM seed_records WHERE entity=? AND record_id=?",
              [table, key],
            );
          const digest = hash(row),
            currentHash = existing
              ? hash(
                  Object.fromEntries(
                    Object.keys(row).map((k) => [k, existing[k]]),
                  ),
                )
              : "";
          if (existing) {
            // A schema migration may already have moved a managed record to the
            // new source value (for example Pro -> Advanced). Reconcile its
            // hashes instead of misclassifying the migration as a live edit.
            if (managed && currentHash === digest) {
              await tx.run(
                "UPDATE seed_records SET source_hash=?,applied_hash=? WHERE entity=? AND record_id=?",
                [digest, digest, table, key],
              );
              summary.skipped++;
              continue;
            }
            if (!managed || managed.applied_hash !== currentHash) {
              summary.skipped++;
              summary.preserved.push(`${table}:${key}`);
              continue;
            }
            if (managed.source_hash === digest) {
              summary.skipped++;
              continue;
            }
            // Runtime history is immutable through seed imports; use a fresh database for revised scenarios.
            if (!["users", "hostels", "rooms", "documents"].includes(table)) {
              summary.skipped++;
              summary.preserved.push(`${table}:${key}`);
              continue;
            }
            if (table === "rooms") {
              const active = await tx.get(
                "SELECT id FROM bookings WHERE room_id=? AND status IN ('confirmed','pending_owner','awaiting_payment')",
                [row.id],
              );
              if (active) {
                summary.skipped++;
                summary.preserved.push(`${table}:${key}`);
                continue;
              }
            }
            const keys = Object.keys(row).filter((k) => k !== "id");
            await tx.run(
              `UPDATE ${table} SET ${keys.map((k) => k + "=?").join(",")} WHERE id=?`,
              [...keys.map((k) => row[k]), row.id],
            );
            summary.updated++;
          } else {
            await insert(
              tx,
              table,
              table === "users" ? { ...row, password } : row,
            );
            summary.inserted++;
          }
          if (managed)
            await tx.run(
              "UPDATE seed_records SET source_hash=?,applied_hash=? WHERE entity=? AND record_id=?",
              [digest, digest, table, key],
            );
          else
            await insert(tx, "seed_records", {
              entity: table,
              record_id: key,
              source_hash: digest,
              applied_hash: digest,
            });
        }
      await insert(tx, "seed_imports", {
        id: randomUUID(),
        source: "seed-data CSV v2",
        status: "success",
        summary: JSON.stringify(summary),
        created_at: new Date().toISOString(),
      });
    });
    return summary;
  } catch (e) {
    if (!dryRun)
      await insert(db, "seed_imports", {
        id: randomUUID(),
        source: "seed-data CSV v2",
        status: "failed",
        summary: JSON.stringify({
          error: e.message,
          inserted: 0,
          updated: 0,
          rejected: 1,
        }),
        created_at: new Date().toISOString(),
      });
    throw e;
  }
}
