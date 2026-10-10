import "dotenv/config";
import { createDatabase } from "./db.js";
import { seed } from "./seed.js";
import { createApp } from "./app.js";
const db = await createDatabase();
if (process.env.NODE_ENV !== "production" && process.env.DEMO_MODE !== "false")
  await seed(db);
const app = createApp(db);
const server = app.listen(
  Number(process.env.PORT) || 4000,
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(`Hostel Hub API: http://localhost:${process.env.PORT || 4000}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await db.close();
      process.exit(0);
    }),
  );
