import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { createDotacionHandler } from './server/dotacion/handler.ts'
import { createIntakeHandler } from './server/intake/handler.ts'

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'local-dotacion-api',
    configureServer(server) {
      // Server variables remain in Node. They are never exposed with a VITE_ prefix.
      const env = { ...loadEnv('dotacion', process.cwd(), ''), ...loadEnv(server.config.mode, process.cwd(), ''), ...process.env }
      const handler = createDotacionHandler(undefined, env)
      server.middlewares.use('/api/admin-dotacion', (req, res) => { void handler(req, res) })
      const intakeHandler = createIntakeHandler(undefined, env)
      server.middlewares.use('/api/access-intake', (req, res) => { void intakeHandler(req, res) })
    },
  }],
  server: {
    fs: {
      // Keep offline reconciliation identifiers and existing private workbooks
      // inaccessible even when running the development server.
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.local/**', '**/server/**', '**/api/**', '**/*.xlsx', '**/*.sqlite', '**/*.local'],
    },
  },
})
