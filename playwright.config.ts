import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

function applyEnvFile(fileName: string) {
  const full = path.resolve(__dirname, fileName);
  if (!fs.existsSync(full)) return;
  for (const raw of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
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
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

applyEnvFile(".env");
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL =
    "postgresql://massage:massage@localhost:5432/massage_test?schema=public";
}

const port = Number(process.env.E2E_PORT ?? "3001");
// Keep browser origin and Auth.js AUTH_URL on the same host. Mixing
// localhost vs 127.0.0.1 breaks session cookies for local E2E (#216).
const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx next dev --webpack -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      // Force after spreading process.env so a developer .env AUTH_URL cannot
      // disagree with Playwright baseURL (localhost vs 127.0.0.1).
      AUTH_URL: baseURL,
      // Avoid real provider calls (Resend/etc.) during local Playwright runs.
      EMAIL_PROVIDER: "log",
      // Prefer the dedicated test DB when present so E2E does not touch dev data.
      ...(process.env.TEST_DATABASE_URL
        ? { DATABASE_URL: process.env.TEST_DATABASE_URL }
        : {}),
    },
  },
});
