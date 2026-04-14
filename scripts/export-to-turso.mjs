import Database from "better-sqlite3";
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "dev.db");

const local = new Database(dbPath);
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function exportTable(tableName, columns) {
  const rows = local.prepare(`SELECT ${columns.join(",")} FROM ${tableName}`).all();
  console.log(`${tableName}: ${rows.length} rows`);

  for (const row of rows) {
    const placeholders = columns.map(() => "?").join(",");
    const values = columns.map((c) => row[c] ?? null);
    try {
      await turso.execute({
        sql: `INSERT OR IGNORE INTO ${tableName} (${columns.join(",")}) VALUES (${placeholders})`,
        args: values,
      });
    } catch (err) {
      console.error(`  Error inserting into ${tableName}:`, err.message);
    }
  }
}

await exportTable("User", ["id", "username", "passwordHash", "createdAt"]);
await exportTable("Member", ["id", "name", "phone", "active", "isGuest", "createdAt"]);
await exportTable("Event", ["id", "name", "type", "date", "perHeadFee", "totalCost", "notes", "createdAt"]);
await exportTable("EventDue", ["id", "eventId", "memberId", "amount", "paid"]);
await exportTable("Purchase", ["id", "description", "totalAmount", "date", "notes", "createdAt"]);
await exportTable("PurchaseSplit", ["id", "purchaseId", "memberId", "amount", "paid"]);
await exportTable("Payment", ["id", "memberId", "amount", "method", "reference", "notes", "date", "eventId", "createdAt"]);
await exportTable("Settings", ["id", "bankName", "accountName", "iban", "accountNumber", "swiftCode", "defaultMatchFee", "groupName"]);

console.log("\nExport complete!");
local.close();
