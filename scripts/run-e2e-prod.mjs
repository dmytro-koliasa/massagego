/**
 * Run Playwright against an already-started production server (#207).
 * Ensures ADMIN_BOOTSTRAP_* and TEST DB vars are present in the Playwright process.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const env = { ...process.env };

for (const raw of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq <= 0) continue;
  const key = line.slice(0, eq).trim();
  let value = line.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  // Force-load bootstrap secrets for E2E even if empty placeholders exist.
  if (key.startsWith("ADMIN_BOOTSTRAP_") || env[key] === undefined || env[key] === "") {
    env[key] = value;
  }
}

if (!env.ADMIN_BOOTSTRAP_EMAIL || !env.ADMIN_BOOTSTRAP_PASSWORD) {
  console.error("ADMIN_BOOTSTRAP_* missing after loading .env");
  process.exit(1);
}

env.EMAIL_PROVIDER = "log";
if (env.TEST_DATABASE_URL) env.DATABASE_URL = env.TEST_DATABASE_URL;

const args = process.argv.slice(2);
const result = spawnSync(
  "npx",
  ["playwright", "test", ...args],
  { cwd: root, env, stdio: "inherit", shell: true },
);
process.exit(result.status ?? 1);
