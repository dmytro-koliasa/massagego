import "server-only";
import {
  removeKeyboard,
  sendTelegramMessage,
  shareContactKeyboard,
} from "@/lib/telegram/api";
import {
  confirmPhoneFromContact,
  disconnectTelegramForChat,
  linkTelegramChatToUser,
} from "@/lib/telegram/account";
import { consumeTelegramLinkToken } from "@/lib/telegram/link";
import { botText, type TelegramLocale } from "@/lib/telegram/texts";
import { prisma } from "@/lib/prisma";

type TelegramUpdate = {
  message?: {
    chat?: { id?: number };
    from?: { id?: number; language_code?: string };
    text?: string;
    contact?: {
      phone_number?: string;
      user_id?: number;
    };
  };
};

async function localeForChat(chatId: string): Promise<TelegramLocale> {
  const user = await prisma.user.findFirst({
    where: { telegramChatId: chatId },
    select: { preferredLocale: true },
    orderBy: { telegramLinkedAt: "desc" },
  });
  return user?.preferredLocale === "uk" ? "uk" : "en";
}

async function localeForUser(userId: string): Promise<TelegramLocale> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredLocale: true },
  });
  return user?.preferredLocale === "uk" ? "uk" : "en";
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message?.chat?.id) return;

  const chatId = String(message.chat.id);
  const fromId = message.from?.id;

  if (message.contact?.phone_number && fromId !== undefined) {
    const result = await confirmPhoneFromContact({
      chatId,
      telegramUserId: fromId,
      contactUserId: message.contact.user_id,
      contactPhone: message.contact.phone_number,
    });
    if (result.ok) {
      await sendTelegramMessage({
        chatId,
        text: botText(result.locale, "phoneConfirmed"),
        replyMarkup: removeKeyboard(),
      });
      return;
    }
    const key =
      result.error === "not_own_contact"
        ? "phoneNotOwnContact"
        : result.error === "phone_mismatch"
          ? "phoneMismatch"
          : "notLinked";
    await sendTelegramMessage({
      chatId,
      text: botText(result.locale, key),
      replyMarkup: removeKeyboard(),
    });
    return;
  }

  const text = message.text?.trim() ?? "";
  if (!text) return;

  if (text === "/disconnect" || text.startsWith("/disconnect@")) {
    const locale = await localeForChat(chatId);
    await disconnectTelegramForChat(chatId);
    await sendTelegramMessage({
      chatId,
      text: botText(locale, "disconnected"),
      replyMarkup: removeKeyboard(),
    });
    return;
  }

  if (text === "/start" || text.startsWith("/start ")) {
    const payload = text === "/start" ? "" : text.slice("/start ".length).trim();
    if (!payload) {
      const locale = await localeForChat(chatId);
      const linked = await prisma.user.count({
        where: { telegramChatId: chatId },
      });
      await sendTelegramMessage({
        chatId,
        text: botText(locale, linked > 0 ? "help" : "notLinked"),
      });
      return;
    }

    const consumed = await consumeTelegramLinkToken(payload);
    if (!consumed.ok) {
      await sendTelegramMessage({
        chatId,
        text: botText(
          "en",
          consumed.error === "expired_token" ? "linkExpired" : "linkInvalid",
        ),
      });
      return;
    }

    const locale = await localeForUser(consumed.userId);
    const linked = await linkTelegramChatToUser({
      userId: consumed.userId,
      chatId,
    });
    if (!linked.ok) {
      await sendTelegramMessage({
        chatId,
        text: botText(
          locale,
          linked.error === "already_linked_other"
            ? "alreadyLinkedOther"
            : "linkInvalid",
        ),
      });
      return;
    }

    await sendTelegramMessage({
      chatId,
      text: `${botText(locale, "linked")}\n\n${botText(locale, "sharePrompt")}`,
      replyMarkup: shareContactKeyboard(locale),
    });
    return;
  }

  if (text === "/help" || text.startsWith("/help@")) {
    const locale = await localeForChat(chatId);
    await sendTelegramMessage({
      chatId,
      text: botText(locale, "help"),
    });
  }
}
