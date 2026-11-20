/**
 * #124 — GET /api/auth/verify-email redirects to AUTH_URL only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const consumeVerificationToken = vi.hoisted(() => vi.fn());
const findUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/email/verification", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/email/verification")>();
  return {
    ...actual,
    consumeVerificationToken,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique,
    },
  },
}));

import { GET } from "@/app/api/auth/verify-email/route";

describe("GET /api/auth/verify-email redirect (#124)", () => {
  const previousAuthUrl = process.env.AUTH_URL;

  beforeEach(() => {
    consumeVerificationToken.mockReset();
    findUnique.mockReset();
  });

  afterEach(() => {
    if (previousAuthUrl === undefined) {
      delete process.env.AUTH_URL;
    } else {
      process.env.AUTH_URL = previousAuthUrl;
    }
  });

  it("redirects to AUTH_URL even when the request Host is evil", async () => {
    process.env.AUTH_URL = "https://trusted.example";
    consumeVerificationToken.mockResolvedValue({ ok: true, userId: "c1" });
    findUnique.mockResolvedValue({ portal: "client" });

    const res = await GET(
      new Request(
        "https://evil.example/api/auth/verify-email?token=raw-token-value",
      ),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://trusted.example/client?emailVerified=ok",
    );
    expect(res.headers.get("location")).not.toContain("evil.example");
  });

  it("returns 503 when AUTH_URL is missing instead of echoing the request host", async () => {
    delete process.env.AUTH_URL;

    const res = await GET(
      new Request("https://evil.example/api/auth/verify-email?token=x"),
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "auth_url_missing" });
    expect(consumeVerificationToken).not.toHaveBeenCalled();
  });
});
