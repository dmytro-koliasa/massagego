/**
 * One-off: copy data from prisma/dev.db (SQLite) into current Postgres DATABASE_URL.
 * Usage: node scripts/migrate-sqlite-to-postgres.js
 */
const Database = require("better-sqlite3");
const { PrismaClient } = require("@prisma/client");

const sqlite = new Database("prisma/dev.db", { readonly: true });
const prisma = new PrismaClient();

function toDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    // Prisma/SQLite sometimes stores ms epoch
    const d = new Date(value > 1e12 ? value : value * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function rows(table) {
  return sqlite.prepare(`SELECT * FROM "${table}"`).all();
}

async function main() {
  const users = rows("User");
  const accounts = rows("Account");
  const slots = rows("AvailabilitySlot");
  const gallery = rows("GalleryImage");
  const bookings = rows("Booking");

  console.log(
    JSON.stringify(
      {
        users: users.length,
        accounts: accounts.length,
        availabilitySlots: slots.length,
        galleryImages: gallery.length,
        bookings: bookings.length,
      },
      null,
      2,
    ),
  );

  // Clear Postgres target (fresh migrate DB) in FK-safe order
  await prisma.booking.deleteMany();
  await prisma.galleryImage.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  for (const u of users) {
    await prisma.user.create({
      data: {
        id: u.id,
        name: u.name,
        nameEn: u.nameEn,
        nameUk: u.nameUk,
        slug: u.slug ?? null,
        email: u.email,
        emailVerified: toDate(u.emailVerified),
        image: u.image,
        descriptionEn: u.descriptionEn,
        descriptionUk: u.descriptionUk,
        massageTypes: u.massageTypes ?? "[]",
        city: u.city,
        address: u.address,
        passwordHash: u.passwordHash,
        portal: u.portal,
        createdAt: toDate(u.createdAt) ?? new Date(),
        updatedAt: toDate(u.updatedAt) ?? new Date(),
      },
    });
  }

  for (const a of accounts) {
    await prisma.account.create({
      data: {
        id: a.id,
        userId: a.userId,
        type: a.type,
        provider: a.provider,
        providerAccountId: a.providerAccountId,
        refresh_token: a.refresh_token,
        access_token: a.access_token,
        expires_at: a.expires_at,
        token_type: a.token_type,
        scope: a.scope,
        id_token: a.id_token,
        session_state: a.session_state,
      },
    });
  }

  // Batch slots for speed
  const slotData = slots.map((s) => ({
    id: s.id,
    masseurId: s.masseurId,
    start: toDate(s.start),
    end: toDate(s.end),
    createdAt: toDate(s.createdAt) ?? new Date(),
    updatedAt: toDate(s.updatedAt) ?? new Date(),
  }));
  const SLOT_CHUNK = 100;
  for (let i = 0; i < slotData.length; i += SLOT_CHUNK) {
    await prisma.availabilitySlot.createMany({
      data: slotData.slice(i, i + SLOT_CHUNK),
    });
  }

  for (const g of gallery) {
    await prisma.galleryImage.create({
      data: {
        id: g.id,
        masseurId: g.masseurId,
        url: g.url,
        width: g.width,
        height: g.height,
        sortOrder: g.sortOrder ?? 0,
        createdAt: toDate(g.createdAt) ?? new Date(),
      },
    });
  }

  for (const b of bookings) {
    await prisma.booking.create({
      data: {
        id: b.id,
        masseurId: b.masseurId,
        clientUserId: b.clientUserId,
        clientName: b.clientName,
        clientPhone: b.clientPhone,
        clientEmail: b.clientEmail,
        preferredDate: b.preferredDate,
        preferredTime: b.preferredTime,
        slotStart: toDate(b.slotStart),
        massageType: b.massageType,
        note: b.note,
        status: b.status ?? "pending",
        createdAt: toDate(b.createdAt) ?? new Date(),
        updatedAt: toDate(b.updatedAt) ?? new Date(),
      },
    });
  }

  const summary = {
    users: await prisma.user.count(),
    accounts: await prisma.account.count(),
    availabilitySlots: await prisma.availabilitySlot.count(),
    galleryImages: await prisma.galleryImage.count(),
    bookings: await prisma.booking.count(),
  };
  console.log("postgres", JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    sqlite.close();
    await prisma.$disconnect();
  });
