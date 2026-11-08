import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { configuredOrigin, containedPath, positiveInteger } from './prerender-lib.mjs'
import { runPrerender } from './prerender.mjs'
import { verifyPrerender } from './verify-prerender.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const marker = 'beavers-public-prerender-v1'
const renameRetryDelays = [100, 250, 500, 1000, 2000, 4000]

async function renameArtifact(source, destination, renameDirectory, wait, log) {
  for (let attempt = 0; ; attempt++) {
    try {
      await renameDirectory(source, destination)
      return
    } catch (error) {
      if (!['EPERM', 'EBUSY'].includes(error.code)) throw error
      if (attempt === renameRetryDelays.length)
        throw Object.assign(
          new Error(
            `Artifact rename is still blocked (${error.code}) after ${attempt + 1} attempts: ` +
              `${source} -> ${destination}. Close processes holding these paths and retry.`,
            { cause: error },
          ),
          { code: error.code },
        )
      const delay = renameRetryDelays[attempt]
      log(
        `Artifact rename blocked (${error.code}); retry ${attempt + 1} in ${delay} ms: ${source} -> ${destination}`,
      )
      await wait(delay)
    }
  }
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

async function ownedArtifact(directory) {
  const manifest = JSON.parse(
    await readFile(containedPath(directory, '_prerender-manifest.json'), 'utf8'),
  )
  if (manifest.generator !== marker || !Array.isArray(manifest.routes))
    throw new Error(`Refusing to replace an unowned prerender artifact: ${directory}`)
  return manifest
}

async function saveStatus(directory, status) {
  const temporary = containedPath(directory, `status-${randomUUID()}.tmp`)
  try {
    await writeFile(temporary, `${JSON.stringify(status, null, 2)}\n`)
    await rename(temporary, containedPath(directory, 'status.json'))
  } finally {
    await rm(temporary, { force: true })
  }
}

async function typeCheck() {
  await new Promise((accept, reject) => {
    const child = spawn(
      process.execPath,
      [containedPath(root, 'node_modules/vue-tsc/bin/vue-tsc.js'), '--build'],
      {
        cwd: root,
        stdio: 'inherit',
        windowsHide: true,
      },
    )
    child.once('error', reject)
    child.once('exit', (code, signal) =>
      code === 0 ? accept() : reject(new Error(`Type check failed (${signal || code}).`)),
    )
  })
}

/** One serialized, verified refresh. Dependency options keep failure tests independent of the API. */
export async function refreshPrerender({
  rootDirectory = root,
  build = async (outputDirectory) => {
    await typeCheck()
    await runPrerender({ outputDirectory })
  },
  verify = verifyPrerender,
  renameDirectory = rename,
  waitForRenameRetry = setTimeout,
  log = console.log,
} = {}) {
  const state = containedPath(rootDirectory, '.data/prerender-refresh')
  const output = containedPath(rootDirectory, 'dist-prerender')
  const previous = containedPath(state, 'previous')
  const candidate = containedPath(state, `candidate-${randomUUID()}`)
  const lockPath = containedPath(rootDirectory, '.data/prerender-refresh.lock')
  await mkdir(state, { recursive: true })
  let lock
  try {
    lock = await open(lockPath, 'wx')
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    log(
      `Skipped: another refresh owns ${lockPath}. See deploy/prerender-refresh.md for stale-lock recovery.`,
    )
    return { skipped: true }
  }

  let lastSuccess = null
  const startedAt = new Date().toISOString()
  const moveArtifact = (source, destination) =>
    renameArtifact(source, destination, renameDirectory, waitForRenameRetry, log)
  try {
    await lock.writeFile(`${JSON.stringify({ pid: process.pid, started_at: startedAt })}\n`)
    // If a process was interrupted between the two directory renames, restore
    // its last good artifact before attempting another build.
    if (!(await exists(output)) && (await exists(previous))) {
      lastSuccess = (await ownedArtifact(previous)).built_at || null
      await moveArtifact(previous, output)
      log('Recovered the previous complete artifact after an interrupted publication.')
    }
    if (await exists(output)) lastSuccess = (await ownedArtifact(output)).built_at || null
    await saveStatus(state, { status: 'running', started_at: startedAt, last_success: lastSuccess })
    // The standard artifact stays untouched throughout type checking, API reads,
    // rendering and the browser verification with JavaScript disabled.
    await build(candidate)
    const manifest = await ownedArtifact(candidate)
    await verify(candidate)

    const hadOutput = await exists(output)
    if (hadOutput) {
      await ownedArtifact(output)
      if (await exists(previous)) {
        await ownedArtifact(previous)
        await rm(previous, { recursive: true })
      }
      await moveArtifact(output, previous)
    }
    try {
      await moveArtifact(candidate, output)
    } catch (error) {
      if (hadOutput) {
        try {
          await moveArtifact(previous, output)
        } catch (rollbackError) {
          throw Object.assign(
            new AggregateError(
              [error, rollbackError],
              `Publication failed: ${error.message} Rollback also failed: ${rollbackError.message} ` +
                `The previous complete artifact is retained at ${previous}; restore it before serving this build.`,
            ),
            { code: rollbackError.code },
          )
        }
      }
      throw error
    }
    const status = {
      status: 'success',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      last_success: manifest.built_at,
      routes: manifest.routes.length,
    }
    await saveStatus(state, status)
    log(
      `Refreshed ${manifest.routes.length} verified public snapshots. Previous artifact retained in ${previous}.`,
    )
    return status
  } catch (error) {
    await saveStatus(state, {
      status: 'failed',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      last_success: lastSuccess,
      error: error.message,
      error_code: error.code || null,
    })
    throw error
  } finally {
    // Both paths are resolved under this task's dedicated state directory.
    try {
      await rm(candidate, { recursive: true, force: true })
    } finally {
      await lock.close()
      await rm(lockPath)
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.some((argument) => argument !== '--watch') || args.length > 1)
    throw new Error('Usage: npm run refresh:prerender [-- --watch]')
  configuredOrigin(process.env.PRERENDER_SITE_URL, 'PRERENDER_SITE_URL', true)
  configuredOrigin(process.env.PRERENDER_API_URL, 'PRERENDER_API_URL')
  if (!args.includes('--watch')) {
    await refreshPrerender()
    return
  }
  const interval = positiveInteger(
    process.env.PRERENDER_REFRESH_INTERVAL_MS,
    300_000,
    'PRERENDER_REFRESH_INTERVAL_MS',
    86_400_000,
  )
  if (interval < 15_000) throw new Error('PRERENDER_REFRESH_INTERVAL_MS must be at least 15000.')
  const stop = new AbortController()
  const requestStop = () => stop.abort()
  process.once('SIGINT', requestStop)
  process.once('SIGTERM', requestStop)
  try {
    do {
      try {
        await refreshPrerender()
      } catch (error) {
        console.error(`Public HTML refresh failed: ${error.message}`)
      }
      if (stop.signal.aborted) break
      await setTimeout(interval, undefined, { signal: stop.signal }).catch((error) => {
        if (error.name !== 'AbortError') throw error
      })
    } while (!stop.signal.aborted)
  } finally {
    process.removeListener('SIGINT', requestStop)
    process.removeListener('SIGTERM', requestStop)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
