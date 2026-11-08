import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import vueDevTools from 'vite-plugin-vue-devtools'

const backendProxy = {
  target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000',
  changeOrigin: true,
}

export default defineConfig({
  plugins: [vue(), ...(process.env.VITE_DEVTOOLS === 'true' ? [vueDevTools()] : [])],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      ignored: ['**/dist-prerender', '**/dist-prerender/**', '**/.data', '**/.data/**'],
    },
    proxy: {
      '/api': backendProxy,
      '/media': backendProxy,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    proxy: {
      '/api': backendProxy,
      '/media': backendProxy,
    },
  },
})
