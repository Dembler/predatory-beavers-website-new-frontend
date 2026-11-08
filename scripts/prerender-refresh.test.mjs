import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { refreshPrerender } from './prerender-refresh.mjs'
import { containedPath } from './prerender-lib.mjs'

async function fixture(callback) {
  const parent = resolve('.data/prerender-refresh-tests')
  await mkdir(parent, { recursive: true })
  const rootDirectory = containedPath(
    parent,
    (await mkdtemp(`${parent}/run-`)).slice(parent.length + 1),
  )
  try {
    await callback(rootDirectory)
  } finally {
    await rm(rootDirectory, { recursive: true, force: true })
  }
}

async function artifact(directory, content) {
  await mkdir(directory, { recursive: true })
  await writeFile(
    containedPath(directory, '_prerender-manifest.json'),
    JSON.stringify({
      generator: 'beavers-public-prerender-v1',
      built_at: content,
      routes: ['/'],
    }),
  )
  await writeFile(containedPath(directory, 'index.html'), content)
}

const content = (directory) => readFile(containedPath(directory, 'index.html'), 'utf8')
const status = async (root) =>
  JSON.parse(await readFile(containedPath(root, '.data/prerender-refresh/status.json'), 'utf8'))

test('the good artifact remains live until verification succeeds, with previous release retained', async () => {
  await fixture(async (rootDirectory) => {
    const output = containedPath(rootDirectory, 'dist-prerender')
    await artifact(output, 'old')
    const result = await refreshPrerender({
      rootDirectory,
      build: async (candidate) => {
        assert.equal(await content(output), 'old')
        await artifact(candidate, 'new')
      },
      verify: async (candidate) => {
        assert.equal(await content(output), 'old')
        assert.equal(await content(candidate), 'new')
      },
      log: () => {},
    })
    assert.equal(result.status, 'success')
    assert.equal(await content(output), 'new')
    assert.equal(
      await content(containedPath(rootDirectory, '.data/prerender-refresh/previous')),
      'old',
    )
    assert.equal((await status(rootDirectory)).last_success, 'new')
  })
})

for (const failure of ['build', 'verification']) {
  test(`${failure} failure preserves the published artifact and allows a later retry`, async () => {
    await fixture(async (rootDirectory) => {
      const output = containedPath(rootDirectory, 'dist-prerender')
      await artifact(output, 'good')
      await assert.rejects(
        refreshPrerender({
          rootDirectory,
          build: async (candidate) => {
            await artifact(candidate, 'incomplete')
            if (failure === 'build') throw new Error('API unavailable')
          },
          verify: async () => {
            throw new Error('Invalid canonical')
          },
          log: () => {},
        }),
        failure === 'build' ? /API unavailable/u : /Invalid canonical/u,
      )
      assert.equal(await content(output), 'good')
      assert.equal((await status(rootDirectory)).status, 'failed')
      assert.equal((await status(rootDirectory)).last_success, 'good')
      await refreshPrerender({
        rootDirectory,
        build: (candidate) => artifact(candidate, 'retried'),
        verify: async () => {},
        log: () => {},
      })
      assert.equal(await content(output), 'retried')
    })
  })
}

test('overlapping refreshes skip instead of running a second build', async () => {
  await fixture(async (rootDirectory) => {
    let started
    const building = new Promise((accept) => {
      started = accept
    })
    let resume
    const paused = new Promise((accept) => {
      resume = accept
    })
    const first = refreshPrerender({
      rootDirectory,
      build: async (candidate) => {
        started()
        await paused
        await artifact(candidate, 'only-build')
      },
      verify: async () => {},
      log: () => {},
    })
    await building
    try {
      const second = await refreshPrerender({
        rootDirectory,
        build: async () => {
          assert.fail('Concurrent build started')
        },
        log: () => {},
      })
      assert.deepEqual(second, { skipped: true })
    } finally {
      resume()
      await first
    }
  })
})

test('a publication rename failure rolls back the previous complete artifact', async () => {
  await fixture(async (rootDirectory) => {
    const output = containedPath(rootDirectory, 'dist-prerender')
    await artifact(output, 'good')
    await assert.rejects(
      refreshPrerender({
        rootDirectory,
        build: (candidate) => artifact(candidate, 'new'),
        // Simulate a disk or external cleanup failure after verification.
        verify: (candidate) => rm(candidate, { recursive: true }),
        log: () => {},
      }),
    )
    assert.equal(await content(output), 'good')
    assert.equal((await status(rootDirectory)).status, 'failed')
  })
})

