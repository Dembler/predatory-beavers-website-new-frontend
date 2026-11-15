import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { resolveConfig } from 'vite'
import { preparePages } from './github-pages.mjs'

async function configWith(api, base = '/club/') {
  const previous = { api: process.env.VITE_API_BASE_URL, base: process.env.VITE_BASE_PATH }
  process.env.VITE_API_BASE_URL = api
  process.env.VITE_BASE_PATH = base
  try {
    return await resolveConfig({ mode: 'github-pages', logLevel: 'silent' }, 'build')
  } finally {
    for (const [key, value] of [
      ['VITE_API_BASE_URL', previous.api],
      ['VITE_BASE_PATH', previous.base],
    ]) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('Pages refuses a missing, local, insecure, or incorrectly scoped API', async () => {
  for (const api of [
    '',
    'http://api.example.org',
    'https://localhost:8000',
    'https://127.0.0.1:8000',
    'https://127.255.255.254:8000',
    'https://127.1:8000',
    'https://2130706433:8000',
    'https://0x7f000001:8000',
    'https://0.0.0.0:8000',
    'https://0:8000',
    'https://[::1]:8000',
    'https://[0:0:0:0:0:0:0:1]:8000',
    'https://[::ffff:127.0.0.1]:8000',
    'https://demo.localhost',
    'https://demo.localhost.',
    'https://user:password@api.example.org',
    'https://api.example.org/api',
    'https://api.example.org?key=example',
    'https://api.example.org/?',
    'https://api.example.org/#',
  ]) {
    await assert.rejects(configWith(api), /GitHub Pages requires/)
  }
})

test('Pages supports repository directories and a custom domain root', async () => {
  assert.equal((await configWith('https://api.example.org', '/club/')).base, '/club/')
  assert.equal((await configWith('https://api.example.org', '/')).base, '/')
  assert.equal((await configWith('https://localhost.example.org', '/')).base, '/')
  for (const base of ['club/', '//club/', '/club', '/../', '/club/../other/'])
    await assert.rejects(configWith('https://api.example.org', base), /VITE_BASE_PATH/)
})

test('Pages fallback restores history paths, filter queries, and anchors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'beavers-pages-'))
  try {
    await writeFile(join(directory, 'index.html'), '<html><head></head><body>site</body></html>')
    await preparePages(directory, '/club/')
    const index = await readFile(join(directory, 'index.html'), 'utf8')
    const fallback = await readFile(join(directory, '404.html'), 'utf8')
    let redirect
    const original = '/club/matches?team=women&season=2026-2027#results'
    const initial = new URL(original, 'https://example.github.io')
    runInNewContext(fallback.match(/<script>([\s\S]*?)<\/script>/)[1], {
      URL,
      location: {
        ...Object.fromEntries(
          ['pathname', 'search', 'hash', 'origin'].map((key) => [key, initial[key]]),
        ),
        replace: (value) => {
          redirect = value
        },
      },
    })
    const redirected = new URL(redirect)
    assert.equal(redirected.pathname, '/club/')
    let restored
    const restore = (search) =>
      runInNewContext(index.match(/<script>([\s\S]*?)<\/script>/)[1], {
        URL,
        URLSearchParams,
        location: { origin: initial.origin, search },
        history: {
          replaceState: (_state, _unused, path) => {
            restored = path
          },
        },
      })
    restore(redirected.search)
    assert.equal(restored, original)
    restored = undefined
    restore('?__pages_route=https%3A%2F%2Fother.example%2Fclub%2F')
    assert.equal(restored, undefined, 'foreign-origin redirects are rejected')
    restore('?__pages_route=%2Fanother-repository%2F')
    assert.equal(restored, undefined, 'history cannot escape the repository directory')
    assert.equal(await readFile(join(directory, '.nojekyll'), 'utf8'), '')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
