import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { migrationFile } from './migration-contract.mjs';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL ?? 'postgres://enervita:enervita@localhost:5432/enervita_crm';

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
  const sql = await readFile(migrationFile, 'utf8');
  await client.connect();
  await client.query('begin');
  await client.query(sql);
  await client.query('commit');
  console.log(`Applied migration: ${migrationFile}`);
} catch (error) {
  try {
    await client.query('rollback');
  } catch {
    // Ignore rollback errors when connection was not established.
  }
  console.error('Database migration failed.');
  printError(error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
