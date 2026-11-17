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
 * Thin adapter for P-3. Until EMAIL_PROVIDER is configured, development logs
 * the message and production refuses to send.
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

  // Real providers are wired when P-3 is chosen.
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
