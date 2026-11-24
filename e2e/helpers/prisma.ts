import { createPrismaClient } from "@/lib/create-prisma-client";
import type { PrismaClient } from "@/generated/prisma/client";

/** Prisma Client for E2E helpers (prefers TEST_DATABASE_URL). */
export function createE2EPrismaClient(): PrismaClient {
	const databaseUrl =
		process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("TEST_DATABASE_URL or DATABASE_URL is required for E2E Prisma");
	}
	return createPrismaClient(databaseUrl);
}
