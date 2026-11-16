-- Per-masseur client booking lead time and cancellation cutoff (BR-002, BR-004).
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bookingLeadHours" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN     "cancelCutoffHours" INTEGER NOT NULL DEFAULT 24;
