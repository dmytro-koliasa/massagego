import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** Build a Prisma Client bound to `connectionString` (Prisma 7 requires a driver adapter). */
export function createPrismaClient(connectionString: string): PrismaClient {
	const adapter = new PrismaPg({
		connectionString,
		// Match Prisma ORM v6 pool timeout defaults (pg defaults to 0 = none).
		connectionTimeoutMillis: 5_000,
		idleTimeoutMillis: 300_000,
	});
	return new PrismaClient({ adapter });
}
