import { vi } from "vitest";

/** Disable Postgres rate limits for booking/auth integration tests. */
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    checkRateLimit: vi.fn(async () => ({ ok: true as const })),
  };
});
