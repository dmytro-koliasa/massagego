import { describe, expect, it } from "vitest";
import {
  portalContinuePath,
  resolveSafePortalCallback,
} from "@/lib/safe-internal-path";

describe("resolveSafePortalCallback (#207)", () => {
  it("falls back for missing/empty values", () => {
    expect(resolveSafePortalCallback("client", null)).toBe("/client");
    expect(resolveSafePortalCallback("client", "  ")).toBe("/client");
    expect(resolveSafePortalCallback("masseur", undefined)).toBe(
      "/masseur/dashboard",
    );
  });

  it("allows same-portal paths with catalog query", () => {
    expect(
      resolveSafePortalCallback("client", "/client?city=all&page=2"),
    ).toBe("/client?city=all&page=2");
    expect(
      resolveSafePortalCallback(
        "client",
        "/client?city=id%3AChIJ123&page=1",
      ),
    ).toBe("/client?city=id%3AChIJ123&page=1");
  });

  it("rejects external, protocol-relative, and cross-portal destinations", () => {
    expect(
      resolveSafePortalCallback("client", "https://evil.example/phish"),
    ).toBe("/client");
    expect(resolveSafePortalCallback("client", "//evil.example")).toBe(
      "/client",
    );
    expect(resolveSafePortalCallback("client", "/masseur/dashboard")).toBe(
      "/client",
    );
    expect(resolveSafePortalCallback("client", "/client/login")).toBe(
      "/client",
    );
    expect(resolveSafePortalCallback("client", "/client/login?x=1")).toBe(
      "/client",
    );
    expect(resolveSafePortalCallback("client", "\\/evil")).toBe("/client");
    expect(
      resolveSafePortalCallback("client", "javascript:alert(1)"),
    ).toBe("/client");
  });

  it("rejects login-loop and wrong portal for masseur/admin", () => {
    expect(resolveSafePortalCallback("masseur", "/client")).toBe(
      "/masseur/dashboard",
    );
    expect(resolveSafePortalCallback("admin", "/admin/users")).toBe(
      "/admin/users",
    );
    expect(resolveSafePortalCallback("admin", "/client")).toBe("/admin");
  });

  it("rejects encoded, double-encoded, and malformed redirect tricks (#207 SR)", () => {
    // Encoded protocol-relative / open-redirect probes
    expect(resolveSafePortalCallback("client", "/%2f%2fevil.example")).toBe(
      "/client",
    );
    expect(resolveSafePortalCallback("client", "/%2F%2Fevil.example")).toBe(
      "/client",
    );
    expect(
      resolveSafePortalCallback("client", "/%252f%252fevil.example"),
    ).toBe("/client");
    expect(resolveSafePortalCallback("client", "/\\evil.example")).toBe(
      "/client",
    );
    expect(resolveSafePortalCallback("client", "\\\\evil.example")).toBe(
      "/client",
    );
    expect(resolveSafePortalCallback("client", "http:evil.example")).toBe(
      "/client",
    );
    expect(resolveSafePortalCallback("client", "/client@evil.example")).toBe(
      "/client",
    );
    expect(resolveSafePortalCallback("client", "///evil.example")).toBe(
      "/client",
    );
    expect(resolveSafePortalCallback("client", "/client/../masseur")).toBe(
      "/client",
    );
    expect(
      resolveSafePortalCallback("client", "/client/%2e%2e/masseur"),
    ).toBe("/client");
    expect(
      resolveSafePortalCallback("client", "/client/%252e%252e/masseur"),
    ).toBe("/client");
    expect(resolveSafePortalCallback("client", "?city=all")).toBe("/client");
    expect(resolveSafePortalCallback("client", "client")).toBe("/client");
  });

  it("allows legitimate catalog deep links after query decoding", () => {
    expect(
      resolveSafePortalCallback(
        "client",
        "/client?city=id%3Ae2e-place-kyiv&page=2",
      ),
    ).toBe("/client?city=id%3Ae2e-place-kyiv&page=2");
    expect(
      resolveSafePortalCallback("masseur", "/masseur/notifications"),
    ).toBe("/masseur/notifications");
    expect(
      resolveSafePortalCallback("admin", "/admin/complaints?tab=open"),
    ).toBe("/admin/complaints?tab=open");
  });
});

describe("portalContinuePath (#207)", () => {
  it("joins pathname and search for deep-link next=", () => {
    expect(portalContinuePath("/client", "?city=all&page=2")).toBe(
      "/client?city=all&page=2",
    );
    expect(portalContinuePath("/client", "")).toBe("/client");
    expect(portalContinuePath("/client", "city=all")).toBe(
      "/client?city=all",
    );
  });
});
