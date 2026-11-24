import NextAuth, { CredentialsSignin } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import type { User as PrismaUser } from "@/generated/prisma/client";
import { compare } from "bcryptjs";
import type { Portal } from "@/lib/portals";
import { isPortal, portalHomePath } from "@/lib/portals";
import { findPortalUserByEmail, findPortalUserByPhone, readAuthIntentCookie } from "@/lib/portals.server";
import { prisma } from "@/lib/prisma";
import { createPortalAuthConfig } from "@/auth/portal-config";
import {
  AUTH_RATE_LIMIT_SCOPES,
  evaluateSignInPasswordAttempt,
  SIGN_IN_IP_LIMIT,
  SIGN_IN_PASSWORD_FAIL_LIMIT,
} from "@/lib/auth/auth-rate-limit-policy";
import {
  checkRateLimit,
  isRateLimitExceeded,
  minutesFromRetryAfter,
  rateLimitKey,
} from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { clientLoginSchema, loginSchema, NAME_MAX } from "@/lib/validation";
import { allocateUniqueSlug, buildSlugBase } from "@/lib/slug";
import { decideGoogleSignIn } from "@/lib/auth/google-account-linking";
import { applyPasswordVersionToJwt } from "@/lib/auth/password-credential-version";

/** Surfaced to the client as `signIn` result `code` (e.g. rate_limited_5). */
class RateLimitedSignIn extends CredentialsSignin {
  constructor(minutes: number) {
    super();
    this.code = `rate_limited_${minutes}`;
  }
}

class AccountBlockedSignIn extends CredentialsSignin {
  code = "blocked";
}

/** IP budget on every sign-in attempt (#86). Account fail budget is separate. */
async function enforceSignInIpLimit(request: Request | undefined) {
  // IP is best-effort: Auth.js v5 passes the original Request into authorize.
  const ip = request ? getClientIp(request) : "unknown";
  const ipLimit = await checkRateLimit(
    rateLimitKey(AUTH_RATE_LIMIT_SCOPES.signInIp, ip),
    SIGN_IN_IP_LIMIT.limit,
    SIGN_IN_IP_LIMIT.windowMs,
  );
  if (!ipLimit.ok) {
    throw new RateLimitedSignIn(minutesFromRetryAfter(ipLimit.retryAfterSec));
  }
}

/**
 * Verify password against the per-identifier fail ceiling (#127 / #86).
 * Correct passwords always succeed and never touch the fail bucket.
 * Wrong passwords at/over the ceiling return the same generic null without
 * a distinct rate-limit code; under the ceiling they increment the bucket.
 */
async function passwordPassesSignInFailCeiling(
  accountKey: string,
  password: string,
  passwordHash: string,
): Promise<boolean> {
  const failKey = rateLimitKey(
    AUTH_RATE_LIMIT_SCOPES.signInPasswordFail,
    accountKey,
  );
  const failCeilingReached = await isRateLimitExceeded(
    failKey,
    SIGN_IN_PASSWORD_FAIL_LIMIT.limit,
    SIGN_IN_PASSWORD_FAIL_LIMIT.windowMs,
  );
  const passwordValid = await compare(password, passwordHash);
  const decision = evaluateSignInPasswordAttempt({
    passwordValid,
    failCeilingReached,
  });
  if (decision.recordFailure) {
    await checkRateLimit(
      failKey,
      SIGN_IN_PASSWORD_FAIL_LIMIT.limit,
      SIGN_IN_PASSWORD_FAIL_LIMIT.windowMs,
    );
  }
  return decision.accept;
}

const googleConfigured =
  Boolean(process.env.AUTH_GOOGLE_ID?.trim()) &&
  Boolean(process.env.AUTH_GOOGLE_SECRET?.trim());

/**
 * Prisma stores `portal` as a plain string; Auth.js expects the `Portal` union.
 * Validate at runtime instead of asserting, so a corrupt row fails loudly.
 */
function toAdapterUser(user: PrismaUser): AdapterUser {
  if (!isPortal(user.portal)) {
    throw new Error(`Invalid portal "${user.portal}" on user ${user.id}`);
  }
  return { ...user, portal: user.portal };
}

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

      const created = await prisma.user.create({
        data: {
          email: data.email!,
          emailVerified: data.emailVerified ?? null,
          name: data.name?.trim().slice(0, NAME_MAX) || null,
          image: data.image ?? null,
          portal,
          slug,
        },
      });
      return toAdapterUser(created);
    },
    getUserByEmail: async (email) => {
      const user = await prisma.user.findUnique({
        where: { email_portal: { email, portal } },
      });
      if (!user || user.deletedAt) return null;
      return toAdapterUser(user);
    },
    getUserByAccount: async ({ provider, providerAccountId }) => {
      const account = await prisma.account.findFirst({
        where: {
          provider,
          providerAccountId,
          user: { portal, deletedAt: null },
        },
        include: { user: true },
      });
      return account ? toAdapterUser(account.user) : null;
    },
  };
}

