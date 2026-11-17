/** Stored in Booking.clientName after account anonymisation (BR-011). */
export const DELETED_USER_NAME_KEY = "deleted_user";

export function formatDeletedUserLabel(locale: "en" | "uk"): string {
  return locale === "uk" ? "Видалений користувач" : "Deleted user";
}

export function displayBookingClientName(
  clientName: string | null | undefined,
  locale: "en" | "uk",
): string {
  const raw = clientName?.trim() ?? "";
  if (!raw || raw === DELETED_USER_NAME_KEY) {
    return formatDeletedUserLabel(locale);
  }
  return raw;
}

export function anonymisedEmailFor(userId: string): string {
  return `deleted:${userId}@invalid.local`;
}
