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
import {
  outboxAbandonedEligibleBefore,
  outboxTerminalEligibleBefore,
} from "@/lib/notifications/outbox-cleanup-rules";
import {
  RATE_LIMIT_MAX_WINDOW_MS,
  rateLimitBucketEligibleBefore,
} from "@/lib/rate-limit-cleanup-rules";
import { RATE_LIMIT_BUCKET_GRACE_MS } from "@/lib/booking-constants";
import { NOTIFICATION_RETRY_MAX_AGE_MS } from "@/lib/notifications/types";

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

describe("outbox + rate-limit retention windows (#81)", () => {
  it("marks terminal outbox eligible after 7 UTC days", () => {
    const now = new Date("2026-11-17T12:00:00.000Z");
    expect(outboxTerminalEligibleBefore(now).toISOString()).toBe(
      "2026-11-10T12:00:00.000Z",
    );
  });

  it("marks abandoned live outbox after retry max age + grace", () => {
    const now = new Date("2026-11-17T12:00:00.000Z");
    const expected = new Date(
      now.getTime() - NOTIFICATION_RETRY_MAX_AGE_MS - 24 * 60 * 60 * 1000,
    );
    expect(outboxAbandonedEligibleBefore(now).toISOString()).toBe(
      expected.toISOString(),
    );
  });

  it("marks rate-limit buckets eligible after max window + grace", () => {
    const now = new Date("2026-11-17T12:00:00.000Z");
    expect(RATE_LIMIT_MAX_WINDOW_MS).toBe(60 * 60 * 1000);
    expect(rateLimitBucketEligibleBefore(now).getTime()).toBe(
      now.getTime() - RATE_LIMIT_MAX_WINDOW_MS - RATE_LIMIT_BUCKET_GRACE_MS,
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
