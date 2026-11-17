import { describe, expect, it } from "vitest";
import {
  isNonCancellableAtBookingTime,
  isWithinClientCancelWindow,
  neighbouringSlotStarts,
} from "@/lib/client-booking-rules";
import { SLOT_MS } from "@/lib/booking-constants";

const utc = (iso: string) => new Date(`${iso}Z`);

describe("client cancel window", () => {
  it("allows cancel at exactly start − cutoff and refuses after", () => {
    const slot = utc("2031-07-15T10:00:00");
    const cutoffHours = 24;
    expect(
      isWithinClientCancelWindow(slot, cutoffHours, utc("2031-07-14T10:00:00")),
    ).toBe(true);
    expect(
      isWithinClientCancelWindow(slot, cutoffHours, utc("2031-07-14T10:00:00.001")),
    ).toBe(false);
  });

  it("flags bookings made inside the cutoff as non-cancellable", () => {
    const slot = utc("2031-07-15T10:00:00");
    expect(
      isNonCancellableAtBookingTime(slot, 24, utc("2031-07-14T11:00:00")),
    ).toBe(true);
    expect(
      isNonCancellableAtBookingTime(slot, 24, utc("2031-07-14T09:00:00")),
    ).toBe(false);
  });

  it("lists neighbouring hour starts", () => {
    const slot = utc("2031-07-15T10:00:00");
    expect(neighbouringSlotStarts(slot)).toEqual([
      new Date(slot.getTime() - SLOT_MS),
      new Date(slot.getTime() + SLOT_MS),
    ]);
  });
});
