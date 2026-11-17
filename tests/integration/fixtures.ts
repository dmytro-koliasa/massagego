/** Shared Prisma create payloads for integration tests (post PR 8 profile rules). */

/** Hour-aligned UTC instant about two weeks ahead (inside the 120-day client window). */
export function slotInsideBookingWindow(daysAhead = 14, hourUtc = 10): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d;
}

export function completeClientData(
  overrides: Record<string, unknown> = {},
) {
  return {
    email: "client@test.local",
    portal: "client" as const,
    name: "Test Client",
    phone: "+380501111111",
    emailVerified: new Date("2030-01-01T00:00:00.000Z"),
    cityPlaceId: "test-place-1",
    cityCountryCode: "UA",
    cityNameEn: "Kyiv",
    cityNameUk: "Київ",
    preferredLocale: "en",
    ...overrides,
  };
}

export function completeMasseurData(
  overrides: Record<string, unknown> = {},
) {
  return {
    email: "masseur@test.local",
    portal: "masseur" as const,
    nameEn: "Test Masseur",
    nameUk: "Тест Масажист",
    phone: "+380501222222",
    emailVerified: new Date("2030-01-01T00:00:00.000Z"),
    cityPlaceId: "test-place-1",
    cityCountryCode: "UA",
    cityNameEn: "Kyiv",
    cityNameUk: "Київ",
    address: "1 Test Street",
    timezone: "Europe/Kyiv",
    bookingLeadHours: 1,
    cancelCutoffHours: 24,
    preferredLocale: "en",
    ...overrides,
  };
}
