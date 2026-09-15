import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { createPortalCookies } from "@/auth/portal-config";
import { isPortalLoginPath, portalHomePath } from "@/lib/portals";

async function readPortalToken(req: NextRequest, portal: "masseur" | "client") {
  return getToken({
    req,
    secret: process.env.AUTH_SECRET,
    cookieName: createPortalCookies(portal).sessionToken.name,
  });
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (isPortalLoginPath(path, "masseur") || isPortalLoginPath(path, "client")) {
    return NextResponse.next();
  }

  if (path.startsWith("/masseur/dashboard")) {
    const token = await readPortalToken(request, "masseur");
    if (!token?.sub || token.portal !== "masseur") {
      const loginUrl = new URL(portalHomePath("masseur"), request.url);
      loginUrl.searchParams.set("next", path);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (path === "/client" || path.startsWith("/client/")) {
    const token = await readPortalToken(request, "client");
    if (!token?.sub || token.portal !== "client") {
      const loginUrl = new URL(portalHomePath("client"), request.url);
      loginUrl.searchParams.set("next", path);
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
    "/client",
    "/client/:path*",
  ],
};
