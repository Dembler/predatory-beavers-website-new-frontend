import { expect, test, type Locator, type Page as BrowserPage } from '@playwright/test'
import type { Achievement, ApiResponse, HomeData, Match, Page, Team } from '../../src/shared/types'
import { assertNoHorizontalOverflow, openPage } from './helpers'

type Outcome = 'win' | 'loss' | 'draw'
type OutcomeCase = { match: Match; outcome: Outcome; difference: number }

const team: Team = {
  id: 'outcomes-men',
  category: 'men',
  name: 'Хищные Бобры / ВГУ',
  slug: 'men',
  logo: null,
}
const outcomeLabels: Record<Outcome, string> = {
  win: 'Победа',
  loss: 'Поражение',
  draw: 'Ничья',
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
]

function opponent(match: Match) {
  return match.club_side === 'home' ? match.away_team_name : match.home_team_name
}

async function expectOutcome(container: Locator, item: OutcomeCase) {
  const badge = container.locator('.match-outcome')
  await expect(badge).toHaveCount(1)
  await expect(badge).toBeVisible()
  await expect(badge).toHaveAttribute('data-outcome', item.outcome)
  await expect(badge).toContainText(outcomeLabels[item.outcome])
  const difference =
    item.difference > 0
      ? new RegExp(`\\+\\s*${item.difference}\\b`)
      : item.difference < 0
        ? new RegExp(`[-−]\\s*${Math.abs(item.difference)}\\b`)
        : /\b0\b/
  await expect(badge).toContainText(difference)
}

async function expectNoOutcome(container: Locator) {
  await expect(container.locator('.match-outcome')).toHaveCount(0)
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
    await page.reload()
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
