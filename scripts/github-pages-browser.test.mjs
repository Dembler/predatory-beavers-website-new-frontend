import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve } from 'node:path'
import test from 'node:test'
import { chromium } from '@playwright/test'

test('production Pages bundle loads assets and restores a direct history URL', async () => {
  const directory = resolve('dist')
  const index = await readFile(resolve(directory, 'index.html'), 'utf8')
  const base = index.match(/<script type="module"[^>]*src="([^"]+)assets\//)?.[1]
  assert.ok(base?.startsWith('/'), 'build:pages must run before this browser check')
  const localRequests = []
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://local.invalid').pathname
    localRequests.push(pathname)
    if (!pathname.startsWith(base)) {
      response.writeHead(404).end('Outside the Pages directory')
      return
    }
    let filename = resolve(
      directory,
      decodeURIComponent(pathname.slice(base.length)) || 'index.html',
    )
    try {
      if (!filename.startsWith(`${directory}/`) && !filename.startsWith(`${directory}\\`))
        throw new Error('Invalid path')
      if (!(await stat(filename)).isFile()) throw new Error('No index')
      response.setHeader(
        'Content-Type',
        {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.woff2': 'font/woff2',
          '.webp': 'image/webp',
          '.png': 'image/png',
          '.svg': 'image/svg+xml',
        }[extname(filename)] || 'application/octet-stream',
      )
    } catch {
      filename = resolve(directory, '404.html')
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    }
    response.end(await readFile(filename))
  })
  await new Promise((ready) => server.listen(0, '127.0.0.1', ready))
  const origin = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    const apiRequests = []
    const brokenAssets = []
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('response', (response) => {
      if (
        response.url().startsWith(origin) &&
        /\.(?:js|css|woff2|webp|png)(?:\?|$)/.test(response.url()) &&
        !response.ok()
      )
        brokenAssets.push(response.url())
    })
    await page.route('**/api/**', (route) => {
      apiRequests.push(route.request().url())
      if (new URL(route.request().url()).pathname === '/api/v1/results-archive/tournaments') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              items: [
                {
                  key: 'asb',
                  name: 'АСБ',
                  description: 'Студенческий баскетбол',
                  organizer: 'АСБ',
                  logo_url: '/images/tournaments/asb.webp',
                  logo_alt: 'Эмблема АСБ',
                  results: [
                    {
                      id: 'pages-test',
                      team: 'men',
                      discipline: '3x3',
                      tournament: 'АСБ 3×3',
                      year: 2026,
                    },
                  ],
                },
              ],
              result_count: 1,
            },
          }),
        })
      }
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{"code":"unavailable"}',
      })
    })
    const route = `${base}club?discipline=3x3#club-tournaments`
    await page.goto(`${origin}${route}`)
    await page.getByRole('heading', { level: 1, name: 'О клубе' }).waitFor()
    await page.waitForLoadState('networkidle')
    const tournamentLogo = page.getByAltText('Эмблема АСБ')
    await tournamentLogo.scrollIntoViewIfNeeded()
    await tournamentLogo.evaluate((image) => image.decode())
    assert.equal(
      await tournamentLogo.getAttribute('src'),
      `${base}images/tournaments/asb.webp`,
      'logos returned by the API use the frontend deployment directory',
    )
    assert.equal(
      new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash,
      route,
    )
    assert.equal(
      await page.locator('link[rel="canonical"]').getAttribute('href'),
      `${process.env.VITE_SITE_URL || origin}${base}club`,
    )
    assert.ok(apiRequests.length, 'the production frontend requests live API data')
    assert.ok(
      apiRequests.every((url) => new URL(url).protocol === 'https:' && !url.startsWith(origin)),
      'API requests use the separately configured HTTPS backend',
    )
    assert.ok(
      localRequests.some((path) => path === `${base}images/photos/club-together.webp`),
      'the club photo uses the frontend deployment directory',
    )
    assert.deepEqual(brokenAssets, [])
    assert.deepEqual(errors, [])
    await page.reload()
    await page.getByRole('heading', { level: 1, name: 'О клубе' }).waitFor()
    assert.equal(
      new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash,
      route,
    )
  } finally {
    await browser.close()
    await new Promise((done) => server.close(done))
  }
})
