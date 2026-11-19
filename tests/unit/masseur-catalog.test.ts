import { describe, expect, it } from "vitest";
import {
  availabilityLabelForNearest,
  compareMasseurCatalogOrder,
  formatNearestLabel,
  formatNoFreeTimeLabel,
  isCompleteMasseurProfile,
  isMasseurListed,
} from "@/lib/masseur-catalog";

const complete = {
  nameEn: "Olena",
  nameUk: "",
  cityPlaceId: "place-1",
  address: "Khreshchatyk 1",
  phone: "+380501112233",
  emailVerified: new Date("2030-01-01T00:00:00.000Z"),
};

describe("listed masseur predicate", () => {
  it("requires name in at least one language", () => {
    expect(isCompleteMasseurProfile(complete)).toBe(true);
    expect(
      isCompleteMasseurProfile({ ...complete, nameEn: "", nameUk: "Олена" }),
    ).toBe(true);
    expect(
      isCompleteMasseurProfile({ ...complete, nameEn: "  ", nameUk: null }),
    ).toBe(false);
  });

  it("requires cityPlaceId (legacy city alone is not enough)", () => {
    expect(
      isCompleteMasseurProfile({ ...complete, cityPlaceId: "" }),
    ).toBe(false);
    expect(
      isCompleteMasseurProfile({ ...complete, cityPlaceId: "  " }),
    ).toBe(false);
  });

  it("requires address and phone", () => {
    expect(isCompleteMasseurProfile({ ...complete, address: null })).toBe(
      false,
    );
    expect(isCompleteMasseurProfile({ ...complete, phone: "" })).toBe(false);
  });

  it("lists only when complete, email verified, and has availability history", () => {
    expect(isMasseurListed({ ...complete, hasAvailability: true })).toBe(true);
    expect(isMasseurListed({ ...complete, hasAvailability: false })).toBe(
      false,
    );
    expect(
      isMasseurListed({
        ...complete,
        _count: { availabilitySlots: 2 },
      }),
    ).toBe(true);
    expect(
      isMasseurListed({
        ...complete,
        _count: { availabilitySlots: 0 },
      }),
    ).toBe(false);
    expect(
      isMasseurListed({
        ...complete,
        emailVerified: null,
        hasAvailability: true,
      }),
    ).toBe(false);
  });
});

describe("nearest free time labels", () => {
  const zone = "Europe/Kyiv";
  // Winter: Kyiv = UTC+2. Local 10:00 = 08:00Z.
  const now = new Date("2027-01-12T08:00:00.000Z"); // Tuesday 10:00 Kyiv

  it("formats today and tomorrow in EN and UK", () => {
    const today = new Date("2027-01-12T09:00:00.000Z"); // 11:00 Kyiv
    expect(formatNearestLabel(today, zone, "en", now)).toBe(
      "Nearest: today, 11:00 (Kyiv, UTC+02:00)",
    );
    expect(formatNearestLabel(today, zone, "uk", now)).toBe(
      "Найближче: сьогодні, 11:00 (Kyiv, UTC+02:00)",
    );

    const tomorrow = new Date("2027-01-13T08:00:00.000Z"); // 10:00 Kyiv
    expect(formatNearestLabel(tomorrow, zone, "en", now)).toBe(
      "Nearest: tomorrow, 10:00 (Kyiv, UTC+02:00)",
    );
    expect(formatNearestLabel(tomorrow, zone, "uk", now)).toBe(
      "Найближче: завтра, 10:00 (Kyiv, UTC+02:00)",
    );
  });

  it("formats weekday+date beyond tomorrow", () => {
    const friday = new Date("2027-01-15T08:00:00.000Z"); // Fri 10:00 Kyiv
    const en = formatNearestLabel(friday, zone, "en", now);
    expect(en.startsWith("Nearest:")).toBe(true);
    expect(en).toContain("10:00");
    expect(en).toContain("(Kyiv, UTC+02:00)");
    expect(en.toLowerCase()).not.toContain("today");
    expect(en.toLowerCase()).not.toContain("tomorrow");
  });

  it("uses red plaque copy when there is no free time", () => {
    expect(formatNoFreeTimeLabel("en")).toBe("No free time");
    expect(formatNoFreeTimeLabel("uk")).toBe("Немає вільного часу");
    expect(availabilityLabelForNearest(null, zone, "en", now)).toBe(
      "No free time",
    );
  });
});

describe("catalog sort order", () => {
  it("puts free-time masseurs first, then newest within each group", () => {
    const rows = [
      { id: "old-free", hasFreeTime: true, createdAt: "2027-01-01T00:00:00Z" },
      { id: "new-busy", hasFreeTime: false, createdAt: "2027-01-10T00:00:00Z" },
      { id: "new-free", hasFreeTime: true, createdAt: "2027-01-09T00:00:00Z" },
      { id: "old-busy", hasFreeTime: false, createdAt: "2027-01-02T00:00:00Z" },
    ];
    const sorted = [...rows].sort(compareMasseurCatalogOrder);
    expect(sorted.map((row) => row.id)).toEqual([
      "new-free",
      "old-free",
      "new-busy",
      "old-busy",
    ]);
  });
});
