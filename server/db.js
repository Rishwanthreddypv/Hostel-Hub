import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import mysql from "mysql2/promise";
import { migrate } from "./migrations.js";

export async function createDatabase(options = {}) {
  const isMysql = (options.client || process.env.DB_CLIENT) === "mysql";
  let native;
  if (isMysql) native = mysql.createPool(process.env.DATABASE_URL);
  else {
    const path =
      options.path || process.env.DATABASE_PATH || "./data/hostel-hub.sqlite";
    if (path !== ":memory:")
      mkdirSync(dirname(resolve(path)), { recursive: true });
    native = new DatabaseSync(path);
    native.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    );
  }
  function wrapper(conn) {
    return {
      async all(sql, params = []) {
        return isMysql
          ? (await conn.execute(sql, params))[0]
          : conn.prepare(sql).all(...params);
      },
      async get(sql, params = []) {
        return (await this.all(sql, params))[0];
      },
      async run(sql, params = []) {
        const r = isMysql
          ? (await conn.execute(sql, params))[0]
          : conn.prepare(sql).run(...params);
        return { changes: Number(r.affectedRows ?? r.changes) };
      },
      lock: isMysql ? " FOR UPDATE" : "",
    };
  }
  const db = wrapper(native);
  let queue = Promise.resolve();
  db.transaction = async function (fn) {
    if (isMysql) {
      const c = await native.getConnection();
      try {
        await c.beginTransaction();
        const result = await fn(wrapper(c));
        await c.commit();
        return result;
      } catch (e) {
        await c.rollback();
        throw e;
      } finally {
        c.release();
      }
    }
    let release;
    const prev = queue;
    queue = new Promise((r) => (release = r));
    await prev;
    try {
      native.exec("BEGIN IMMEDIATE");
      const result = await fn(wrapper(native));
      native.exec("COMMIT");
      return result;
    } catch (e) {
      native.exec("ROLLBACK");
      throw e;
    } finally {
      release();
    }
  };
  db.close = () => (isMysql ? native.end() : native.close());
  // Initial idempotent schema. Add reviewed migrations before evolving existing databases.
  const tables = [
    `users (id VARCHAR(36) PRIMARY KEY,name VARCHAR(120) NOT NULL,email VARCHAR(190) NOT NULL UNIQUE,password VARCHAR(255) NOT NULL,role VARCHAR(20) NOT NULL,phone VARCHAR(30) NOT NULL DEFAULT '',bio TEXT NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'active',plan VARCHAR(20) NOT NULL DEFAULT 'Basic',token_version INTEGER NOT NULL DEFAULT 0,created_at VARCHAR(30) NOT NULL)`,
    `hostels (id VARCHAR(36) PRIMARY KEY,owner_id VARCHAR(36) NOT NULL,name VARCHAR(160) NOT NULL,city VARCHAR(80) NOT NULL,area VARCHAR(100) NOT NULL,address TEXT NOT NULL,description TEXT NOT NULL,gender VARCHAR(20) NOT NULL,facilities TEXT NOT NULL,photos TEXT NOT NULL,deposit INTEGER NOT NULL,discount INTEGER NOT NULL DEFAULT 0,latitude DOUBLE NOT NULL,longitude DOUBLE NOT NULL,nearby TEXT NOT NULL,check_in VARCHAR(20) NOT NULL,check_out VARCHAR(20) NOT NULL,contact VARCHAR(30) NOT NULL,refund_policy TEXT NOT NULL,status VARCHAR(20) NOT NULL,verification_note TEXT NOT NULL,created_at VARCHAR(30) NOT NULL,FOREIGN KEY(owner_id) REFERENCES users(id))`,
    `rooms (id VARCHAR(36) PRIMARY KEY,hostel_id VARCHAR(36) NOT NULL,name VARCHAR(80) NOT NULL,sharing INTEGER NOT NULL,rent INTEGER NOT NULL,capacity INTEGER NOT NULL,ac INTEGER NOT NULL DEFAULT 0,FOREIGN KEY(hostel_id) REFERENCES hostels(id))`,
    `documents (id VARCHAR(36) PRIMARY KEY,hostel_id VARCHAR(36) NOT NULL,owner_id VARCHAR(36) NOT NULL,name VARCHAR(255) NOT NULL,path VARCHAR(255) NOT NULL,mime VARCHAR(80) NOT NULL,created_at VARCHAR(30) NOT NULL,FOREIGN KEY(hostel_id) REFERENCES hostels(id))`,
    `bookings (id VARCHAR(36) PRIMARY KEY,user_id VARCHAR(36) NOT NULL,hostel_id VARCHAR(36) NOT NULL,room_id VARCHAR(36) NOT NULL,start_date VARCHAR(10) NOT NULL,end_date VARCHAR(10) NOT NULL,status VARCHAR(30) NOT NULL,rent INTEGER NOT NULL,deposit INTEGER NOT NULL,total INTEGER NOT NULL,refund_amount INTEGER NOT NULL DEFAULT 0,expires_at VARCHAR(30) NOT NULL,created_at VARCHAR(30) NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(hostel_id) REFERENCES hostels(id),FOREIGN KEY(room_id) REFERENCES rooms(id))`,
    `payments (id VARCHAR(36) PRIMARY KEY,booking_id VARCHAR(36) UNIQUE,user_id VARCHAR(36) NOT NULL,kind VARCHAR(20) NOT NULL,amount INTEGER NOT NULL,status VARCHAR(20) NOT NULL,provider VARCHAR(20) NOT NULL,reference VARCHAR(100) NOT NULL UNIQUE,created_at VARCHAR(30) NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(booking_id) REFERENCES bookings(id))`,
    `reviews (id VARCHAR(36) PRIMARY KEY,user_id VARCHAR(36) NOT NULL,hostel_id VARCHAR(36) NOT NULL,booking_id VARCHAR(36) NOT NULL UNIQUE,rating INTEGER NOT NULL,body TEXT NOT NULL,status VARCHAR(20) NOT NULL,created_at VARCHAR(30) NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(hostel_id) REFERENCES hostels(id),FOREIGN KEY(booking_id) REFERENCES bookings(id))`,
    `wishlist (user_id VARCHAR(36) NOT NULL,hostel_id VARCHAR(36) NOT NULL,PRIMARY KEY(user_id,hostel_id),FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(hostel_id) REFERENCES hostels(id))`,
    `notifications (id VARCHAR(36) PRIMARY KEY,user_id VARCHAR(36) NOT NULL,title VARCHAR(160) NOT NULL,body TEXT NOT NULL,is_read INTEGER NOT NULL DEFAULT 0,created_at VARCHAR(30) NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id))`,
    `messages (id VARCHAR(36) PRIMARY KEY,sender_id VARCHAR(36) NOT NULL,recipient_id VARCHAR(36) NOT NULL,hostel_id VARCHAR(36) NOT NULL,body TEXT NOT NULL,created_at VARCHAR(30) NOT NULL,FOREIGN KEY(sender_id) REFERENCES users(id),FOREIGN KEY(recipient_id) REFERENCES users(id),FOREIGN KEY(hostel_id) REFERENCES hostels(id))`,
    `complaints (id VARCHAR(36) PRIMARY KEY,user_id VARCHAR(36) NOT NULL,booking_id VARCHAR(36),subject VARCHAR(160) NOT NULL,body TEXT NOT NULL,status VARCHAR(20) NOT NULL,resolution TEXT NOT NULL,created_at VARCHAR(30) NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(booking_id) REFERENCES bookings(id))`,
    `audit_log (id VARCHAR(36) PRIMARY KEY,actor_id VARCHAR(36) NOT NULL,action VARCHAR(80) NOT NULL,target_id VARCHAR(36) NOT NULL,detail TEXT NOT NULL,created_at VARCHAR(30) NOT NULL)`,
  ];
  for (const table of tables)
    await db.run(`CREATE TABLE IF NOT EXISTS ${table}`);
  // Additive migration: existing booking rows remain untouched. Historical events
  // are not invented; the UI identifies records created before history tracking.
  await db.run(`CREATE TABLE IF NOT EXISTS booking_events (
    id VARCHAR(36) PRIMARY KEY, booking_id VARCHAR(36) NOT NULL,
    actor_id VARCHAR(36) NOT NULL, actor_name VARCHAR(120) NOT NULL,
    actor_role VARCHAR(20) NOT NULL, event VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL, note TEXT NOT NULL, created_at VARCHAR(30) NOT NULL,
    FOREIGN KEY(booking_id) REFERENCES bookings(id), FOREIGN KEY(actor_id) REFERENCES users(id)
  )`);
  await migrate(db, isMysql);
  return db;
}
