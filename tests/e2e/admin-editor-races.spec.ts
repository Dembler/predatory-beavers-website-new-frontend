import { expect, test, type Page } from '@playwright/test'

const teamId = '11111111-1111-4111-8111-111111111111'
const competitionId = '33333333-3333-4333-8333-333333333333'
const matchA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const matchB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const version = '2026-11-08T08:00:00.000000Z'

async function fixture(page: Page, deepLink = false) {
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const state = {
    holdA: deepLink,
    failA: false,
    staleOnSave: false,
    requestedA: 0,
    releaseA: () => release(),
  }
  const team = { id: teamId, name: 'Хищные Бобры', slug: 'men', category: 'men', active: true }
  const competition = {
    id: competitionId,
    name: 'Тестовый турнир',
    season: '2026-2027',
    active: true,
  }
  const match = (id: string) => ({
    id,
    team_id: teamId,
    team,
    competition_id: competitionId,
    competition,
    venue_id: null,
    venue: null,
    starts_at: '2026-11-08T18:00:00Z',
    club_side: 'home',
    home_team_name: id === matchA ? 'Матч A' : 'Матч B',
    away_team_name: 'Соперник',
    home_score: 80,
    away_score: 70,
    status: 'finished',
    notes: '',
    featured: false,
    active: true,
    updated_at: version,
  })
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const ok = (data: unknown) => route.fulfill({ json: { data } })
    const list = (items: unknown[]) =>
      route.fulfill({
        json: {
          items,
          total: items.length,
          page: 1,
          page_size: Number(url.searchParams.get('page_size') || 15),
          total_pages: items.length ? 1 : 0,
        },
      })
    if (path === '/api/v1/auth/me') return ok({ id: teamId, username: 'Редактор', role: 'ADMIN' })
    if (path === '/api/v1/auth/csrf') return ok({ csrf_token: 'test-csrf' })
    if (path === '/api/v1/admin/teams') return list([team])
    if (path === '/api/v1/admin/competitions') return list([competition])
    if (path === '/api/v1/admin/venues' || path === '/api/v1/admin/media') return list([])
    if (path === '/api/v1/admin/matches') return list([match(matchA), match(matchB)])
    if (path === `/api/v1/admin/matches/${matchA}` && request.method() === 'GET') {
      state.requestedA++
      if (state.holdA) await gate
      if (state.failA) return route.fulfill({ status: 404, json: { code: 'not_found' } })
      return ok(match(matchA))
    }
    if (path.startsWith('/api/v1/admin/matches/') && request.method() === 'PATCH') {
      if (state.staleOnSave) return route.fulfill({ status: 409, json: { code: 'stale_record' } })
      return ok(match(path.split('/').pop()!))
    }
    return list([])
  })
  await page.goto(`/admin?tab=matches${deepLink ? `&edit=${matchA}` : ''}`)
  await expect(
    page.getByRole('button', { name: 'Изменить: Матч B — Соперник', exact: true }),
  ).toBeVisible()
  return state
}

async function openMatch(page: Page, name: 'A' | 'B') {
  await page.getByRole('button', { name: `Изменить: Матч ${name} — Соперник`, exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Редактировать запись', exact: true })
  await expect(editor.getByRole('textbox', { name: 'Хозяева', exact: true })).toHaveValue(
    `Матч ${name}`,
  )
  return editor
}

async function releaseResponse(page: Page, release: () => void) {
  const response = page.waitForResponse(
    (result) =>
      new URL(result.url()).pathname === `/api/v1/admin/matches/${matchA}` &&
      result.request().method() === 'GET',
  )
  release()
  await response
  // Also wait for any reference requests a stale callback might incorrectly start.
  await page.waitForLoadState('networkidle')
}

for (const lateFailure of [false, true]) {
  test(`a delayed deep link ${lateFailure ? 'error' : 'record'} cannot overwrite another match draft`, async ({
    page,
  }) => {
    const state = await fixture(page, true)
    state.failA = lateFailure
    await expect.poll(() => state.requestedA).toBe(1)
    const editor = await openMatch(page, 'B')
    await editor.getByLabel('Очки хозяев', { exact: true }).fill('99')
    await releaseResponse(page, state.releaseA)
    await expect(editor.getByRole('textbox', { name: 'Хозяева', exact: true })).toHaveValue(
      'Матч B',
    )
    await expect(editor.getByLabel('Очки хозяев', { exact: true })).toHaveValue('99')
    await expect(editor.getByRole('alert')).toHaveCount(0)
  })
}

async function beginReload(page: Page) {
  const state = await fixture(page)
  const editor = await openMatch(page, 'A')
  await editor.getByLabel('Очки хозяев', { exact: true }).fill('81')
  state.staleOnSave = true
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(
    editor.getByRole('button', { name: 'Загрузить актуальную версию', exact: true }),
  ).toBeVisible()
  state.holdA = true
  page.once('dialog', (dialog) => dialog.accept())
  await editor.getByRole('button', { name: 'Загрузить актуальную версию', exact: true }).click()
  await expect.poll(() => state.requestedA).toBe(1)
  return { state, editor }
}

test('closing a reload and opening another match invalidates its late record', async ({ page }) => {
  const { state, editor } = await beginReload(page)
  page.once('dialog', (dialog) => dialog.accept())
  await editor.getByRole('button', { name: 'Закрыть редактор', exact: true }).click()
  const nextEditor = await openMatch(page, 'B')
  await nextEditor.getByLabel('Очки хозяев', { exact: true }).fill('99')
  await releaseResponse(page, state.releaseA)
  await expect(nextEditor.getByRole('textbox', { name: 'Хозяева', exact: true })).toHaveValue(
    'Матч B',
  )
  await expect(nextEditor.getByLabel('Очки хозяев', { exact: true })).toHaveValue('99')
  await expect(nextEditor.getByRole('alert')).toHaveCount(0)
})

test('new edits after confirming a reload remain in the same match draft', async ({ page }) => {
  const { state, editor } = await beginReload(page)
  await editor.getByLabel('Очки хозяев', { exact: true }).fill('98')
  await releaseResponse(page, state.releaseA)
  await expect(editor.getByRole('textbox', { name: 'Хозяева', exact: true })).toHaveValue('Матч A')
  await expect(editor.getByLabel('Очки хозяев', { exact: true })).toHaveValue('98')
})