export function createPortalAuth(portal: Portal) {
  const config = createPortalAuthConfig(portal);

  return NextAuth({
    ...config,
    adapter: createPortalPrismaAdapter(portal),
    providers: [
      ...(googleConfigured && portal === "masseur"
        ? [
            Google({
              clientId: process.env.AUTH_GOOGLE_ID,
              clientSecret: process.env.AUTH_GOOGLE_SECRET,
              // Never auto-link Google to an existing password user by email alone (#76).
              allowDangerousEmailAccountLinking: false,
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
          phone: { label: "Phone", type: "text" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials, request) {
          if (portal === "client") {
            // Auth.js posts credentials as x-www-form-urlencoded; "+" may become
            // a space or be stripped. Normalize to E.164 before Zod.
            const raw =
              typeof credentials?.phone === "string"
                ? credentials.phone.trim()
                : "";
            const digits = raw.replace(/\D/g, "");
            const phoneValue = digits ? `+${digits}` : raw;

            const parsed = clientLoginSchema.safeParse({
              phone: phoneValue,
              password: credentials?.password,
            });
            if (!parsed.success) {
              return null;
            }

            const { phone, password } = parsed.data;
            const accountKey = `client:${phone}`;
            await enforceSignInIpLimit(request);

            const user = await findPortalUserByPhone(phone, portal);

            if (!user?.passwordHash) {
              return null;
            }
            if (user.blockedAt) {
              throw new AccountBlockedSignIn();
            }

            const accepted = await passwordPassesSignInFailCeiling(
              accountKey,
              password,
              user.passwordHash,
            );
            if (!accepted) {
              return null;
            }

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.image,
              portal,
            };
          }

          // Masseur + admin: email + password.
          const parsed = loginSchema.safeParse({
            email: credentials?.email,
            password: credentials?.password,
          });
          if (!parsed.success) {
            return null;
          }

          const { email, password } = parsed.data;
          const accountKey = `${portal}:${email}`;
          await enforceSignInIpLimit(request);

          const user = await findPortalUserByEmail(email, portal);

          if (!user?.passwordHash) {
            return null;
          }
          if (user.blockedAt) {
            throw new AccountBlockedSignIn();
          }

          const accepted = await passwordPassesSignInFailCeiling(
            accountKey,
            password,
            user.passwordHash,
          );
          if (!accepted) {
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
                where: { id: user.id, portal, deletedAt: null },
                select: { id: true, blockedAt: true },
              })
            : null;

        if (account?.provider === "google") {
          const providerAccountId =
            typeof account.providerAccountId === "string"
              ? account.providerAccountId
              : null;

          let googleAccountAlreadyLinked = false;
          if (dbUser && providerAccountId) {
            const linked = await prisma.account.findFirst({
              where: {
                userId: dbUser.id,
                provider: "google",
                providerAccountId,
              },
              select: { id: true },
            });
            googleAccountAlreadyLinked = Boolean(linked);
          }

          const intent = await readAuthIntentCookie("login");
          const decision = decideGoogleSignIn({
            existingUser: dbUser
              ? { id: dbUser.id, blockedAt: dbUser.blockedAt }
              : null,
            googleAccountAlreadyLinked,
            authIntent: intent === "register" ? "register" : "login",
          });

          if (!decision.allow) {
            return `${portalHomePath(portal)}?error=${decision.error}`;
          }
          return true;
        }

        if (dbUser) {
          if (dbUser.blockedAt) {
            return `${portalHomePath(portal)}?error=blocked`;
          }
          return true;
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
          where: {
            id: token.sub,
            portal,
            deletedAt: null,
            blockedAt: null,
          },
          select: {
            id: true,
            name: true,
            nameEn: true,
            nameUk: true,
            email: true,
            image: true,
            passwordChangedAt: true,
          },
        });

        if (!existing) {
          return {};
        }

        // Server-side credential check: JWT claim alone is not enough (#79).
        const version = applyPasswordVersionToJwt({
          token,
          dbPasswordChangedAt: existing.passwordChangedAt,
          isInitialSignIn: Boolean(user),
        });
        if (version === "stale") {
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
