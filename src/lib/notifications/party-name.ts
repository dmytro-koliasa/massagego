import {
  anonymisedEmailFor,
  formatDeletedUserLabel,
} from "@/lib/deleted-user";

export type NotificationPartyUser = {
  name?: string | null;
  nameEn?: string | null;
  nameUk?: string | null;
  email?: string | null;
  deletedAt?: Date | null;
  id?: string;
};

/**
 * Name shown in notification payloads. Deleted / anonymised accounts never
 * fall through to `deleted:<id>@invalid.local` (#131).
 */
export function notificationPartyName(
  user: NotificationPartyUser | null | undefined,
  locale: "en" | "uk",
): string {
  if (!user || user.deletedAt) {
    return formatDeletedUserLabel(locale);
  }

  const email = user.email?.trim() || "";
  if (
    email.endsWith("@invalid.local") ||
    (user.id != null && email === anonymisedEmailFor(user.id))
  ) {
    return formatDeletedUserLabel(locale);
  }

  const localized =
    locale === "uk"
      ? user.nameUk?.trim() || user.nameEn?.trim()
      : user.nameEn?.trim() || user.nameUk?.trim();
  return localized || user.name?.trim() || email || "User";
}
