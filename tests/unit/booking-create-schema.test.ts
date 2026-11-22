import { describe, expect, it } from "vitest";
import { MAX_ACTIVE_FUTURE_BOOKINGS_PER_CLIENT } from "@/lib/booking-constants";
import { bookingCreateSchema } from "@/lib/validation/booking";
import { parseWithSchema } from "@/lib/validation/common";

function isoHours(count: number) {
  const base = Date.parse("2031-07-15T10:00:00.000Z");
  return Array.from({ length: count }, (_, i) =>
    new Date(base + i * 60 * 60 * 1000).toISOString(),
  );
}

describe("bookingCreateSchema slotStarts request-size (#164)", () => {
  it("accepts up to the BR-008 active-future cap in one request", () => {
    const parsed = parseWithSchema(bookingCreateSchema, {
      masseurId: "masseur-1",
      slotStarts: isoHours(MAX_ACTIVE_FUTURE_BOOKINGS_PER_CLIENT),
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.slotStarts).toHaveLength(
        MAX_ACTIVE_FUTURE_BOOKINGS_PER_CLIENT,
      );
    }
  });

  it("rejects oversized slotStarts before route work", () => {
    const parsed = parseWithSchema(bookingCreateSchema, {
      masseurId: "masseur-1",
      slotStarts: isoHours(MAX_ACTIVE_FUTURE_BOOKINGS_PER_CLIENT + 1),
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toBe("invalid_slot");
    }
  });
});
