/**
 * #124 — auth links and verify redirects use AUTH_URL only.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildTrustedAppUrl,
  resolveTrustedAppOrigin,
} from "@/lib/auth/trusted-origin";
import {
  emailVerifyLinkPath,
} from "@/lib/email/verification";
import {
  passwordResetLinkPath,
} from "@/lib/email/password-reset";

describe("resolveTrustedAppOrigin (#124)", () => {
  it("returns the AUTH_URL origin without a trailing slash", () => {
    expect(
      resolveTrustedAppOrigin({ AUTH_URL: "https://app.example/" }),
    ).toEqual({ ok: true, origin: "https://app.example" });
  });

  it("ignores path on AUTH_URL and keeps host+port", () => {
    expect(
      resolveTrustedAppOrigin({
        AUTH_URL: "http://localhost:3000/unused",
      }),
    ).toEqual({ ok: true, origin: "http://localhost:3000" });
  });

  it("rejects missing AUTH_URL", () => {
    expect(resolveTrustedAppOrigin({})).toEqual({
      ok: false,
      error: "auth_url_missing",
    });
    expect(resolveTrustedAppOrigin({ AUTH_URL: "   " })).toEqual({
      ok: false,
      error: "auth_url_missing",
    });
  });

  it("rejects non-http(s) and unparseable values", () => {
    expect(resolveTrustedAppOrigin({ AUTH_URL: "not a url" })).toEqual({
      ok: false,
      error: "auth_url_invalid",
    });
    expect(resolveTrustedAppOrigin({ AUTH_URL: "ftp://app.example" })).toEqual({
      ok: false,
      error: "auth_url_invalid",
    });
  });
});

describe("auth link hosts ignore request URL (#124)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds reset and verify URLs from AUTH_URL when the request host is evil", () => {
    const authUrl = "https://massagego.example";
    const evilRequest = new Request(
      "https://evil.example/api/auth/password-reset/request",
      { method: "POST" },
    );

    // Reproduce the pre-fix pattern: request origin must not win.
    const requestOrigin = new URL(evilRequest.url).origin;
    expect(requestOrigin).toBe("https://evil.example");

    const trusted = resolveTrustedAppOrigin({ AUTH_URL: authUrl });
    expect(trusted.ok).toBe(true);
    if (!trusted.ok) return;

    const resetUrl = buildTrustedAppUrl(
      trusted.origin,
      passwordResetLinkPath("masseur", "abc123"),
    );
    const verifyUrl = buildTrustedAppUrl(
      trusted.origin,
      emailVerifyLinkPath("tok456"),
    );

    expect(resetUrl).toBe(
      "https://massagego.example/masseur/login?resetToken=abc123",
    );
    expect(verifyUrl).toBe(
      "https://massagego.example/api/auth/verify-email?token=tok456",
    );
    expect(resetUrl.startsWith(requestOrigin)).toBe(false);
    expect(verifyUrl.startsWith(requestOrigin)).toBe(false);
    expect(resetUrl).not.toContain("evil.example");
    expect(verifyUrl).not.toContain("evil.example");
  });

  it("does not fall back to a request host when AUTH_URL is missing", () => {
    const evilOrigin = new URL("https://evil.example/x").origin;
    const trusted = resolveTrustedAppOrigin({ AUTH_URL: undefined });
    expect(trusted.ok).toBe(false);
    if (trusted.ok) return;
    expect(trusted.error).toBe("auth_url_missing");
    // Callers must not substitute evilOrigin.
    expect(evilOrigin).toBe("https://evil.example");
  });
});
