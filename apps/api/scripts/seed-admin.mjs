#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const seedEntrypoint = resolve(scriptDir, '../src/db/seedAdmin.ts');
const tsxBin = process.platform === 'win32' ? 'tsx.cmd' : 'tsx';

const child = spawn(tsxBin, [seedEntrypoint], {
  stdio: 'inherit',
  env: process.env,
  shell: false,
});

child.on('error', (error) => {
  console.error('Admin seed failed.');
  console.error(`Unable to start tsx seed runner: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error('Admin seed failed.');
    console.error(`Seed runner terminated by signal ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
