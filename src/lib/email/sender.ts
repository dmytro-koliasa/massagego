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

/**
 * Email adapter (P-3). `EMAIL_PROVIDER=log|console` (default) logs locally.
 * `EMAIL_PROVIDER=resend` uses Resend with `RESEND_API_KEY` and `EMAIL_FROM`.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<EmailSendResult> {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  if (!provider || provider === "log" || provider === "console") {
    console.info("[email:log]", {
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return { ok: true, mode: "log" };
  }

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim();
    if (!apiKey || !from) {
      console.error("[email] Resend is selected but RESEND_API_KEY or EMAIL_FROM is missing");
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
        console.error("[email:resend]", result.error);
        return { ok: false, error: "send_failed" };
      }
      return { ok: true, mode: "provider" };
    } catch (error) {
      console.error("[email:resend]", error);
      return { ok: false, error: "send_failed" };
    }
  }

  if (process.env.NODE_ENV === "production") {
    console.error("[email] EMAIL_PROVIDER is set but no transport is wired", {
      provider,
    });
    return { ok: false, error: "email_not_configured" };
  }

  console.info("[email:unwired-provider]", {
    provider,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
  return { ok: true, mode: "log" };
}
