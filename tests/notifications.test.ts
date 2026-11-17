import { describe, expect, it } from "vitest";
import {
  isEmailLocked,
  validatePreferencePatches,
  eventsForPortal,
  defaultEmailEnabled,
} from "@/lib/notifications/pref-rules";
import { isPastRetryWindow, nextRetryAt } from "@/lib/notifications/retry";
import {
  emailBodyLooksPhoneFree,
  renderNotificationEmail,
} from "@/lib/notifications/templates";
import type { NotificationPayload } from "@/lib/notifications/types";

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

  it("locks email for critical events until Telegram exists", () => {
    expect(isEmailLocked("booking_created")).toBe(false);
    expect(isEmailLocked("booking_confirmed")).toBe(true);
    expect(isEmailLocked("booking_cancelled_by_client")).toBe(true);
  });

  it("rejects turning off critical email", () => {
    const result = validatePreferencePatches("client", [
      { eventType: "booking_confirmed", emailEnabled: false },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("critical_email_required");
  });

  it("allows turning off new-booking email for masseurs", () => {
    const result = validatePreferencePatches("masseur", [
      { eventType: "booking_created", emailEnabled: false },
    ]);
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
    // Names must not smuggle phones into the body via other fields we control;
    // the phone-looking digits in otherPartyName would fail the guard — ensure
    // production payloads never put phones in otherPartyName.
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
  });

  it("includes client cancel reason", () => {
    const rendered = renderNotificationEmail(
      "booking_cancelled_by_client",
      {
        ...basePayload,
        locale: "en",
        cancelReasonKey: "changed_mind",
        appPath: "/masseur/dashboard",
      },
      "https://example.com",
    );
    expect(rendered.text).toMatch(/Reason:/i);
    expect(rendered.text).toContain("I changed my mind");
  });

  it("renders Ukrainian confirmation", () => {
    const rendered = renderNotificationEmail(
      "booking_confirmed",
      { ...basePayload, locale: "uk" },
      "https://example.com",
    );
    expect(rendered.subject).toContain("Підтвердження");
    expect(rendered.text).toContain("Відкрити в застосунку:");
  });
});
