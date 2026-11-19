-- AlterEnum
ALTER TYPE "NotificationOutboxStatus" ADD VALUE 'processing';

-- AlterTable
ALTER TABLE "NotificationOutbox" ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "NotificationOutbox_status_leaseExpiresAt_idx" ON "NotificationOutbox"("status", "leaseExpiresAt");
