import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import {
  configuredOrigin,
  containedPath,
  discoverRoutes,
  positiveInteger,
  publicApiPath,
  sitemap,
  snapshotPath,
} from './prerender-lib.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

export async function createStaticServer(directory, fallbackHtml) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost')
      let file = containedPath(directory, `.${decodeURIComponent(url.pathname)}`)
      const entry = await stat(file).catch(() => null)
      if (entry?.isDirectory()) file = containedPath(file, 'index.html')
      else if (!entry) {
        if (fallbackHtml !== undefined) {
          response.writeHead(200, { 'Content-Type': mime['.html'], 'Cache-Control': 'no-store' })
          response.end(fallbackHtml)
          return
        }
        const spaShell = containedPath(directory, 'spa.html')
        file = (await stat(spaShell).catch(() => null))
          ? spaShell
          : containedPath(directory, 'index.html')
      }
      response.writeHead(200, {
        'Content-Type': mime[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      response.end(await readFile(file))
    } catch {
      response.writeHead(404)
      response.end('Not found')
    }
  })
  await new Promise((accept, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', accept)
  })
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((accept, reject) => server.close((error) => (error ? reject(error) : accept()))),
  }
}

export function anonymousApi(apiOrigin, timeout = 20_000) {
  const cache = new Map()
  return async (path) => {
    if (!publicApiPath(path)) throw new Error(`Prerender refused a non-public API path: ${path}`)
    if (!cache.has(path))
      cache.set(
        path,
        (async () => {
          const response = await fetch(`${apiOrigin}${path}`, {
            method: 'GET',
            credentials: 'omit',
            redirect: 'error',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(timeout),
          })
          const body = await response.text()
          if (body.length > 8_000_000) throw new Error(`Public API response is too large: ${path}`)
          if (!response.headers.get('content-type')?.includes('application/json'))
            throw new Error(`Public API did not return JSON: ${path} (${response.status}).`)
          return { status: response.status, body }
        })(),
      )
    return cache.get(path)
  }
}

export async function renderSnapshot(browser, origin, path, siteOrigin, getApi, timeout = 45_000) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await context.addInitScript(() => {
    // Set before Vue is imported; visitors never have this build-only marker.
    const mark = () => {
      if (!document.documentElement) return false
      document.documentElement.dataset.prerender = 'active'
      return true
    }
    if (!mark()) {
      const observer = new MutationObserver(() => {
        if (mark()) observer.disconnect()
      })
      observer.observe(document, { childList: true })
    }
  })
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() !== 'GET') {
      errors.push(`Unexpected ${request.method()} request.`)
      return route.abort()
    }
    // Resolve image requests locally without touching third-party hosts or
    // triggering components' broken-photo fallbacks in the saved HTML.
    if (request.resourceType() === 'image')
      return route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6byYAAAAASUVORK5CYII=',
          'base64',
        ),
      })
    if (['media', 'font'].includes(request.resourceType())) return route.abort()
    if (url.pathname.startsWith('/api/')) {
      try {
        const response = await getApi(`${url.pathname}${url.search}`)
        // An absent standings snapshot is an ordinary public empty state.
        if (
          response.status >= 400 &&
          !(url.pathname === '/api/v1/standings' && response.status === 404)
        )
          errors.push(`Public API ${response.status}: ${url.pathname}`)
        return route.fulfill({
          status: response.status,
          contentType: 'application/json',
          body: response.body,
        })
      } catch (error) {
        errors.push(error.message)
        return route.abort()
      }
    }
    if (url.origin !== origin || (request.resourceType() === 'document' && url.pathname !== path))
      return route.abort()
    return route.continue()
  })
  try {
    await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded', timeout })
    await page.waitForFunction(
      () => {
        const state = document.documentElement.dataset
        return (
          Number(state.prerenderStarted) > 0 &&
          state.prerenderPending === '0' &&
          document.querySelector('#app[data-v-app] main h1')
        )
      },
      null,
      { timeout },
    )
    const failures = await page.evaluate(() =>
      Number(document.documentElement.dataset.prerenderFailures || 0),
    )
    if (failures || errors.length)
      throw new Error(
        [...errors, ...(failures ? [`${failures} data loader(s) failed.`] : [])].join(' '),
      )
    if (await page.locator('main [aria-busy="true"], main [role="alert"]').count())
      throw new Error('A loading or error state remains in the public document.')
    return await page.evaluate(
      ({ path, siteOrigin }) => {
        const meta = (attribute, name, content) => {
          let element = document.head.querySelector(`meta[${attribute}="${name}"]`)
          if (!element) {
            element = document.createElement('meta')
            element.setAttribute(attribute, name)
            document.head.append(element)
          }
          element.content = content
        }
        const canonical = new URL(path, siteOrigin).href
        document.querySelector('link[rel="canonical"]').href = canonical
        meta('name', 'site-origin', siteOrigin)
        meta('name', 'robots', 'index, follow')
        meta('property', 'og:url', canonical)
        meta('property', 'og:image', new URL('/images/brand/club-emblem.webp', siteOrigin).href)
        meta('name', 'twitter:image', new URL('/images/brand/club-emblem.webp', siteOrigin).href)
        // The index entry keeps its own preloads; route-specific preloads are redundant
        // and may point at the temporary preview host after browser serialization.
        document
          .querySelectorAll('link[rel="modulepreload"]')
          .forEach((element) => element.remove())
        for (const key of Object.keys(document.documentElement.dataset))
          if (key.startsWith('prerender')) delete document.documentElement.dataset[key]
        document.documentElement.style.removeProperty('--header-edge')
        if (!document.title || !document.querySelector('meta[property="og:title"]')?.content)
          throw new Error('Public page metadata is incomplete.')
        for (const script of document.scripts)
          if (!script.src || !new URL(script.src).pathname.startsWith('/assets/'))
            throw new Error('Unexpected inline or non-build script in public snapshot.')
        return '<!doctype html>\n' + document.documentElement.outerHTML
      },
      { path, siteOrigin },
    )
  } catch (error) {
    throw new Error(`Prerender failed for ${path}: ${error.message}`, { cause: error })
  } finally {
    await context.close()
  }
}

