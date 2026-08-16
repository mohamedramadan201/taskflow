import { loadEnvFile } from "node:process";
import pg from "pg";

loadEnvFile();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const existing = await client.query(`
    select 1
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    where enum_type.typname = 'TaskStatus'
      and enum_value.enumlabel = 'NO_ACTION_NEEDED'
  `);

  if (existing.rowCount === 0) {
    // PostgreSQL enum additions are intentionally applied outside a transaction.
    await client.query(`alter type "TaskStatus" add value 'NO_ACTION_NEEDED'`);
    console.log("Added NO_ACTION_NEEDED to TaskStatus.");
  } else {
    console.log("NO_ACTION_NEEDED is already present.");
  }

  const verification = await client.query(`
    select enum_value.enumlabel
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    where enum_type.typname = 'TaskStatus'
    order by enum_value.enumsortorder
  `);
  console.log(JSON.stringify(verification.rows.map((row) => row.enumlabel)));
} finally {
  await client.end();
}
