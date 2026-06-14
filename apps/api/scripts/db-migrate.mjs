import { readFile } from "node:fs/promises";
import pg from "pg";
import { migrationFiles } from "./migration-contract.mjs";

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL ?? "postgres://enervita_app:***@localhost:5432/enervita_crm";

const client = new Client({ connectionString: databaseUrl });

function printError(error) {
  console.error(error.message || error.toString());
  if (Array.isArray(error.errors)) {
    for (const nestedError of error.errors) {
      console.error(`- ${nestedError.message || nestedError.toString()}`);
    }
  }
}

try {
  await client.connect();
  
  // Ensure schema_migrations table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      description text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Get already applied migrations
  const applied = await client.query("SELECT version FROM schema_migrations");
  const appliedSet = new Set(applied.rows.map(r => r.version));
  
  let appliedCount = 0;
  let skippedCount = 0;

  for (const migrationFile of migrationFiles) {
    const version = migrationFile.split('/').pop().replace('.sql', '');
    
    if (appliedSet.has(version)) {
      skippedCount++;
      continue;
    }
    
    const sql = await readFile(migrationFile, "utf8");
    const description = sql.split('\n')[0].replace(/^--\s*/, '').trim() || version;
    
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (version, description) VALUES ($1, $2)",
        [version, description]
      );
      await client.query("COMMIT");
      console.log(`Applied migration: ${version}`);
      appliedCount++;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    }
  }

  console.log(`Migration complete: ${appliedCount} applied, ${skippedCount} skipped`);
} catch (error) {
  console.error("Database migration failed.");
  printError(error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
