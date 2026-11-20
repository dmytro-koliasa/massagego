/**
 * #138 — note-only complaint audit; block + audit are atomic.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  completeClientData,
  completeMasseurData,
  slotInsideBookingWindow,
} from "./fixtures";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

const session = vi.hoisted(() => ({ adminId: "" }));

vi.mock("@/auth/admin", () => ({
  auth: async () => ({
    user: { id: session.adminId, portal: "admin" },
  }),
}));

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("admin audit (#138)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let patchComplaint: typeof import("@/app/api/admin/complaints/[id]/route").PATCH;
  let blockUser: typeof import("@/app/api/admin/users/[id]/block/route").POST;
  let adminId = "";
  let masseurId = "";
  let clientId = "";
  let complaintId = "";

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ PATCH: patchComplaint } = await import(
      "@/app/api/admin/complaints/[id]/route"
    ));
    ({ POST: blockUser } = await import(
      "@/app/api/admin/users/[id]/block/route"
    ));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const admin = await prisma.user.create({
      data: {
        email: `audit-admin-${suffix}@test.local`,
        portal: "admin",
        name: "Audit Admin",
      },
    });
    const masseur = await prisma.user.create({
      data: completeMasseurData({
        email: `audit-m-${suffix}@test.local`,
        phone: `+38050${String(Date.now()).slice(-7)}`,
      }),
    });
    const client = await prisma.user.create({
      data: completeClientData({
        email: `audit-c-${suffix}@test.local`,
        phone: `+38067${String(Date.now()).slice(-7)}`,
      }),
    });
    adminId = admin.id;
    masseurId = masseur.id;
    clientId = client.id;
    session.adminId = admin.id;

    const booking = await prisma.booking.create({
      data: {
        masseurId,
        clientUserId: clientId,
        clientName: "Audit Client",
        clientPhone: "+380501111111",
        slotStart: slotInsideBookingWindow(40, 10),
        status: "confirmed",
        massageType: "classic",
      },
    });
    const complaint = await prisma.complaint.create({
      data: {
        reporterId: clientId,
        targetId: masseurId,
        bookingId: booking.id,
        category: "rude",
        body: "Complaint body for audit test",
        status: "open",
      },
    });
    complaintId = complaint.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.adminAuditLog.deleteMany({
      where: { actorUserId: adminId },
    });
    await prisma.complaint.deleteMany({
      where: { OR: [{ reporterId: clientId }, { targetId: masseurId }] },
    });
    await prisma.booking.deleteMany({
      where: { OR: [{ masseurId }, { clientUserId: clientId }] },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminId, masseurId, clientId].filter(Boolean) } },
    });
    await prisma.$disconnect();
  });

  it("writes complaint.note audit without note text in meta", async () => {
    const response = await patchComplaint(
      new Request("http://test/api/admin/complaints/x", {
        method: "PATCH",
        body: JSON.stringify({ adminNote: "Internal follow-up note" }),
      }),
      { params: Promise.resolve({ id: complaintId }) },
    );
    expect(response.status).toBe(200);

    const logs = await prisma.adminAuditLog.findMany({
      where: { action: "complaint.note", actorUserId: adminId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.metaJson).toContain(complaintId);
    expect(logs[0]?.metaJson).not.toContain("Internal follow-up");
    expect(logs[0]?.metaJson).not.toContain("Complaint body");
  });

  it("keeps status-change audit and blocks with an atomic audit row", async () => {
    const statusRes = await patchComplaint(
      new Request("http://test/api/admin/complaints/x", {
        method: "PATCH",
        body: JSON.stringify({ status: "resolved" }),
      }),
      { params: Promise.resolve({ id: complaintId }) },
    );
    expect(statusRes.status).toBe(200);
    const statusLogs = await prisma.adminAuditLog.count({
      where: { action: "complaint.resolved", actorUserId: adminId },
    });
    expect(statusLogs).toBeGreaterThan(0);

    const blockRes = await blockUser(
      new Request("http://test/api/admin/users/x/block", { method: "POST" }),
      { params: Promise.resolve({ id: masseurId }) },
    );
    expect(blockRes.status).toBe(200);

    const blockLogs = await prisma.adminAuditLog.findMany({
      where: { action: "user.block", targetUserId: masseurId },
      take: 1,
    });
    expect(blockLogs).toHaveLength(1);
    const masseur = await prisma.user.findUniqueOrThrow({
      where: { id: masseurId },
      select: { blockedAt: true },
    });
    expect(masseur.blockedAt).toBeInstanceOf(Date);
  });
});
