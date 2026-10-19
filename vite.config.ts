import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';

export default defineConfig({
  plugins: [react(), nitro({
    serverDir: 'server',
    preset: 'vercel',
    experimental: { tasks: true },
    scheduledTasks: { '0 3 * * *': 'sharing:expire' },
  })],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
