import { describe, expect, it } from "vitest";
import {
  AUTH_RATE_LIMIT_SCOPES,
  correctPasswordBypassesFailBudget,
  PASSWORD_RESET_IDENTIFIER_LIMIT,
  PASSWORD_RESET_IP_LIMIT,
  shouldConsumeSignInPasswordFail,
  SIGN_IN_IP_LIMIT,
  SIGN_IN_PASSWORD_FAIL_LIMIT,
} from "@/lib/auth/auth-rate-limit-policy";

describe("auth rate-limit policy (#86)", () => {
  it("consumes the fail bucket only after a failed password check", () => {
    expect(
      shouldConsumeSignInPasswordFail({
        hasPasswordHash: true,
        passwordValid: false,
      }),
    ).toBe(true);
    expect(
      shouldConsumeSignInPasswordFail({
        hasPasswordHash: true,
        passwordValid: true,
      }),
    ).toBe(false);
    expect(
      shouldConsumeSignInPasswordFail({
        hasPasswordHash: false,
        passwordValid: false,
      }),
    ).toBe(false);
  });

  it("lets a correct password bypass the fail budget (anti-lockout)", () => {
    expect(correctPasswordBypassesFailBudget(true)).toBe(true);
    expect(correctPasswordBypassesFailBudget(false)).toBe(false);
  });

  it("keeps IP tighter than identifier budgets where lockout mattered", () => {
    expect(SIGN_IN_IP_LIMIT.limit).toBe(10);
    expect(SIGN_IN_PASSWORD_FAIL_LIMIT.limit).toBeGreaterThan(
      SIGN_IN_IP_LIMIT.limit,
    );
    expect(PASSWORD_RESET_IDENTIFIER_LIMIT.limit).toBeGreaterThan(
      PASSWORD_RESET_IP_LIMIT.limit,
    );
    expect(AUTH_RATE_LIMIT_SCOPES.signInPasswordFail).toBe("signin:fail");
    expect(AUTH_RATE_LIMIT_SCOPES.passwordResetIdentifier).toBe(
      "password-reset:id",
    );
  });
});
