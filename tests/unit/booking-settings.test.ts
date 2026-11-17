import { describe, expect, it } from "vitest";
import { applyBookingSettingsUpdate } from "@/lib/booking-settings";

describe("applyBookingSettingsUpdate", () => {
  it("auto-raises cutoff when lead moves above it", () => {
    const result = applyBookingSettingsUpdate({
      currentLead: 1,
      currentCutoff: 2,
      nextLead: 4,
      nextCutoff: 2,
    });
    expect(result).toEqual({
      ok: true,
      bookingLeadHours: 4,
      cancelCutoffHours: 4,
      cutoffRaised: true,
    });
  });

  it("refuses an explicit cutoff below the lead", () => {
    const result = applyBookingSettingsUpdate({
      currentLead: 2,
      currentCutoff: 24,
      nextLead: 2,
      nextCutoff: 1,
    });
    expect(result).toEqual({ ok: false, error: "CUTOFF_TOO_LOW" });
  });

  it("keeps a valid pair unchanged", () => {
    const result = applyBookingSettingsUpdate({
      currentLead: 1,
      currentCutoff: 24,
      nextLead: 3,
      nextCutoff: 36,
    });
    expect(result).toEqual({
      ok: true,
      bookingLeadHours: 3,
      cancelCutoffHours: 36,
      cutoffRaised: false,
    });
  });
});
