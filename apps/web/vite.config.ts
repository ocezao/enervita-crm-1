import { defineConfig } from 'vite'
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
  preview: {
    allowedHosts: allowedHostsFromEnv(),
  },
})
