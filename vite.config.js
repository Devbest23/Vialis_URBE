import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiProxy = {
  '/api': { target: 'http://localhost:4000', changeOrigin: true },
  '/ws': { target: 'ws://localhost:4000', ws: true },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: apiProxy },
  preview: { port: 4173, proxy: apiProxy },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'zustand', '@tanstack/react-virtual'],
          leaflet: ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
})
