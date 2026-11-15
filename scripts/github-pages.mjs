import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const routeParameter = '__pages_route'

/** Preserve history URLs, including filters and anchors, on a static Pages host. */
export async function preparePages(directory, base) {
  if (!/^\/(?:[a-zA-Z0-9_-][a-zA-Z0-9._-]*\/)*$/.test(base))
    throw new Error('Invalid GitHub Pages base directory.')
  const encodedBase = JSON.stringify(base)
  const encodedParameter = JSON.stringify(routeParameter)
  const restore = `<script>
(() => {
  const route = new URLSearchParams(location.search).get(${encodedParameter});
  if (!route) return;
  try {
    const target = new URL(route, location.origin);
    if (target.origin === location.origin && target.pathname.startsWith(${encodedBase}))
      history.replaceState(null, '', target.pathname + target.search + target.hash);
  } catch { /* Invalid redirect values must never prevent loading the site. */ }
})();
</script>`
  const indexPath = resolve(directory, 'index.html')
  const index = await readFile(indexPath, 'utf8')
  await writeFile(indexPath, index.replace('<head>', `<head>\n${restore}`))
  await writeFile(
    resolve(directory, '404.html'),
    `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="robots" content="noindex"><title>Хищные Бобры</title>
<script>
(() => {
  const base = ${encodedBase};
  if (!location.pathname.startsWith(base)) return;
  const target = new URL(base, location.origin);
  target.searchParams.set(${encodedParameter}, location.pathname + location.search + location.hash);
  location.replace(target.href);
})();
</script></head><body><a href=${encodedBase}>Открыть сайт клуба</a></body></html>`,
  )
  await writeFile(resolve(directory, '.nojekyll'), '')
}
