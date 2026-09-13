import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { createPortalCookies } from "@/auth/portal-config";
import { portalHomePath } from "@/lib/portals";

async function readPortalToken(req: NextRequest, portal: "masseur" | "client") {
  return getToken({
    req,
    secret: process.env.AUTH_SECRET,
    cookieName: createPortalCookies(portal).sessionToken.name,
  });
}

function isClientLoginPath(path: string) {
  return path === "/client/login" || path.startsWith("/client/login/");
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/masseur/dashboard")) {
    const token = await readPortalToken(request, "masseur");
    if (!token?.sub || token.portal !== "masseur") {
      return NextResponse.redirect(new URL("/masseur", request.url));
    }
    return NextResponse.next();
  }

  if (isClientLoginPath(path)) {
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
  matcher: ["/masseur/dashboard/:path*", "/client", "/client/:path*"],
};
