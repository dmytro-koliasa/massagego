/**
 * #125 — refuse log/console mailer in production-like environments.
 */
import { describe, expect, it, vi } from "vitest";
import {
  isEmailProductionLike,
  sendEmailWithEnv,
} from "@/lib/email/sender";

const sample = {
  to: "user@example.com",
  subject: "Reset",
  text: "https://app.example/reset?token=secret",
  html: "<p>reset</p>",
};

describe("isEmailProductionLike (#125)", () => {
  it("is true for NODE_ENV=production", () => {
    expect(isEmailProductionLike({ NODE_ENV: "production" })).toBe(true);
  });

  it("is true for VERCEL_ENV production or preview", () => {
    expect(isEmailProductionLike({ VERCEL_ENV: "production" })).toBe(true);
    expect(isEmailProductionLike({ VERCEL_ENV: "preview" })).toBe(true);
  });

  it("is false for local/test", () => {
    expect(isEmailProductionLike({ NODE_ENV: "development" })).toBe(false);
    expect(isEmailProductionLike({ NODE_ENV: "test" })).toBe(false);
    expect(isEmailProductionLike({})).toBe(false);
  });
});

describe("sendEmailWithEnv log guard (#125)", () => {
  it("logs and succeeds for local EMAIL_PROVIDER=log", async () => {
    const log = { info: vi.fn(), error: vi.fn() };
    const result = await sendEmailWithEnv(
      sample,
      { NODE_ENV: "test", EMAIL_PROVIDER: "log" },
      log,
    );
    expect(result).toEqual({ ok: true, mode: "log" });
    expect(log.info).toHaveBeenCalledWith(
      "[email:log]",
      expect.objectContaining({ to: sample.to, text: sample.text }),
    );
    expect(log.error).not.toHaveBeenCalled();
  });

  it("refuses empty/log/console on NODE_ENV=production without printing body", async () => {
    for (const provider of [undefined, "log", "console", "  LOG  "]) {
      const log = { info: vi.fn(), error: vi.fn() };
      const result = await sendEmailWithEnv(
        sample,
        { NODE_ENV: "production", EMAIL_PROVIDER: provider },
        log,
      );
      expect(result).toEqual({ ok: false, error: "email_not_configured" });
      expect(log.info).not.toHaveBeenCalled();
      expect(log.error).toHaveBeenCalled();
    }
  });

  it("refuses log provider when VERCEL_ENV=preview", async () => {
    const log = { info: vi.fn(), error: vi.fn() };
    const result = await sendEmailWithEnv(
      sample,
      { NODE_ENV: "development", VERCEL_ENV: "preview", EMAIL_PROVIDER: "log" },
      log,
    );
    expect(result).toEqual({ ok: false, error: "email_not_configured" });
    expect(log.info).not.toHaveBeenCalled();
  });
});
