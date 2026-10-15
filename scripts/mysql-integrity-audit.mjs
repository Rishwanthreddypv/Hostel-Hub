import "dotenv/config";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createDatabase } from "../server/db.js";

assert.equal(process.env.DB_CLIENT, "mysql", "This audit must run against MySQL");
const db = await createDatabase();
const checks = [];

async function zero(name, sql) {
  const row = await db.get(sql);
  const count = Number(row.count);
  checks.push({ name, status: count === 0 ? "PASS" : "FAIL", count });
}

try {
  const tables = [
    "users", "hostels", "rooms", "documents", "bookings", "payments",
    "payment_attempts", "subscription_attempts", "booking_events", "reviews", "wishlist",
    "notifications", "messages", "complaints", "audit_log", "seed_imports",
  ];
  const counts = {};
  for (const table of tables) {
    const row = await db.get(`SELECT COUNT(*) count FROM ${table}`);
    counts[table] = Number(row.count);
  }

  await zero("unique user emails", "SELECT COUNT(*) count FROM (SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1) d");
  await zero("passwords are hashed", "SELECT COUNT(*) count FROM users WHERE password NOT LIKE '$2%'");
  await zero("valid user roles", "SELECT COUNT(*) count FROM users WHERE role NOT IN ('user','owner','admin')");
  await zero("valid user statuses", "SELECT COUNT(*) count FROM users WHERE status NOT IN ('active','suspended')");
  await zero("valid owner plans", "SELECT COUNT(*) count FROM users WHERE role='owner' AND plan NOT IN ('Basic','Advanced')");
  await zero("hostel owners exist", "SELECT COUNT(*) count FROM hostels h LEFT JOIN users u ON u.id=h.owner_id AND u.role='owner' WHERE u.id IS NULL");
  await zero("room hostels exist", "SELECT COUNT(*) count FROM rooms r LEFT JOIN hostels h ON h.id=r.hostel_id WHERE h.id IS NULL");
  await zero("document hostels and owners exist", "SELECT COUNT(*) count FROM documents d LEFT JOIN hostels h ON h.id=d.hostel_id LEFT JOIN users u ON u.id=d.owner_id WHERE h.id IS NULL OR u.id IS NULL");
  await zero("booking relations exist", "SELECT COUNT(*) count FROM bookings b LEFT JOIN users u ON u.id=b.user_id LEFT JOIN hostels h ON h.id=b.hostel_id LEFT JOIN rooms r ON r.id=b.room_id WHERE u.id IS NULL OR h.id IS NULL OR r.id IS NULL OR r.hostel_id<>b.hostel_id");
  await zero("booking dates and amounts are valid", "SELECT COUNT(*) count FROM bookings WHERE start_date>=end_date OR rent<0 OR deposit<0 OR total<0 OR refund_amount<0 OR refund_amount>total OR quantity<1");
  await zero("valid booking statuses", "SELECT COUNT(*) count FROM bookings WHERE status NOT IN ('pending_owner','awaiting_payment','confirmed','rejected','cancelled','refund_pending','refunded','expired','completed')");
  await zero("payment relations exist", "SELECT COUNT(*) count FROM payments p LEFT JOIN users u ON u.id=p.user_id LEFT JOIN bookings b ON b.id=p.booking_id WHERE u.id IS NULL OR (p.booking_id IS NOT NULL AND b.id IS NULL)");
  await zero("one final payment per booking", "SELECT COUNT(*) count FROM (SELECT booking_id FROM payments WHERE booking_id IS NOT NULL GROUP BY booking_id HAVING COUNT(*)>1) d");
  await zero("booking payment totals match", "SELECT COUNT(*) count FROM payments p JOIN bookings b ON b.id=p.booking_id WHERE p.kind='booking' AND p.amount<>b.total");
  await zero("payment attempt relations exist", "SELECT COUNT(*) count FROM payment_attempts p LEFT JOIN users u ON u.id=p.user_id LEFT JOIN bookings b ON b.id=p.booking_id WHERE u.id IS NULL OR b.id IS NULL");
  await zero("payment attempt totals match", "SELECT COUNT(*) count FROM payment_attempts p JOIN bookings b ON b.id=p.booking_id WHERE p.amount<>b.total");
  await zero("subscription attempt owners and values are valid", "SELECT COUNT(*) count FROM subscription_attempts s LEFT JOIN users u ON u.id=s.owner_id WHERE u.id IS NULL OR u.role<>'owner' OR s.plan_code<>'Advanced' OR s.amount<>999");
  await zero("subscription payment values are valid", "SELECT COUNT(*) count FROM payments WHERE kind='subscription' AND (booking_id IS NOT NULL OR plan_code<>'Advanced' OR amount<>999)");
  await zero("review relations exist", "SELECT COUNT(*) count FROM reviews r LEFT JOIN users u ON u.id=r.user_id LEFT JOIN hostels h ON h.id=r.hostel_id LEFT JOIN bookings b ON b.id=r.booking_id WHERE u.id IS NULL OR h.id IS NULL OR b.id IS NULL OR b.user_id<>r.user_id OR b.hostel_id<>r.hostel_id");
  await zero("wishlist relations exist", "SELECT COUNT(*) count FROM wishlist w LEFT JOIN users u ON u.id=w.user_id LEFT JOIN hostels h ON h.id=w.hostel_id WHERE u.id IS NULL OR h.id IS NULL");
  await zero("notification users exist", "SELECT COUNT(*) count FROM notifications n LEFT JOIN users u ON u.id=n.user_id WHERE u.id IS NULL");
  await zero("message relations exist", "SELECT COUNT(*) count FROM messages m LEFT JOIN users s ON s.id=m.sender_id LEFT JOIN users r ON r.id=m.recipient_id LEFT JOIN hostels h ON h.id=m.hostel_id WHERE s.id IS NULL OR r.id IS NULL OR h.id IS NULL");
  await zero("complaint relations exist", "SELECT COUNT(*) count FROM complaints c LEFT JOIN users u ON u.id=c.user_id LEFT JOIN bookings b ON b.id=c.booking_id WHERE u.id IS NULL OR (c.booking_id IS NOT NULL AND b.id IS NULL)");
  await zero("booking event relations exist", "SELECT COUNT(*) count FROM booking_events e LEFT JOIN bookings b ON b.id=e.booking_id LEFT JOIN users u ON u.id=e.actor_id WHERE b.id IS NULL OR u.id IS NULL");

  const engineRows = await db.all("SELECT table_name, engine FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE'");
  const nonInnoDb = engineRows.filter((row) => (row.engine || row.ENGINE) !== "InnoDB");
  checks.push({ name: "all MySQL tables use InnoDB", status: nonInnoDb.length ? "FAIL" : "PASS", count: nonInnoDb.length });
  const constraints = await db.get("SELECT COUNT(*) count FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE()");
  checks.push({ name: "foreign keys installed", status: Number(constraints.count) >= 20 ? "PASS" : "FAIL", count: Number(constraints.count) });

  const failed = checks.filter((item) => item.status === "FAIL");
  const report = { database: "hostel_hub", counts, passed: checks.length - failed.length, failed: failed.length, checks };
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/mysql-integrity-audit.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failed.length) process.exitCode = 1;
} finally {
  await db.close();
}
