import { expect, test, type Page } from '@playwright/test'
import { assertNoHorizontalOverflow } from './helpers'

function syncStatus(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    interval_seconds: 3600,
    fiba_interval_seconds: 86400,
    timeout_seconds: 180,
    state: 'partial',
    attempt_started_at: '2026-11-15T10:00:00Z',
    attempt_finished_at: '2026-11-15T10:01:00Z',
    next_attempt_at: '2026-11-15T11:00:00Z',
    last_success_at: '2026-11-15T09:56:00Z',
    last_error: null,
    sources: {
      asb_games_men: {
        status: 'succeeded',
        interval_seconds: 3600,
        next_attempt_at: '2026-11-15T11:00:00Z',
        last_success_at: '2026-11-15T10:00:30Z',
      },
      asb_roster_women: {
        status: 'succeeded',
        interval_seconds: 3600,
        next_attempt_at: '2026-11-15T11:01:00Z',
        last_success_at: '2026-11-15T10:00:40Z',
      },
      fiba3x3: {
        status: 'auth_required',
        interval_seconds: 86400,
        next_attempt_at: '2026-11-16T10:01:00Z',
        error: 'Upstream authentication unavailable',
      },
    },
    ...overrides,
  }
}

async function mockAdmin(page: Page, status: () => Record<string, unknown> | null) {
  const requests: string[] = []
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/auth/me')
      return route.fulfill({
        json: { data: { id: 'admin', username: 'Редактор', role: 'ADMIN' } },
      })
    if (path === '/api/v1/admin/imports/sports-sync') {
      requests.push(route.request().method())
      const result = status()
      return result
        ? route.fulfill({ json: { data: result } })
        : route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } })
    }
    return route.fulfill({
      json: { items: [], total: 0, page: 1, page_size: 100, total_pages: 1 },
    })
  })
  return requests
}

test('automatic import status shows source coverage and FIBA access requirement, refresh only reads status', async ({
  page,
}) => {
  let current = syncStatus()
  const requests = await mockAdmin(page, () => current)
  await page.goto('/admin?tab=imports')
  const panel = page.getByRole('region', { name: 'Автоматическое обновление' })
  await expect(panel.getByRole('status')).toHaveText('Обновлено частично')
  await expect(panel.getByText('Раз в час', { exact: true })).toBeVisible()
  await expect(panel.getByText('Раз в сутки', { exact: true })).toBeVisible()
  await expect(panel.getByText('15.11.2026, 14:00', { exact: true })).toBeVisible()
  await expect(panel.getByText('16.11.2026, 13:01', { exact: true })).toBeVisible()
  await expect(panel.getByText('15.11.2026, 13:00', { exact: true })).toBeVisible()
  await expect(panel.getByText('АСБ · матчи мужчин', { exact: true })).toBeVisible()
  await expect(panel.getByText('АСБ · состав и статистика девушек', { exact: true })).toBeVisible()
  await expect(panel.getByText('Нужен доступ к API FIBA', { exact: true })).toBeVisible()
  await expect(panel.getByText('Upstream authentication unavailable')).toHaveCount(0)
  await expect(panel.getByRole('link', { name: '3x3digital@fiba.basketball' })).toHaveAttribute(
    'href',
    'mailto:3x3digital@fiba.basketball',
  )
  await expect(panel.getByRole('link', { name: 'Справка FIBA о доступе к API' })).toHaveAttribute(
    'href',
    'https://help.fiba3x3.com/en/support/solutions/articles/35000118581',
  )
  await expect(panel.getByRole('textbox')).toHaveCount(0)
  current = syncStatus({ state: 'succeeded' })
  await panel.getByRole('button', { name: 'Обновить статус', exact: true }).click()
  await expect(panel.getByRole('status')).toHaveText('Обновлено')
  expect(requests).toEqual(['GET', 'GET'])
  await assertNoHorizontalOverflow(page)
})

test('failed status request is retryable and does not hide the admin workspace', async ({
  page,
}) => {
  let ready = false
  const requests = await mockAdmin(page, () => (ready ? syncStatus({ state: 'running' }) : null))
  await page.goto('/admin?tab=imports')
  const panel = page.getByRole('region', { name: 'Автоматическое обновление' })
  await expect(panel.getByRole('alert')).toBeVisible()
  ready = true
  await panel.getByRole('button', { name: 'Обновить статус', exact: true }).click()
  await expect(panel.getByRole('status')).toHaveText('Обновляется')
  await expect(panel.getByRole('alert')).toHaveCount(0)
  expect(requests).toEqual(['GET', 'GET'])
})

test('disabled automation and invalid or missing timestamps are displayed without invalid dates', async ({
  page,
}) => {
  await mockAdmin(page, () =>
    syncStatus({
      enabled: false,
      state: 'disabled',
      attempt_started_at: 'invalid date',
      next_attempt_at: '2026-11-15T10:06:00Z',
      last_success_at: null,
      sources: {},
    }),
  )
  await page.goto('/admin?tab=imports')
  const panel = page.getByRole('region', { name: 'Автоматическое обновление' })
  await expect(panel.getByRole('status')).toHaveText('Автообновление выключено')
  await expect(panel.getByText('Источники ещё не проверялись.', { exact: true })).toBeVisible()
  await expect(panel.getByText('—', { exact: true })).toHaveCount(4)
  await expect(panel).not.toContainText('Invalid Date')
  await assertNoHorizontalOverflow(page)
})

test('worker and source failure states use actual server values and keep separate schedules', async ({
  page,
}) => {
  await mockAdmin(page, () =>
    syncStatus({
      state: 'failed',
      sources: {
        asb_games_men: {
          status: 'failed',
          interval_seconds: 3600,
          next_attempt_at: '2026-11-15T11:00:00Z',
          error: 'Ошибка ответа АСБ',
        },
        asb_standings_men: { status: 'unavailable', next_attempt_at: 'invalid date' },
        asb_roster_men: { status: 'disabled' },
        fiba3x3: {
          status: 'invalid_watchlist',
          interval_seconds: 86400,
          next_attempt_at: '2026-11-16T10:01:00Z',
        },
      },
    }),
  )
  await page.goto('/admin?tab=imports')
  const panel = page.getByRole('region', { name: 'Автоматическое обновление' })
  await expect(panel.getByRole('status')).toHaveText('Ошибка обновления')
  await expect(panel.getByText('Ошибка ответа АСБ', { exact: true })).toBeVisible()
  await expect(panel.getByText('Источник недоступен', { exact: true })).toBeVisible()
  await expect(panel.getByText('Выключено', { exact: true })).toBeVisible()
  await expect(panel.getByText('Проверьте список турниров FIBA', { exact: true })).toBeVisible()
  await expect(panel.getByText('15.11.2026, 14:00', { exact: true })).toBeVisible()
  await expect(panel.getByText('16.11.2026, 13:01', { exact: true })).toBeVisible()
  await expect(panel).not.toContainText('Invalid Date')
  await assertNoHorizontalOverflow(page)
})
