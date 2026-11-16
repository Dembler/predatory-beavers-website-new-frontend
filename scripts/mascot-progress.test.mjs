import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

// Use the project's existing compiler so this also runs on supported Node 20.
const source = await readFile(
  new URL('../src/composables/mascotProgress.ts', import.meta.url),
  'utf8',
)
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText
const { appendProgress, finishProgress } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
)

test('persisted timestamps preserve stage durations across a delayed replay', () => {
  const replayTime = Date.parse('2026-11-16T09:00:00Z')
  let steps = appendProgress([], { stage: 'queued', at: '2026-11-16T08:00:00Z' }, 1, replayTime)
  steps = appendProgress(
    steps,
    { stage: 'reading_data', at: '2026-11-16T08:00:00.250Z' },
    2,
    replayTime,
  )
  steps = appendProgress(
    steps,
    {
      stage: 'thinking',
      message: 'Нашёл источники и собираю ответ по ним.',
      source_count: 1,
      source_titles: ['История клуба', 'История клуба'],
      at: '2026-11-16T08:00:01Z',
      reasoning_content: 'PRIVATE REASONING MUST NOT BE COPIED',
    },
    3,
    replayTime,
  )
  const duplicate = appendProgress(steps, { stage: 'thinking' }, 3, replayTime)
  assert.deepEqual(duplicate, steps)
  // A local transport failure has no server timestamp and must use the client clock.
  assert.equal(finishProgress(steps, 'failed', undefined, replayTime + 1000)[2].durationMs, 1000)
  steps = finishProgress(steps, 'completed', '2026-11-16T08:00:04Z', replayTime)
  assert.deepEqual(
    steps.map((step) => step.durationMs),
    [250, 750, 3000],
  )
  assert.deepEqual(
    steps.map((step) => step.state),
    ['completed', 'completed', 'completed'],
  )
  assert.deepEqual(steps[2].sourceTitles, ['История клуба'])
  assert.equal(steps[2].observedAt, replayTime)
  assert.equal(steps[2].sourceCount, 1)
  assert.equal(JSON.stringify(steps).includes('PRIVATE'), false)
  assert.equal(steps[2].detail, 'Укладываю веточку к веточке, чтобы ответ держался крепко.')
  assert.equal(JSON.stringify(steps).includes('Нашёл источники и собираю ответ по ним.'), false)
})

test('only known public stages are accepted and cancellation ends only the current stage', () => {
  const now = Date.parse('2026-11-16T08:00:00Z')
  const steps = appendProgress(
    [],
    { stage: 'thinking', source_titles: [123, '<b>Источник</b>'] },
    1,
    now,
  )
  assert.deepEqual(appendProgress(steps, { stage: 'reasoning', message: 'PRIVATE' }, 2, now), steps)
  assert.deepEqual(appendProgress(steps, { stage: '__proto__' }, 3, now), steps)
  assert.deepEqual(steps[0].sourceTitles, ['<b>Источник</b>']) // The view renders plain text.
  const cancelled = finishProgress(steps, 'stopped', '2026-11-16T08:00:02Z', now)
  assert.equal(cancelled[0].state, 'stopped')
  assert.equal(cancelled[0].durationMs, 2000)
  assert.equal(steps[0].state, 'active')
})

test('malformed metadata is bounded and old events still have a usable fallback', () => {
  const now = Date.parse('2026-11-16T08:00:00Z')
  const steps = appendProgress(
    [],
    {
      stage: 'validating',
      at: 'invalid',
      message: 'x'.repeat(1000),
      source_count: -1,
      source_titles: Array.from({ length: 20 }, (_, i) => `${i}${'x'.repeat(300)}`),
    },
    1,
    now,
  )
  assert.equal(steps[0].startedAt, new Date(now).toISOString())
  assert.equal(steps[0].detail, 'Последний обход плотины — всё ли на своих местах?')
  assert.equal(steps[0].sourceCount, undefined)
  assert.equal(steps[0].sourceTitles.length, 6)
  assert.equal(steps[0].sourceTitles[0].length, 160)
  assert.equal(finishProgress(steps, 'failed', '2026-11-16T07:59:00Z', now)[0].durationMs, 0)
})

test('character copy comes from the stage descriptor and ignores backend messages and traces', () => {
  const now = Date.parse('2026-11-16T08:00:00Z')
  for (const stage of ['queued', 'reading_data', 'thinking', 'validating']) {
    const [step] = appendProgress(
      [],
      {
        stage,
        title: 'RAW BACKEND TITLE',
        message: 'RAW BACKEND MESSAGE',
        reasoning: 'PRIVATE MODEL TRACE',
        reasoning_content: 'PRIVATE MODEL TRACE',
      },
      1,
      now,
    )
    assert(step.title.length > 0)
    assert(step.detail.length > 0)
    assert.equal(/RAW|PRIVATE/.test(JSON.stringify(step)), false)
    assert.deepEqual(step, appendProgress([], { stage }, 1, now)[0])
  }
})
