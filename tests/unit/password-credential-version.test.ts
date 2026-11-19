import { describe, expect, it } from "vitest";
import {
  applyPasswordVersionToJwt,
  isJwtPasswordStale,
  passwordChangedAtMs,
} from "@/lib/auth/password-credential-version";

describe("passwordChangedAtMs", () => {
  it("maps nullish to 0 and dates to epoch ms", () => {
    expect(passwordChangedAtMs(null)).toBe(0);
    expect(passwordChangedAtMs(undefined)).toBe(0);
    expect(passwordChangedAtMs(new Date(1_700_000_000_000))).toBe(
      1_700_000_000_000,
    );
  });
});

describe("isJwtPasswordStale", () => {
  it("is false when DB version matches or is older than the token stamp", () => {
    expect(isJwtPasswordStale(100, 100)).toBe(false);
    expect(isJwtPasswordStale(100, 50)).toBe(false);
    expect(isJwtPasswordStale(0, 0)).toBe(false);
  });

  it("is true when DB moved forward after the token was issued", () => {
    expect(isJwtPasswordStale(100, 101)).toBe(true);
    expect(isJwtPasswordStale(0, 1)).toBe(true);
  });
});

describe("applyPasswordVersionToJwt", () => {
  it("stamps DB version on initial sign-in", () => {
    const token: { pwdChangedAt?: number } = {};
    const changedAt = new Date("2026-11-19T10:00:00.000Z");

    expect(
      applyPasswordVersionToJwt({
        token,
        dbPasswordChangedAt: changedAt,
        isInitialSignIn: true,
      }),
    ).toBe("ok");
    expect(token.pwdChangedAt).toBe(changedAt.getTime());
  });

  it("keeps a matching token alive on refresh", () => {
    const changedAt = new Date("2026-11-19T10:00:00.000Z");
    const token = { pwdChangedAt: changedAt.getTime() };

    expect(
      applyPasswordVersionToJwt({
        token,
        dbPasswordChangedAt: changedAt,
        isInitialSignIn: false,
      }),
    ).toBe("ok");
  });

  it("marks pre-reset tokens stale after passwordChangedAt advances", () => {
    const token = { pwdChangedAt: 0 };
    const afterReset = new Date("2026-11-19T12:00:00.000Z");

    expect(
      applyPasswordVersionToJwt({
        token,
        dbPasswordChangedAt: afterReset,
        isInitialSignIn: false,
      }),
    ).toBe("stale");
  });

  it("allows a new sign-in stamp after reset", () => {
    const afterReset = new Date("2026-11-19T12:00:00.000Z");
    const token: { pwdChangedAt?: number } = { pwdChangedAt: 0 };

    expect(
      applyPasswordVersionToJwt({
        token,
        dbPasswordChangedAt: afterReset,
        isInitialSignIn: true,
      }),
    ).toBe("ok");
    expect(token.pwdChangedAt).toBe(afterReset.getTime());
  });
});
