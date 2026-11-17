import { NextResponse } from "next/server";
import { deleteOwnAccount } from "@/lib/account-deletion";
import { requirePortalUser } from "@/lib/notifications/portal-gate";

export async function POST() {
  const gate = await requirePortalUser();
  if (!gate.ok) return gate.response;

  const result = await deleteOwnAccount({
    userId: gate.userId,
    portal: gate.portal,
  });

  if (!result.ok) {
    if (result.error === "masseur_has_future_bookings") {
      return NextResponse.json(
        {
          error: result.error,
          futureBookingCount: result.futureBookingCount ?? 0,
        },
        { status: 409 },
      );
    }
    const status = result.error === "not_found" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
