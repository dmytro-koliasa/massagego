/**
 * #114 — GET /api/bookings requires bounded from/to.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireClientSession = vi.fn();
const findMany = vi.fn();

vi.mock("@/lib/client-session.server", () => ({
  requireClientSession: (...args: unknown[]) => requireClientSession(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findMany: (...args: unknown[]) => findMany(...args),
    },
  },
}));

vi.mock("@/lib/http/route-error", () => ({
  logRouteError: vi.fn(),
}));

import { GET } from "@/app/api/bookings/route";

describe("GET /api/bookings date range (#114)", () => {
  beforeEach(() => {
    requireClientSession.mockReset();
    findMany.mockReset();
    requireClientSession.mockResolvedValue({ ok: true, userId: "c1" });
    findMany.mockResolvedValue([]);
  });

  it("returns invalid_range when from/to are missing", async () => {
    const res = await GET(new Request("http://test/api/bookings"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_range" });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns range_too_large when span exceeds 366 days", async () => {
    const from = "2020-01-01T00:00:00.000Z";
    const to = "2022-01-01T00:00:00.000Z";
    const res = await GET(
      new Request(
        `http://test/api/bookings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "range_too_large" });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("queries with required bounds for a valid week", async () => {
    const from = "2026-06-01T00:00:00.000Z";
    const to = "2026-06-08T00:00:00.000Z";
    const res = await GET(
      new Request(
        `http://test/api/bookings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
    );
    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          slotStart: expect.objectContaining({
            gte: new Date(from),
            lt: new Date(to),
          }),
        }),
      }),
    );
  });
});
