import type { Dictionary } from "@/lib/i18n";
import {
  AUTH_INTENT_COOKIE,
  AUTH_PORTAL_COOKIE,
  type AuthIntent,
  type Portal,
} from "@/lib/portals";

export function rateLimitedMessage(
  code: string | undefined | null,
  t: Pick<Dictionary, "authRateLimited">,
) {
  if (!code?.startsWith("rate_limited_")) return null;
  const minutes = Number(code.slice("rate_limited_".length));
  if (!Number.isFinite(minutes) || minutes < 1) {
    return t.authRateLimited.replace("{n}", "1");
  }
  return t.authRateLimited.replace("{n}", String(minutes));
}

export function signInErrorMessage(
  code: string | undefined | null,
  t: Pick<
    Dictionary,
    | "authRateLimited"
    | "authAccountBlocked"
    | "authInvalidCredentials"
    | "authInvalidPhoneCredentials"
    | "authGenericError"
  >,
  kind: "email" | "phone" | "generic",
) {
  if (code === "blocked") return t.authAccountBlocked;
  const limited = rateLimitedMessage(code, t);
  if (limited) return limited;
  if (kind === "phone") return t.authInvalidPhoneCredentials;
  if (kind === "email") return t.authInvalidCredentials;
  return t.authGenericError;
}

export function mapRegisterError(code: string | undefined, t: Dictionary) {
  switch (code) {
    case "email_taken":
      return t.authEmailTaken;
    case "phone_taken":
      return t.authPhoneTaken;
    case "weak_password":
      return t.authWeakPassword;
    case "password_mismatch":
      return t.authPasswordMismatch;
    case "phone_country_excluded":
      return t.authPhoneCountryExcluded;
    case "invalid_phone":
      return t.authInvalidPhone;
    case "invalid_email":
    case "missing_fields":
      return t.authMissingFields;
    default:
      return t.authGenericError;
  }
}

export function persistAuthContext(portal: Portal, intent: AuthIntent) {
  document.cookie = `${AUTH_PORTAL_COOKIE}=${portal};path=/;max-age=600;samesite=lax`;
  document.cookie = `${AUTH_INTENT_COOKIE}=${intent};path=/;max-age=600;samesite=lax`;
}