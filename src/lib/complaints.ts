import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
	COMPLAINT_BODY_MAX,
	COMPLAINT_CATEGORIES,
	assertComplaintBookingLink,
	type ComplaintCreateError,
	type ComplaintCreateInput,
} from "@/lib/complaints-shared";

export {
	COMPLAINT_ADMIN_NOTE_MAX,
	COMPLAINT_BODY_MAX,
	COMPLAINT_CATEGORIES,
	assertComplaintBookingLink,
	type ComplaintCategoryValue,
	type ComplaintCreateError,
	type ComplaintCreateInput,
} from "@/lib/complaints-shared";

/**
 * Keep `Booking.hasRetentionHold` true while any open complaint references
 * the booking (#132 / BR-011).
 */
export async function syncBookingRetentionHold(
	tx: Pick<Prisma.TransactionClient, "complaint" | "booking">,
	bookingId: string,
): Promise<void> {
	const openCount = await tx.complaint.count({
		where: { bookingId, status: "open" },
	});
	await tx.booking.update({
		where: { id: bookingId },
		data: { hasRetentionHold: openCount > 0 },
	});
}

export async function createComplaint(
	prisma: Pick<PrismaClient, "booking" | "complaint" | "user" | "$transaction">,
	input: ComplaintCreateInput,
): Promise<
	{ ok: true; id: string } | { ok: false; error: ComplaintCreateError }
> {
	const body = input.body.trim();
	if (!body || body.length > COMPLAINT_BODY_MAX) {
		return { ok: false, error: "invalid_body" };
	}
	if (
		!COMPLAINT_CATEGORIES.includes(
			input.category as (typeof COMPLAINT_CATEGORIES)[number],
		)
	) {
		return { ok: false, error: "invalid_category" };
	}

	const booking = await prisma.booking.findUnique({
		where: { id: input.bookingId },
		select: { id: true, masseurId: true, clientUserId: true },
	});
	if (!booking) {
		return { ok: false, error: "booking_not_found" };
	}

	const link = assertComplaintBookingLink({
		reporterId: input.reporterId,
		reporterPortal: input.reporterPortal,
		booking,
	});
	if (!link.ok) return link;

	const target = await prisma.user.findFirst({
		where: {
			id: link.targetId,
			portal: input.reporterPortal === "client" ? "masseur" : "client",
			deletedAt: null,
		},
		select: { id: true },
	});
	if (!target) {
		return { ok: false, error: "invalid_target" };
	}

	const created = await prisma.$transaction(async (tx) => {
		const row = await tx.complaint.create({
			data: {
				reporterId: input.reporterId,
				targetId: target.id,
				bookingId: booking.id,
				category: input.category,
				body,
				status: "open",
			},
			select: { id: true },
		});
		await syncBookingRetentionHold(tx, booking.id);
		return row;
	});

	return { ok: true, id: created.id };
}
