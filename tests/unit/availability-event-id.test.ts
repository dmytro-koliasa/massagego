import { describe, expect, it } from "vitest";
import {
  eventIdExposesBookingPrimaryKey,
  syntheticBookedSlotEventId,
} from "@/lib/availability-event-id";

describe("syntheticBookedSlotEventId (#87)", () => {
  it("is stable for the slot start and does not embed the booking id", () => {
    const start = "2030-06-01T10:00:00.000Z";
    const bookingId = "clxyz0123456789abcdef";
    const id = syntheticBookedSlotEventId(start);
    expect(id).toBe(`booked-slot:${start}`);
    expect(id).toBe(syntheticBookedSlotEventId(start));
    expect(eventIdExposesBookingPrimaryKey(id, bookingId)).toBe(false);
    expect(
      eventIdExposesBookingPrimaryKey(`booking-${bookingId}`, bookingId),
    ).toBe(true);
  });
});
