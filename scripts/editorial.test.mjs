import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/shared/editorial.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText
const { currentMoscowMonday, isEditorialMonday, safeEditorialSource, copyColumnDraft } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('the editorial week rolls over at Moscow Monday and rejects normalized invalid dates', () => {
  assert.equal(currentMoscowMonday(new Date('2026-11-15T20:59:59Z')), '2026-11-09')
  assert.equal(currentMoscowMonday(new Date('2026-11-15T21:00:00Z')), '2026-11-16')
  assert.equal(isEditorialMonday('2026-11-16'), true)
  for (const value of ['2026-11-17', '2026-02-30', '', 'not-a-date'])
    assert.equal(isEditorialMonday(value), false)
})

test('editorial source links accept local public paths and reject redirects and executable URLs', () => {
  assert.equal(safeEditorialSource('/club#history'), true)
  assert.equal(safeEditorialSource('/matches?team=women'), true)
  for (const value of [
    '//example.com',
    '/\\example.com',
    'javascript:alert(1)',
    'https://example.com',
    '/\nunsafe',
    '/unsafe path',
  ])
    assert.equal(safeEditorialSource(value), false)
})

test('editing a copied draft cannot mutate its immutable source revision', () => {
  const original = {
    title: 'Колонка',
    lead: 'Начало',
    sections: [{ heading: 'Глава', body: 'Текст', fact_ids: ['fact-1'] }],
  }
  const edited = copyColumnDraft(original)
  edited.sections[0].body = 'Новый текст'
  edited.sections[0].fact_ids.push('fact-2')
  assert.equal(original.sections[0].body, 'Текст')
  assert.deepEqual(original.sections[0].fact_ids, ['fact-1'])
})
