import { createDatabase } from "../server/db.js";
import { loadSeedCSV, validateRelations } from "../server/seed-import.js";
import { seed } from "../server/seed.js";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
const args = process.argv.slice(2);
if (args.includes("--validate")) {
  const { data } = loadSeedCSV();
  validateRelations(data);
  console.log(
    JSON.stringify(
      {
        valid: true,
        counts: Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, v.length]),
        ),
      },
      null,
      2,
    ),
  );
} else {
  let path;
  if (args.includes("--fresh")) {
    const filename = args[args.indexOf("--fresh") + 1];
    if (!filename || !/^[a-zA-Z0-9-]+\.sqlite$/.test(filename))
      throw new Error(
        "Use --fresh filename.sqlite. A new file is created in data/; existing files are never overwritten.",
      );
    path = resolve("data", filename);
    if (existsSync(path))
      throw new Error("That database already exists. Choose a new filename.");
  }
  const db = await createDatabase(path ? { client: "sqlite", path } : {});
  try {
    console.log(JSON.stringify(await seed(db, { force: true }), null, 2));
    if (path)
      console.log(
        `Fresh dataset created. Set DATABASE_PATH=${path} and restart to use it. Your previous database is preserved.`,
      );
  } finally {
    await db.close();
  }
}