export function noindexShell(shell, title = 'Управление клубом — БК ВГУ «Хищные Бобры»') {
  return shell
    .replace(/<title>[^<]*<\/title>/u, `<title>${title}</title>`)
    .replace('</head>', '    <meta name="robots" content="noindex, nofollow" />\n  </head>')
}

export async function runPrerender({ outputDirectory = 'dist-prerender' } = {}) {
  const siteOrigin = configuredOrigin(process.env.PRERENDER_SITE_URL, 'PRERENDER_SITE_URL', true)
  const apiOrigin = configuredOrigin(process.env.PRERENDER_API_URL, 'PRERENDER_API_URL')
  const { build, loadEnv } = await import('vite')
  const environment = loadEnv('production', root, 'VITE_')
  if (environment.VITE_API_BASE_URL)
    throw new Error(
      'Public prerender requires an empty VITE_API_BASE_URL and a same-origin API reverse proxy.',
    )
  if (
    environment.VITE_SITE_URL &&
    configuredOrigin(environment.VITE_SITE_URL, 'VITE_SITE_URL', true) !== siteOrigin
  )
    throw new Error('VITE_SITE_URL and PRERENDER_SITE_URL must identify the same public origin.')
  const maxRoutes = positiveInteger(
    process.env.PRERENDER_MAX_ROUTES,
    500,
    'PRERENDER_MAX_ROUTES',
    5000,
  )
  const timeout = positiveInteger(
    process.env.PRERENDER_TIMEOUT_MS,
    45_000,
    'PRERENDER_TIMEOUT_MS',
    180_000,
  )
  const output = containedPath(root, outputDirectory)
  // Vite/IDE watchers on Windows can hold newly rendered directories open and
  // prevent an atomic rename. node_modules is excluded from those source watchers.
  const temporaryRoot = containedPath(root, 'node_modules/.cache/beavers-prerender')
  const stage = containedPath(temporaryRoot, randomUUID())
  await mkdir(stage, { recursive: true })
  let server, browser
  try {
    const getApi = anonymousApi(apiOrigin)
    const routes = await discoverRoutes(async (path) => {
      const response = await getApi(path)
      if (response.status !== 200) throw new Error(`Discovery API ${response.status}: ${path}`)
      return JSON.parse(response.body)
    }, maxRoutes)
    await build({
      // Node 20 is supported by this project but cannot load TypeScript configs
      // natively. Node 24+ can avoid the extra config-bundling subprocess.
      configLoader: Number(process.versions.node.split('.')[0]) >= 24 ? 'native' : 'bundle',
      build: { outDir: stage, emptyOutDir: true },
    })
    const shell = await readFile(containedPath(stage, 'index.html'), 'utf8')
    // The fallback must never expose the home snapshot on an unbuilt/draft profile URL.
    await writeFile(containedPath(stage, 'spa.html'), noindexShell(shell, 'БК ВГУ «Хищные Бобры»'))
    await mkdir(containedPath(stage, 'admin'), { recursive: true })
    await writeFile(containedPath(stage, 'admin/index.html'), noindexShell(shell))
    server = await createStaticServer(stage, shell)
    browser = await chromium.launch({ channel: process.env.PRERENDER_BROWSER_CHANNEL || undefined })
    // A fixed fallback shell lets each route boot from a clean SPA entry while
    // completed snapshots stream to disk instead of accumulating in memory.
    for (const path of routes) {
      const html = await renderSnapshot(browser, server.origin, path, siteOrigin, getApi, timeout)
      const file = snapshotPath(stage, path)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, html)
      console.log(`Prerendered ${path}`)
    }
    await writeFile(containedPath(stage, 'sitemap.xml'), sitemap(siteOrigin, routes))
    await writeFile(
      containedPath(stage, 'robots.txt'),
      `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${siteOrigin}/sitemap.xml\n`,
    )
    await writeFile(
      containedPath(stage, '_prerender-manifest.json'),
      JSON.stringify(
        {
          generator: 'beavers-public-prerender-v1',
          built_at: new Date().toISOString(),
          site_origin: siteOrigin,
          routes,
        },
        null,
        2,
      ) + '\n',
    )
    await browser.close()
    browser = undefined
    await server.close()
    server = undefined
    const previous = containedPath(temporaryRoot, `previous-${randomUUID()}`)
    let hadPrevious = false
    try {
      const manifest = JSON.parse(
        await readFile(containedPath(output, '_prerender-manifest.json'), 'utf8'),
      )
      if (manifest.generator !== 'beavers-public-prerender-v1')
        throw new Error('Unexpected existing output marker.')
      await rename(output, previous)
      hadPrevious = true
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      if (await stat(output).catch(() => null))
        throw new Error(
          'dist-prerender exists without an ownership manifest; refusing to replace it.',
        )
    }
    try {
      await rename(stage, output)
    } catch (error) {
      if (hadPrevious) await rename(previous, output)
      throw error
    }
    if (hadPrevious) await rm(previous, { recursive: true, force: true })
    console.log(`Saved ${routes.length} complete anonymous snapshots to ${outputDirectory}.`)
  } finally {
    if (browser) await browser.close()
    if (server) await server.close()
    // stage is resolved and checked against the dedicated task-owned temporary root.
    await rm(stage, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runPrerender().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
