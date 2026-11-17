import { describe, expect, it } from "vitest";
import { SESSION_MINUTES, SLOT_MS } from "@/lib/booking-constants";

describe("unit smoke", () => {
  it("exposes the shared 60-minute session constant", () => {
    expect(SESSION_MINUTES).toBe(60);
    expect(SLOT_MS).toBe(60 * 60 * 1000);
  });
});
