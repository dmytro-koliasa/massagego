import { RATE_LIMITS } from "@/lib/rate-limit";

/**
 * #86 — auth anti-abuse / targeted-lockout policy (threat-model note)
 *
 * Threat: knowing a phone/email, an attacker can burn a shared per-identifier
 * bucket before password verification and lock the victim out (including with
 * the correct password). Password-reset has the same shape for identifier keys.
 *
 * v1 controls (locked decisions: no CAPTCHA, no paid antibot):
 * 1. Sign-in IP budget on every attempt (hard 429 / Auth.js rate_limited_*).
 * 2. Sign-in per-identifier budget only after a failed password check, and
 *    correct passwords always bypass that bucket so a filled fail counter does
 *    not lock the real owner out.
 * 3. Cross-IP password spray is bounded primarily by the per-IP budget; the
 *    fail bucket adds a shared ceiling on counted failures without blocking
 *    successful auth.
 * 4. Password-reset: keep a per-IP budget; replace the tight global identifier
 *    lock with a higher identifier budget so a third party cannot cheaply deny
 *    reset, while still capping email-bombing of one address.
 * 5. Responses stay generic for credentials failures (no account-existence
 *    signal via a special rate-limit code on the fail bucket).
 */

export const SIGN_IN_IP_LIMIT = RATE_LIMITS.signIn;
export const SIGN_IN_PASSWORD_FAIL_LIMIT = RATE_LIMITS.signInPasswordFail;
export const PASSWORD_RESET_IP_LIMIT = RATE_LIMITS.passwordReset;
export const PASSWORD_RESET_IDENTIFIER_LIMIT =
  RATE_LIMITS.passwordResetIdentifier;

/** Scopes used in `rateLimitKey` for auth abuse controls. */
export const AUTH_RATE_LIMIT_SCOPES = {
  signInIp: "signin:ip",
  signInPasswordFail: "signin:fail",
  passwordResetIp: "password-reset:ip",
  passwordResetIdentifier: "password-reset:id",
} as const;

/**
 * Charge the per-identifier sign-in fail bucket only after a real password
 * check fails for a user that has a password hash.
 *
 * Correct passwords never touch this bucket, so a filled counter cannot lock
 * the account owner out (IP budget still applies).
 */
export function shouldConsumeSignInPasswordFail(input: {
  hasPasswordHash: boolean;
  passwordValid: boolean;
}): boolean {
  return input.hasPasswordHash && !input.passwordValid;
}

/** Pure fixture for tests: owner with the right password is never fail-locked. */
export function correctPasswordBypassesFailBudget(
  passwordValid: boolean,
): boolean {
  return passwordValid;
}
