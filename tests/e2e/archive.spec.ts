import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import type { Match } from '../../src/shared/types'
import type { PublicResult } from '../../src/shared/results'
import { assertNoHorizontalOverflow, openPage } from './helpers'

function fixture(index: number, changes: Partial<Match> = {}): Match {
  return {
    id: `calendar-${index}`,
    source: 'asb',
    external_id: String(index),
    team_id: 'men',
    team: { id: 'men', category: 'men', name: 'ВГУ', slug: 'men', logo: null },
    competition_id: 'season',
    competition: { id: 'season', name: 'АСБ', season: '2025-2026', active: true },
    venue_id: null,
    venue: null,
    club_side: 'home',
    starts_at: `2026-02-${String((index % 28) + 1).padStart(2, '0')}T15:00:00Z`,
    home_team_name: 'ВГУ',
    away_team_name: `Соперник ${index}`,
    home_score: 99,
    away_score: 70,
    status: 'finished',
    home_logo: null,
    away_logo: null,
    home_logo_asset_id: null,
    away_logo_asset_id: null,
    notes: null,
    featured: false,
    ...changes,
  }
}
function result(index: number, changes: Partial<PublicResult> = {}): PublicResult {
  return {
    id: `historical-${index}`,
    external_id: String(index),
    source: 'asb',
    discipline: '5x5',
    team: 'men',
    season: '2025-2026',
    year: 2026,
    tournament: 'АСБ — историческая запись',
    event_date: '2026-02-01',
    date_precision: 'day',
    location: 'Воронеж',
    team_name: 'ВГУ',
    opponent_name: `Соперник ${index}`,
    club_score: 82,
    opponent_score: 80,
    place: null,
    status: 'finished',
    source_url: 'https://asbasket.ru/',
    source_label: 'АСБ · официальный архив',
    emblem_url: null,
    opponent_emblem_url: null,
    notes: null,
    ...changes,
  }
}
const womenPlace = result(900, {
  external_id: 'women-place',
  source: 'vsu',
  team: 'women',
  discipline: '3x3',
  season: '2023',
  year: 2023,
  event_date: null,
  date_precision: 'year',
  tournament: 'Кубок девушек 3×3',
  opponent_name: null,
  club_score: null,
  opponent_score: null,
  place: 3,
  source_url: 'https://www.vsu.ru/',
  source_label: 'ВГУ',
})
async function mockData(page: Page, matches: Match[], results: PublicResult[]) {
  await page.route('**/api/v1/matches?**', (route) => {
    const query = new URL(route.request().url()).searchParams
    const current = Number(query.get('page') || 1),
      size = Number(query.get('page_size') || 100)
    return route.fulfill({
      json: {
        items: matches.slice((current - 1) * size, current * size),
        total: matches.length,
        page: current,
        page_size: size,
        total_pages: Math.ceil(matches.length / size),
      },
    })
  })
  await page.route('**/api/v1/results-archive?**', (route) => {
    const query = new URL(route.request().url()).searchParams
    const current = Number(query.get('page') || 1),
      size = Number(query.get('page_size') || 100)
    return route.fulfill({
      json: {
        items: results.slice((current - 1) * size, current * size),
        total: results.length,
        page: current,
        page_size: size,
        total_pages: Math.ceil(results.length / size),
      },
    })
  })
  await page.route('**/api/v1/results-archive/summary', (route) =>
    route.fulfill({
      json: {
        data: {
          coverage: [
            {
              provider: 'asb',
              team: 'men',
              season: '2010-2011',
              records: 0,
              status: 'historical_identity_unverified',
              source_url: 'https://asbasket.ru/',
              note: 'Ранние данные не подтверждены.',
            },
            {
              provider: 'fiba3x3',
              team: 'women',
              season: 'all',
              records: 0,
              status: 'upstream_unavailable',
              source_url: 'https://play.fiba3x3.com/',
              note: 'Источник временно недоступен.',
            },
          ],
        },
      },
    }),
  )
}

