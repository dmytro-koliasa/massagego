import { cookies } from "next/headers";
import {
  AUTH_INTENT_COOKIE,
  AUTH_PORTAL_COOKIE,
  isAuthIntent,
  isPortal,
  type AuthIntent,
  type Portal,
} from "@/lib/portals";
import { prisma } from "@/lib/prisma";

export async function readPortalCookie(fallback: Portal = "masseur"): Promise<Portal> {
  const jar = await cookies();
  const value = jar.get(AUTH_PORTAL_COOKIE)?.value;
  return isPortal(value) ? value : fallback;
}

export async function readAuthIntentCookie(
  fallback: AuthIntent = "login",
): Promise<AuthIntent> {
  const jar = await cookies();
  const value = jar.get(AUTH_INTENT_COOKIE)?.value;
  return isAuthIntent(value) ? value : fallback;
}

/** True when this user id belongs to the given portal identity. */
export async function userHasPortal(userId: string, portal: Portal) {
  const user = await prisma.user.findFirst({
    where: { id: userId, portal },
    select: { id: true },
  });
  return Boolean(user);
}

export async function findPortalUserByEmail(email: string, portal: Portal) {
  return prisma.user.findUnique({
    where: { email_portal: { email, portal } },
  });
}

export async function findPortalUserByPhone(phone: string, portal: Portal) {
  return prisma.user.findFirst({
    where: { phone, portal },
  });
}
