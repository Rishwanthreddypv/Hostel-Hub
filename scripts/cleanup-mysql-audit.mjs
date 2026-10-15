import { unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createDatabase } from "../server/db.js";

const apply = process.argv.includes("--apply");
const db = await createDatabase();
const ids = (rows) => rows.map((row) => row.id);
const marks = (values) => values.map(() => "?").join(",");
const whereIn = (column, values) =>
  values.length ? `${column} IN (${marks(values)})` : "0=1";

try {
  const users = await db.all(
    "SELECT id,email,created_at FROM users WHERE email LIKE ? ORDER BY created_at",
    ["%@example.test"],
  );
  const userIds = ids(users);
  if (!userIds.length) {
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", users: 0 }));
    process.exit(0);
  }

  const hostels = await db.all(
    `SELECT id,photos FROM hostels WHERE ${whereIn("owner_id", userIds)}`,
    userIds,
  );
  const hostelIds = ids(hostels);
  const rooms = hostelIds.length
    ? await db.all(
        `SELECT id FROM rooms WHERE ${whereIn("hostel_id", hostelIds)}`,
        hostelIds,
      )
    : [];
  const bookingParams = [...userIds, ...hostelIds];
  const bookings = await db.all(
    `SELECT id FROM bookings WHERE ${whereIn("user_id", userIds)} OR ${whereIn("hostel_id", hostelIds)}`,
    bookingParams,
  );
  const bookingIds = ids(bookings);
  const documents = hostelIds.length
    ? await db.all(
        `SELECT id,path FROM documents WHERE ${whereIn("hostel_id", hostelIds)}`,
        hostelIds,
      )
    : [];
  const relatedTables = [
    ["payment_attempts", `SELECT id FROM payment_attempts WHERE ${whereIn("booking_id", bookingIds)} OR ${whereIn("user_id", userIds)}`, [...bookingIds, ...userIds]],
    ["subscription_attempts", `SELECT id FROM subscription_attempts WHERE ${whereIn("owner_id", userIds)}`, userIds],
    ["payments", `SELECT id FROM payments WHERE ${whereIn("booking_id", bookingIds)} OR ${whereIn("user_id", userIds)}`, [...bookingIds, ...userIds]],
    ["reviews", `SELECT id FROM reviews WHERE ${whereIn("booking_id", bookingIds)} OR ${whereIn("hostel_id", hostelIds)} OR ${whereIn("user_id", userIds)} OR body LIKE ?`, [...bookingIds, ...hostelIds, ...userIds, "QA verified review %"]],
    ["complaints", `SELECT id FROM complaints WHERE ${whereIn("booking_id", bookingIds)} OR ${whereIn("user_id", userIds)}`, [...bookingIds, ...userIds]],
  ];
  const related = {};
  for (const [name, sql, params] of relatedTables) related[name] = ids(await db.all(sql, params));
  const targetIds = [
    ...userIds,
    ...hostelIds,
    ...ids(rooms),
    ...bookingIds,
    ...ids(documents),
    ...Object.values(related).flat(),
  ];
  const report = {
    mode: apply ? "apply" : "dry-run",
    cutoff: users[0].created_at,
    users: userIds.length,
    hostels: hostelIds.length,
    rooms: rooms.length,
    bookings: bookingIds.length,
    documents: documents.length,
    ...Object.fromEntries(Object.entries(related).map(([key, value]) => [key, value.length])),
  };
  if (!apply) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  await db.transaction(async (tx) => {
    const del = (table, condition, params) => tx.run(`DELETE FROM ${table} WHERE ${condition}`, params);
    await del("booking_events", `${whereIn("booking_id", bookingIds)} OR ${whereIn("actor_id", userIds)}`, [...bookingIds, ...userIds]);
    await del("payment_attempts", `${whereIn("booking_id", bookingIds)} OR ${whereIn("user_id", userIds)}`, [...bookingIds, ...userIds]);
    await del("subscription_attempts", whereIn("owner_id", userIds), userIds);
    await del("payments", `${whereIn("booking_id", bookingIds)} OR ${whereIn("user_id", userIds)}`, [...bookingIds, ...userIds]);
    await del("reviews", `${whereIn("booking_id", bookingIds)} OR ${whereIn("hostel_id", hostelIds)} OR ${whereIn("user_id", userIds)} OR body LIKE ?`, [...bookingIds, ...hostelIds, ...userIds, "QA verified review %"]);
    await del("complaints", `${whereIn("booking_id", bookingIds)} OR ${whereIn("user_id", userIds)}`, [...bookingIds, ...userIds]);
    await del("wishlist", `${whereIn("user_id", userIds)} OR ${whereIn("hostel_id", hostelIds)}`, [...userIds, ...hostelIds]);
    await del("messages", `${whereIn("sender_id", userIds)} OR ${whereIn("recipient_id", userIds)} OR ${whereIn("hostel_id", hostelIds)}`, [...userIds, ...userIds, ...hostelIds]);
    await del("notifications", whereIn("user_id", userIds), userIds);
    await tx.run(
      "DELETE FROM notifications WHERE created_at>=? AND (body LIKE ? OR body LIKE ? OR body LIKE ? OR body=?)",
      [users[0].created_at, "QA MySQL Residency %", "MySQL Browser Resident %", "%Browser audit cancellation.%", "Aaram OMR House: refunded."],
    );
    await del("documents", whereIn("hostel_id", hostelIds), hostelIds);
    await del("audit_log", `${whereIn("actor_id", userIds)} OR ${whereIn("target_id", targetIds)}`, [...userIds, ...targetIds]);
    await del("bookings", whereIn("id", bookingIds), bookingIds);
    await del("rooms", whereIn("hostel_id", hostelIds), hostelIds);
    await del("hostels", whereIn("id", hostelIds), hostelIds);
    await del("users", whereIn("id", userIds), userIds);
  });

  const uploadRoot = resolve("uploads");
  const paths = [
    ...hostels.flatMap((hostel) => {
      try { return JSON.parse(hostel.photos || "[]"); } catch { return []; }
    }),
    ...documents.map((document) => document.path),
  ];
  for (const storedPath of paths) {
    const local = resolve(storedPath.startsWith("/uploads/")
      ? `uploads/${storedPath.slice("/uploads/".length)}`
      : storedPath);
    if (local === uploadRoot || !local.startsWith(uploadRoot + sep)) continue;
    await unlink(local).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await db.close();
}
