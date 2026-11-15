-- Prevent double-booking at the database level.
--
-- Every session is exactly one hour (see SLOT_MS in the booking routes), so a
-- booking occupies [slotStart, slotStart + 1 hour). Two non-cancelled bookings
-- for the same masseur must never overlap. This covers identical start times
-- as well as legacy/unaligned starts (e.g. 10:00 and 10:30).
-- Cancelled bookings are excluded so a freed slot can be booked again.
--
-- Prisma cannot model exclusion constraints, so this lives only in SQL.
-- If the session length ever changes, this constraint must be replaced too.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Fail with a readable message if existing data already conflicts.
DO $$
DECLARE
  conflicts integer;
BEGIN
  SELECT count(*) INTO conflicts
  FROM "Booking" a
  JOIN "Booking" b
    ON a."masseurId" = b."masseurId"
   AND a."id" < b."id"
  WHERE a."slotStart" IS NOT NULL
    AND b."slotStart" IS NOT NULL
    AND a."status" <> 'cancelled'
    AND b."status" <> 'cancelled'
    AND a."slotStart" < b."slotStart" + interval '1 hour'
    AND b."slotStart" < a."slotStart" + interval '1 hour';

  IF conflicts > 0 THEN
    RAISE EXCEPTION
      'Cannot add Booking_no_overlapping_active_slots: % overlapping active booking pair(s) exist. Cancel or move them, then re-run the migration.',
      conflicts;
  END IF;
END $$;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_no_overlapping_active_slots"
  EXCLUDE USING gist (
    "masseurId" WITH =,
    tsrange("slotStart", "slotStart" + interval '1 hour') WITH &&
  )
  WHERE ("slotStart" IS NOT NULL AND "status" <> 'cancelled');
