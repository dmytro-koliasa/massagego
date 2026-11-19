/**
 * FullCalendar / availability slot `id` for a booked hour that has no
 * `AvailabilitySlot` row. Must not embed the booking primary key (#87).
 *
 * Stable across refetches for the same hour; actions that need the real
 * booking id use the separate `bookingId` field on authorized payloads.
 */
export function syntheticBookedSlotEventId(slotStartIso: string): string {
  return `booked-slot:${slotStartIso}`;
}

/** True when an event id embeds a raw booking primary key (legacy shape). */
export function eventIdExposesBookingPrimaryKey(
  eventId: string,
  bookingId: string,
): boolean {
  if (!bookingId) return false;
  return (
    eventId === `booking-${bookingId}` ||
    eventId.includes(bookingId)
  );
}
