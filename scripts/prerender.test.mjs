import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import {
  configuredOrigin,
  containedPath,
  discoverRoutes,
  fixedRoutes,
  publicApiPath,
  sitemap,
  snapshotPath,
} from './prerender-lib.mjs'
import { anonymousApi, createStaticServer, noindexShell, renderSnapshot } from './prerender.mjs'

const emptyRoster = { data: { status: 'not_published', is_current_season: false, players: [] } }
const playerPage = (page, items, total = items.length, total_pages = 1) => ({
  page,
  items,
  total,
  total_pages,
})

test('discovery paginates public local profiles and only the current published ASB roster', async () => {
  const requested = []
  const routes = await discoverRoutes(async (path) => {
    requested.push(path)
    if (path.includes('players?page=1'))
      return playerPage(1, [{ id: 'local-one', active: true }], 2, 2)
    if (path.includes('players?page=2')) return playerPage(2, [{ id: 'local-two' }], 2, 2)
    if (path.endsWith('/men'))
      return {
        data: { status: 'published', is_current_season: true, players: [{ id: 'asb-one' }] },
      }
    return {
      data: { status: 'published', is_current_season: false, players: [{ id: 'old-hidden' }] },
    }
  })
  assert.deepEqual(routes, [
    ...fixedRoutes,
    '/players/local/local-one',
    '/players/local/local-two',
    '/teams/men/players/asb-one',
  ])
  assert.equal(requested.length, 4)
  assert.ok(!requested.some((path) => path.includes('admin') || path.includes('auth')))
})

test('incomplete pagination, drafts, route overflow and path injection fail closed', async () => {
  for (const result of [
    null,
    playerPage(1, [], 1, 1),
    playerPage(1, [{ id: 'hidden', active: false }]),
    playerPage(1, [{ id: '../../admin' }]),
    { page: 1, items: [], total: 0 },
  ])
    await assert.rejects(
      discoverRoutes(async (path) => (path.includes('/players?') ? result : emptyRoster)),
    )
  await assert.rejects(
    discoverRoutes(
      async (path) => (path.includes('/players?') ? playerPage(1, [{ id: 'one' }]) : emptyRoster),
      8,
    ),
    /route count/u,
  )
})

test('only public GET JSON paths are eligible, admin/auth/media are excluded', () => {
  for (const path of [
    '/api/v1/home',
    '/api/v1/players?page=1',
    '/api/v1/asb-roster/women/players/id',
    '/api/v1/calendar',
    '/api/v1/results-archive/tournaments',
  ])
    assert.ok(publicApiPath(path), path)
  for (const path of [
    '/api/v1/auth/me',
    '/api/v1/admin/players',
    '/api/v1/media/id/content',
    '/api/v1/standings/logos/one.webp',
    'https://evil.invalid/api/v1/home',
    '//evil.invalid/api/v1/home',
    '/api/v1/players/../../admin',
  ])
    assert.equal(publicApiPath(path), false, path)
})

test('canonical origin, sitemap escaping and output boundaries are validated', () => {
  assert.equal(configuredOrigin('https://club.example/', 'SITE', true), 'https://club.example')
  for (const value of [
    '',
    'https://user:password@club.example',
    'https://club.example/path',
    'https://club.example?secret=x',
    'http://club.example',
  ])
    assert.throws(() => configuredOrigin(value, 'SITE', true))
  assert.match(
    sitemap('https://club.example', ['/club']),
    /<loc>https:\/\/club.example\/club<\/loc>/u,
  )
  assert.match(sitemap('https://club.example', ['/a?b=1&c=2']), /&amp;/u)
  assert.throws(() => containedPath('/build/staging', '../secret'))
  assert.throws(() => snapshotPath('/build/staging', '/admin'))
  assert.throws(() => snapshotPath('/build/staging', '/players/local/../admin'))
  assert.ok(snapshotPath('/build/staging', '/players/local/abc').endsWith('index.html'))
})

test('unrendered/admin shells contain noindex before JavaScript runs', () => {
  const shell = noindexShell(
    '<html><head><title>Club</title></head><body><div id="app"></div></body></html>',
  )
  assert.match(shell, /name="robots" content="noindex, nofollow"/u)
  assert.match(shell, /Управление клубом/u)
  assert.ok(!shell.includes('og:title'))
})

