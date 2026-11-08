import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { configuredOrigin, containedPath, snapshotPath, sitemap } from './prerender-lib.mjs'
import { createStaticServer } from './prerender.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export async function verifyPrerender(directory = containedPath(root, 'dist-prerender')) {
  const manifest = JSON.parse(
    await readFile(containedPath(directory, '_prerender-manifest.json'), 'utf8'),
  )
  assert.equal(manifest.generator, 'beavers-public-prerender-v1')
  const siteOrigin = configuredOrigin(manifest.site_origin, 'manifest site origin', true)
  assert.ok(Array.isArray(manifest.routes) && manifest.routes.length >= 8)
  assert.equal(new Set(manifest.routes).size, manifest.routes.length)
  for (const path of manifest.routes) await readFile(snapshotPath(directory, path), 'utf8')
  assert.equal(
    await readFile(containedPath(directory, 'sitemap.xml'), 'utf8'),
    sitemap(siteOrigin, manifest.routes),
  )

  let browser, server
  try {
    server = await createStaticServer(directory)
    browser = await chromium.launch({ channel: process.env.PRERENDER_BROWSER_CHANNEL || undefined })
    const context = await browser.newContext({ javaScriptEnabled: false })
    await context.route('**/*', (route) =>
      ['image', 'font', 'media'].includes(route.request().resourceType())
        ? route.abort()
        : route.continue(),
    )
    const page = await context.newPage()
    for (const path of manifest.routes) {
      const response = await page.goto(`${server.origin}${path}`, { waitUntil: 'domcontentloaded' })
      assert.equal(response?.status(), 200, path)
      assert.ok(
        (await page.locator('main h1').first().innerText()).trim(),
        `${path}: no public heading without JavaScript`,
      )
      assert.equal(
        await page.locator('link[rel="canonical"]').getAttribute('href'),
        new URL(path, siteOrigin).href,
        `${path}: canonical`,
      )
      assert.equal(
        await page.locator('meta[property="og:url"]').getAttribute('content'),
        new URL(path, siteOrigin).href,
        `${path}: OG URL`,
      )
      for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]'])
        assert.equal(
          await page.locator(selector).getAttribute('content'),
          await page.title(),
          `${path}: title`,
        )
      assert.ok(
        await page.locator('meta[name="description"]').getAttribute('content'),
        `${path}: description`,
      )
      assert.equal(
        await page.locator('meta[name="robots"]').getAttribute('content'),
        'index, follow',
        `${path}: robots`,
      )
      assert.equal(
        await page.locator('main [aria-busy="true"], main [role="alert"]').count(),
        0,
        `${path}: incomplete public state`,
      )
      assert.equal(
        await page.locator('[data-prerender]').count(),
        0,
        `${path}: build marker leaked`,
      )
    }
    for (const path of ['/admin', '/not-a-published-route']) {
      await page.goto(`${server.origin}${path}`, { waitUntil: 'domcontentloaded' })
      assert.equal(
        await page.locator('meta[name="robots"]').getAttribute('content'),
        'noindex, nofollow',
        `${path}: raw noindex`,
      )
      assert.equal(
        await page.locator('#app').evaluate((element) => element.childElementCount),
        0,
        `${path}: public snapshot leaked into private/unknown route`,
      )
    }
    console.log(
      `Verified ${manifest.routes.length} public snapshots without JavaScript, sitemap, admin and unknown-route noindex shells.`,
    )
  } finally {
    if (browser) await browser.close()
    if (server) await server.close()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyPrerender().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
