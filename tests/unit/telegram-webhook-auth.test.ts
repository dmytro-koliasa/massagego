import { describe, expect, it } from "vitest";
import {
  authorizeTelegramWebhook,
  isTelegramWebhookProductionLike,
  type TelegramWebhookAuthEnv,
} from "@/lib/telegram/webhook-auth";

function env(
  overrides: Partial<TelegramWebhookAuthEnv> = {},
): TelegramWebhookAuthEnv {
  return {
    secret: null,
    nodeEnv: "development",
    vercelEnv: undefined,
    allowInsecure: false,
    ...overrides,
  };
}

describe("isTelegramWebhookProductionLike", () => {
  it("treats NODE_ENV=production as production-like", () => {
    expect(
      isTelegramWebhookProductionLike({
        nodeEnv: "production",
        vercelEnv: undefined,
      }),
    ).toBe(true);
  });

  it("treats Vercel production and preview as production-like", () => {
    expect(
      isTelegramWebhookProductionLike({
        nodeEnv: "development",
        vercelEnv: "production",
      }),
    ).toBe(true);
    expect(
      isTelegramWebhookProductionLike({
        nodeEnv: "development",
        vercelEnv: "preview",
      }),
    ).toBe(true);
  });

  it("does not treat local development as production-like", () => {
    expect(
      isTelegramWebhookProductionLike({
        nodeEnv: "development",
        vercelEnv: undefined,
      }),
    ).toBe(false);
    expect(
      isTelegramWebhookProductionLike({
        nodeEnv: "test",
        vercelEnv: "development",
      }),
    ).toBe(false);
  });
});

describe("authorizeTelegramWebhook", () => {
  it("rejects missing secret in production-like mode", () => {
    expect(
      authorizeTelegramWebhook(null, env({ nodeEnv: "production" })),
    ).toEqual({
      ok: false,
      status: 503,
      error: "webhook_secret_required",
    });

    expect(
      authorizeTelegramWebhook("anything", env({ vercelEnv: "preview" })),
    ).toEqual({
      ok: false,
      status: 503,
      error: "webhook_secret_required",
    });
  });

  it("rejects missing secret locally when insecure opt-in is off", () => {
    expect(authorizeTelegramWebhook(null, env())).toEqual({
      ok: false,
      status: 503,
      error: "webhook_secret_required",
    });
  });

  it("allows missing secret only with explicit local insecure opt-in", () => {
    expect(
      authorizeTelegramWebhook(
        null,
        env({ allowInsecure: true, nodeEnv: "development" }),
      ),
    ).toEqual({ ok: true });
  });

  it("ignores insecure opt-in on production-like hosts", () => {
    expect(
      authorizeTelegramWebhook(
        null,
        env({
          allowInsecure: true,
          nodeEnv: "production",
        }),
      ),
    ).toEqual({
      ok: false,
      status: 503,
      error: "webhook_secret_required",
    });
  });

  it("rejects missing or invalid token when secret is configured", () => {
    const configured = env({ secret: "expected-secret" });

    expect(authorizeTelegramWebhook(null, configured)).toEqual({
      ok: false,
      status: 401,
      error: "unauthorized",
    });
    expect(authorizeTelegramWebhook("wrong", configured)).toEqual({
      ok: false,
      status: 401,
      error: "unauthorized",
    });
  });

  it("accepts a matching secret token", () => {
    expect(
      authorizeTelegramWebhook(
        "expected-secret",
        env({ secret: "expected-secret", nodeEnv: "production" }),
      ),
    ).toEqual({ ok: true });
  });
});
