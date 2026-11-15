import { isIPv4 } from 'node:net'
import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import vueDevTools from 'vite-plugin-vue-devtools'

const backendProxy = {
  target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000',
  changeOrigin: true,
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const base = env.VITE_BASE_PATH || '/'
  if (!/^\/(?:[a-zA-Z0-9_-][a-zA-Z0-9._-]*\/)*$/.test(base)) {
    throw new Error('VITE_BASE_PATH must be / or a directory path such as /repository/.')
  }
  if (mode === 'github-pages') {
    let api: URL
    try {
      api = new URL(env.VITE_API_BASE_URL || '')
    } catch {
      throw new Error('GitHub Pages requires the repository variable VITE_API_BASE_URL.')
    }
    // URL canonicalizes shorthand/decimal/hex IPs, e.g. 127.1 -> 127.0.0.1.
    const hostname = api.hostname.replace(/\.$/, '')
    const localHost =
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '[::1]' ||
      (isIPv4(hostname) && /^(?:127|0)\./.test(hostname))
    if (
      api.protocol !== 'https:' ||
      api.username ||
      api.password ||
      api.pathname !== '/' ||
      api.search ||
      api.hash ||
      api.href !== `${api.origin}/` ||
      localHost ||
      !hostname.includes('.')
    ) {
      throw new Error(
        'GitHub Pages requires a public HTTPS API origin, without a path or credentials.',
      )
    }
  }
  return {
    base,
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
  }
})
