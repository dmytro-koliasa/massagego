import "server-only";
import { telegramBotToken } from "@/lib/telegram/config";

type TelegramApiResult = { ok: true } | { ok: false; error: string };

async function callTelegramApi(
  method: string,
  body: Record<string, unknown>,
): Promise<TelegramApiResult> {
  const token = telegramBotToken();
  if (!token) {
    return { ok: false, error: "telegram_not_configured" };
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      description?: string;
    } | null;
    if (!response.ok || !data?.ok) {
      return {
        ok: false,
        error: data?.description || `telegram_http_${response.status}`,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "telegram_network_error",
    };
  }
}

export async function sendTelegramMessage(options: {
  chatId: string;
  text: string;
  replyMarkup?: Record<string, unknown>;
}): Promise<TelegramApiResult> {
  return callTelegramApi("sendMessage", {
    chat_id: options.chatId,
    text: options.text,
    disable_web_page_preview: true,
    ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
  });
}

export function shareContactKeyboard(locale: "en" | "uk") {
  return {
    keyboard: [
      [
        {
          text:
            locale === "uk"
              ? "Поділитися номером"
              : "Share my phone number",
          request_contact: true,
        },
      ],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

export function removeKeyboard() {
  return { remove_keyboard: true };
}
