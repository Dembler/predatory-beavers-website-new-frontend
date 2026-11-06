import { expect, test, type Locator, type Page as BrowserPage } from '@playwright/test'
import type { Achievement, ApiResponse, HomeData, Match, Page, Team } from '../../src/shared/types'
import { assertNoHorizontalOverflow, mockEmptyHistoricalResults, openPage } from './helpers'

test.beforeEach(async ({ page }) => {
  await mockEmptyHistoricalResults(page)
})

type Outcome = 'win' | 'loss' | 'draw'
type OutcomeCase = { match: Match; outcome: Outcome; difference: number }

const team: Team = {
  id: 'outcomes-men',
  category: 'men',
  name: 'Хищные Бобры / ВГУ',
  slug: 'men',
  logo: null,
}
const runtimeErrors = new WeakMap<BrowserPage, string[]>()

function fixture(id: string, changes: Partial<Match> = {}): Match {
  const side = changes.club_side ?? 'home'
  return {
    id,
    team_id: team.id,
    team,
    competition_id: 'outcomes-cup',
    competition: {
      id: 'outcomes-cup',
      name: 'Кубок проверки результатов',
      season: '2026-2027',
      active: true,
    },
    venue_id: null,
    venue: null,
    club_side: side,
    starts_at: '2026-10-25T12:00:00Z',
    home_team_name: side === 'home' ? team.name : `Соперник ${id}`,
    away_team_name: side === 'away' ? team.name : `Соперник ${id}`,
    home_score: 80,
    away_score: 70,
    status: 'finished',
    home_logo: null,
    away_logo: null,
    home_logo_url: null,
    away_logo_url: null,
    home_logo_asset_id: null,
    away_logo_asset_id: null,
    notes: null,
    featured: false,
    ...changes,
  }
}

// Expected outcomes are explicit: every margin is from the club's perspective,
// while the displayed score must keep its original home/away order.
const completed: OutcomeCase[] = [
  {
    match: fixture('home-win', { home_score: 90, away_score: 72 }),
    outcome: 'win',
    difference: 18,
  },
  {
    match: fixture('home-loss', { home_score: 66, away_score: 81 }),
    outcome: 'loss',
    difference: -15,
  },
  {
    match: fixture('away-win', { club_side: 'away', home_score: 61, away_score: 80 }),
    outcome: 'win',
    difference: 19,
  },
  {
    match: fixture('away-loss', { club_side: 'away', home_score: 91, away_score: 77 }),
    outcome: 'loss',
    difference: -14,
  },
  {
    match: fixture('zero-draw', { home_score: 0, away_score: 0 }),
    outcome: 'draw',
    difference: 0,
  },
  {
    match: fixture('home-zero', { home_score: 0, away_score: 12 }),
    outcome: 'loss',
    difference: -12,
  },
  {
    match: fixture('away-zero', { club_side: 'away', home_score: 12, away_score: 0 }),
    outcome: 'loss',
    difference: -12,
  },
]
const unscored = [
  fixture('missing-home-score', { home_score: null, away_score: 42 }),
  fixture('missing-away-score', { club_side: 'away', home_score: 42, away_score: null }),
  fixture('missing-both-scores', { home_score: null, away_score: null }),
]
const unfinished = [
  fixture('scheduled-with-scores', {
    status: 'scheduled',
    starts_at: '2026-11-15T12:00:00Z',
    home_score: 999,
    away_score: 888,
  }),
  fixture('live-with-scores', {
    status: 'live',
    starts_at: '2026-11-01T09:00:00Z',
    home_score: 54,
    away_score: 60,
  }),
  fixture('postponed-with-scores', { status: 'postponed', home_score: 222, away_score: 111 }),
  fixture('cancelled-with-scores', { status: 'cancelled', home_score: 333, away_score: 444 }),
  fixture('unpublished-with-stale-scores', {
    status: 'unpublished',
    home_score: 999,
    away_score: 888,
  }),
]

function opponent(match: Match) {
  return match.club_side === 'home' ? match.away_team_name : match.home_team_name
}

async function expectOutcome(container: Locator, item: OutcomeCase) {
  await expect(container.locator('.match-outcome')).toHaveCount(0)
  await expect(container).toHaveAttribute('data-outcome', item.outcome)
  const winningSide =
    item.match.home_score === item.match.away_score
      ? null
      : item.match.home_score! > item.match.away_score!
        ? 'home'
        : 'away'
  if (!winningSide) {
    await expect(container.locator('.is-winner, .is-loser')).toHaveCount(0)
    return
  }
  await expect(container).toHaveAttribute('data-winning-side', winningSide)
  const teams = container.locator('.match-card__team, .match-card__row-team, .result-row__team')
  const winner = teams.nth(winningSide === 'home' ? 0 : 1)
  const loser = teams.nth(winningSide === 'home' ? 1 : 0)
  await expect(winner).toHaveClass(/is-winner/)
  await expect(loser).toHaveClass(/is-loser/)
  const winnerScore = winner.locator(
    '.match-card__team-score, .match-card__row-team-score, .result-row__score',
  )
  const loserScore = loser.locator(
    '.match-card__team-score, .match-card__row-team-score, .result-row__score',
  )
  const winnerStyle = await winnerScore.evaluate((el) => ({
    color: getComputedStyle(el).color,
    weight: getComputedStyle(el).fontWeight,
    marker: getComputedStyle(el, '::after').borderRightWidth,
  }))
  const loserStyle = await loserScore.evaluate((el) => ({
    color: getComputedStyle(el).color,
    weight: getComputedStyle(el).fontWeight,
  }))
  expect(winnerStyle.color).not.toBe(loserStyle.color)
  expect(Number(winnerStyle.weight)).toBeGreaterThan(Number(loserStyle.weight))
  expect(winnerStyle.marker).toBe('5px')
  await expect(winnerScore).toHaveAttribute('aria-label', /победитель/u)
}