test('matches retain individual games and editor scores without tournament totals or sources', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-04T09:00:00Z'))
  const upcoming = fixture(2, {
    source: 'manual',
    external_id: null,
    starts_at: '2026-11-15T15:00:00Z',
    status: 'scheduled',
    home_score: null,
    away_score: null,
    away_team_name: 'Будущая встреча',
    competition: { id: 'current', name: 'Кубок', season: '2026-2027', active: true },
  })
  const unpublished = result(901, {
    season: '2018-2019',
    year: 2019,
    event_date: '2019-02-01',
    status: 'unpublished',
    club_score: 0,
    opponent_score: 0,
    opponent_name: 'Итог неизвестен',
    notes: 'Итог не опубликован в источнике.',
  })
  await mockData(page, [fixture(1), upcoming], [result(1), womenPlace, unpublished])
  await openPage(page, '/matches?team=all')
  await expect(page.getByRole('combobox', { name: 'Сезон', exact: true })).toContainText(
    '2026 / 2027',
  )
  await expect(page.locator('article.match-card')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Ближайшие', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Сезон', exact: true }).click()
  await page.getByRole('option', { name: 'Все сезоны', exact: true }).click()
  await expect(page.locator('.match-filters__summary')).toContainText('Найдено: 3')
  await expect(page.locator('article.match-card')).toHaveCount(3)
  await expect(page.locator('.tournament-result, .match-sources, .match-source-link')).toHaveCount(
    0,
  )
  await expect(page.locator('main')).not.toContainText(womenPlace.tournament)
  const clubGame = page.locator('article.match-card').filter({ hasText: 'Соперник 1' })
  await expect(clubGame).toContainText('99')
  await expect(clubGame).not.toContainText('82')
  await expect(clubGame.getByRole('link')).toHaveCount(0)
  const unknown = page.locator('article.match-card').filter({ hasText: 'Итог неизвестен' })
  await expect(unknown.locator('.match-card__score')).toHaveCount(0)
  await expect(unknown.locator('.match-outcome')).toHaveCount(0)
  await expect(unknown).not.toContainText('0:0')
  await expect(
    page
      .getByRole('navigation', { name: 'Основная навигация' })
      .getByRole('link', { name: 'Архив', exact: true }),
  ).toHaveCount(0)
  await assertNoHorizontalOverflow(page)
})

test('pagination and filters survive reload, reset their page and restore with browser back and forward', async ({
  page,
}) => {
  const matches = Array.from({ length: 30 }, (_, index) =>
    fixture(
      index + 1,
      index === 29
        ? {
            team: { id: 'women', category: 'women', name: 'ВГУ', slug: 'women', logo: null },
          }
        : {},
    ),
  )
  await mockData(page, matches, [...matches.map((_, index) => result(index + 1)), womenPlace])
  await openPage(page, '/matches?season=all&team=all')
  await expect(page.locator('article.match-card')).toHaveCount(24)
  await page.getByRole('button', { name: 'Дальше →', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('article.match-card')).toHaveCount(6)
  await page.reload()
  await expect(page.locator('article.match-card')).toHaveCount(6)
  await expect(page.getByRole('navigation', { name: 'Страницы матчей' })).toContainText('2 / 2')
  await page.getByRole('combobox', { name: 'Команда', exact: true }).click()
  await page.getByRole('option', { name: 'Девушки', exact: true }).click()
  await expect(page).not.toHaveURL(/page=/)
  await expect(page.locator('article.match-card')).toHaveCount(1)
  await page.goBack()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('article.match-card')).toHaveCount(6)
  await page.goForward()
  await expect(page.locator('article.match-card')).toHaveCount(1)
  await expect(page.getByRole('combobox', { name: 'Команда', exact: true })).toContainText(
    'Девушки',
  )
  await assertNoHorizontalOverflow(page)
})

