/**
 * Local / pre-release check for booking exclusion constraints (P-1).
 *
 * Verifies against DATABASE_URL (from env or `.env`):
 * - btree_gist extension
 * - Booking_no_overlapping_active_slots
 * - Booking_no_overlapping_active_client_slots
 * - SHOW timezone (informational)
 * - overlapping active booking pair counts (masseur + client)
 *
 * Exit 1 if an extension/constraint is missing or any overlap count > 0.
 *
 * Usage: npm run db:verify-constraints
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

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

const MASSAGEUR_CONSTRAINT = "Booking_no_overlapping_active_slots";
const CLIENT_CONSTRAINT = "Booking_no_overlapping_active_client_slots";

let failed = false;

function fail(message) {
  console.error(`[db:verify-constraints] FAIL ${message}`);
  failed = true;
}

function ok(message) {
  console.log(`[db:verify-constraints] OK   ${message}`);
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  fail("DATABASE_URL is missing");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();

  const extensions = await client.query(
    `SELECT extname FROM pg_extension WHERE extname = 'btree_gist'`,
  );
  if (extensions.rowCount === 0) {
    fail("extension btree_gist is not installed");
  } else {
    ok("extension btree_gist");
  }

  const constraints = await client.query(
    `SELECT conname
     FROM pg_constraint
     WHERE conname = ANY($1::text[])`,
    [[MASSAGEUR_CONSTRAINT, CLIENT_CONSTRAINT]],
  );
  const names = new Set(constraints.rows.map((row) => row.conname));
  for (const name of [MASSAGEUR_CONSTRAINT, CLIENT_CONSTRAINT]) {
    if (names.has(name)) {
      ok(`constraint ${name}`);
    } else {
      fail(`constraint ${name} is missing`);
    }
  }

  const tzRows = await client.query(`SHOW timezone`);
  const timezone = tzRows.rows[0]?.TimeZone ?? tzRows.rows[0]?.timezone ?? "(unknown)";
  console.log(`[db:verify-constraints] INFO timezone=${timezone}`);

  const masseurOverlaps = await client.query(`
    SELECT count(*)::int AS count
    FROM "Booking" a
    JOIN "Booking" b
      ON a."masseurId" = b."masseurId"
     AND a."id" < b."id"
    WHERE a."slotStart" IS NOT NULL
      AND b."slotStart" IS NOT NULL
      AND a."status" <> 'cancelled'
      AND b."status" <> 'cancelled'
      AND a."slotStart" < b."slotStart" + interval '1 hour'
      AND b."slotStart" < a."slotStart" + interval '1 hour'
  `);
  const masseurCount = masseurOverlaps.rows[0]?.count ?? 0;
  if (masseurCount > 0) {
    fail(`masseur overlapping active pairs: ${masseurCount}`);
  } else {
    ok("masseur overlapping active pairs: 0");
  }

  const clientOverlaps = await client.query(`
    SELECT count(*)::int AS count
    FROM "Booking" a
    JOIN "Booking" b
      ON a."clientUserId" = b."clientUserId"
     AND a."id" < b."id"
    WHERE a."slotStart" IS NOT NULL
      AND b."slotStart" IS NOT NULL
      AND a."clientUserId" IS NOT NULL
      AND b."clientUserId" IS NOT NULL
      AND a."status" <> 'cancelled'
      AND b."status" <> 'cancelled'
      AND a."slotStart" < b."slotStart" + interval '1 hour'
      AND b."slotStart" < a."slotStart" + interval '1 hour'
  `);
  const clientCount = clientOverlaps.rows[0]?.count ?? 0;
  if (clientCount > 0) {
    fail(`client overlapping active pairs: ${clientCount}`);
  } else {
    ok("client overlapping active pairs: 0");
  }
} catch (error) {
  console.error(
    "[db:verify-constraints] Could not query the database. Is Postgres up (`npm run db:up`)?",
  );
  console.error(error instanceof Error ? error.message : error);
  failed = true;
} finally {
  await client.end().catch(() => {});
}

if (failed) {
  process.exit(1);
}

console.log("[db:verify-constraints] All checks passed");