async function expectNoOutcome(container: Locator) {
  await expect(container.locator('.match-outcome, .is-winner, .is-loser')).toHaveCount(0)
  await expect(container).not.toContainText(/Победа|Поражение|Ничья/)
}

async function mockHome(page: BrowserPage, home: HomeData) {
  const response: ApiResponse<HomeData> = { data: home }
  const achievements: Page<Achievement> = {
    items: [],
    total: 0,
    page: 1,
    page_size: 6,
    total_pages: 0,
  }
  await page.route('**/api/v1/home', (route) => route.fulfill({ json: response }))
  await page.route('**/api/v1/achievements?**', (route) => route.fulfill({ json: achievements }))
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  runtimeErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  await page.clock.setFixedTime(new Date('2026-11-01T09:00:00Z'))
})

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page), 'The page must not raise JavaScript runtime errors').toEqual([])
})

test('schedule keeps home/away scores and gives final outcomes only to fully scored finished games', async ({
  page,
}) => {
  const matches = [...completed.map((item) => item.match), ...unscored, ...unfinished]
  const response: Page<Match> = {
    items: matches,
    total: matches.length,
    page: 1,
    page_size: 100,
    total_pages: 1,
  }
  await page.route('**/api/v1/matches?**', (route) => route.fulfill({ json: response }))
  await openPage(page, '/matches')
  const cards = page.locator('article.match-card')
  await expect(cards).toHaveCount(matches.length)

  for (const item of completed) {
    const card = cards.filter({ hasText: opponent(item.match) })
    await expectOutcome(card, item)
    await expect(card.locator('.match-card__score')).toHaveText(
      new RegExp(`^\\s*${item.match.home_score}\\s*:\\s*${item.match.away_score}\\s*$`),
    )
  }
  for (const match of unscored) {
    const card = cards.filter({ hasText: opponent(match) })
    await expectNoOutcome(card)
    await expect(card.locator('.match-card__score')).toHaveCount(0)
    await expect(card).toContainText('Счёт уточняется')
  }
  for (const match of unfinished) {
    const card = cards.filter({ hasText: opponent(match) })
    await expectNoOutcome(card)
    if (match.status === 'live') {
      await expect(card).toContainText('Идёт')
      await expect(card.locator('.match-card__score')).toHaveText(/54\s*:\s*60/)
    } else {
      await expect(card.locator('.match-card__score')).toHaveCount(0)
      await expect(card).not.toContainText(String(match.home_score))
      await expect(card).not.toContainText(String(match.away_score))
      if (match.status === 'unpublished') {
        await expect(card.locator('.match-card__no-score')).toBeVisible()
        await expect(card).toContainText('Результат не опубликован')
      }
    }
  }
  await assertNoHorizontalOverflow(page)
})

for (const item of completed) {
  test(`home featured match and recent results agree for ${item.match.id}`, async ({ page }) => {
    await mockHome(page, { next_match: null, recent_results: [item.match], teams: [team] })
    await openPage(page, '/')
    const featured = page.locator('article.match-card').filter({ hasText: opponent(item.match) })
    await expectOutcome(featured, item)
    await expect(featured.locator('.match-card__score')).toHaveText(
      new RegExp(`^\\s*${item.match.home_score}\\s*:\\s*${item.match.away_score}\\s*$`),
    )
    const result = page
      .getByRole('list', { name: 'Последние результаты', exact: true })
      .getByRole('listitem')
      .filter({ hasText: opponent(item.match) })
    await result.scrollIntoViewIfNeeded()
    await expectOutcome(result, item)
    await expect(result.locator('.result-row__score')).toHaveText([
      String(item.match.home_score),
      String(item.match.away_score),
    ])
    await assertNoHorizontalOverflow(page)
  })
}

