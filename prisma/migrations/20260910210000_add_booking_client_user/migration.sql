-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "masseurId" TEXT NOT NULL,
    "clientUserId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "clientEmail" TEXT,
    "preferredDate" TEXT,
    "preferredTime" TEXT,
    "slotStart" DATETIME,
    "massageType" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Booking_masseurId_fkey" FOREIGN KEY ("masseurId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Booking_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("clientEmail", "clientName", "clientPhone", "createdAt", "id", "massageType", "masseurId", "note", "preferredDate", "preferredTime", "slotStart", "status", "updatedAt") SELECT "clientEmail", "clientName", "clientPhone", "createdAt", "id", "massageType", "masseurId", "note", "preferredDate", "preferredTime", "slotStart", "status", "updatedAt" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE INDEX "Booking_masseurId_idx" ON "Booking"("masseurId");
CREATE INDEX "Booking_masseurId_slotStart_idx" ON "Booking"("masseurId", "slotStart");
CREATE INDEX "Booking_clientUserId_idx" ON "Booking"("clientUserId");
CREATE INDEX "Booking_clientUserId_status_idx" ON "Booking"("clientUserId", "status");
CREATE INDEX "Booking_clientUserId_slotStart_idx" ON "Booking"("clientUserId", "slotStart");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
