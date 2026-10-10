import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  cpSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createDatabase } from "../server/db.js";
import { seed } from "../server/seed-legacy.js";
import {
  importSeed,
  loadSeedCSV,
  validateRelations,
} from "../server/seed-import.js";
import { parseCSV, stringifyCSV } from "../server/csv.js";
test("CSV round trips commas, Unicode, quotes and multiline text; malformed rows fail", () => {
  const rows = [
    {
      id: "one",
      name: "Priya, Raman",
      note: 'First line\n"Second" line — test',
    },
    { id: "two", name: "Meera", note: "" },
  ];
  assert.deepEqual(parseCSV(stringifyCSV(rows)), rows);
  assert.throws(() => parseCSV('id,name\n1,"unclosed'));
  assert.throws(() => parseCSV("id,name\n1,one,extra"));
  assert.throws(() => parseCSV("id,id\n1,2"));
});
test("realistic CSV dataset reconciles and contains independent owner portfolios", () => {
  const { data } = loadSeedCSV();
  validateRelations(data);
  assert.equal(data.owners.length, 10);
  assert.equal(data.hostels.length, 24);
  assert.equal(data.rooms.length, 96);
  assert.equal(data.bookings.length, 240);
  assert.equal(data.reviews.length, 100);
  for (const owner of data.owners) {
    const count = data.hostels.filter((h) => h.owner_id === owner.id).length;
    assert(count >= 1 && count <= 4);
  }
  const broken = structuredClone(data);
  broken.payments[0].amount++;
  assert.throws(() => validateRelations(broken), /amount differs/);
  const capacity = structuredClone(data);
  capacity.rooms.forEach((r) => (r.capacity = 1));
  assert.throws(() => validateRelations(capacity), /capacity/);
});
test("CSV import is repeatable, preserves live edits, reports row errors and rolls back conflicts", async () => {
  const temp = mkdtempSync(join(tmpdir(), "hostel-csv-test-"));
  let db;
  try {
    const directory = join(temp, "source");
    cpSync(resolve("seed-data"), directory, { recursive: true });
    db = await createDatabase({
      client: "sqlite",
      path: join(temp, "test.sqlite"),
    });
    await seed(db);
    const initial = await importSeed(db, { directory, uploads: temp });
    assert(initial.inserted > 2900);
    assert.equal(initial.rejected, 0);
    const count = (await db.get("SELECT COUNT(*) AS n FROM bookings")).n;
    assert.equal(count, 241);
    const again = await importSeed(db, { directory, uploads: temp });
    assert.equal(again.inserted, 0);
    assert.equal(again.updated, 0);
    await db.run(
      "UPDATE hostels SET description='Edited through the owner interface' WHERE id='csv-hostel-01'",
    );
    const file = join(directory, "hostels.csv"),
      rows = parseCSV(readFileSync(file, "utf8"));
    rows[0].description = "Changed in CSV";
    rows[1].description = "Updated listing description from CSV";
    writeFileSync(file, stringifyCSV(rows));
    const edited = await importSeed(db, { directory, uploads: temp });
    assert.equal(edited.updated, 1);
    assert(edited.preserved.includes("hostels:csv-hostel-01"));
    assert.equal(
      (await db.get("SELECT description FROM hostels WHERE id='csv-hostel-01'"))
        .description,
      "Edited through the owner interface",
    );
    rows[0].owner_id = "missing-owner";
    writeFileSync(file, stringifyCSV(rows));
    await assert.rejects(
      importSeed(db, { directory, uploads: temp }),
      /hostels.csv row 2/,
    );
    assert.equal((await db.get("SELECT COUNT(*) AS n FROM bookings")).n, count);
    // Cause a database uniqueness conflict after a source owner update; all data writes must roll back.
    cpSync(resolve("seed-data"), directory, { recursive: true });
    const ownersFile = join(directory, "owners.csv"),
      owners = parseCSV(readFileSync(ownersFile, "utf8"));
    owners[0].bio = "This edit must be rolled back";
    owners[1].email = "owner@hostelhub.test";
    writeFileSync(ownersFile, stringifyCSV(owners));
    const before = (
      await db.get("SELECT bio FROM users WHERE id='csv-owner-01'")
    ).bio;
    await assert.rejects(
      importSeed(db, { directory, uploads: temp }),
      /UNIQUE/,
    );
    assert.equal(
      (await db.get("SELECT bio FROM users WHERE id='csv-owner-01'")).bio,
      before,
    );
    await db.close();
    db = await createDatabase({
      client: "sqlite",
      path: join(temp, "test.sqlite"),
    });
    assert.equal((await db.get("SELECT COUNT(*) AS n FROM bookings")).n, count);
  } finally {
    if (db) await db.close();
    assert(
      resolve(temp).startsWith(resolve(tmpdir())) &&
        temp.includes("hostel-csv-test-"),
    );
    rmSync(temp, { recursive: true, force: true });
  }
});
