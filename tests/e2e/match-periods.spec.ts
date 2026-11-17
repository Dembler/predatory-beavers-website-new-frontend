import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator } from '@playwright/test'
import type { Match, MatchPeriodScore } from '../../src/shared/types'
import type { PublicResult } from '../../src/shared/results'
import { archiveItem, calendarItem, mockCalendar } from './calendar-fixtures'
import { assertNoHorizontalOverflow, openPage } from './helpers'

const periods: MatchPeriodScore[] = [
  { number: 1, label: '1', club_score: 20, opponent_score: 18 },
  { number: 2, label: '2', club_score: 19, opponent_score: 20 },
  { number: 3, label: '3', club_score: 18, opponent_score: 19 },
  { number: 4, label: '4', club_score: 17, opponent_score: 17 },
  { number: 5, label: 'ОТ1', club_score: 6, opponent_score: 4 },
]
const game = (id: string, changes: Partial<Match> = {}): Match => ({
  id,
  source: 'asb',
  external_id: id,
  team_id: 'men',
  team: { id: 'men', name: 'ВГУ', slug: 'men', category: 'men', logo: null },
  competition_id: 'asb',
  competition: { id: 'asb', name: 'АСБ', season: '2026-2027', active: true },
  venue_id: null,
  venue: null,
  club_side: 'away',
  starts_at: '2026-11-10T15:00:00Z',
  home_team_name: 'Хозяева',
  away_team_name: 'ВГУ',
  home_score: 78,
  away_score: 80,
  status: 'finished',
  home_logo: null,
  away_logo: null,
  home_logo_url: null,
  away_logo_url: null,
  home_logo_asset_id: null,
  away_logo_asset_id: null,
  notes: null,
  featured: false,
  active: true,
  created_at: '',
  updated_at: '',
  score_by_periods: periods,
  ...changes,
})
const archive = (id: string, changes: Partial<PublicResult> = {}): PublicResult => ({
  id: `archive-${id}`,
  external_id: id,
  source: 'asb',
  discipline: '5x5',
  team: 'men',
  season: '2026-2027',
  year: 2026,
  tournament: 'Архив АСБ',
  event_date: '2026-11-10',
  date_precision: 'day',
  location: null,
  team_name: 'ВГУ',
  opponent_name: 'Архивный соперник',
  club_score: 80,
  opponent_score: 78,
  place: null,
  status: 'finished',
  source_url: 'https://asbasket.ru/',
  source_label: 'АСБ',
  emblem_url: null,
  opponent_emblem_url: null,
  notes: null,
  score_by_periods: periods,
  ...changes,
})
async function expectScores(card: Locator, home: string[], away: string[]) {
  await expect(card.locator('.match-periods')).toBeVisible()
  await expect(card.locator('.match-periods thead th')).toHaveText([
    'Команда',
    '1',
    '2',
    '3',
    '4',
    'ОТ1',
  ])
  await expect(card.locator('.match-periods [data-side="home"] td')).toHaveText(home)
  await expect(card.locator('.match-periods [data-side="away"] td')).toHaveText(away)
  await expect(card.getByRole('button')).toHaveCount(0)
  await expect(card.getByText(/Протокол|Статистика игроков|Снимок/)).toHaveCount(0)
}

test('calendar cards immediately show official quarter and overtime scores in their visible home/away order', async ({
  page,
}, testInfo) => {
  const protocolRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/game-statistics/')) protocolRequests.push(request.url())
  })
  await mockCalendar(page, [
    calendarItem(game('away')),
    calendarItem(
      game('home', {
        club_side: 'home',
        home_team_name: 'ВГУ',
        away_team_name: 'Гости',
        home_score: 80,
        away_score: 78,
      }),
    ),
    archiveItem(archive('archived')),
  ])
  await openPage(page, '/matches')
  const away = page.locator('article.match-card').filter({ hasText: 'Хозяева' })
  await expectScores(away, ['18', '20', '19', '17', '4'], ['20', '19', '18', '17', '6'])
  await expect(away.locator('.match-periods [data-side="away"] th')).toHaveText('ВГУ')
  const home = page.locator('article.match-card').filter({ hasText: 'Гости' })
  await expectScores(home, ['20', '19', '18', '17', '6'], ['18', '20', '19', '17', '4'])
  const archived = page.locator('article.match-card').filter({ hasText: 'Архивный соперник' })
  await expectScores(archived, ['20', '19', '18', '17', '6'], ['18', '20', '19', '17', '4'])
  await expect(archived.locator('.match-periods [data-side="home"] th')).toHaveText('ВГУ')
  await assertNoHorizontalOverflow(page)
  expect((await new AxeBuilder({ page }).include('.match-periods').analyze()).violations).toEqual(
    [],
  )
  expect(protocolRequests).toEqual([])
  await away.screenshot({
    path: testInfo.outputPath('quarter-scores.png'),
    style: '.bobrik-launcher { visibility: hidden !important; }',
  })
})

test('featured card shows quarter scores without fetching a full protocol', async ({
  page,
}, testInfo) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/game-statistics/')) requests.push(request.url())
  })
  const match = game('featured')
  await page.route('**/api/v1/home', (route) =>
    route.fulfill({
      json: {
        data: {
          next_match: match,
          recent_results: [],
          teams: [match.team],
        },
      },
    }),
  )
  await page.route('**/api/v1/achievements?**', (route) =>
    route.fulfill({
      json: {
        items: [],
        total: 0,
        page: 1,
        page_size: 6,
        total_pages: 0,
      },
    }),
  )
  await openPage(page, '/')
  const card = page.locator('article.match-card')
  await expect(card).not.toHaveClass(/match-card--row/)
  await expectScores(card, ['18', '20', '19', '17', '4'], ['20', '19', '18', '17', '6'])
  expect(requests).toEqual([])
  await assertNoHorizontalOverflow(page)
  await card.screenshot({
    path: testInfo.outputPath('featured-quarter-scores.png'),
    style: '.bobrik-launcher { visibility: hidden !important; }',
  })
})

test('absent quarters are omitted, known zero stays zero and 3x3 has no quarters', async ({
  page,
}) => {
  await mockCalendar(page, [
    calendarItem(game('none', { home_team_name: 'Нет данных', score_by_periods: [] })),
    calendarItem(
      game('missing', { home_team_name: 'Поле отсутствует', score_by_periods: undefined }),
    ),
    calendarItem(
      game('zero', {
        home_team_name: 'Ноль очков',
        score_by_periods: [{ number: 1, label: '1', club_score: 0, opponent_score: 12 }],
      }),
    ),
    calendarItem(game('stale', { home_team_name: 'Перенесён', status: 'postponed' }), {
      section: 'changed',
    }),
    archiveItem(archive('3x3', { discipline: '3x3', opponent_name: 'Три на три' })),
  ])
  await openPage(page, '/matches')
  for (const name of ['Нет данных', 'Поле отсутствует', 'Перенесён', 'Три на три']) {
    await expect(
      page.locator('article.match-card').filter({ hasText: name }).locator('.match-periods'),
    ).toHaveCount(0)
  }
  const zero = page.locator('article.match-card').filter({ hasText: 'Ноль очков' })
  await expect(zero.locator('.match-periods thead th')).toHaveText(['Команда', '1'])
  await expect(zero.locator('.match-periods [data-side="away"] td')).toHaveText('0')
  await expect(zero.locator('.match-periods [data-side="home"] td')).toHaveText('12')
  await assertNoHorizontalOverflow(page)
})
