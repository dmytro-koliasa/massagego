/**
 * Free local stand-in for a frequent notifications scheduler (#89).
 * Repeatedly runs the same GET as `npm run cron:notifications`.
 *
 * Usage (with `next dev` running):
 *   npm run cron:notifications:loop
 *
 * Env:
 *   CRON_POLL_MS — interval between runs (default 300000 = 5 minutes)
 *   Same CRON_SECRET / CRON_BASE_URL / AUTH_URL / .env rules as cron-notifications.mjs
 *
 * Stop with Ctrl+C. Does not touch Vercel or production hosting.
 */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = resolve(ROOT, "scripts", "cron-notifications.mjs");
const pollMsRaw = Number(process.env.CRON_POLL_MS ?? 300_000);
const pollMs =
  Number.isFinite(pollMsRaw) && pollMsRaw >= 5_000 ? pollMsRaw : 300_000;

function runOnce() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`cron-notifications exited with code ${code}`));
    });
  });
}

console.log(
  `[cron:notifications:loop] polling every ${pollMs}ms — Ctrl+C to stop`,
);

let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
  console.log("\n[cron:notifications:loop] stopping…");
});
process.on("SIGTERM", () => {
  stopping = true;
});

while (!stopping) {
  const started = Date.now();
  try {
    await runOnce();
  } catch (error) {
    console.error(
      "[cron:notifications:loop]",
      error instanceof Error ? error.message : error,
    );
  }
  if (stopping) break;
  const wait = Math.max(0, pollMs - (Date.now() - started));
  await new Promise((r) => setTimeout(r, wait));
}
