-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "masseurId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "clientEmail" TEXT,
    "preferredDate" TEXT,
    "preferredTime" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Booking_masseurId_fkey" FOREIGN KEY ("masseurId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("id", "masseurId", "clientName", "clientPhone", "clientEmail", "preferredDate", "preferredTime", "note", "status", "createdAt", "updatedAt") SELECT "id", "masseurId", "clientName", "clientPhone", "clientEmail", "preferredDate", "preferredTime", "note", "status", "createdAt", "updatedAt" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE INDEX "Booking_masseurId_idx" ON "Booking"("masseurId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
