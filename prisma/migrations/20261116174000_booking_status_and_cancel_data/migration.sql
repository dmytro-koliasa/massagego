-- Booking status becomes a fixed set (confirmed | cancelled), cancelled
-- bookings record who cancelled, when and why, and the unused columns
-- clientEmail, preferredDate and preferredTime are removed.

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('client', 'masseur');

-- CreateEnum
CREATE TYPE "CancellationReason" AS ENUM ('cant_make_it', 'circumstances_changed', 'changed_mind', 'wrong_slot', 'other', 'client_account_deleted');

-- The exclusion constraint depends on "status"; drop it while the column
-- type changes and recreate it below with the same predicate.
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_no_overlapping_active_slots";

-- Every value other than 'cancelled' (in practice only 'pending') occupied
-- the hour, so it maps to 'confirmed'.
ALTER TABLE "Booking" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Booking" ALTER COLUMN "status" TYPE "BookingStatus"
  USING (CASE WHEN "status" = 'cancelled' THEN 'cancelled' ELSE 'confirmed' END)::"BookingStatus";
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'confirmed';

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "clientEmail",
DROP COLUMN "preferredDate",
DROP COLUMN "preferredTime",
ADD COLUMN     "cancelReason" "CancellationReason",
ADD COLUMN     "cancelReasonText" VARCHAR(200),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" "CancelledBy";

-- Cancelling was the only update applied to a booking, so "updatedAt" is the
-- best available cancellation time. Who cancelled is unknown and stays NULL.
UPDATE "Booking" SET "cancelledAt" = "updatedAt" WHERE "status" = 'cancelled';

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_no_overlapping_active_slots"
  EXCLUDE USING gist (
    "masseurId" WITH =,
    tsrange("slotStart", "slotStart" + interval '1 hour') WITH &&
  )
  WHERE ("slotStart" IS NOT NULL AND "status" <> 'cancelled');

-- CreateIndex
CREATE INDEX "Booking_status_cancelledAt_idx" ON "Booking"("status", "cancelledAt");

-- CreateIndex
CREATE INDEX "Booking_status_slotStart_idx" ON "Booking"("status", "slotStart");
