/**
 * Start production Next for local E2E (#207 verification).
 * Forces AUTH_URL / DATABASE_URL alignment with Playwright.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env");
const env = { ...process.env };

for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
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
  if (env[key] === undefined) env[key] = value;
}

const port = process.env.E2E_PORT || "3001";
const baseURL = `http://127.0.0.1:${port}`;
env.AUTH_URL = baseURL;
env.EMAIL_PROVIDER = "log";
if (env.TEST_DATABASE_URL) {
  env.DATABASE_URL = env.TEST_DATABASE_URL;
}

console.log(`Starting next start on ${baseURL} (DATABASE_URL=TEST_DATABASE_URL)`);
const child = spawn("npx", ["next", "start", "-p", port], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: true,
});
child.on("exit", (code) => process.exit(code ?? 1));
