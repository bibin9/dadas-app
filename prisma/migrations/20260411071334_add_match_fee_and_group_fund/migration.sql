-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'event',
    "date" DATETIME NOT NULL,
    "perHeadFee" REAL NOT NULL,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Event" ("createdAt", "date", "id", "name", "notes", "perHeadFee") SELECT "createdAt", "date", "id", "name", "notes", "perHeadFee" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "bankName" TEXT NOT NULL DEFAULT '',
    "accountName" TEXT NOT NULL DEFAULT '',
    "iban" TEXT NOT NULL DEFAULT '',
    "accountNumber" TEXT NOT NULL DEFAULT '',
    "swiftCode" TEXT NOT NULL DEFAULT '',
    "defaultMatchFee" REAL NOT NULL DEFAULT 20,
    "groupName" TEXT NOT NULL DEFAULT 'Company'
);
INSERT INTO "new_Settings" ("accountName", "accountNumber", "bankName", "iban", "id", "swiftCode") SELECT "accountName", "accountNumber", "bankName", "iban", "id", "swiftCode" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
