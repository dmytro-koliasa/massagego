/**
 * Masseur Google sign-in linking policy (#76).
 *
 * Email match alone must never attach Google to an existing password account.
 * Linking another auth method requires a separate, authenticated flow (future issue).
 */

export type GoogleAuthIntent = "login" | "register";

export type GoogleLinkError =
  | "blocked"
  | "oauth_not_linked"
  | "no_portal_access";

export type GoogleLinkDecision =
  | { allow: true }
  | { allow: false; error: GoogleLinkError };

export type GoogleSignInContext = {
  existingUser: { id: string; blockedAt: Date | null } | null;
  /** True when this Google providerAccountId is already linked to existingUser. */
  googleAccountAlreadyLinked: boolean;
  authIntent: GoogleAuthIntent;
};

/**
 * Decide whether a Google OAuth callback may proceed for the masseur portal.
 *
 * - Returning Google users (already linked): allow.
 * - Brand-new email (no portal user) + register intent: allow create.
 * - Existing portal user by email without this Google account: refuse (no auto-link).
 */
export function decideGoogleSignIn(
  context: GoogleSignInContext,
): GoogleLinkDecision {
  const { existingUser, googleAccountAlreadyLinked, authIntent } = context;

  if (existingUser) {
    if (existingUser.blockedAt) {
      return { allow: false, error: "blocked" };
    }
    if (googleAccountAlreadyLinked) {
      return { allow: true };
    }
    return { allow: false, error: "oauth_not_linked" };
  }

  if (authIntent === "register") {
    return { allow: true };
  }

  return { allow: false, error: "no_portal_access" };
}
