import { expect, test, type Page } from '@playwright/test'
import type { Match } from '../../src/shared/types'
import { assertNoHorizontalOverflow, openPage } from './helpers'
import { calendarItem, mockCalendar, type CalendarFixture } from './calendar-fixtures'

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

async function mockMatches(page: Page, matches: CalendarFixture[]) {
  await page.clock.setFixedTime(currentTime)
  await mockCalendar(page, matches)
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
  await mockMatches(page, [
    calendarItem(pastLive, { section: 'upcoming' }),
    calendarItem(futureScheduled, { section: 'upcoming' }),
    calendarItem(finished),
    calendarItem(pastScheduled, { section: 'awaiting' }),
  ])
  await openPage(page, '/matches?team=all')
  await expect(page.locator('article.match-card')).toHaveCount(4)

  const upcoming = group(page, 'Ближайшие')
  await expect(upcoming.locator('article')).toHaveCount(2)
  await expect(upcoming.locator('article').first()).toContainText(pastLive.away_team_name)
  await expect(upcoming).toContainText(futureScheduled.away_team_name)
  await expect(upcoming).not.toContainText(pastScheduled.away_team_name)
  await expect(upcoming).not.toContainText(finished.away_team_name)
  await expect(group(page, 'Сыгранные матчи').locator('article')).toHaveCount(1)
  await expect(group(page, 'Сыгранные матчи')).toContainText(finished.away_team_name)

  const awaiting = group(page, 'Счёт уточняется')
  await expect(awaiting.locator('article')).toHaveCount(1)
  await expect(awaiting).toContainText(pastScheduled.away_team_name)
  await expect(awaiting).toContainText('Официальный результат пока не опубликован')
  await expect(awaiting.locator('.match-card__status--scheduled')).toHaveText('Запланирован')
  await expect(awaiting.locator('.match-card__status--scheduled')).toBeVisible()
  await expect(page.locator('.match-group__heading h2')).toHaveText([
    'Ближайшие',
    'Сыгранные матчи',
    'Счёт уточняется',
  ])

  await page.getByRole('combobox', { name: 'Статус', exact: true }).click()
  await page.getByRole('option', { name: 'Запланирован', exact: true }).click()
  await expect(page.locator('article.match-card')).toHaveCount(2)
  await expect(upcoming.locator('article')).toHaveCount(1)
  await expect(upcoming).toContainText(futureScheduled.away_team_name)
  await expect(awaiting.locator('article')).toHaveCount(1)
  await expect(group(page, 'Сыгранные матчи')).toHaveCount(0)
  await assertNoHorizontalOverflow(page)
})

test('a schedule containing only past scheduled games shows no false upcoming or empty state', async ({
  page,
}) => {
  const past = fixture('Матч без опубликованного результата', 'scheduled', '2026-08-22T14:00:00Z')
  await mockMatches(page, [calendarItem(past, { section: 'awaiting' })])
  await openPage(page, '/matches?team=all')
  await expect(page.locator('article.match-card')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Ближайшие', exact: true })).toHaveCount(0)
  await expect(group(page, 'Счёт уточняется')).toContainText(past.away_team_name)
  await expect(page.locator('.match-filters__summary')).toContainText('Найдено: 1')
  await expect(page.getByText('По выбранным фильтрам матчей нет.', { exact: true })).toHaveCount(0)

  await page.getByRole('combobox', { name: 'Статус', exact: true }).click()
  await page.getByRole('option', { name: 'Запланирован', exact: true }).click()
  await expect(page.locator('article.match-card')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Ближайшие', exact: true })).toHaveCount(0)
  await expect(group(page, 'Счёт уточняется')).toContainText(past.away_team_name)
  await assertNoHorizontalOverflow(page)
})

test('archive precision preserves a known year or day without inventing a tip-off time', async ({
  page,
}) => {
  const yearOnly: Match = {
    ...fixture('Игра с известным только годом', 'finished', ''),
    display_date: '2023 год',
    date_precision: 'year',
  }
  const dayOnly: Match = {
    ...fixture('Игра с известным днём', 'finished', '2024-01-09'),
    display_date: '9 января 2024',
    date_precision: 'day',
  }
  await mockMatches(page, [calendarItem(yearOnly), calendarItem(dayOnly)])
  await openPage(page, '/matches?team=all')
  const cards = page.locator('article.match-card')
  await expect(cards).toHaveCount(2)
  const year = cards.filter({ hasText: yearOnly.away_team_name })
  await expect(year.locator('.match-card__row-date')).toHaveText(/2023\s*год/u)
  await expect(year.locator('time')).not.toHaveAttribute('datetime', /2023-01-01/u)
  const day = cards.filter({ hasText: dayOnly.away_team_name })
  await expect(day.locator('.match-card__row-date')).toContainText('2024')
  await expect(day.locator('.match-card__row-date')).toContainText('янв')
  for (const card of [year, day]) {
    await expect(card.locator('.match-card__time')).toHaveCount(0)
    await expect(card.locator('.match-card__row-date')).not.toContainText(/00:00|03:00|МСК/u)
  }
  await assertNoHorizontalOverflow(page)
})