test('default season is the latest published season when scheduled dates have already passed', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-04T09:00:00Z'))
  const past = fixture(2, {
    source: 'manual',
    external_id: null,
    starts_at: '2026-08-01T15:00:00Z',
    status: 'scheduled',
    home_score: null,
    away_score: null,
    competition: { id: 'past', name: 'Кубок', season: '2026-2027', active: true },
  })
  await mockData(
    page,
    [fixture(1), past],
    [
      result(1),
      {
        ...womenPlace,
        opponent_name: 'Соперник девушек',
        club_score: 21,
        opponent_score: 15,
        place: null,
      },
    ],
  )
  await openPage(page, '/matches?team=all')
  await expect(page.locator('.match-filters__summary')).toContainText('Найдено: 1')
  await expect(page.getByRole('combobox', { name: 'Сезон', exact: true })).toContainText(
    '2025 / 2026',
  )
  await expect(page.getByRole('heading', { name: 'Ближайшие', exact: true })).toHaveCount(0)
  await expect(page.locator('article.match-card')).toHaveCount(1)
  await page.getByRole('combobox', { name: 'Формат игры', exact: true }).click()
  await page.getByRole('option', { name: '3×3 — на одно кольцо', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Сезон', exact: true })).toContainText(
    '2023 / 2024',
  )
  await expect(page.locator('article.match-card')).toHaveCount(1)
})

