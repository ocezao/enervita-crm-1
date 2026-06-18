import { spawn } from 'node:child_process';

const command = process.platform === 'win32' ? 'vitest.cmd' : 'vitest';
const userArgs = process.argv.slice(2);
const hasExplicitTestPath = userArgs.some((arg) => !arg.startsWith('-'));
const defaultTestPaths = ['src'];

const child = spawn(command, ['run', '--no-file-parallelism', ...(hasExplicitTestPath ? [] : defaultTestPaths), ...userArgs], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    NODE_ENV: 'test',
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
