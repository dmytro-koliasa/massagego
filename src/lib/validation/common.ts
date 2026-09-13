import { z } from "zod";
import { isValidPhoneNumber, parsePhoneNumber } from "libphonenumber-js";
import { isPortal } from "@/lib/portals";
import { PHONE_COUNTRIES_EU_UA } from "@/lib/phone-countries";
import { isMassageTypeValue } from "@/lib/massage-types";

export const NAME_MAX = 80;
export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;
export const PHONE_MAX = 20;
export const NOTE_MAX = 200;
export const CITY_MAX = 80;
export const CITY_QUERY_MIN = 2;
export const ADDRESS_MAX = 150;
export const DESCRIPTION_MAX = 200;

/** Trimmed string that may become empty; empty → null. */
export function nullableText(max: number) {
  return z.preprocess((value) => {
    if (value === undefined) return undefined;
    if (typeof value !== "string") return value;
    const trimmed = value.trim().slice(0, max);
    return trimmed.length ? trimmed : null;
  }, z.union([z.string().max(max), z.null()]).optional());
}

export function requiredText(max: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(max);
}

export const emailSchema = z
  .string()
  .trim()
  .min(1)
  .max(EMAIL_MAX)
  .email()
  .transform((value) => value.toLowerCase());

const PASSWORD_COMPLEXITY = /^(?=.*\p{L})(?=.*\d)(?=.*[^\p{L}\p{N}\s]).+$/u;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN)
  .max(PASSWORD_MAX)
  .refine((value) => PASSWORD_COMPLEXITY.test(value), {
    message: "weak_password",
  });

export const portalSchema = z.enum(["masseur", "client"]);

export function isAllowedBookingPhone(value: string) {
  if (!isValidPhoneNumber(value)) return false;
  try {
    const parsed = parsePhoneNumber(value);
    const country = parsed.country;
    return Boolean(
      country && (PHONE_COUNTRIES_EU_UA as readonly string[]).includes(country),
    );
  } catch {
    return false;
  }
}

export const phoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(PHONE_MAX)
  .refine(isAllowedBookingPhone, { message: "invalid_phone" })
  .transform((value) => parsePhoneNumber(value).format("E.164"));

export const massageTypeSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || isMassageTypeValue(value), {
    message: "invalid_massage_type",
  });

export function zodErrorCode(error: z.ZodError): string {
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (
      issue.message === "invalid_phone" ||
      path === "clientPhone" ||
      path === "phone"
    ) {
      return "invalid_phone";
    }
    if (
      path === "password" &&
      (issue.code === "too_small" || issue.message === "weak_password")
    ) {
      return "weak_password";
    }
    if (
      path === "passwordConfirm" ||
      issue.message === "password_mismatch"
    ) {
      return "password_mismatch";
    }
    if (path === "email") {
      return "invalid_email";
    }
    if (
      path === "city" ||
      path === "address" ||
      issue.message === "address_required"
    ) {
      return "address_required";
    }
    if (
      path.includes("slot") ||
      issue.message === "invalid_slot"
    ) {
      return "invalid_slot";
    }
    if (
      path === "massageType" ||
      issue.message === "invalid_massage_type"
    ) {
      return "invalid_massage_type";
    }
  }
  return "missing_fields";
}

export function parseWithSchema<T>(
  schema: z.ZodType<T>,
  data: unknown,
): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { ok: false, error: zodErrorCode(result.error) };
  }
  return { ok: true, data: result.data };
}

export function resolvePortalInput(body: {
  portal?: unknown;
  role?: unknown;
}) {
  if (isPortal(body.portal)) return body.portal;
  if (isPortal(body.role)) return body.role;
  return "masseur" as const;
}
