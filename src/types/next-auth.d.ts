import "next-auth/jwt";
import type { Portal } from "@/lib/portals";

declare module "next-auth" {
  interface User {
    portal?: Portal;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      nameEn?: string | null;
      nameUk?: string | null;
      email?: string | null;
      image?: string | null;
      portal?: Portal;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    portal?: Portal;
    nameEn?: string | null;
    nameUk?: string | null;
  }
}
