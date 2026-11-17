import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session.server";
import { prisma } from "@/lib/prisma";

const FILTERS = ["all", "open", "resolved", "dismissed"] as const;

export async function GET(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(request.url);
  const filterRaw = searchParams.get("filter") ?? "open";
  const filter = FILTERS.includes(filterRaw as (typeof FILTERS)[number])
    ? (filterRaw as (typeof FILTERS)[number])
    : "open";

  const complaints = await prisma.complaint.findMany({
    where: filter === "all" ? undefined : { status: filter },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      category: true,
      body: true,
      status: true,
      adminNote: true,
      bookingId: true,
      createdAt: true,
      resolvedAt: true,
      reporter: {
        select: {
          id: true,
          portal: true,
          email: true,
          name: true,
          nameEn: true,
          nameUk: true,
        },
      },
      target: {
        select: {
          id: true,
          portal: true,
          email: true,
          name: true,
          nameEn: true,
          nameUk: true,
          blockedAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    complaints: complaints.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      target: {
        ...row.target,
        blockedAt: row.target.blockedAt?.toISOString() ?? null,
      },
    })),
  });
}
