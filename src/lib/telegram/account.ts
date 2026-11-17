import "server-only";
import { prisma } from "@/lib/prisma";
import { phonesMatch, samePersonContact } from "@/lib/telegram/phone";

export async function linkTelegramChatToUser(options: {
  userId: string;
  chatId: string;
}): Promise<
  | { ok: true }
  | { ok: false; error: "user_not_found" | "already_linked_other" }
> {
  const user = await prisma.user.findUnique({
    where: { id: options.userId },
    select: {
      id: true,
      email: true,
      phone: true,
      preferredLocale: true,
    },
  });
  if (!user) return { ok: false, error: "user_not_found" };

  const existing = await prisma.user.findMany({
    where: { telegramChatId: options.chatId },
    select: { id: true, email: true, phone: true },
  });

  for (const row of existing) {
    if (row.id === user.id) continue;
    if (!samePersonContact(user, row)) {
      return { ok: false, error: "already_linked_other" };
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      telegramChatId: options.chatId,
      telegramLinkedAt: new Date(),
      telegramAwaitingPhoneConfirm: true,
    },
  });

  return { ok: true };
}

export async function disconnectTelegramForUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      telegramChatId: null,
      telegramLinkedAt: null,
      telegramAwaitingPhoneConfirm: false,
      phoneConfirmedAt: null,
    },
  });
}

/** Bot /disconnect — clear every User row sharing this chat. */
export async function disconnectTelegramForChat(chatId: string): Promise<number> {
  const result = await prisma.user.updateMany({
    where: { telegramChatId: chatId },
    data: {
      telegramChatId: null,
      telegramLinkedAt: null,
      telegramAwaitingPhoneConfirm: false,
      phoneConfirmedAt: null,
    },
  });
  return result.count;
}

export async function requestPhoneConfirm(userId: string): Promise<
  | { ok: true; chatId: string; locale: "en" | "uk" }
  | { ok: false; error: "not_linked" }
> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      telegramChatId: true,
      preferredLocale: true,
    },
  });
  if (!user?.telegramChatId) {
    return { ok: false, error: "not_linked" };
  }
  await prisma.user.update({
    where: { id: userId },
    data: { telegramAwaitingPhoneConfirm: true },
  });
  return {
    ok: true,
    chatId: user.telegramChatId,
    locale: user.preferredLocale === "uk" ? "uk" : "en",
  };
}

export async function confirmPhoneFromContact(options: {
  chatId: string;
  telegramUserId: number;
  contactUserId: number | undefined;
  contactPhone: string;
}): Promise<
  | { ok: true; locale: "en" | "uk" }
  | {
      ok: false;
      error: "not_own_contact" | "not_linked" | "phone_mismatch";
      locale: "en" | "uk";
    }
> {
  const localeFallback = "en" as const;
  if (
    options.contactUserId === undefined ||
    options.contactUserId !== options.telegramUserId
  ) {
    return { ok: false, error: "not_own_contact", locale: localeFallback };
  }

  const candidates = await prisma.user.findMany({
    where: {
      telegramChatId: options.chatId,
      telegramAwaitingPhoneConfirm: true,
    },
    select: {
      id: true,
      phone: true,
      preferredLocale: true,
    },
    orderBy: { telegramLinkedAt: "desc" },
  });

  if (candidates.length === 0) {
    const any = await prisma.user.findFirst({
      where: { telegramChatId: options.chatId },
      select: { preferredLocale: true },
    });
    return {
      ok: false,
      error: "not_linked",
      locale: any?.preferredLocale === "uk" ? "uk" : "en",
    };
  }

  // Confirm only the portal that requested it most recently (Q15).
  let locale: "en" | "uk" =
    candidates[0].preferredLocale === "uk" ? "uk" : "en";
  const target = candidates.find((user) =>
    phonesMatch(user.phone, options.contactPhone),
  );

  if (!target) {
    await prisma.user.updateMany({
      where: {
        telegramChatId: options.chatId,
        telegramAwaitingPhoneConfirm: true,
      },
      data: { telegramAwaitingPhoneConfirm: false },
    });
    return { ok: false, error: "phone_mismatch", locale };
  }

  locale = target.preferredLocale === "uk" ? "uk" : "en";
  await prisma.user.update({
    where: { id: target.id },
    data: {
      phoneConfirmedAt: new Date(),
      telegramAwaitingPhoneConfirm: false,
    },
  });
  // Clear awaiting on sibling portal rows for this chat.
  await prisma.user.updateMany({
    where: {
      telegramChatId: options.chatId,
      telegramAwaitingPhoneConfirm: true,
      NOT: { id: target.id },
    },
    data: { telegramAwaitingPhoneConfirm: false },
  });

  return { ok: true, locale };
}

export async function getTelegramStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      telegramChatId: true,
      telegramLinkedAt: true,
      phoneConfirmedAt: true,
      phone: true,
    },
  });
  return {
    connected: Boolean(user?.telegramChatId),
    linkedAt: user?.telegramLinkedAt?.toISOString() ?? null,
    phoneConfirmed: Boolean(user?.phoneConfirmedAt),
    hasPhone: Boolean(user?.phone?.trim()),
  };
}
