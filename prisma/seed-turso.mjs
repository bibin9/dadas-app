import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables");
  process.exit(1);
}

const db = createClient({ url, authToken });

// Create tables (matching Prisma schema)
const tables = [
  `CREATE TABLE IF NOT EXISTS User (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS Member (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    isGuest INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS Event (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'event',
    date TEXT NOT NULL,
    perHeadFee REAL NOT NULL,
    totalCost REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS EventDue (
    id TEXT PRIMARY KEY,
    eventId TEXT NOT NULL,
    memberId TEXT NOT NULL,
    amount REAL NOT NULL,
    paid INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (eventId) REFERENCES Event(id) ON DELETE CASCADE,
    FOREIGN KEY (memberId) REFERENCES Member(id) ON DELETE CASCADE,
    UNIQUE(eventId, memberId)
  )`,
  `CREATE TABLE IF NOT EXISTS Purchase (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    totalAmount REAL NOT NULL,
    date TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS PurchaseSplit (
    id TEXT PRIMARY KEY,
    purchaseId TEXT NOT NULL,
    memberId TEXT NOT NULL,
    amount REAL NOT NULL,
    paid INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (purchaseId) REFERENCES Purchase(id) ON DELETE CASCADE,
    FOREIGN KEY (memberId) REFERENCES Member(id) ON DELETE CASCADE,
    UNIQUE(purchaseId, memberId)
  )`,
  `CREATE TABLE IF NOT EXISTS Payment (
    id TEXT PRIMARY KEY,
    memberId TEXT NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL DEFAULT 'cash',
    reference TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    eventId TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (memberId) REFERENCES Member(id) ON DELETE CASCADE,
    FOREIGN KEY (eventId) REFERENCES Event(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS MemberGroup (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS MemberGroupMember (
    id TEXT PRIMARY KEY,
    groupId TEXT NOT NULL,
    memberId TEXT NOT NULL,
    FOREIGN KEY (groupId) REFERENCES MemberGroup(id) ON DELETE CASCADE,
    FOREIGN KEY (memberId) REFERENCES Member(id) ON DELETE CASCADE,
    UNIQUE(groupId, memberId)
  )`,
  `CREATE TABLE IF NOT EXISTS EventTemplate (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'event',
    amount REAL NOT NULL DEFAULT 0,
    amountType TEXT NOT NULL DEFAULT 'total',
    groupId TEXT,
    notes TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS EventExpense (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL DEFAULT 'venue',
    date TEXT NOT NULL,
    reference TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    eventId TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (eventId) REFERENCES Event(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS Settings (
    id TEXT PRIMARY KEY,
    bankName TEXT NOT NULL DEFAULT '',
    accountName TEXT NOT NULL DEFAULT '',
    iban TEXT NOT NULL DEFAULT '',
    accountNumber TEXT NOT NULL DEFAULT '',
    swiftCode TEXT NOT NULL DEFAULT '',
    defaultMatchFee REAL NOT NULL DEFAULT 20,
    groupName TEXT NOT NULL DEFAULT 'Company',
    autoDeleteDays INTEGER NOT NULL DEFAULT 0
  )`,
];

for (const sql of tables) {
  await db.execute(sql);
}
console.log("Tables created");

// Seed admin user
const existing = await db.execute({ sql: "SELECT id FROM User WHERE username = ?", args: ["admin"] });
if (existing.rows.length === 0) {
  const passwordHash = bcrypt.hashSync("admin123", 10);
  const id = crypto.randomBytes(12).toString("hex");
  await db.execute({
    sql: "INSERT INTO User (id, username, passwordHash, createdAt) VALUES (?, ?, ?, ?)",
    args: [id, "admin", passwordHash, new Date().toISOString()],
  });
  console.log("Created admin user (username: admin, password: admin123)");
} else {
  console.log("Admin user already exists");
}

// Seed settings
const settings = await db.execute({ sql: "SELECT id FROM Settings WHERE id = ?", args: ["main"] });
if (settings.rows.length === 0) {
  await db.execute({
    sql: "INSERT INTO Settings (id, bankName, accountName, iban, accountNumber, swiftCode, defaultMatchFee, groupName) VALUES (?, '', '', '', '', '', 20, 'Company')",
    args: ["main"],
  });
  console.log("Created default settings");
} else {
  console.log("Settings already exist");
}

console.log("Seed complete!");
