import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // Chemins relatifs : le site s'ouvre aussi bien à la racine que dans un sous-dossier.
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5174,
  },
  preview: {
    host: '127.0.0.1',
    port: 4174,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
