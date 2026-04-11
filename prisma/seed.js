const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const path = require("path");

const db = new Database(path.join(__dirname, "..", "dev.db"));

// Check if admin exists
const existing = db.prepare("SELECT id FROM User WHERE username = ?").get("admin");
if (!existing) {
  const passwordHash = bcrypt.hashSync("admin123", 10);
  const id = crypto.randomBytes(12).toString("hex");
  db.prepare("INSERT INTO User (id, username, passwordHash, createdAt) VALUES (?, ?, ?, ?)").run(
    id, "admin", passwordHash, new Date().toISOString()
  );
  console.log("Created default admin user (username: admin, password: admin123)");
} else {
  console.log("Admin user already exists");
}

// Check if settings exist
const settings = db.prepare("SELECT id FROM Settings WHERE id = ?").get("main");
if (!settings) {
  db.prepare("INSERT INTO Settings (id, bankName, accountName, iban, accountNumber, swiftCode, defaultMatchFee, groupName) VALUES (?, '', '', '', '', '', 20, 'Company')").run("main");
  console.log("Created default settings");
} else {
  console.log("Settings already exist");
}

db.close();
