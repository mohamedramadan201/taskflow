import { readFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import pg from "pg";

loadEnvFile();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const existing = await client.query(`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'Task'
      and column_name in ('estimatedMinutes', 'blockedAt')
    order by column_name
  `);
  if (existing.rowCount === 0) {
    const sql = await readFile(new URL("../prisma/migrations/20260814160000_manager_workload/migration.sql", import.meta.url), "utf8");
    await client.query("begin");
    try { await client.query(sql); await client.query("commit"); }
    catch (error) { await client.query("rollback"); throw error; }
    console.log("Applied manager workload schema.");
  } else if (existing.rowCount !== 2) {
    throw new Error(`Partial workload schema detected (${existing.rows.map((row) => row.column_name).join(", ")}); migration was not applied.`);
  } else {
    console.log("Manager workload schema already present.");
  }
  const verification = await client.query(`
    select
      (select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'Task' and column_name in ('estimatedMinutes','remainingMinutes','actualMinutes','blockedAt','blockedReason','blockerTaskId')) as task_columns,
      (select count(*)::int from pg_indexes where schemaname = 'public' and indexname in ('Task_workspaceId_assigneeUserId_status_dueAt_idx','Task_workspaceId_blockedAt_idx','Task_blockerTaskId_idx')) as workload_indexes,
      (select relrowsecurity from pg_class where oid = 'public."MemberAvailability"'::regclass) as availability_rls
  `);
  console.log(JSON.stringify(verification.rows[0]));
} finally { await client.end(); }
