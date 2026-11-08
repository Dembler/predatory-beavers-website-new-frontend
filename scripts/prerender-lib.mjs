import { resolve, relative, isAbsolute } from 'node:path'

export const fixedRoutes = [
  '/',
  '/club',
  '/teams/men',
  '/teams/women',
  '/matches',
  '/standings',
  '/rules',
  '/contacts',
]

export function configuredOrigin(value, label, requireHttps = false) {
  if (!value) throw new Error(`${label} is required; no local or production URL is guessed.`)
  const url = new URL(value)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error(
      `${label} must be an HTTP(S) origin without credentials, path, query or fragment.`,
    )
  if (requireHttps && url.protocol !== 'https:') throw new Error(`${label} must use HTTPS.`)
  return url.origin
}

export function positiveInteger(value, fallback, label, max) {
  if (value === undefined || value === '') return fallback
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1 || number > max)
    throw new Error(`${label} must be an integer from 1 to ${max}.`)
  return number
}

export function publicApiPath(path) {
  const url = new URL(path, 'https://public.invalid')
  return (
    url.origin === 'https://public.invalid' &&
    /^\/api\/v1\/(?:home|teams|players(?:\/[a-zA-Z0-9-]+)?|content\/[a-z_]+|competitions|venues|matches(?:\/[a-zA-Z0-9-]+)?|calendar|achievements|standings(?:\/options)?|results-archive(?:\/(?:honours|summary|tournaments))?|asb-roster\/(?:men|women)(?:\/players\/[a-zA-Z0-9-]+)?)$/u.test(
      url.pathname,
    )
  )
}

function playerPath(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9-]+$/u.test(id))
    throw new Error('Public API returned an invalid player ID; refusing to create a file path.')
  return id
}

export async function discoverRoutes(getJson, maxRoutes = 500) {
  const routes = new Set(fixedRoutes)
  const add = (path) => {
    routes.add(path)
    if (routes.size > maxRoutes)
      throw new Error(
        `Public route count exceeds PRERENDER_MAX_ROUTES=${maxRoutes}; increase it explicitly.`,
      )
  }
  if (maxRoutes < routes.size)
    throw new Error('PRERENDER_MAX_ROUTES is smaller than the fixed route count.')
  let expectedTotal
  let expectedPages
  const localIds = new Set()
  let seen = 0
  for (let page = 1; ; page++) {
    const result = await getJson(`/api/v1/players?page=${page}&page_size=100`)
    if (
      !result ||
      typeof result !== 'object' ||
      !Array.isArray(result.items) ||
      !Number.isSafeInteger(result.total) ||
      result.total < 0 ||
      result.page !== page ||
      !Number.isSafeInteger(result.total_pages) ||
      result.total_pages < 0 ||
      (result.total > 0 && result.total_pages < page)
    )
      throw new Error(`Invalid public players pagination at page ${page}.`)
    expectedTotal ??= result.total
    expectedPages ??= result.total_pages
    if (
      expectedTotal !== result.total ||
      expectedPages !== result.total_pages ||
      result.total > maxRoutes
    )
      throw new Error(
        'Public player pagination changed during discovery or exceeds the route limit.',
      )
    for (const player of result.items) {
      // The public endpoint already filters drafts; defend against a misconfigured API as well.
      if (player.active === false)
        throw new Error('Public players endpoint exposed an unpublished player.')
      const id = playerPath(player.id)
      if (localIds.has(id))
        throw new Error('Public player pagination repeated an ID; refusing incomplete discovery.')
      localIds.add(id)
      add(`/players/local/${id}`)
      seen++
    }
    if (page >= result.total_pages) break
    if (result.items.length === 0 || page >= maxRoutes)
      throw new Error('Public players pagination did not terminate consistently.')
  }
  if (seen !== expectedTotal)
    throw new Error('Public players pagination is incomplete; no snapshots were published.')
  for (const category of ['men', 'women']) {
    const response = await getJson(`/api/v1/asb-roster/${category}`)
    const roster = response?.data
    if (
      !roster ||
      !Array.isArray(roster.players) ||
      !['published', 'not_published'].includes(roster.status) ||
      typeof roster.is_current_season !== 'boolean'
    )
      throw new Error(`Invalid ${category} public roster.`)
    if (roster.status === 'published' && roster.is_current_season === true)
      for (const player of roster.players)
        add(`/teams/${category}/players/${playerPath(player.id)}`)
  }
  return [...routes]
}

export function escapeXml(value) {
  return value.replace(
    /[&<>"']/gu,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char],
  )
}

export function sitemap(siteOrigin, routes) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes
    .map((path) => `  <url><loc>${escapeXml(new URL(path, siteOrigin).href)}</loc></url>`)
    .join('\n')}\n</urlset>\n`
}

/** Resolve every generated/deleted target against a known build directory. */
export function containedPath(directory, path) {
  const target = resolve(directory, path)
  const within = relative(resolve(directory), target)
  if (
    within === '..' ||
    within.startsWith(`..\\`) ||
    within.startsWith('../') ||
    isAbsolute(within)
  )
    throw new Error(`Refusing a build path outside ${directory}.`)
  return target
}

export function snapshotPath(directory, route) {
  if (
    !fixedRoutes.includes(route) &&
    !/^\/(?:players\/local|teams\/(?:men|women)\/players)\/[a-zA-Z0-9-]+$/u.test(route)
  )
    throw new Error(`Refusing a non-public snapshot route: ${route}`)
  return containedPath(directory, route === '/' ? 'index.html' : `${route.slice(1)}/index.html`)
}
