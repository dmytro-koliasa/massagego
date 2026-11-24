/**
 * #88 — complaints POST uses the shared X-Portal dual-session gate.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePortalUser = vi.fn();
const checkRateLimit = vi.fn();
const createComplaint = vi.fn();

vi.mock("@/lib/portal-session.server", () => ({
  requirePortalUser: (...args: unknown[]) => requirePortalUser(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    complaintCreate: { limit: 5, windowMs: 60 * 60 * 1000 },
  },
  rateLimitKey: (scope: string, subject: string) => `${scope}:${subject}`,
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
}));

vi.mock("@/lib/request-ip", () => ({
  getClientIp: () => "203.0.113.10",
}));

vi.mock("@/lib/complaints", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/complaints")>();
  return {
    ...actual,
    createComplaint: (...args: unknown[]) => createComplaint(...args),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/lib/http/route-error", () => ({
  logRouteError: vi.fn(),
}));

import { POST } from "@/app/api/complaints/route";

describe("POST /api/complaints portal gate (#88)", () => {
  beforeEach(() => {
    requirePortalUser.mockReset();
    checkRateLimit.mockReset();
    createComplaint.mockReset();
    checkRateLimit.mockResolvedValue({ ok: true });
  });

  it("returns 409 ambiguous_portal when the gate rejects dual sessions", async () => {
    requirePortalUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "ambiguous_portal" }, { status: 409 }),
    });

    const res = await POST(
      new Request("http://test/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: "b1",
          category: "rude",
          body: "late and rude",
        }),
      }),
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "ambiguous_portal" });
    expect(createComplaint).not.toHaveBeenCalled();
  });

  it("attributes the complaint to the X-Portal masseur reporter", async () => {
    requirePortalUser.mockResolvedValue({
      ok: true,
      userId: "m1",
      portal: "masseur",
    });
    createComplaint.mockResolvedValue({ ok: true, id: "c1" });

    const res = await POST(
      new Request("http://test/api/complaints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-portal": "masseur",
        },
        body: JSON.stringify({
          bookingId: "b1",
          category: "rude",
          body: "late and rude",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(createComplaint).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reporterId: "m1",
        reporterPortal: "masseur",
        bookingId: "b1",
      }),
    );
  });
});
