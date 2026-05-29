import { readFile } from 'node:fs/promises';
import {
  migrationFiles,
  requiredColumns,
  requiredConstraints,
  requiredEnums,
  requiredNotNullColumns,
  requiredTables,
} from './migration-contract.mjs';

const normalize = (sql) => sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').toLowerCase();

function extractCreateTableBody(sql, table) {
  const marker = `create table if not exists ${table}`;
  const start = sql.indexOf(marker);
  if (start === -1) return null;

  const open = sql.indexOf('(', start);
  if (open === -1) return null;

  let depth = 0;
  for (let index = open; index < sql.length; index += 1) {
    const char = sql[index];
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth === 0) return sql.slice(open + 1, index);
  }

  return null;
}

function hasColumn(tableBody, column) {
  return new RegExp(`(^|[,\\s])${column}\\s+`, 'i').test(tableBody);
}

function hasNotNullColumn(tableBody, column) {
  return new RegExp(`(^|[,\\s])${column}\\s+[^,]*\\bnot null\\b`, 'i').test(tableBody);
}

const failures = [];
let sql;
try {
  const sqlParts = await Promise.all(migrationFiles.map((file) => readFile(file, "utf8")));
  sql = sqlParts.join("\n");
} catch (error) {
  console.error("Migration file not found.");
  console.error(error.message);
  process.exit(1);
}
const normalized = normalize(sql);

for (const extension of ['pgcrypto']) {
  if (!normalized.includes(`create extension if not exists ${extension}`)) {
    failures.push(`missing idempotent extension: ${extension}`);
  }
}

for (const enumName of requiredEnums) {
  if (!normalized.includes(`typname = '${enumName}'`) && !normalized.includes(`create type ${enumName} as enum`)) {
    failures.push(`missing enum guarded by DO block or create type: ${enumName}`);
  }
}

for (const table of requiredTables) {
  const body = extractCreateTableBody(normalized, table);
  if (!body) {
    failures.push(`missing idempotent table: ${table}`);
    continue;
  }

  for (const column of requiredColumns[table] ?? []) {
    if (!hasColumn(body, column)) {
      failures.push(`missing column ${table}.${column}`);
    }
  }

  for (const column of requiredNotNullColumns[table] ?? []) {
    if (!hasNotNullColumn(body, column)) {
      failures.push(`missing not null column ${table}.${column}`);
    }
  }
}

for (const constraint of requiredConstraints) {
  if (!normalized.includes(`constraint ${constraint}`)) {
    failures.push(`missing constraint: ${constraint}`);
  }
}

if (!normalized.includes('create table if not exists schema_migrations')) {
  failures.push('missing schema_migrations table for idempotent migration bookkeeping');
}

if (!normalized.includes('insert into schema_migrations')) {
  failures.push('missing schema_migrations insert');
}

if (failures.length > 0) {
  console.error('Migration validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Migration validation passed for " + migrationFiles.join(", "));
console.log(`Validated ${requiredTables.length} tables and ${requiredEnums.length} enums.`);