test('home never announces a final outcome for a live, scheduled, changed or unscored game', async ({
  page,
}) => {
  test.setTimeout(90_000)
  // The normal API puts only finished matches in recent_results. Include other
  // valid Match statuses here to ensure stale data cannot announce a false win.
  const recent = [...unfinished, ...unscored]
  let nextMatch = unfinished[1]!
  await page.route('**/api/v1/home', (route) => {
    const response: ApiResponse<HomeData> = {
      data: { next_match: nextMatch, recent_results: recent, teams: [team] },
    }
    return route.fulfill({ json: response })
  })
  await page.route('**/api/v1/achievements?**', (route) =>
    route.fulfill({
      json: {
        items: [],
        total: 0,
        page: 1,
        page_size: 6,
        total_pages: 0,
      } satisfies Page<Achievement>,
    }),
  )
  await openPage(page, '/')
  for (const match of [...unfinished, ...unscored]) {
    nextMatch = match
    await openPage(page, '/')
    const featured = page.locator('article.match-card').filter({ hasText: opponent(match) })
    await expect(featured).toBeVisible()
    await expectNoOutcome(featured)
    if (match.status === 'live') {
      await expect(featured).toContainText('Идёт')
      await expect(featured.locator('.match-card__score')).toHaveText(/54\s*:\s*60/)
    } else {
      await expect(featured.locator('.match-card__score')).toHaveCount(0)
    }
  }
  const results = page.getByRole('list', { name: 'Последние результаты', exact: true })
  await expect(results.locator('.match-outcome')).toHaveCount(0)
  await expect(results.locator('.result-row__score')).toHaveCount(0)
  await assertNoHorizontalOverflow(page)
})

test('stages are immediately readable while imported provenance and map links stay out of match cards', async ({
  page,
}) => {
  const cases = [
    ['final', 'Финал', 'Финал'],
    ['third', 'Финал за 3 место', 'Матч за 3-е место'],
    ['semi', '1/2 финала (2)', 'Полуфинал'],
    ['quarter', '1/4 (3)', 'Четвертьфинал'],
    ['places', '4-6 места', 'Матчи за 4–6-е места'],
    ['group', 'Группа А', 'Группа А'],
    ['technical', 'Импорт АСБ. Источник https://example.com/private-api; GameID=123', null],
    ['region', 'Воронежская область', null],
  ] as const
  const venue = {
    id: 'gym',
    name: 'Спортзал ВГУ',
    address: 'Воронеж, Университетская пл., 1',
    description: null,
  }
  const matches = cases.map(([id, notes]) => fixture(id, { notes, venue_id: venue.id, venue }))
  await page.route('**/api/v1/matches?**', (route) =>
    route.fulfill({
      json: {
        items: matches,
        total: matches.length,
        page: 1,
        page_size: 100,
        total_pages: 1,
      },
    }),
  )
  await openPage(page, '/matches')
  for (const [id, , label] of cases) {
    const card = page.locator('article.match-card').filter({ hasText: `Соперник ${id}` })
    if (label) await expect(card.locator('.match-card__stage')).toHaveText(label)
    else await expect(card.locator('.match-card__stage')).toHaveCount(0)
    await expect(card.locator('details, summary, a')).toHaveCount(0)
    await expect(card).toContainText(venue.name)
    await expect(card).not.toContainText(/Источник|GameID|example.com|Подробнее о матче/u)
  }
  await assertNoHorizontalOverflow(page)

  const girls = fixture('girls-final', {
    team: { ...team, category: 'women' },
    notes: 'Финал за 3 место',
    venue_id: venue.id,
    venue,
  })
  await mockHome(page, { next_match: null, recent_results: [girls], teams: [girls.team] })
  await openPage(page, '/')
  const featured = page.locator('article.match-card')
  await expect(featured.locator('.match-card__stage')).toHaveText('Матч за 3-е место')
  await expect(featured.locator('a, details')).toHaveCount(0)
  await expect(featured.getByRole('img', { name: 'Женский матч', exact: true })).toHaveText('Ж')
  const recent = page.locator('.result-row')
  await expect(recent.locator('.result-row__stage')).toHaveText('Матч за 3-е место')
  await expect(recent.getByRole('img', { name: 'Женский матч', exact: true })).toHaveText('Ж')
  await expect(page.locator('.recent-results__header, .recent-results__record')).toHaveCount(0)
  await assertNoHorizontalOverflow(page)
})

test('recent cards retain competition context and label each known gender without a shared caption', async ({
  page,
}) => {
  const men = fixture('men-category')
  const women = fixture('women-category', {
    team: { ...team, id: 'outcomes-women', category: 'women' },
    competition: { ...men.competition, id: 'women-cup', name: 'Кубок девушек' },
  })
  const unknown = fixture('unknown-category', {
    team: { ...team, category: null } as unknown as Team,
  })
  await mockHome(page, { next_match: null, recent_results: [men, women, unknown], teams: [team] })
  await openPage(page, '/')
  const recent = page.locator('.recent-results')
  await expect(recent.locator('header, .recent-results__record')).toHaveCount(0)
  const rows = recent.getByRole('listitem')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0).getByRole('img', { name: 'Мужской матч', exact: true })).toHaveText('М')
  await expect(rows.nth(1).getByRole('img', { name: 'Женский матч', exact: true })).toHaveText('Ж')
  await expect(rows.nth(2).locator('.result-row__category')).toHaveCount(0)
  for (const [index, match] of [men, women, unknown].entries()) {
    await expect(rows.nth(index)).toContainText(match.competition.name)
    await expect(rows.nth(index)).toContainText(`Сезон ${match.competition.season}`)
  }
  await assertNoHorizontalOverflow(page)
})
