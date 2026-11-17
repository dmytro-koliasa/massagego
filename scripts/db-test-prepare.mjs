/**
 * Ensures the massage_test database exists on the local Docker Postgres
 * and applies Prisma migrations to it.
 *
 * Safe for an already-initialized volume (init scripts do not re-run).
 */
import { execSync } from "node:child_process";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://massage:massage@localhost:5432/massage_test?schema=public";

function run(command, env = process.env) {
  execSync(command, { stdio: "inherit", env });
}

try {
  run("docker compose exec -T db pg_isready -U massage -d massage");
} catch {
  console.error(
    "[db:test:prepare] Docker Postgres is not reachable. Run: npm run db:up",
  );
  process.exit(1);
}

try {
  run(
    'docker compose exec -T db psql -U massage -d postgres -c "CREATE DATABASE massage_test"',
  );
} catch {
  // Database already exists — continue to migrate.
  console.log("[db:test:prepare] massage_test already exists");
}

run("npx prisma migrate deploy", {
  ...process.env,
  DATABASE_URL: TEST_DATABASE_URL,
});

console.log(`[db:test:prepare] Ready: ${TEST_DATABASE_URL}`);
