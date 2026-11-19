import { describe, expect, it, vi } from "vitest";
import {
  logRouteError,
  redactForLog,
  sanitizeErrorForLog,
} from "@/lib/http/route-error";

describe("redactForLog", () => {
  it("redacts emails and phone-like strings", () => {
    expect(
      redactForLog("fail for user@example.com at +380501112233"),
    ).toBe("fail for [email] at [phone]");
  });

  it("caps length", () => {
    expect(redactForLog("x".repeat(600), 20)).toHaveLength(20);
  });
});

describe("sanitizeErrorForLog", () => {
  it("keeps Error name and redacted message", () => {
    const sanitized = sanitizeErrorForLog(
      new Error("db failed for kolya@test.local"),
    );
    expect(sanitized.name).toBe("Error");
    expect(sanitized.message).toBe("db failed for [email]");
    expect(sanitized.code).toBeUndefined();
  });

  it("includes string code when present", () => {
    const err = Object.assign(new Error("unique"), { code: "P2002" });
    expect(sanitizeErrorForLog(err).code).toBe("P2002");
  });

  it("handles non-Error values without dumping objects", () => {
    expect(sanitizeErrorForLog({ secret: "x" })).toEqual({
      name: "UnknownError",
      message: "non_error_thrown",
    });
  });
});

describe("logRouteError", () => {
  it("logs route tag and sanitized payload", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logRouteError("bookings/cancel", new Error("boom a@b.co"));
    expect(spy).toHaveBeenCalledWith("[bookings/cancel]", {
      name: "Error",
      message: "boom [email]",
    });
    spy.mockRestore();
  });
});
