/**
 * Local stand-in for Vercel Cron: drains NotificationOutbox via
 * GET /api/cron/notifications.
 *
 * Usage (with `next dev` running):
 *   npm run cron:notifications
 *
 * Reads CRON_SECRET and optional CRON_BASE_URL from the environment
 * or from `.env` in the project root. CRON_SECRET is required (#116);
 * the script exits if it is missing.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(resolve(ROOT, ".env"));

const baseUrl = (
  process.env.CRON_BASE_URL?.trim() ||
  process.env.AUTH_URL?.trim() ||
  "http://localhost:3000"
).replace(/\/$/, "");
const secret = process.env.CRON_SECRET?.trim() ?? "";
const url = `${baseUrl}/api/cron/notifications`;

if (!secret) {
  console.error(
    "[cron:notifications] CRON_SECRET is required (fail-closed, #116). Set it in `.env`.",
  );
  process.exit(1);
}

const headers = {
  Accept: "application/json",
  Authorization: `Bearer ${secret}`,
};

let response;
try {
  response = await fetch(url, { method: "GET", headers });
} catch (error) {
  console.error(
    `[cron:notifications] Could not reach ${url}. Is \`npm run dev\` running?`,
  );
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const bodyText = await response.text();
let body;
try {
  body = JSON.parse(bodyText);
} catch {
  body = bodyText;
}

if (!response.ok) {
  console.error(`[cron:notifications] ${response.status}`, body);
  process.exit(1);
}

console.log(`[cron:notifications] ${response.status}`, body);
