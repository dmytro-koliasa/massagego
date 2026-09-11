-- CreateTable
CREATE TABLE "AvailabilitySlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "masseurId" TEXT NOT NULL,
    "start" DATETIME NOT NULL,
    "end" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AvailabilitySlot_masseurId_fkey" FOREIGN KEY ("masseurId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AvailabilitySlot_masseurId_start_idx" ON "AvailabilitySlot"("masseurId", "start");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilitySlot_masseurId_start_key" ON "AvailabilitySlot"("masseurId", "start");
