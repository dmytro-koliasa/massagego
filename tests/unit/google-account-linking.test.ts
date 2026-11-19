import { describe, expect, it } from "vitest";
import { decideGoogleSignIn } from "@/lib/auth/google-account-linking";

describe("decideGoogleSignIn", () => {
  const activeUser = { id: "user-1", blockedAt: null as Date | null };
  const blockedUser = {
    id: "user-2",
    blockedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  it("allows a returning Google user whose account is already linked", () => {
    expect(
      decideGoogleSignIn({
        existingUser: activeUser,
        googleAccountAlreadyLinked: true,
        authIntent: "login",
      }),
    ).toEqual({ allow: true });
  });

  it("refuses email-only match for an unverified/password account (takeover path)", () => {
    expect(
      decideGoogleSignIn({
        existingUser: activeUser,
        googleAccountAlreadyLinked: false,
        authIntent: "login",
      }),
    ).toEqual({ allow: false, error: "oauth_not_linked" });

    expect(
      decideGoogleSignIn({
        existingUser: activeUser,
        googleAccountAlreadyLinked: false,
        authIntent: "register",
      }),
    ).toEqual({ allow: false, error: "oauth_not_linked" });
  });

  it("refuses blocked existing users even if Google is linked", () => {
    expect(
      decideGoogleSignIn({
        existingUser: blockedUser,
        googleAccountAlreadyLinked: true,
        authIntent: "login",
      }),
    ).toEqual({ allow: false, error: "blocked" });
  });

  it("allows brand-new Google registration when no portal user exists", () => {
    expect(
      decideGoogleSignIn({
        existingUser: null,
        googleAccountAlreadyLinked: false,
        authIntent: "register",
      }),
    ).toEqual({ allow: true });
  });

  it("refuses Google login for a brand-new identity without register intent", () => {
    expect(
      decideGoogleSignIn({
        existingUser: null,
        googleAccountAlreadyLinked: false,
        authIntent: "login",
      }),
    ).toEqual({ allow: false, error: "no_portal_access" });
  });
});
