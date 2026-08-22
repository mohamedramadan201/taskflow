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
  const isMigrationApplied = async (migrationName) => {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM "_prisma_migrations"
        WHERE "migration_name" = $1
          AND "finished_at" IS NOT NULL
          AND "rolled_back_at" IS NULL
      ) AS "migrationAlreadyApplied"
    `, [migrationName]);
    return result.rows[0].migrationAlreadyApplied;
  };

  const resolveAsApplied = (migrationName) => {
    console.log(`Repairing already-present schema state for ${migrationName}...`);
    execFileSync("pnpm", ["exec", "prisma", "migrate", "resolve", "--applied", migrationName], { stdio: "inherit" });
  };

  const result = await client.query(`
    SELECT
      EXISTS (
        SELECT 1
        FROM pg_type type
        JOIN pg_enum value ON value.enumtypid = type.oid
        WHERE type.typname = 'InboundEmailStatus'
          AND value.enumlabel = 'NO_ACTION_NEEDED'
      ) AS "enumValueExists"
  `);

  const state = result.rows[0];
  if (state.enumValueExists && !(await isMigrationApplied(historicalMigration))) {
    resolveAsApplied(historicalMigration);
  }

  const followUpMigration = "20260819190000_task_follow_up_with";
  const followUpState = await client.query(`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Task'
          AND column_name = 'followUpWith'
      ) AS "columnExists",
      EXISTS (
        SELECT 1
        FROM pg_class class_rel
        JOIN pg_namespace namespace_rel ON namespace_rel.oid = class_rel.relnamespace
        WHERE namespace_rel.nspname = 'public'
          AND class_rel.relname = 'Task_workspaceId_followUpWith_idx'
      ) AS "indexExists"
  `);

  if (followUpState.rows[0].columnExists) {
    if (!followUpState.rows[0].indexExists) {
      await client.query('CREATE INDEX IF NOT EXISTS "Task_workspaceId_followUpWith_idx" ON "Task"("workspaceId", "followUpWith")');
    }
    if (!(await isMigrationApplied(followUpMigration))) {
      resolveAsApplied(followUpMigration);
    }
  }

  const teamGroupsMigration = "20260820100000_team_groups";
  const teamGroupsState = await client.query(`
    SELECT to_regclass('public."TeamGroup"') IS NOT NULL AS "tableExists"
  `);

  if (teamGroupsState.rows[0].tableExists) {
    await client.query('ALTER TABLE "WorkspaceMember" ADD COLUMN IF NOT EXISTS "teamGroupId" TEXT');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "TeamGroup_workspaceId_name_key" ON "TeamGroup"("workspaceId", "name")');
    await client.query('CREATE INDEX IF NOT EXISTS "TeamGroup_workspaceId_createdAt_idx" ON "TeamGroup"("workspaceId", "createdAt")');
    await client.query('CREATE INDEX IF NOT EXISTS "WorkspaceMember_teamGroupId_idx" ON "WorkspaceMember"("teamGroupId")');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'TeamGroup_workspaceId_fkey'
        ) THEN
          ALTER TABLE "TeamGroup"
            ADD CONSTRAINT "TeamGroup_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'WorkspaceMember_teamGroupId_fkey'
        ) THEN
          ALTER TABLE "WorkspaceMember"
            ADD CONSTRAINT "WorkspaceMember_teamGroupId_fkey"
            FOREIGN KEY ("teamGroupId") REFERENCES "TeamGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
    await client.query('ALTER TABLE "TeamGroup" ENABLE ROW LEVEL SECURITY');
    if (!(await isMigrationApplied(teamGroupsMigration))) {
      resolveAsApplied(teamGroupsMigration);
    }
  }
} finally {
  await client.end();
}

execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], { stdio: "inherit" });
