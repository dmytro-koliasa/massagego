-- AlterEnum
ALTER TYPE "NotificationChannel" ADD VALUE 'telegram';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "telegramChatId" TEXT,
ADD COLUMN     "telegramLinkedAt" TIMESTAMP(3),
ADD COLUMN     "telegramAwaitingPhoneConfirm" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phoneConfirmedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN "telegramEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "User_telegramChatId_idx" ON "User"("telegramChatId");