test('anonymous API neither forwards cookies nor accepts redirect/non-JSON/private requests', async () => {
  const received = []
  const server = createServer((request, response) => {
    received.push(request.headers)
    if (request.url === '/api/v1/teams') {
      response.writeHead(302, { Location: '/api/v1/auth/me' })
      response.end()
      return
    }
    if (request.url === '/api/v1/venues') {
      response.writeHead(200, { 'Content-Type': 'text/html' })
      response.end('<html>Login</html>')
      return
    }
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': 'private=discarded',
    })
    response.end('{"data":null}')
  })
  await new Promise((accept) => server.listen(0, '127.0.0.1', accept))
  try {
    const get = anonymousApi(`http://127.0.0.1:${server.address().port}`)
    assert.equal((await get('/api/v1/home')).status, 200)
    assert.equal((await get('/api/v1/home')).status, 200)
    assert.equal(received.length, 1, 'shared public data stays consistent across snapshots')
    await assert.rejects(get('/api/v1/teams'))
    await assert.rejects(get('/api/v1/venues'), /did not return JSON/u)
    await assert.rejects(get('/api/v1/admin/players'), /non-public/u)
    assert.ok(received.every((headers) => !headers.cookie && !headers.authorization))
  } finally {
    await new Promise((accept) => server.close(accept))
  }
})

test(
  'browser snapshot waits for resolved DOM, escapes content, adds absolute metadata and rejects failed loaders',
  { timeout: 30_000 },
  async () => {
    const temporaryRoot = resolve('.data/prerender-tests')
    await mkdir(temporaryRoot, { recursive: true })
    const directory = containedPath(
      temporaryRoot,
      (await mkdtemp(`${temporaryRoot}/fixture-`)).slice(temporaryRoot.length + 1),
    )
    let browser, server
    try {
      await mkdir(containedPath(directory, 'assets'))
      await writeFile(
        containedPath(directory, 'index.html'),
        '<!doctype html><html lang="ru"><head><title>Waiting</title><link rel="canonical" href="/"><meta property="og:title" content="Waiting"></head><body><div id="app" data-v-app><main><h1>Waiting</h1></main></div><script type="module" src="/assets/fixture.js"></script></body></html>',
      )
      await writeFile(
        containedPath(directory, 'assets/fixture.js'),
        `
      const state = document.documentElement.dataset;
      if (state.prerender !== 'active') throw new Error('Readiness hook was enabled too late');
      state.prerenderStarted = '1'; state.prerenderPending = '1';
      try {
        const response = await fetch('/api/v1/home');
        if (!response.ok) throw new Error('Load failed');
        const data = await response.json();
        document.querySelector('h1').textContent = data.title;
        document.title = data.title;
        document.querySelector('meta[property="og:title"]').content = data.title;
      } catch { state.prerenderFailures = '1'; }
      state.prerenderPending = '0';
    `,
      )
      server = await createStaticServer(directory)
      browser = await chromium.launch({
        channel: process.env.PRERENDER_BROWSER_CHANNEL || undefined,
      })
      const maliciousTitle = 'Published <script>alert("private")</script> & team'
      const html = await renderSnapshot(
        browser,
        server.origin,
        '/club',
        'https://club.example',
        async () => ({ status: 200, body: JSON.stringify({ title: maliciousTitle }) }),
        10_000,
      )
      assert.match(html, /<h1>Published &lt;script&gt;/u)
      assert.match(html, /rel="canonical" href="https:\/\/club.example\/club"/u)
      assert.match(html, /name="site-origin" content="https:\/\/club.example"/u)
      assert.ok(!html.includes('data-prerender'))
      const noJs = await browser.newContext({ javaScriptEnabled: false })
      const page = await noJs.newPage()
      await page.setContent(html)
      assert.equal(await page.locator('h1').innerText(), maliciousTitle)
      await noJs.close()
      await assert.rejects(
        renderSnapshot(
          browser,
          server.origin,
          '/club',
          'https://club.example',
          async () => ({ status: 503, body: '{}' }),
          10_000,
        ),
        /Prerender failed for \/club:.*503.*loader/u,
      )
    } finally {
      if (browser) await browser.close()
      if (server) await server.close()
      // mkdtemp's resolved directory was checked to remain in the task-owned root.
      await rm(directory, { recursive: true, force: true })
    }
  },
)
