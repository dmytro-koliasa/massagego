/**
 * Client-safe complaint constants and pure helpers (#204).
 * Server DB logic lives in `@/lib/complaints` (server-only).
 */

export const COMPLAINT_BODY_MAX = 500;
export const COMPLAINT_ADMIN_NOTE_MAX = 1000;

export const COMPLAINT_CATEGORIES = [
	"no_show",
	"rude",
	"spam",
	"other",
] as const;

export type ComplaintCategoryValue = (typeof COMPLAINT_CATEGORIES)[number];

export type ComplaintCreateInput = {
	reporterId: string;
	reporterPortal: "client" | "masseur";
	bookingId: string;
	category: ComplaintCategoryValue;
	body: string;
};

export type ComplaintCreateError =
	| "booking_not_found"
	| "no_relationship"
	| "walk_in"
	| "invalid_target"
	| "invalid_body"
	| "invalid_category";

/**
 * Ensures the reporter and target are linked by the given booking
 * (client↔masseur account booking; walk-ins rejected).
 */
export function assertComplaintBookingLink(options: {
	reporterId: string;
	reporterPortal: "client" | "masseur";
	booking: {
		masseurId: string;
		clientUserId: string | null;
	};
}):
	| { ok: true; targetId: string }
	| { ok: false; error: ComplaintCreateError } {
	const { reporterId, reporterPortal, booking } = options;
	if (!booking.clientUserId) {
		return { ok: false, error: "walk_in" };
	}

	if (reporterPortal === "client") {
		if (booking.clientUserId !== reporterId) {
			return { ok: false, error: "no_relationship" };
		}
		if (booking.masseurId === reporterId) {
			return { ok: false, error: "invalid_target" };
		}
		return { ok: true, targetId: booking.masseurId };
	}

	if (booking.masseurId !== reporterId) {
		return { ok: false, error: "no_relationship" };
	}
	if (booking.clientUserId === reporterId) {
		return { ok: false, error: "invalid_target" };
	}
	return { ok: true, targetId: booking.clientUserId };
}
