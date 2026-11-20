import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-session.server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      portal: true,
      blockedAt: true,
      deletedAt: true,
    },
  });

  if (!target || target.deletedAt) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (target.portal === "admin") {
    return NextResponse.json(
      { error: "cannot_unblock_admin" },
      { status: 400 },
    );
  }
  if (!target.blockedAt) {
    return NextResponse.json({ ok: true, already: true });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { blockedAt: null },
    });
    await writeAdminAuditLog(
      {
        actorUserId: gate.userId,
        action: "user.unblock",
        targetUserId: id,
        meta: { portal: target.portal },
      },
      tx,
    );
  });

  return NextResponse.json({ ok: true, blockedAt: null });
}
