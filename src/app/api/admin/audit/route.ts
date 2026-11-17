import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session.server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const entries = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      action: true,
      actorUserId: true,
      targetUserId: true,
      metaJson: true,
      createdAt: true,
      actor: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  return NextResponse.json({
    entries: entries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      actorUserId: entry.actorUserId,
      actorEmail: entry.actor.email,
      actorName: entry.actor.name,
      targetUserId: entry.targetUserId,
      metaJson: entry.metaJson,
      createdAt: entry.createdAt.toISOString(),
    })),
  });
}
