-- AlterEnum
ALTER TYPE "NotificationEventType" ADD VALUE 'booking_reminder';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "reminderHours" INTEGER DEFAULT 24;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
