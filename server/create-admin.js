import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createDatabase } from "./db.js";
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (
  !email ||
  !email.includes("@") ||
  !password ||
  password.length < 12 ||
  password.length > 72
)
  throw new Error(
    "Set ADMIN_EMAIL and ADMIN_PASSWORD (12–72 characters) in your private environment.",
  );
const db = await createDatabase();
try {
  if (await db.get("SELECT id FROM users WHERE email=?", [email]))
    throw new Error(
      "An account with this email already exists. No changes made.",
    );
  await db.run(
    "INSERT INTO users (id,name,email,password,role,bio,created_at) VALUES (?,?,?,?,?,?,?)",
    [
      randomUUID(),
      process.env.ADMIN_NAME || "Administrator",
      email,
      await bcrypt.hash(password, 12),
      "admin",
      "",
      new Date().toISOString(),
    ],
  );
  console.log(
    "Administrator created. Remove ADMIN_PASSWORD from your environment after use.",
  );
} finally {
  await db.close();
}
