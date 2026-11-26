import "server-only";

import { createPrismaClient } from "@/lib/create-prisma-client";
import type { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

function resolveDatabaseUrl(): string {
	const url = process.env.DATABASE_URL;
	if (!url) {
		throw new Error("DATABASE_URL is not set");
	}
	return url;
}

export const prisma =
	globalForPrisma.prisma ?? createPrismaClient(resolveDatabaseUrl());

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}
