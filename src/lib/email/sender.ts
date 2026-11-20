import "server-only";
import { Resend } from "resend";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailSendResult =
  | { ok: true; mode: "provider" | "log" }
  | { ok: false; error: "email_not_configured" | "send_failed" };

export type EmailSenderEnv = {
  EMAIL_PROVIDER?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
};

/**
 * Production-like hosts must not use the log/console adapter (#125).
 * Matches Telegram webhook production-like detection.
 */
export function isEmailProductionLike(
  env: Pick<EmailSenderEnv, "NODE_ENV" | "VERCEL_ENV">,
): boolean {
  if (env.NODE_ENV === "production") return true;
  const vercel = env.VERCEL_ENV?.trim();
  return vercel === "production" || vercel === "preview";
}

function isLogProvider(provider: string | undefined): boolean {
  return !provider || provider === "log" || provider === "console";
}

/**
 * Email adapter (P-3). `EMAIL_PROVIDER=log|console` (default) logs locally
 * outside production-like env. On production-like hosts, log/console/empty
 * returns `email_not_configured` without writing the body (#125).
 * `EMAIL_PROVIDER=resend` uses Resend with `RESEND_API_KEY` and `EMAIL_FROM`.
 */
export async function sendEmailWithEnv(
  input: SendEmailInput,
  env: EmailSenderEnv,
  log: Pick<Console, "info" | "error"> = console,
): Promise<EmailSendResult> {
  const provider = env.EMAIL_PROVIDER?.trim().toLowerCase();

  if (isLogProvider(provider)) {
    if (isEmailProductionLike(env)) {
      log.error(
        "[email] log/console provider is refused in production-like environments",
      );
      return { ok: false, error: "email_not_configured" };
    }
    log.info("[email:log]", {
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return { ok: true, mode: "log" };
  }

  if (provider === "resend") {
    const apiKey = env.RESEND_API_KEY?.trim();
    const from = env.EMAIL_FROM?.trim();
    if (!apiKey || !from) {
      log.error(
        "[email] Resend is selected but RESEND_API_KEY or EMAIL_FROM is missing",
      );
      return { ok: false, error: "email_not_configured" };
    }
    try {
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      if (result.error) {
        log.error("[email:resend]", result.error);
        return { ok: false, error: "send_failed" };
      }
      return { ok: true, mode: "provider" };
    } catch (error) {
      log.error("[email:resend]", error);
      return { ok: false, error: "send_failed" };
    }
  }

  if (isEmailProductionLike(env)) {
    log.error("[email] EMAIL_PROVIDER is set but no transport is wired", {
      provider,
    });
    return { ok: false, error: "email_not_configured" };
  }

  log.info("[email:unwired-provider]", {
    provider,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
  return { ok: true, mode: "log" };
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<EmailSendResult> {
  return sendEmailWithEnv(input, process.env);
}
