import { execFileSync } from "node:child_process";
import pg from "pg";

const isProductionDeployment = process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";
const explicitlyEnabled = process.env.RUN_DB_MIGRATIONS === "true";

if (!isProductionDeployment && !explicitlyEnabled) {
  console.log("Skipping production database migrations outside a production deployment.");
  process.exit(0);
}

if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  throw new Error("Production database migrations require DATABASE_URL or DIRECT_URL.");
}

console.log("Applying pending Prisma migrations...");

const historicalMigration = "20260816130000_inbound_email_no_action_needed";
const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const client = new pg.Client({ connectionString: migrationUrl });
await client.connect();

try {
  const result = await client.query(`
    SELECT
      EXISTS (
        SELECT 1
        FROM pg_type type
        JOIN pg_enum value ON value.enumtypid = type.oid
        WHERE type.typname = 'InboundEmailStatus'
          AND value.enumlabel = 'NO_ACTION_NEEDED'
      ) AS "enumValueExists",
      EXISTS (
        SELECT 1
        FROM "_prisma_migrations"
        WHERE "migration_name" = $1
          AND "finished_at" IS NOT NULL
          AND "rolled_back_at" IS NULL
      ) AS "migrationAlreadyApplied"
  `, [historicalMigration]);

  const state = result.rows[0];
  if (state.enumValueExists && !state.migrationAlreadyApplied) {
    console.log(`Repairing already-present schema state for ${historicalMigration}...`);
    execFileSync("pnpm", ["exec", "prisma", "migrate", "resolve", "--applied", historicalMigration], { stdio: "inherit" });
  }
} finally {
  await client.end();
}

execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], { stdio: "inherit" });
