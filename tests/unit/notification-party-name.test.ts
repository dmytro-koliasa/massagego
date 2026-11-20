/**
 * #131 — event 4 must not name a deleted client with the internal email.
 */
import { describe, expect, it } from "vitest";
import { anonymisedEmailFor } from "@/lib/deleted-user";
import { notificationPartyName } from "@/lib/notifications/party-name";

describe("notificationPartyName (#131)", () => {
  it("uses the deleted-user label in en and uk when deletedAt is set", () => {
    const user = {
      id: "user_1",
      name: null,
      nameEn: null,
      nameUk: null,
      email: anonymisedEmailFor("user_1"),
      deletedAt: new Date("2031-01-01T00:00:00Z"),
    };
    expect(notificationPartyName(user, "en")).toBe("Deleted user");
    expect(notificationPartyName(user, "uk")).toBe("Видалений користувач");
    expect(notificationPartyName(user, "en")).not.toContain("invalid.local");
    expect(notificationPartyName(user, "en")).not.toContain("user_1");
  });

  it("uses the deleted-user label when the client row is missing", () => {
    expect(notificationPartyName(null, "en")).toBe("Deleted user");
    expect(notificationPartyName(undefined, "uk")).toBe("Видалений користувач");
  });

  it("uses the deleted-user label for anonymised email without deletedAt", () => {
    const user = {
      id: "user_2",
      name: null,
      email: anonymisedEmailFor("user_2"),
      deletedAt: null,
    };
    const name = notificationPartyName(user, "en");
    expect(name).toBe("Deleted user");
    expect(name).not.toContain("invalid.local");
  });

  it("keeps a normal account name", () => {
    expect(
      notificationPartyName(
        {
          id: "user_3",
          name: "Ada",
          email: "ada@example.com",
          deletedAt: null,
        },
        "en",
      ),
    ).toBe("Ada");
  });
});
