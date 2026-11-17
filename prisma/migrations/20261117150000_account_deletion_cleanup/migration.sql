-- AlterTable
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "hasRetentionHold" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "Booking_hasRetentionHold_idx" ON "Booking"("hasRetentionHold");
