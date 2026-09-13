import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { compare } from "bcryptjs";
import type { Portal } from "@/lib/portals";
import { portalHomePath } from "@/lib/portals";
import { findPortalUserByEmail, readAuthIntentCookie } from "@/lib/portals.server";
import { prisma } from "@/lib/prisma";
import { createPortalAuthConfig } from "@/auth/portal-config";
import { loginSchema, NAME_MAX } from "@/lib/validation";
import { allocateUniqueSlug, buildSlugBase } from "@/lib/slug";

const googleConfigured =
  Boolean(process.env.AUTH_GOOGLE_ID?.trim()) &&
  Boolean(process.env.AUTH_GOOGLE_SECRET?.trim());

function createPortalPrismaAdapter(portal: Portal): Adapter {
  const base = PrismaAdapter(prisma) as Adapter;

  return {
    ...base,
    createUser: async (data) => {
      const slug =
        portal === "masseur"
          ? await allocateUniqueSlug(
              buildSlugBase([data.name, data.email?.split("@")[0]]),
            )
          : null;

      return prisma.user.create({
        data: {
          email: data.email!,
          emailVerified: data.emailVerified ?? null,
          name: data.name?.trim().slice(0, NAME_MAX) || null,
          image: data.image ?? null,
          portal,
          slug,
        },
      });
    },
    getUserByEmail: async (email) => {
      return prisma.user.findUnique({
        where: { email_portal: { email, portal } },
      });
    },
    getUserByAccount: async ({ provider, providerAccountId }) => {
      const account = await prisma.account.findFirst({
        where: {
          provider,
          providerAccountId,
          user: { portal },
        },
        include: { user: true },
      });
      return account?.user ?? null;
    },
  };
}

export function createPortalAuth(portal: Portal) {
  const config = createPortalAuthConfig(portal);

  return NextAuth({
    ...config,
    adapter: createPortalPrismaAdapter(portal),
    providers: [
      ...(googleConfigured
        ? [
            Google({
              clientId: process.env.AUTH_GOOGLE_ID,
              clientSecret: process.env.AUTH_GOOGLE_SECRET,
              allowDangerousEmailAccountLinking: true,
              authorization: {
                params: {
                  prompt: "select_account",
                  access_type: "offline",
                  response_type: "code",
                },
              },
            }),
          ]
        : []),
      Credentials({
        id: "credentials",
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const parsed = loginSchema.safeParse({
            email: credentials?.email,
            password: credentials?.password,
          });
          if (!parsed.success) {
            return null;
          }

          const { email, password } = parsed.data;

          const user = await findPortalUserByEmail(email, portal);

          if (!user?.passwordHash) {
            return null;
          }

          const valid = await compare(password, user.passwordHash);
          if (!valid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            portal,
          };
        },
      }),
    ],
    callbacks: {
      ...config.callbacks,
      async signIn({ user, account }) {
        if (!user.email && !user.id) {
          return false;
        }

        const email =
          typeof user.email === "string"
            ? user.email.toLowerCase().trim()
            : null;

        const dbUser = email
          ? await findPortalUserByEmail(email, portal)
          : user.id
            ? await prisma.user.findFirst({
                where: { id: user.id, portal },
                select: { id: true },
              })
            : null;

        if (dbUser) {
          return true;
        }

        // New OAuth identity for this portal only.
        if (account?.provider === "google") {
          const intent = await readAuthIntentCookie("login");
          if (intent === "register") {
            return true;
          }
          return `${portalHomePath(portal)}?error=no_portal_access`;
        }

        // Credentials registration creates the portal user before signIn.
        if (account?.provider === "credentials") {
          return true;
        }

        return false;
      },
      async jwt({ token, user }) {
        if (user?.id) {
          token.sub = user.id;
        }

        if (!token.sub) {
          return token;
        }

        const existing = await prisma.user.findFirst({
          where: { id: token.sub, portal },
          select: {
            id: true,
            name: true,
            nameEn: true,
            nameUk: true,
            email: true,
            image: true,
          },
        });

        if (!existing) {
          return {};
        }

        token.portal = portal;
        token.name = existing.name || existing.nameEn || existing.nameUk || null;
        token.nameEn = existing.nameEn;
        token.nameUk = existing.nameUk;
        token.email = existing.email;
        token.picture = existing.image;
        return token;
      },
      async session({ session, token }) {
        if (!token.sub || token.portal !== portal) {
          return { ...session, user: undefined };
        }

        if (session.user) {
          session.user.id = token.sub;
          session.user.portal = portal;
          session.user.name =
            typeof token.name === "string" ? token.name : null;
          session.user.nameEn =
            typeof token.nameEn === "string" ? token.nameEn : null;
          session.user.nameUk =
            typeof token.nameUk === "string" ? token.nameUk : null;
          session.user.email =
            typeof token.email === "string" ? token.email : session.user.email;
          session.user.image =
            typeof token.picture === "string" ? token.picture : null;
        }

        return session;
      },
    },
  });
}
