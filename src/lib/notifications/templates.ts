import type { Locale } from "@/lib/i18n";
import { dictionaries } from "@/lib/i18n";
import type {
  NotificationEventType,
  NotificationPayload,
} from "@/lib/notifications/types";
import { DateTime } from "luxon";

function formatSlot(payload: NotificationPayload): string {
  const dt = DateTime.fromISO(payload.slotStartIso, {
    zone: payload.timeZone,
  });
  const when = dt.isValid
    ? dt.toFormat("dd LLL yyyy, HH:mm")
    : payload.slotStartIso;
  return `${when} (${payload.timeZoneLabel})`;
}

function cancelReasonLine(
  locale: Locale,
  payload: NotificationPayload,
): string | null {
  if (!payload.cancelReasonKey) return null;
  const dict = dictionaries[locale];
  const key =
    `cancelReason_${payload.cancelReasonKey}` as keyof typeof dict;
  const label =
    typeof dict[key] === "string"
      ? (dict[key] as string)
      : payload.cancelReasonKey;
  if (payload.cancelReasonKey === "other" && payload.cancelReasonText?.trim()) {
    return `${label}: ${payload.cancelReasonText.trim()}`;
  }
  if (payload.cancelReasonKey === "client_account_deleted") {
    return locale === "uk"
      ? "Причина: клієнт видалив обліковий запис"
      : "Reason: client deleted their account";
  }
  return locale === "uk" ? `Причина: ${label}` : `Reason: ${label}`;
}

function openLink(locale: Locale, origin: string, path: string): string {
  const url = `${origin.replace(/\/$/, "")}${path}`;
  return locale === "uk" ? `Відкрити в застосунку: ${url}` : `Open in app: ${url}`;
}

function massageLine(locale: Locale, massageType: string | null): string | null {
  if (!massageType?.trim()) return null;
  return locale === "uk"
    ? `Тип масажу: ${massageType}`
    : `Massage type: ${massageType}`;
}

type RenderedEmail = { subject: string; text: string; html: string };

function wrapHtml(text: string): string {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "<br/>");
  return `<!doctype html><html><body style="font-family:sans-serif;line-height:1.5">${escaped}</body></html>`;
}

export function renderNotificationEmail(
  eventType: NotificationEventType,
  payload: NotificationPayload,
  origin: string,
): RenderedEmail {
  const locale = payload.locale === "uk" ? "uk" : "en";
  const slot = formatSlot(payload);
  const link = openLink(locale, origin, payload.appPath);
  const massage = massageLine(locale, payload.massageType);
  const reason = cancelReasonLine(locale, payload);

  const lines: string[] = [];
  let subject: string;

  switch (eventType) {
    case "booking_created":
      subject =
        locale === "uk" ? "Нове бронювання" : "New booking";
      lines.push(
        locale === "uk"
          ? `${payload.otherPartyName} записався(лась) на сеанс.`
          : `${payload.otherPartyName} booked a session.`,
        slot,
      );
      break;
    case "booking_confirmed":
      subject =
        locale === "uk" ? "Підтвердження бронювання" : "Booking confirmation";
      lines.push(
        locale === "uk"
          ? `Ваш сеанс з ${payload.otherPartyName} підтверджено.`
          : `Your session with ${payload.otherPartyName} is confirmed.`,
        slot,
      );
      break;
    case "booking_cancelled_by_client":
      subject =
        locale === "uk"
          ? "Клієнт скасував бронювання"
          : "Client cancelled a booking";
      lines.push(
        locale === "uk"
          ? `${payload.otherPartyName} скасував(ла) сеанс.`
          : `${payload.otherPartyName} cancelled a session.`,
        slot,
      );
      break;
    case "booking_cancelled_by_masseur":
      subject =
        locale === "uk"
          ? "Масажист скасував бронювання"
          : "Masseur cancelled a booking";
      lines.push(
        locale === "uk"
          ? `${payload.otherPartyName} скасував(ла) ваш сеанс.`
          : `${payload.otherPartyName} cancelled your session.`,
        slot,
      );
      break;
    case "booking_cancelled_client_deleted":
      subject =
        locale === "uk"
          ? "Бронювання скасовано (акаунт клієнта видалено)"
          : "Booking cancelled (client account deleted)";
      lines.push(
        locale === "uk"
          ? `Сеанс з ${payload.otherPartyName} скасовано автоматично.`
          : `The session with ${payload.otherPartyName} was cancelled automatically.`,
        slot,
      );
      break;
    default: {
      const _exhaustive: never = eventType;
      throw new Error(`Unknown event: ${_exhaustive}`);
    }
  }

  if (massage) lines.push(massage);
  if (reason) lines.push(reason);
  lines.push(link);

  const text = lines.join("\n");
  return { subject, text, html: wrapHtml(text) };
}

/** Plain Telegram body — same facts as email, no HTML. */
export function renderNotificationTelegram(
  eventType: NotificationEventType,
  payload: NotificationPayload,
  origin: string,
): { text: string } {
  const email = renderNotificationEmail(eventType, payload, origin);
  return { text: `${email.subject}\n\n${email.text}` };
}

/** Guard for tests: rendered bodies must not contain phone-like digits runs. */
export function emailBodyLooksPhoneFree(text: string): boolean {
  // Reject E.164-ish or long digit groups that look like phone numbers.
  return !/\+?\d[\d\s()-]{8,}\d/.test(text);
}
