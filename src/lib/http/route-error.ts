/**
 * Privacy-safe API route error logging (#84).
 * Logs error name/message/code only — never request bodies or raw stacks.
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** International / national phone-like digit runs (avoid redacting short ids). */
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/g;

/** Redact common PII shapes and cap length for log lines. */
export function redactForLog(text: string, maxLen = 500): string {
  return text
    .replace(EMAIL_RE, "[email]")
    .replace(PHONE_RE, "[phone]")
    .slice(0, maxLen);
}

export type SanitizedRouteError = {
  name: string;
  message: string;
  code?: string;
};

/** Extract a safe, redacted summary from an unknown thrown value. */
export function sanitizeErrorForLog(error: unknown): SanitizedRouteError {
  if (error instanceof Error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;
    return {
      name: error.name || "Error",
      message: redactForLog(error.message || "unknown"),
      ...(code ? { code: redactForLog(code, 64) } : {}),
    };
  }
  if (typeof error === "string") {
    return { name: "Error", message: redactForLog(error) };
  }
  return { name: "UnknownError", message: "non_error_thrown" };
}

/** Log an unexpected route failure without leaking PII to clients or logs. */
export function logRouteError(route: string, error: unknown): void {
  console.error(`[${route}]`, sanitizeErrorForLog(error));
}
