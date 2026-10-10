import bcrypt from "bcryptjs";
import { pathToFileURL } from "node:url";
import { createDatabase } from "./db.js";
import { importSeed } from "./seed-import.js";
export const now = () => new Date().toISOString();
export async function seed(db, options = {}) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seed is disabled in production");
  const password = await bcrypt.hash(
    process.env.DEMO_SEED_PASSWORD || "HostelHub@123",
    12,
  );
  for (const [id, name, email, role] of [
    ["user-demo", "Aarav Sharma", "user@hostelhub.test", "user"],
    ["owner-demo", "Priya Raman", "owner@hostelhub.test", "owner"],
    ["admin-demo", "Hostel Hub Admin", "admin@hostelhub.test", "admin"],
  ]) {
    if (
      !(await db.get("SELECT id FROM users WHERE id=? OR email=?", [id, email]))
    )
      await db.run(
        "INSERT INTO users (id,name,email,password,role,bio,created_at) VALUES (?,?,?,?,?,?,?)",
        [id, name, email, password, role, "Local demo account", now()],
      );
  }
  if (
    options.force ||
    !(await db.get(
      "SELECT id FROM seed_imports WHERE status='success' LIMIT 1",
    ))
  )
    return importSeed(db, options);
  return {
    skipped: true,
    reason:
      "CSV dataset already imported. Run npm run db:seed to apply source edits.",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const db = await createDatabase();
  try {
    console.log(JSON.stringify(await seed(db, { force: true }), null, 2));
  } finally {
    await db.close();
  }
}
