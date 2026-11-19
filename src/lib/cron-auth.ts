import { timingSafeEqual } from "crypto";

/**
 * Shared Bearer CRON_SECRET check for cron routes (#116).
 * Fail-closed in every environment: missing/empty secret rejects.
 */

export type CronAuthEnv = {
  secret: string | null;
};

function secretsEqual(expected: string, received: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function readCronAuthEnv(
  env: NodeJS.ProcessEnv = process.env,
): CronAuthEnv {
  const secret = env.CRON_SECRET?.trim() || null;
  return { secret };
}

/**
 * Authorize a cron request.
 * @returns true only when Authorization is `Bearer <CRON_SECRET>`.
 */
export function authorizeCron(
  request: Request,
  env: CronAuthEnv = readCronAuthEnv(),
): boolean {
  const secret = env.secret?.trim() || null;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  if (!header) return false;

  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const token = header.slice(prefix.length);
  return secretsEqual(secret, token);
}
