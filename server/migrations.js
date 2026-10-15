// Additive, restart-safe migrations. Legacy bookings keep their original prices and flow.
export async function migrate(db, mysql) {
  const additions = {
    hostels: {
      min_stay_days: "INTEGER NOT NULL DEFAULT 30",
      food_charge: "INTEGER NOT NULL DEFAULT 0",
      service_charge: "INTEGER NOT NULL DEFAULT 0",
      tax_percent: "INTEGER NOT NULL DEFAULT 0",
    },
    bookings: {
      flow_version: "INTEGER NOT NULL DEFAULT 1",
      quantity: "INTEGER NOT NULL DEFAULT 1",
      monthly_rent: "INTEGER NOT NULL DEFAULT 0",
      food_charge: "INTEGER NOT NULL DEFAULT 0",
      service_charge: "INTEGER NOT NULL DEFAULT 0",
      discount_amount: "INTEGER NOT NULL DEFAULT 0",
      tax_amount: "INTEGER NOT NULL DEFAULT 0",
      min_stay_days: "INTEGER NOT NULL DEFAULT 7",
      guest_note: "VARCHAR(1000) NOT NULL DEFAULT ''",
      approved_at: "VARCHAR(30) NOT NULL DEFAULT ''",
    },
    payments: {
      method: "VARCHAR(20) NOT NULL DEFAULT 'demo'",
      refunded_at: "VARCHAR(30) NOT NULL DEFAULT ''",
      plan_code: "VARCHAR(20) NOT NULL DEFAULT ''",
    },
  };
  for (const [table, columns] of Object.entries(additions)) {
    const existing = await db.all(
      mysql ? `SHOW COLUMNS FROM ${table}` : `PRAGMA table_info(${table})`,
    );
    const names = new Set(existing.map((c) => c.name || c.Field));
    for (const [name, definition] of Object.entries(columns))
      if (!names.has(name))
        await db.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
  await db.run(
    `CREATE TABLE IF NOT EXISTS payment_attempts (id VARCHAR(36) PRIMARY KEY, booking_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL, idempotency_key VARCHAR(100) NOT NULL UNIQUE, method VARCHAR(20) NOT NULL, outcome VARCHAR(20) NOT NULL, status VARCHAR(20) NOT NULL, amount INTEGER NOT NULL, created_at VARCHAR(30) NOT NULL, ready_at VARCHAR(30) NOT NULL, completed_at VARCHAR(30) NOT NULL DEFAULT '', FOREIGN KEY(booking_id) REFERENCES bookings(id), FOREIGN KEY(user_id) REFERENCES users(id))`,
  );
  await db.run(
    `CREATE TABLE IF NOT EXISTS seed_records (entity VARCHAR(40) NOT NULL, record_id VARCHAR(100) NOT NULL, source_hash VARCHAR(64) NOT NULL, applied_hash VARCHAR(64) NOT NULL, PRIMARY KEY(entity,record_id))`,
  );
  await db.run(
    `CREATE TABLE IF NOT EXISTS seed_imports (id VARCHAR(36) PRIMARY KEY, source VARCHAR(255) NOT NULL, status VARCHAR(20) NOT NULL, summary TEXT NOT NULL, created_at VARCHAR(30) NOT NULL)`,
  );
  await db.run(
    `CREATE TABLE IF NOT EXISTS subscription_attempts (id VARCHAR(36) PRIMARY KEY, owner_id VARCHAR(36) NOT NULL, plan_code VARCHAR(20) NOT NULL, idempotency_key VARCHAR(100) NOT NULL UNIQUE, method VARCHAR(20) NOT NULL, outcome VARCHAR(20) NOT NULL, status VARCHAR(20) NOT NULL, amount INTEGER NOT NULL, reference VARCHAR(100) NOT NULL DEFAULT '', created_at VARCHAR(30) NOT NULL, ready_at VARCHAR(30) NOT NULL, completed_at VARCHAR(30) NOT NULL DEFAULT '', FOREIGN KEY(owner_id) REFERENCES users(id))`,
  );
  // Pro was an early demo tier. Advanced is now the single paid tier and keeps
  // every former Pro owner's access without deleting listings or history.
  await db.run("UPDATE users SET plan='Advanced' WHERE plan='Pro'");
}
