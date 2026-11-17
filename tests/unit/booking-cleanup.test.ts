import { describe, expect, it } from "vitest";
import {
  cancelledBookingEligibleBefore,
  completedBookingEligibleBefore,
} from "@/lib/booking-cleanup-rules";
import {
  DELETED_USER_NAME_KEY,
  anonymisedEmailFor,
  displayBookingClientName,
  formatDeletedUserLabel,
} from "@/lib/deleted-user";

describe("booking cleanup windows", () => {
  it("marks cancelled bookings eligible after 7 UTC days", () => {
    const now = new Date("2026-11-17T12:00:00.000Z");
    expect(cancelledBookingEligibleBefore(now).toISOString()).toBe(
      "2026-11-10T12:00:00.000Z",
    );
  });

  it("marks completed bookings eligible after 3 UTC months", () => {
    const now = new Date("2026-11-17T12:00:00.000Z");
    expect(completedBookingEligibleBefore(now).toISOString()).toBe(
      "2026-08-17T12:00:00.000Z",
    );
  });
});

describe("deleted user labels", () => {
  it("stores a stable key and localises for display", () => {
    expect(DELETED_USER_NAME_KEY).toBe("deleted_user");
    expect(formatDeletedUserLabel("en")).toBe("Deleted user");
    expect(formatDeletedUserLabel("uk")).toBe("Видалений користувач");
    expect(displayBookingClientName("deleted_user", "uk")).toBe(
      "Видалений користувач",
    );
    expect(displayBookingClientName("Olena", "en")).toBe("Olena");
  });

  it("builds a unique anonymised email per user id", () => {
    expect(anonymisedEmailFor("abc")).toBe("deleted:abc@invalid.local");
  });
});
