import { parsePhoneNumber } from "libphonenumber-js";

/** Normalize Telegram contact / account phones to E.164 for comparison. */
export function normalizePhoneForCompare(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const withPlus = raw.startsWith("+") ? raw : `+${raw.replace(/[^\d]/g, "")}`;
    const parsed = parsePhoneNumber(withPlus);
    if (!parsed?.isValid()) return null;
    return parsed.format("E.164");
  } catch {
    return null;
  }
}

export function phonesMatch(
  accountPhone: string | null | undefined,
  telegramPhone: string | null | undefined,
): boolean {
  const a = normalizePhoneForCompare(accountPhone);
  const b = normalizePhoneForCompare(telegramPhone);
  return Boolean(a && b && a === b);
}

/** Same person across portals: shared email or phone (normalized). */
export function samePersonContact(
  a: { email: string; phone: string | null },
  b: { email: string; phone: string | null },
): boolean {
  if (a.email.trim().toLowerCase() === b.email.trim().toLowerCase()) {
    return true;
  }
  const phoneA = a.phone?.trim();
  const phoneB = b.phone?.trim();
  if (phoneA && phoneB && phoneA === phoneB) return true;
  return false;
}
