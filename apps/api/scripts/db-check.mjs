import pg from 'pg';
import { requiredColumns, requiredConstraints, requiredNotNullColumns, requiredTables } from './migration-contract.mjs';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL ?? 'postgres://enervita:enervita@localhost:5432/enervita_crm';
const client = new Client({ connectionString: databaseUrl });

const failures = [];

try {
  await client.connect();

  const tableResult = await client.query(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
        and table_name = any($1::text[])
      order by table_name`,
    [requiredTables],
  );
  const existingTables = new Set(tableResult.rows.map((row) => row.table_name));

  for (const table of requiredTables) {
    if (!existingTables.has(table)) failures.push(`missing table: ${table}`);
  }

  const columnResult = await client.query(
    `select table_name, column_name, is_nullable
       from information_schema.columns
      where table_schema = 'public'
        and table_name = any($1::text[])
      order by table_name, ordinal_position`,
    [requiredTables],
  );

  const columnsByTable = new Map();
  const nullableByTableAndColumn = new Map();
  for (const row of columnResult.rows) {
    if (!columnsByTable.has(row.table_name)) columnsByTable.set(row.table_name, new Set());
    columnsByTable.get(row.table_name).add(row.column_name);
    nullableByTableAndColumn.set(`${row.table_name}.${row.column_name}`, row.is_nullable === 'YES');
  }

  for (const [table, columns] of Object.entries(requiredColumns)) {
    const existingColumns = columnsByTable.get(table) ?? new Set();
    for (const column of columns) {
      if (!existingColumns.has(column)) failures.push(`missing column: ${table}.${column}`);
    }
  }

  for (const [table, columns] of Object.entries(requiredNotNullColumns)) {
    for (const column of columns) {
      if (nullableByTableAndColumn.get(`${table}.${column}`) !== false) {
        failures.push(`nullable tenant-scoped column: ${table}.${column}`);
      }
    }
  }

  const constraintResult = await client.query(
    `select constraint_name
       from information_schema.table_constraints
      where table_schema = 'public'
        and constraint_name = any($1::text[])`,
    [requiredConstraints],
  );
  const existingConstraints = new Set(constraintResult.rows.map((row) => row.constraint_name));
  for (const constraint of requiredConstraints) {
    if (!existingConstraints.has(constraint)) failures.push(`missing constraint: ${constraint}`);
  }

  const migrationResult = await client.query(
    `select version from schema_migrations where version = $1`,
    ['001_initial_schema'],
  );
  if (migrationResult.rowCount !== 1) failures.push('missing schema_migrations row: 001_initial_schema');

  if (failures.length > 0) {
    console.error('Database schema check failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`Database schema check passed: ${requiredTables.length} CRM tables validated.`);
} catch (error) {
  console.error('Database schema check failed.');
  console.error(error.message || error.toString());
  if (Array.isArray(error.errors)) {
    for (const nestedError of error.errors) {
      console.error(`- ${nestedError.message || nestedError.toString()}`);
    }
  }
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
