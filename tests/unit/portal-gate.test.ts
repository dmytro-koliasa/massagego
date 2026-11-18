import { beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();
const clientAuth = vi.fn();
const masseurAuth = vi.fn();
const findUnique = vi.fn();

vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

vi.mock("@/auth/client", () => ({
  auth: () => clientAuth(),
}));

vi.mock("@/auth/masseur", () => ({
  auth: () => masseurAuth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

import { requirePortalUser } from "@/lib/notifications/portal-gate";
import { PORTAL_REQUEST_HEADER } from "@/lib/portals";

function headerMap(values: Record<string, string>) {
  return {
    get(name: string) {
      return values[name.toLowerCase()] ?? null;
    },
  };
}

describe("requirePortalUser", () => {
  beforeEach(() => {
    headersMock.mockReset();
    clientAuth.mockReset();
    masseurAuth.mockReset();
    findUnique.mockReset();
    headersMock.mockResolvedValue(headerMap({}));
    clientAuth.mockResolvedValue(null);
    masseurAuth.mockResolvedValue(null);
  });

  it("returns the only active session without a hint", async () => {
    masseurAuth.mockResolvedValue({ user: { id: "m1" } });
    findUnique.mockResolvedValue({ portal: "masseur", deletedAt: null });

    const gate = await requirePortalUser();
    expect(gate).toEqual({ ok: true, userId: "m1", portal: "masseur" });
  });

  it("prefers the X-Portal hint when both sessions are present", async () => {
    headersMock.mockResolvedValue(
      headerMap({ [PORTAL_REQUEST_HEADER]: "masseur" }),
    );
    clientAuth.mockResolvedValue({ user: { id: "c1" } });
    masseurAuth.mockResolvedValue({ user: { id: "m1" } });
    findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id === "c1") {
          return { portal: "client", deletedAt: null };
        }
        if (where.id === "m1") {
          return { portal: "masseur", deletedAt: null };
        }
        return null;
      },
    );

    const gate = await requirePortalUser();
    expect(gate).toEqual({ ok: true, userId: "m1", portal: "masseur" });
  });

  it("returns 409 ambiguous_portal when both sessions exist without a hint", async () => {
    clientAuth.mockResolvedValue({ user: { id: "c1" } });
    masseurAuth.mockResolvedValue({ user: { id: "m1" } });
    findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id === "c1") {
          return { portal: "client", deletedAt: null };
        }
        if (where.id === "m1") {
          return { portal: "masseur", deletedAt: null };
        }
        return null;
      },
    );

    const gate = await requirePortalUser();
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.response.status).toBe(409);
    await expect(gate.response.json()).resolves.toEqual({
      error: "ambiguous_portal",
    });
  });

  it("returns 401 when the hint portal session is missing", async () => {
    headersMock.mockResolvedValue(
      headerMap({ [PORTAL_REQUEST_HEADER]: "masseur" }),
    );
    clientAuth.mockResolvedValue({ user: { id: "c1" } });
    findUnique.mockResolvedValue({ portal: "client", deletedAt: null });

    const gate = await requirePortalUser();
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.response.status).toBe(401);
  });
});
