import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
function allowedHostsFromEnv() {
  const base = [
    'crm.enervita.com.br',
    'web',
    'enervita-custom-crm-web',
    'enervita-prod-crm-web',
  ];

  const envHosts = (process.env.VITE_PREVIEW_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);

  return [...new Set([...base, ...envHosts])];
}

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'jsdom',
    fileParallelism: false,
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/e2e/**',
      '**/e2e/**',
      '**/*.spec.ts',
      '**/*.spec.tsx',
    ],
  },
  preview: {
    allowedHosts: allowedHostsFromEnv(),
  },
})
