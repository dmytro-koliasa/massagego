import { timingSafeEqual } from "crypto";

/**
 * Telegram webhook authentication (#77).
 *
 * Default is fail-closed: missing secret rejects requests.
 * Local-only bypass requires TELEGRAM_WEBHOOK_ALLOW_INSECURE=1 and a
 * non-production-like environment (not NODE_ENV=production and not
 * VERCEL_ENV=production|preview).
 */

export type TelegramWebhookAuthEnv = {
  secret: string | null;
  nodeEnv: string | undefined;
  vercelEnv: string | undefined;
  allowInsecure: boolean;
};

export type TelegramWebhookAuthResult =
  | { ok: true }
  | {
      ok: false;
      status: 401 | 503;
      error: "unauthorized" | "webhook_secret_required";
    };

export function readTelegramWebhookAuthEnv(): TelegramWebhookAuthEnv {
  return {
    secret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    allowInsecure: process.env.TELEGRAM_WEBHOOK_ALLOW_INSECURE?.trim() === "1",
  };
}

export function isTelegramWebhookProductionLike(
  env: Pick<TelegramWebhookAuthEnv, "nodeEnv" | "vercelEnv">,
): boolean {
  if (env.nodeEnv === "production") return true;
  const vercel = env.vercelEnv?.trim();
  return vercel === "production" || vercel === "preview";
}

function secretsEqual(expected: string, received: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function authorizeTelegramWebhook(
  headerToken: string | null,
  env: TelegramWebhookAuthEnv,
): TelegramWebhookAuthResult {
  const secret = env.secret?.trim() || null;

  if (!secret) {
    if (isTelegramWebhookProductionLike(env) || !env.allowInsecure) {
      return {
        ok: false,
        status: 503,
        error: "webhook_secret_required",
      };
    }
    return { ok: true };
  }

  if (!headerToken || !secretsEqual(secret, headerToken)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  return { ok: true };
}
