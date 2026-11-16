-- Prevent one client account from holding two active bookings for the same hour
-- (BR-008), including across different masseurs. Walk-ins (null clientUserId)
-- are excluded. Cancelled rows do not occupy the hour.
--
-- Prisma cannot model exclusion constraints; this lives only in SQL.
-- Requires btree_gist (already enabled by 20261115120000_booking_no_overlap).

DO $$
DECLARE
  conflicts integer;
BEGIN
  SELECT count(*) INTO conflicts
  FROM "Booking" a
  JOIN "Booking" b
    ON a."clientUserId" = b."clientUserId"
   AND a."id" < b."id"
  WHERE a."slotStart" IS NOT NULL
    AND b."slotStart" IS NOT NULL
    AND a."clientUserId" IS NOT NULL
    AND b."clientUserId" IS NOT NULL
    AND a."status" <> 'cancelled'
    AND b."status" <> 'cancelled'
    AND a."slotStart" < b."slotStart" + interval '1 hour'
    AND b."slotStart" < a."slotStart" + interval '1 hour';

  IF conflicts > 0 THEN
    RAISE EXCEPTION
      'Cannot add Booking_no_overlapping_active_client_slots: % overlapping active client booking pair(s) exist. Cancel or move them, then re-run the migration.',
      conflicts;
  END IF;
END $$;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_no_overlapping_active_client_slots"
  EXCLUDE USING gist (
    "clientUserId" WITH =,
    tsrange("slotStart", "slotStart" + interval '1 hour') WITH &&
  )
  WHERE (
    "slotStart" IS NOT NULL
    AND "clientUserId" IS NOT NULL
    AND "status" <> 'cancelled'
  );
