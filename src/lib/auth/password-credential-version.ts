/**
 * JWT password-credential versioning (#79).
 *
 * Auth.js uses JWT sessions; deleting DB `Session` rows does not revoke cookies.
 * Stamp `pwdChangedAt` into the JWT at sign-in and re-check against
 * `User.passwordChangedAt` on every jwt refresh (DB is source of truth).
 */

export function passwordChangedAtMs(
  value: Date | null | undefined,
): number {
  return value?.getTime() ?? 0;
}

/**
 * True when the DB credential version is newer than the version stamped
 * into the JWT at issue/sign-in time.
 */
export function isJwtPasswordStale(
  tokenPasswordChangedAtMs: number,
  dbPasswordChangedAtMs: number,
): boolean {
  return dbPasswordChangedAtMs > tokenPasswordChangedAtMs;
}

export type PasswordVersionJwtToken = {
  pwdChangedAt?: number;
};

/**
 * On initial sign-in, stamp the current DB version into the token.
 * On later refreshes, reject the token when the DB version moved forward
 * (password reset/change).
 */
export function applyPasswordVersionToJwt(options: {
  token: PasswordVersionJwtToken;
  dbPasswordChangedAt: Date | null | undefined;
  isInitialSignIn: boolean;
}): "ok" | "stale" {
  const dbPwd = passwordChangedAtMs(options.dbPasswordChangedAt);

  if (options.isInitialSignIn) {
    options.token.pwdChangedAt = dbPwd;
    return "ok";
  }

  const tokenPwd =
    typeof options.token.pwdChangedAt === "number"
      ? options.token.pwdChangedAt
      : 0;

  if (isJwtPasswordStale(tokenPwd, dbPwd)) {
    return "stale";
  }

  return "ok";
}
