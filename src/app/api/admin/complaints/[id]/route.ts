import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-session.server";
import { syncBookingRetentionHold } from "@/lib/complaints";
import { prisma } from "@/lib/prisma";
import { parseWithSchema } from "@/lib/validation";
import { complaintAdminPatchSchema } from "@/lib/validation/complaints";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = parseWithSchema(complaintAdminPatchSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const existing = await prisma.complaint.findUnique({
    where: { id },
    select: { id: true, status: true, targetId: true, bookingId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const data: {
    status?: "open" | "resolved" | "dismissed";
    adminNote?: string | null;
    resolvedAt?: Date | null;
    resolvedById?: string | null;
  } = {};

  if (parsed.data.adminNote !== undefined) {
    data.adminNote = parsed.data.adminNote;
  }

  if (parsed.data.status !== undefined) {
    data.status = parsed.data.status;
    if (parsed.data.status === "open") {
      data.resolvedAt = null;
      data.resolvedById = null;
    } else {
      data.resolvedAt = new Date();
      data.resolvedById = gate.userId;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.complaint.update({
      where: { id },
      data,
      select: {
        id: true,
        status: true,
        adminNote: true,
        resolvedAt: true,
      },
    });
    if (
      existing.bookingId &&
      parsed.data.status !== undefined &&
      parsed.data.status !== existing.status
    ) {
      await syncBookingRetentionHold(tx, existing.bookingId);
    }
    return row;
  });

  if (parsed.data.status && parsed.data.status !== existing.status) {
    await writeAdminAuditLog({
      actorUserId: gate.userId,
      action: `complaint.${parsed.data.status}`,
      targetUserId: existing.targetId,
      meta: { complaintId: id, from: existing.status },
    });
  }

  return NextResponse.json({
    ok: true,
    complaint: {
      ...updated,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
    },
  });
}
