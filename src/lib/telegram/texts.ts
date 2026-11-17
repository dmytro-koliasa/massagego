export type TelegramLocale = "en" | "uk";

export function botText(
  locale: TelegramLocale,
  key:
    | "linked"
    | "linkInvalid"
    | "linkExpired"
    | "alreadyLinkedOther"
    | "sharePrompt"
    | "phoneConfirmed"
    | "phoneMismatch"
    | "phoneNotOwnContact"
    | "disconnected"
    | "notLinked"
    | "help",
): string {
  const uk = locale === "uk";
  switch (key) {
    case "linked":
      return uk
        ? "Telegram підключено. Ви отримуватимете сповіщення про бронювання тут."
        : "Telegram connected. You will receive booking notices here.";
    case "linkInvalid":
      return uk
        ? "Посилання недійсне. Відкрийте нове з налаштувань сповіщень у застосунку."
        : "This link is invalid. Open a new one from notification settings in the app.";
    case "linkExpired":
      return uk
        ? "Посилання прострочене (15 хв). Згенеруйте нове в застосунку."
        : "This link expired (15 min). Generate a new one in the app.";
    case "alreadyLinkedOther":
      return uk
        ? "Цей Telegram уже прив’язаний до іншого облікового запису."
        : "This Telegram account is already linked to another account.";
    case "sharePrompt":
      return uk
        ? "За бажанням підтвердіть номер: натисніть «Поділитися номером». Це необов’язково для бронювань."
        : "Optionally confirm your phone: tap “Share my phone number”. This is not required to book.";
    case "phoneConfirmed":
      return uk
        ? "Номер підтверджено. Дякуємо."
        : "Phone number confirmed. Thank you.";
    case "phoneMismatch":
      return uk
        ? "Номер у Telegram не збігається з номером у застосунку. Оновіть телефон у профілі застосунку, потім спробуйте знову."
        : "The Telegram number does not match your app account phone. Update your phone in the app profile, then try again.";
    case "phoneNotOwnContact":
      return uk
        ? "Можна підтвердити лише власний контакт Telegram."
        : "You can only confirm your own Telegram contact.";
    case "disconnected":
      return uk
        ? "Telegram від’єднано від облікового запису."
        : "Telegram disconnected from your account.";
    case "notLinked":
      return uk
        ? "Цей чат не прив’язаний. Відкрийте посилання з налаштувань сповіщень у застосунку."
        : "This chat is not linked. Open the link from notification settings in the app.";
    case "help":
      return uk
        ? "Команди: /disconnect — від’єднати. Підключення — лише з посилання в застосунку."
        : "Commands: /disconnect — unlink. Connect only via the link in the app.";
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}
