-- IANA time zone of a masseur (BR-006). Existing users get Europe/Kyiv.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Europe/Kyiv';
