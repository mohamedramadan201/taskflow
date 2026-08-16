import { loadEnvFile } from "node:process";
import pg from "pg";

loadEnvFile();
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 15_000 });
try {
  const tables = ["EmailConnector", "EmailFilterRule", "InboundEmail"];
  const result = await pool.query(`
    select c.relname as name, c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = any($1::text[])
    order by c.relname
  `, [tables]);
  if (result.rows.length !== tables.length || result.rows.some((row) => !row.rls)) throw new Error("Email tables are missing or are not protected by RLS");
  const migration = await pool.query(`select finished_at from _prisma_migrations where migration_name = $1 and rolled_back_at is null`, ["20260816120000_email_inbox_connectors"]);
  if (migration.rowCount !== 1 || !migration.rows[0].finished_at) throw new Error("Email migration is not recorded as successfully applied");
  console.log(`Verified ${result.rows.length} email tables, RLS protection, and the applied migration.`);
} finally {
  await pool.end();
}