test('transient publication locks retry before replacing the last good artifact', async () => {
  await fixture(async (rootDirectory) => {
    const output = containedPath(rootDirectory, 'dist-prerender')
    await artifact(output, 'good')
    const waits = []
    let publicationAttempts = 0
    const result = await refreshPrerender({
      rootDirectory,
      build: (candidate) => artifact(candidate, 'new'),
      verify: async () => {},
      renameDirectory: async (source, destination) => {
        if (source.includes('candidate-') && destination === output) {
          publicationAttempts++
          if (publicationAttempts < 3)
            throw Object.assign(new Error('A temporary Windows file lock'), { code: 'EPERM' })
        }
        await rename(source, destination)
      },
      waitForRenameRetry: async (delay) => {
        waits.push(delay)
      },
      log: () => {},
    })
    assert.equal(result.status, 'success')
    assert.equal(publicationAttempts, 3)
    assert.deepEqual(waits, [100, 250])
    assert.equal(await content(output), 'new')
    assert.equal(
      await content(containedPath(rootDirectory, '.data/prerender-refresh/previous')),
      'good',
    )
  })
})

test('a persistent publication lock has bounded retries and restores through a transient rollback lock', async () => {
  await fixture(async (rootDirectory) => {
    const output = containedPath(rootDirectory, 'dist-prerender')
    await artifact(output, 'good')
    let publicationAttempts = 0
    let rollbackAttempts = 0
    const waits = []
    await assert.rejects(
      refreshPrerender({
        rootDirectory,
        build: (candidate) => artifact(candidate, 'new'),
        verify: async () => {},
        renameDirectory: async (source, destination) => {
          if (source.includes('candidate-') && destination === output) {
            publicationAttempts++
            throw Object.assign(new Error('Persistent Windows file lock'), { code: 'EPERM' })
          }
          if (source.endsWith('previous') && destination === output) {
            rollbackAttempts++
            if (rollbackAttempts === 1)
              throw Object.assign(new Error('Transient rollback lock'), { code: 'EBUSY' })
          }
          await rename(source, destination)
        },
        waitForRenameRetry: async (delay) => {
          waits.push(delay)
        },
        log: () => {},
      }),
      /still blocked \(EPERM\) after 7 attempts/u,
    )
    assert.equal(publicationAttempts, 7)
    assert.equal(rollbackAttempts, 2)
    assert.deepEqual(waits, [100, 250, 500, 1000, 2000, 4000, 100])
    assert.equal(await content(output), 'good')
    assert.equal((await status(rootDirectory)).status, 'failed')
    assert.equal((await status(rootDirectory)).error_code, 'EPERM')
  })
})

test('a persistently blocked rollback retains the previous good artifact and diagnoses its location', async () => {
  await fixture(async (rootDirectory) => {
    const output = containedPath(rootDirectory, 'dist-prerender')
    const previous = containedPath(rootDirectory, '.data/prerender-refresh/previous')
    await artifact(output, 'good')
    await assert.rejects(
      refreshPrerender({
        rootDirectory,
        build: (candidate) => artifact(candidate, 'new'),
        verify: async () => {},
        renameDirectory: async (source, destination) => {
          if (destination === output)
            throw Object.assign(new Error('Persistent directory lock'), { code: 'EBUSY' })
          await rename(source, destination)
        },
        waitForRenameRetry: async () => {},
        log: () => {},
      }),
      (error) => {
        assert.ok(error instanceof AggregateError)
        assert.match(error.message, /Rollback also failed/u)
        assert.ok(error.message.includes(previous))
        return true
      },
    )
    assert.equal(await content(previous), 'good')
    assert.equal((await status(rootDirectory)).status, 'failed')
    assert.equal((await status(rootDirectory)).last_success, 'good')
  })
})

test('an interrupted publication restores the previous good artifact before attempting a build', async () => {
  await fixture(async (rootDirectory) => {
    const output = containedPath(rootDirectory, 'dist-prerender')
    await artifact(containedPath(rootDirectory, '.data/prerender-refresh/previous'), 'recovered')
    await assert.rejects(
      refreshPrerender({
        rootDirectory,
        build: async () => {
          assert.equal(await content(output), 'recovered')
          throw new Error('API offline')
        },
        log: () => {},
      }),
      /API offline/u,
    )
    assert.equal(await content(output), 'recovered')
  })
})

test('existing unowned output is never overwritten or removed', async () => {
  await fixture(async (rootDirectory) => {
    const output = containedPath(rootDirectory, 'dist-prerender')
    await mkdir(output)
    await writeFile(containedPath(output, 'index.html'), 'hand-written')
    await assert.rejects(
      refreshPrerender({
        rootDirectory,
        build: async () => {
          assert.fail('Build started before output ownership was verified')
        },
        log: () => {},
      }),
    )
    assert.equal(await content(output), 'hand-written')
  })
})
