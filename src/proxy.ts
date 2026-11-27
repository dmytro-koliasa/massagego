import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { createPortalCookies } from "@/auth/portal-config";
import {
  isPortalLoginPath,
  portalHomePath,
  type Portal,
} from "@/lib/portals";
import { portalContinuePath } from "@/lib/safe-internal-path";

async function readPortalToken(req: NextRequest, portal: Portal) {
  return getToken({
    req,
    secret: process.env.AUTH_SECRET,
    cookieName: createPortalCookies(portal).sessionToken.name,
  });
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (
    isPortalLoginPath(path, "masseur") ||
    isPortalLoginPath(path, "client") ||
    isPortalLoginPath(path, "admin")
  ) {
    return NextResponse.next();
  }

  if (
    path.startsWith("/masseur/dashboard") ||
    path.startsWith("/masseur/notifications")
  ) {
    const token = await readPortalToken(request, "masseur");
    if (!token?.sub || token.portal !== "masseur") {
      const loginUrl = new URL(portalHomePath("masseur"), request.url);
      loginUrl.searchParams.set(
        "next",
        portalContinuePath(path, request.nextUrl.search),
      );
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (path === "/client" || path.startsWith("/client/")) {
    const token = await readPortalToken(request, "client");
    if (!token?.sub || token.portal !== "client") {
      const loginUrl = new URL(portalHomePath("client"), request.url);
      loginUrl.searchParams.set(
        "next",
        portalContinuePath(path, request.nextUrl.search),
      );
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (path === "/admin" || path.startsWith("/admin/")) {
    const token = await readPortalToken(request, "admin");
    if (!token?.sub || token.portal !== "admin") {
      const loginUrl = new URL(portalHomePath("admin"), request.url);
      loginUrl.searchParams.set(
        "next",
        portalContinuePath(path, request.nextUrl.search),
      );
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/masseur/login",
    "/masseur/login/:path*",
    "/masseur/dashboard/:path*",
    "/masseur/notifications",
    "/masseur/notifications/:path*",
    "/client",
    "/client/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
