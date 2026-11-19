/**
 * #90 — shared requireMasseurSession gate.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
const findFirst = vi.fn();

vi.mock("@/auth/masseur", () => ({
  auth: () => auth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: (...args: unknown[]) => findFirst(...args),
    },
  },
}));

import { requireMasseurSession } from "@/lib/masseur-session.server";

describe("requireMasseurSession (#90)", () => {
  beforeEach(() => {
    auth.mockReset();
    findFirst.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    auth.mockResolvedValue(null);
    const gate = await requireMasseurSession();
    expect(gate).toHaveProperty("error");
    if (!("error" in gate)) return;
    expect(gate.error.status).toBe(401);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns 403 when the user is not an active masseur", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    findFirst.mockResolvedValue(null);
    const gate = await requireMasseurSession();
    expect(gate).toHaveProperty("error");
    if (!("error" in gate)) return;
    expect(gate.error.status).toBe(403);
  });

  it("returns userId for membership-only routes", async () => {
    auth.mockResolvedValue({ user: { id: "m1" } });
    findFirst.mockResolvedValue({ id: "m1", timezone: "Europe/Kyiv" });
    const gate = await requireMasseurSession();
    expect(gate).toEqual({ userId: "m1" });
  });

  it("includes timeZone when requested", async () => {
    auth.mockResolvedValue({ user: { id: "m1" } });
    findFirst.mockResolvedValue({ id: "m1", timezone: "Europe/Kyiv" });
    const gate = await requireMasseurSession({ withTimeZone: true });
    expect(gate).toEqual({ userId: "m1", timeZone: "Europe/Kyiv" });
  });

  it("rejects blocked/deleted masseurs via the shared query", async () => {
    auth.mockResolvedValue({ user: { id: "m1" } });
    findFirst.mockResolvedValue(null);
    await requireMasseurSession({ withTimeZone: true });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "m1",
          portal: "masseur",
          deletedAt: null,
          blockedAt: null,
        }),
      }),
    );
  });
});
