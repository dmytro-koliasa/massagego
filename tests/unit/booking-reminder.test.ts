import { describe, expect, it } from "vitest";
import {
  isBookingDueForReminder,
  resolveReminderHours,
} from "@/lib/booking-reminder";

describe("resolveReminderHours", () => {
  it("treats null as Off and defaults missing values to 24", () => {
    expect(resolveReminderHours(null)).toBeNull();
    expect(resolveReminderHours(undefined)).toBe(24);
    expect(resolveReminderHours(12)).toBe(12);
    expect(resolveReminderHours(3)).toBe(24);
  });
});

describe("isBookingDueForReminder", () => {
  const slotStart = new Date("2026-12-01T12:00:00.000Z");
  const windowStart = new Date("2026-11-30T12:00:00.000Z"); // 24h before

  it("is due inside the window when booked earlier", () => {
    expect(
      isBookingDueForReminder({
        now: new Date("2026-11-30T15:00:00.000Z"),
        slotStart,
        createdAt: new Date("2026-11-20T10:00:00.000Z"),
        reminderHours: 24,
        reminderSentAt: null,
        status: "confirmed",
        clientUserId: "client-1",
      }),
    ).toBe(true);
  });

  it("skips Off, already sent, walk-in, before window, and after start", () => {
    const base = {
      now: new Date("2026-11-30T15:00:00.000Z"),
      slotStart,
      createdAt: new Date("2026-11-20T10:00:00.000Z"),
      reminderHours: 24 as const,
      reminderSentAt: null,
      status: "confirmed",
      clientUserId: "client-1",
    };
    expect(isBookingDueForReminder({ ...base, reminderHours: null })).toBe(
      false,
    );
    expect(
      isBookingDueForReminder({
        ...base,
        reminderSentAt: new Date("2026-11-30T14:00:00.000Z"),
      }),
    ).toBe(false);
    expect(isBookingDueForReminder({ ...base, clientUserId: null })).toBe(
      false,
    );
    expect(
      isBookingDueForReminder({
        ...base,
        now: new Date("2026-11-30T10:00:00.000Z"),
      }),
    ).toBe(false);
    expect(
      isBookingDueForReminder({
        ...base,
        now: new Date("2026-12-01T12:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("skips when the booking was created inside the reminder window", () => {
    expect(
      isBookingDueForReminder({
        now: new Date("2026-11-30T18:00:00.000Z"),
        slotStart,
        createdAt: new Date(windowStart.getTime() + 60_000),
        reminderHours: 24,
        reminderSentAt: null,
        status: "confirmed",
        clientUserId: "client-1",
      }),
    ).toBe(false);
  });
});
