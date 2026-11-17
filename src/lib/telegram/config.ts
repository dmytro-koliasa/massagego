import "server-only";

export function telegramBotToken(): string | null {
  const value = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return value || null;
}

export function telegramBotUsername(): string | null {
  const value = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  return value || null;
}

export function telegramWebhookSecret(): string | null {
  const value = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  return value || null;
}

export function telegramConfigured(): boolean {
  return Boolean(telegramBotToken() && telegramBotUsername());
}
