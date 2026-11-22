import { describe, expect, it } from "vitest";
import { MAX_AVAILABILITY_CHANGES_PER_REQUEST } from "@/lib/booking-constants";
import { availabilityChangesBatchSchema } from "@/lib/validation/availability";
import { parseWithSchema } from "@/lib/validation/common";

function isoHours(count: number) {
  const base = Date.parse("2031-07-15T05:00:00.000Z");
  return Array.from({ length: count }, (_, i) => ({
    start: new Date(base + i * 60 * 60 * 1000).toISOString(),
    active: true,
  }));
}

describe("availabilityChangesBatchSchema (#165)", () => {
  it("documents the operational week-of-hours ceiling", () => {
    expect(MAX_AVAILABILITY_CHANGES_PER_REQUEST).toBe(126);
  });

  it("accepts a full week of working-hour changes", () => {
    const parsed = parseWithSchema(availabilityChangesBatchSchema, {
      changes: isoHours(MAX_AVAILABILITY_CHANGES_PER_REQUEST),
    });
    expect(parsed.ok).toBe(true);
  });

  it("rejects oversized batches", () => {
    const parsed = parseWithSchema(availabilityChangesBatchSchema, {
      changes: isoHours(MAX_AVAILABILITY_CHANGES_PER_REQUEST + 1),
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toBe("invalid_changes");
    }
  });

  it("rejects malformed change items", () => {
    const parsed = parseWithSchema(availabilityChangesBatchSchema, {
      changes: [{ start: "not-a-date", active: true }],
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toBe("invalid_start");
    }
  });
});
