import { describe, expect, it } from "vitest";
import { assertComplaintBookingLink } from "@/lib/complaints";

describe("assertComplaintBookingLink", () => {
  const booking = {
    masseurId: "masseur-1",
    clientUserId: "client-1",
  };

  it("lets a client report the masseur on a shared booking", () => {
    expect(
      assertComplaintBookingLink({
        reporterId: "client-1",
        reporterPortal: "client",
        booking,
      }),
    ).toEqual({ ok: true, targetId: "masseur-1" });
  });

  it("lets a masseur report the account client on a shared booking", () => {
    expect(
      assertComplaintBookingLink({
        reporterId: "masseur-1",
        reporterPortal: "masseur",
        booking,
      }),
    ).toEqual({ ok: true, targetId: "client-1" });
  });

  it("rejects walk-ins and foreign bookings", () => {
    expect(
      assertComplaintBookingLink({
        reporterId: "masseur-1",
        reporterPortal: "masseur",
        booking: { masseurId: "masseur-1", clientUserId: null },
      }),
    ).toEqual({ ok: false, error: "walk_in" });

    expect(
      assertComplaintBookingLink({
        reporterId: "client-2",
        reporterPortal: "client",
        booking,
      }),
    ).toEqual({ ok: false, error: "no_relationship" });
  });
});
