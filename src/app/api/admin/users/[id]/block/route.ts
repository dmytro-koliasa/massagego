import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-session.server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  if (id === gate.userId) {
    return NextResponse.json({ error: "cannot_block_self" }, { status: 400 });
  }

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
    return NextResponse.json({ error: "cannot_block_admin" }, { status: 400 });
  }
  if (target.blockedAt) {
    return NextResponse.json({ ok: true, already: true });
  }

  const blockedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { blockedAt },
    });
    await tx.session.deleteMany({ where: { userId: id } });
    await writeAdminAuditLog(
      {
        actorUserId: gate.userId,
        action: "user.block",
        targetUserId: id,
        meta: { portal: target.portal },
      },
      tx,
    );
  });

  return NextResponse.json({ ok: true, blockedAt: blockedAt.toISOString() });
}
