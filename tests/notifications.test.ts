import { describe, expect, it } from "vitest";
import {
  isEmailLocked,
  isTelegramLocked,
  validatePreferencePatches,
  eventsForPortal,
  defaultEmailEnabled,
} from "@/lib/notifications/pref-rules";
import { isPastRetryWindow, nextRetryAt } from "@/lib/notifications/retry";
import {
  emailBodyLooksPhoneFree,
  renderNotificationEmail,
  renderNotificationTelegram,
} from "@/lib/notifications/templates";
import type { NotificationPayload } from "@/lib/notifications/types";
import { phonesMatch, samePersonContact } from "@/lib/telegram/phone";
import { botText } from "@/lib/telegram/texts";

const basePayload: NotificationPayload = {
  locale: "en",
  slotStartIso: "2026-12-01T08:00:00.000Z",
  timeZone: "Europe/Kyiv",
  timeZoneLabel: "Kyiv, UTC+2",
  massageType: "classic",
  otherPartyName: "Olena",
  cancelReasonKey: null,
  cancelReasonText: null,
  appPath: "/client",
};

describe("notification preferences", () => {
  it("defaults email on for every event", () => {
    expect(defaultEmailEnabled("booking_created")).toBe(true);
    expect(defaultEmailEnabled("booking_confirmed")).toBe(true);
  });

  it("locks critical email until Telegram can cover it", () => {
    expect(isEmailLocked("booking_created")).toBe(false);
    expect(
      isEmailLocked("booking_confirmed", {
        telegramConnected: false,
        telegramEnabled: false,
      }),
    ).toBe(true);
    expect(
      isEmailLocked("booking_confirmed", {
        telegramConnected: true,
        telegramEnabled: true,
      }),
    ).toBe(false);
    expect(
      isEmailLocked("booking_confirmed", {
        telegramConnected: true,
        telegramEnabled: false,
      }),
    ).toBe(true);
  });

  it("locks telegram until connected or when email is off for critical", () => {
    expect(
      isTelegramLocked("booking_confirmed", {
        telegramConnected: false,
        emailEnabled: true,
      }),
    ).toBe(true);
    expect(
      isTelegramLocked("booking_confirmed", {
        telegramConnected: true,
        emailEnabled: false,
      }),
    ).toBe(true);
    expect(
      isTelegramLocked("booking_confirmed", {
        telegramConnected: true,
        emailEnabled: true,
      }),
    ).toBe(false);
  });

  it("rejects turning off the last critical channel", () => {
    const result = validatePreferencePatches(
      "client",
      [{ eventType: "booking_confirmed", emailEnabled: false }],
      {
        telegramConnected: false,
        current: {
          booking_confirmed: { emailEnabled: true, telegramEnabled: false },
        },
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("critical_channel_required");
  });

  it("allows turning off critical email when telegram stays on", () => {
    const result = validatePreferencePatches(
      "client",
      [{ eventType: "booking_confirmed", emailEnabled: false }],
      {
        telegramConnected: true,
        current: {
          booking_confirmed: { emailEnabled: true, telegramEnabled: true },
        },
      },
    );
    expect(result.ok).toBe(true);
  });

  it("allows turning off new-booking email for masseurs", () => {
    const result = validatePreferencePatches(
      "masseur",
      [{ eventType: "booking_created", emailEnabled: false }],
      {
        telegramConnected: false,
        current: {
          booking_created: { emailEnabled: true, telegramEnabled: false },
        },
      },
    );
    expect(result.ok).toBe(true);
  });

  it("scopes events by portal", () => {
    expect(eventsForPortal("masseur")).toContain("booking_created");
    expect(eventsForPortal("masseur")).not.toContain("booking_confirmed");
    expect(eventsForPortal("client")).toContain("booking_confirmed");
    expect(eventsForPortal("client")).not.toContain("booking_created");
  });
});

describe("notification retry backoff", () => {
  it("uses 1 → 5 → 15 → 30 minute steps", () => {
    const from = new Date("2026-11-17T10:00:00.000Z");
    expect(nextRetryAt(1, from).toISOString()).toBe(
      "2026-11-17T10:01:00.000Z",
    );
    expect(nextRetryAt(2, from).toISOString()).toBe(
      "2026-11-17T10:05:00.000Z",
    );
    expect(nextRetryAt(3, from).toISOString()).toBe(
      "2026-11-17T10:15:00.000Z",
    );
    expect(nextRetryAt(4, from).toISOString()).toBe(
      "2026-11-17T10:30:00.000Z",
    );
    expect(nextRetryAt(8, from).toISOString()).toBe(
      "2026-11-17T10:30:00.000Z",
    );
  });

  it("marks rows older than 24h as past the retry window", () => {
    const createdAt = new Date("2026-11-16T10:00:00.000Z");
    const now = new Date("2026-11-17T10:00:00.000Z");
    expect(isPastRetryWindow(createdAt, now)).toBe(true);
    expect(
      isPastRetryWindow(createdAt, new Date("2026-11-17T09:59:59.000Z")),
    ).toBe(false);
  });
});

describe("notification templates", () => {
  it("renders short transactional copy without phones", () => {
    const rendered = renderNotificationEmail(
      "booking_confirmed",
      {
        ...basePayload,
        otherPartyName: "Olena +380501112233",
      },
      "https://example.com",
    );
    const clean = renderNotificationEmail(
      "booking_confirmed",
      basePayload,
      "https://example.com",
    );
    expect(clean.subject.toLowerCase()).toContain("confirm");
    expect(clean.text).toContain("Open in app:");
    expect(clean.text).toContain("Kyiv, UTC+2");
    expect(emailBodyLooksPhoneFree(clean.text)).toBe(true);
    expect(emailBodyLooksPhoneFree(rendered.text)).toBe(false);

    const tg = renderNotificationTelegram(
      "booking_confirmed",
      basePayload,
      "https://example.com",
    );
    expect(tg.text).toContain("Booking confirmation");
    expect(emailBodyLooksPhoneFree(tg.text)).toBe(true);
  });

  it("includes client cancel reason", () => {
    const rendered = renderNotificationEmail(
      "booking_cancelled_by_client",
      {
        ...basePayload,
        cancelReasonKey: "circumstances_changed",
      },
      "https://example.com",
    );
    expect(rendered.text.toLowerCase()).toContain("reason");
  });
});

describe("telegram helpers", () => {
  it("matches phones across telegram formatting", () => {
    expect(phonesMatch("+380501112233", "380501112233")).toBe(true);
    expect(phonesMatch("+380501112233", "+380501112244")).toBe(false);
  });

  it("treats shared email or phone as same person", () => {
    expect(
      samePersonContact(
        { email: "a@example.com", phone: "+380501112233" },
        { email: "b@example.com", phone: "+380501112233" },
      ),
    ).toBe(true);
    expect(
      samePersonContact(
        { email: "a@example.com", phone: null },
        { email: "A@example.com", phone: "+380501112233" },
      ),
    ).toBe(true);
    expect(
      samePersonContact(
        { email: "a@example.com", phone: "+380501112233" },
        { email: "b@example.com", phone: "+380501112244" },
      ),
    ).toBe(false);
  });

  it("returns locale-specific bot copy", () => {
    expect(botText("en", "linked")).toMatch(/connected/i);
    expect(botText("uk", "linked")).toMatch(/підключено/i);
  });
});
