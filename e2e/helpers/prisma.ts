import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma Client for E2E helpers (prefers TEST_DATABASE_URL).
 * Longer connect timeout than the app default — parallel Playwright workers
 * plus `next start` can briefly saturate the local Postgres accept queue (#208).
 */
export function createE2EPrismaClient(): PrismaClient {
	const databaseUrl =
		process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("TEST_DATABASE_URL or DATABASE_URL is required for E2E Prisma");
	}
	const adapter = new PrismaPg({
		connectionString: databaseUrl,
		connectionTimeoutMillis: 30_000,
		idleTimeoutMillis: 300_000,
	});
	return new PrismaClient({ adapter });
}
