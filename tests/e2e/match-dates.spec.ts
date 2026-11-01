import { expect, test, type Page } from '@playwright/test'
import type { Match } from '../../src/shared/types'
import { assertNoHorizontalOverflow, openPage } from './helpers'

const currentTime = new Date('2026-11-01T09:00:00Z')

function fixture(id: string, status: Match['status'], startsAt: string): Match {
  return {
    id,
    team_id: 'men',
    team: { id: 'men', category: 'men', name: 'Команда клуба', slug: 'men', logo: null },
    competition_id: 'cup',
    competition: { id: 'cup', name: 'Кубок дат', season: '2026-2027', active: true },
    venue_id: null,
    venue: null,
    starts_at: startsAt,
    club_side: 'home',
    home_team_name: 'Команда клуба',
    away_team_name: id,
    home_score: status === 'finished' ? 81 : null,
    away_score: status === 'finished' ? 70 : null,
    status,
    home_logo: null,
    away_logo: null,
    home_logo_asset_id: null,
    away_logo_asset_id: null,
    notes: null,
    featured: false,
  }
}

async function mockMatches(page: Page, matches: Match[]) {
  await page.clock.setFixedTime(currentTime)
  await page.route('**/api/v1/matches?**', (route) =>
    route.fulfill({
      json: { items: matches, total: matches.length, page: 1, page_size: 100, total_pages: 1 },
    }),
  )
}

function group(page: Page, name: string) {
  return page.locator('section.match-group').filter({
    has: page.getByRole('heading', { name, exact: true }),
  })
}

test('only future scheduled games and live games appear as upcoming; past scheduled games keep their own group', async ({
  page,
}) => {
  const pastScheduled = fixture(
    'Прошедший запланированный матч',
    'scheduled',
    '2026-08-15T16:00:00Z',
  )
  const futureScheduled = fixture(
    'Будущий запланированный матч',
    'scheduled',
    '2026-11-02T16:00:00Z',
  )
  const pastLive = fixture('Идущий матч с прошедшей датой', 'live', '2026-10-31T16:00:00Z')
  const finished = fixture('Завершённый матч', 'finished', '2026-10-30T16:00:00Z')
  await mockMatches(page, [pastScheduled, futureScheduled, pastLive, finished])
  await openPage(page, '/matches?team=all')
  await expect(page.locator('article.match-card')).toHaveCount(4)

  const upcoming = group(page, 'Ближайшие')
  await expect(upcoming.locator('article')).toHaveCount(2)
  await expect(upcoming.locator('article').first()).toContainText(pastLive.away_team_name)
  await expect(upcoming).toContainText(futureScheduled.away_team_name)
  await expect(upcoming).not.toContainText(pastScheduled.away_team_name)
  await expect(upcoming).not.toContainText(finished.away_team_name)
  await expect(group(page, 'Результаты').locator('article')).toHaveCount(1)
  await expect(group(page, 'Результаты')).toContainText(finished.away_team_name)

  const awaiting = group(page, 'Результат уточняется')
  await expect(awaiting.locator('article')).toHaveCount(1)
  await expect(awaiting).toContainText(pastScheduled.away_team_name)
  await expect(awaiting).toContainText('Официальный результат пока не опубликован')
  await expect(awaiting.locator('.match-card__status--scheduled')).toHaveText('Запланирован')
  await expect(awaiting.locator('.match-card__status--scheduled')).toBeVisible()
  await expect(page.locator('.match-group__heading h2')).toHaveText([
    'Ближайшие',
    'Результаты',
    'Результат уточняется',
  ])

  await page.getByRole('combobox', { name: 'Статус', exact: true }).click()
  await page.getByRole('option', { name: 'Запланирован', exact: true }).click()
  await expect(page.locator('article.match-card')).toHaveCount(2)
  await expect(upcoming.locator('article')).toHaveCount(1)
  await expect(upcoming).toContainText(futureScheduled.away_team_name)
  await expect(awaiting.locator('article')).toHaveCount(1)
  await expect(group(page, 'Результаты')).toHaveCount(0)
  await assertNoHorizontalOverflow(page)
})

test('a schedule containing only past scheduled games shows no false upcoming or empty state', async ({
  page,
}) => {
  const past = fixture('Матч без опубликованного результата', 'scheduled', '2026-08-22T14:00:00Z')
  await mockMatches(page, [past])
  await openPage(page, '/matches?team=all')
  await expect(page.locator('article.match-card')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Ближайшие', exact: true })).toHaveCount(0)
  await expect(group(page, 'Результат уточняется')).toContainText(past.away_team_name)
  await expect(page.locator('.match-filters__summary')).toContainText('Найдено: 1')
  await expect(page.getByText('По выбранным фильтрам матчей нет.', { exact: true })).toHaveCount(0)

  await page.getByRole('combobox', { name: 'Статус', exact: true }).click()
  await page.getByRole('option', { name: 'Запланирован', exact: true }).click()
  await expect(page.locator('article.match-card')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Ближайшие', exact: true })).toHaveCount(0)
  await expect(group(page, 'Результат уточняется')).toContainText(past.away_team_name)
  await assertNoHorizontalOverflow(page)
})
