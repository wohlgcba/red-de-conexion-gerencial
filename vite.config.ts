import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    fs: {
      // Keep offline reconciliation identifiers and existing private workbooks
      // inaccessible even when running the development server.
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.local/**', '**/*.xlsx', '**/*.sqlite', '**/*.local'],
    },
  },
})