test('old tournament links lead to club history rather than individual matches', async ({
  page,
}) => {
  await mockData(page, [], [womenPlace])
  await openPage(page, '/results?team=women&season=2023&discipline=3x3')
  await expect(page).toHaveURL('/club?team=women&season=2023&discipline=3x3#club-tournaments')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('О клубе')
  await expect(
    page.locator('.tournaments-filters').getByRole('button', { name: 'Девушки', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.goto('/3x3?team=women&season=2023')
  await expect(page).toHaveURL('/club?team=women&season=2023&discipline=3x3#club-tournaments')
  await expect(page.locator('#club-tournaments')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Формат турнира', exact: true })).toContainText(
    '3×3',
  )
  await expect(page.locator('.tournament-story').first()).toBeVisible()
  for (const summary of await page.locator('.tournament-story__results summary').all())
    await summary.click()
  for (const meta of await page.locator('.tournament-story__meta').all())
    await expect(meta).toContainText('3×3')
  await assertNoHorizontalOverflow(page)
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    accessibility.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
  ).toEqual([])
})

test('season filters use the July boundary, preserve explicit seasons and retain undated evidence without duplicating it', async ({
  page,
}) => {
  const old = fixture(1, {
    starts_at: '2024-03-01T15:00:00Z',
    competition: { id: 'old', name: 'АСБ', season: '2023-2024', active: true },
  })
  const julyInMoscow = fixture(7, {
    starts_at: '2024-06-30T21:00:00Z',
    competition: { id: 'undated-season', name: 'Кубок', season: '', active: true },
  })
  const undated = {
    ...womenPlace,
    id: 'undated-2024',
    season: '2024',
    year: 2024,
    opponent_name: 'Соперник девушек',
    club_score: 21,
    opponent_score: 15,
    place: null,
  }
  const dated = (
    index: number,
    tournament: string,
    event_date: string,
    changes: Partial<PublicResult> = {},
  ) =>
    result(index, {
      source: 'vsu',
      tournament,
      discipline: '3x3',
      season: '2024',
      year: 2024,
      event_date,
      opponent_name: `Соперник ${index}`,
      place: null,
      ...changes,
    })
  await mockData(
    page,
    [old, julyInMoscow],
    [
      result(1, { year: 2024, season: '2023-2024', event_date: '2024-03-01' }),
      dated(2, 'Июньский кубок 3×3', '2024-06-30'),
      dated(3, 'Июльский кубок 3×3', '2024-07-01'),
      dated(4, 'Турнир с явным сезоном', '2024-09-01', { season: '2023-2024' }),
      dated(5, 'Фиджитал июня', '2024-06-01', {
        discipline: 'phygital',
        date_precision: 'month',
      }),
      dated(6, 'Фиджитал июля', '2024-07-01', {
        discipline: 'phygital',
        date_precision: 'month',
      }),
      undated,
    ],
  )
  await openPage(page, '/matches?season=2023-2024&team=all')
  await expect(page.locator('article.match-card')).toHaveCount(5)
  await expect(page.locator('.match-filters__summary')).toContainText('Найдено: 5')
  for (const title of [
    'Турнир с явным сезоном',
    'Июньский кубок 3×3',
    'Фиджитал июня',
    'Кубок девушек 3×3',
  ])
    await expect(page.locator('article.match-card').filter({ hasText: title })).toHaveCount(1)
  const seasons = page.getByRole('combobox', { name: 'Сезон', exact: true })
  await seasons.click()
  await expect(page.getByRole('option', { name: /год/ })).toHaveCount(0)
  await expect(page.getByRole('option', { name: 'Все сезоны', exact: true })).toBeVisible()
  await page.getByRole('option', { name: '2024 / 2025', exact: true }).click()
  await expect(page.locator('article.match-card')).toHaveCount(4)
  await expect(page.locator('article.match-card').filter({ hasText: 'Соперник 7' })).toHaveCount(1)
  await expect(page.locator('.match-filters__summary')).toContainText('Найдено: 4')
  for (const title of ['Июльский кубок 3×3', 'Фиджитал июля', 'Кубок девушек 3×3'])
    await expect(page.locator('article.match-card').filter({ hasText: title })).toHaveCount(1)
  await seasons.click()
  await page.getByRole('option', { name: 'Все сезоны', exact: true }).click()
  await expect(page.locator('article.match-card')).toHaveCount(8)
  await expect(page.locator('.match-filters__summary')).toContainText('Найдено: 8')
  await expect(page.getByRole('heading', { name: 'Сезон не уточнён', exact: true })).toBeVisible()
  const unknown = page.locator('article.match-card').filter({ hasText: 'Кубок девушек 3×3' })
  await expect(unknown).toHaveCount(1)
  await expect(unknown.locator('.match-card__row-date')).toContainText('2024год')
  await assertNoHorizontalOverflow(page)
  await page.goto('/matches?season=2010-2011&team=all')
  await expect(page.getByRole('status')).toContainText('По выбранным фильтрам матчей нет')
  await expect(page.locator('.match-sources')).toHaveCount(0)
})

test('legacy calendar-year URLs become canonical season filters while preserving other filters', async ({
  page,
}) => {
  const early = result(10, {
    source: 'vsu',
    discipline: '3x3',
    season: '2025',
    year: 2025,
    event_date: '2025-06-30',
    tournament: 'Июнь 2025',
  })
  const late = result(11, {
    ...early,
    id: 'late-2025',
    external_id: 'late-2025',
    event_date: '2025-07-01',
    tournament: 'Июль 2025',
  })
  await mockData(page, [], [early, late])
  await openPage(page, '/matches?year=2025&team=men&discipline=3x3&status=finished&page=2')
  await expect(page).toHaveURL('/matches?team=men&discipline=3x3&status=finished&season=2024-2025')
  await expect(page.getByRole('combobox', { name: 'Сезон', exact: true })).toContainText(
    '2024 / 2025',
  )
  await expect(page.locator('article.match-card')).toHaveCount(1)
  await expect(page.locator('article.match-card')).toContainText('Июнь 2025')
  await page.getByRole('combobox', { name: 'Сезон', exact: true }).click()
  await page.getByRole('option', { name: '2025 / 2026', exact: true }).click()
  await expect(page.locator('article.match-card')).toHaveCount(1)
  await expect(page.locator('article.match-card')).toContainText('Июль 2025')
  await page.goto('/matches?season=2025&team=all')
  await expect(page).toHaveURL('/matches?season=2024-2025&team=all')
  await page.goto('/matches?season=2025-2026&year=2025&team=all')
  await expect(page).toHaveURL('/matches?season=2025-2026&team=all')
  await expect(page.locator('article.match-card')).toContainText('Июль 2025')
})
