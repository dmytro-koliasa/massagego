import { describe, expect, it } from "vitest";
import {
  lastCancellationSince,
  pickLastCancellationsBySlotStart,
} from "@/lib/last-cancellation";

describe("pickLastCancellationsBySlotStart", () => {
  const slotA = new Date("2026-11-20T10:00:00.000Z");
  const slotB = new Date("2026-11-20T11:00:00.000Z");

  it("keeps the latest client cancel per slotStart", () => {
    const map = pickLastCancellationsBySlotStart([
      {
        slotStart: slotA,
        cancelReason: "changed_mind",
        cancelReasonText: null,
        cancelledAt: new Date("2026-11-17T09:00:00.000Z"),
      },
      {
        slotStart: slotA,
        cancelReason: "other",
        cancelReasonText: "traffic",
        cancelledAt: new Date("2026-11-17T12:00:00.000Z"),
      },
      {
        slotStart: slotB,
        cancelReason: "cant_make_it",
        cancelReasonText: null,
        cancelledAt: new Date("2026-11-17T10:00:00.000Z"),
      },
    ]);

    expect(map.get(slotA.toISOString())).toEqual({
      reason: "other",
      reasonText: "traffic",
      cancelledAt: "2026-11-17T12:00:00.000Z",
    });
    expect(map.get(slotB.toISOString())?.reason).toBe("cant_make_it");
  });

  it("skips rows missing slot, reason, or cancelledAt", () => {
    const map = pickLastCancellationsBySlotStart([
      {
        slotStart: null,
        cancelReason: "changed_mind",
        cancelReasonText: null,
        cancelledAt: new Date("2026-11-17T12:00:00.000Z"),
      },
      {
        slotStart: slotA,
        cancelReason: null,
        cancelReasonText: null,
        cancelledAt: new Date("2026-11-17T12:00:00.000Z"),
      },
      {
        slotStart: slotA,
        cancelReason: "wrong_slot",
        cancelReasonText: null,
        cancelledAt: null,
      },
    ]);
    expect(map.size).toBe(0);
  });
});

describe("lastCancellationSince", () => {
  it("matches the 7-day cancelled retention cutoff", () => {
    const now = new Date("2026-11-17T12:00:00.000Z");
    expect(lastCancellationSince(now).toISOString()).toBe(
      "2026-11-10T12:00:00.000Z",
    );
  });
});
