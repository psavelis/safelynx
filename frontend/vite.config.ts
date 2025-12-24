import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 7900,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://localhost:7889',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:7889',
        ws: true,
      },
      '/files': {
        target: 'http://localhost:7889',
        changeOrigin: true,
      },
    },
  },
})
