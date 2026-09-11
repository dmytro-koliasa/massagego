-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "slotStart" DATETIME;

-- CreateIndex
CREATE INDEX "Booking_masseurId_slotStart_idx" ON "Booking"("masseurId", "slotStart");
