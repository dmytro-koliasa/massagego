import { prisma } from "@/lib/prisma";
import { resolveTimeZone } from "@/lib/masseur-time";

/** The masseur's time zone, or null when the id is not a masseur. */
export async function getMasseurTimeZone(masseurId: string): Promise<string | null> {
  const masseur = await prisma.user.findFirst({
    where: { id: masseurId, portal: "masseur" },
    select: { timezone: true },
  });
  return masseur ? resolveTimeZone(masseur.timezone) : null;
}
