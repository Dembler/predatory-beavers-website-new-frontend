import { expect, test } from '@playwright/test'
import type { Match } from '../../src/shared/types'
import { assertNoHorizontalOverflow, openPage } from './helpers'

test('team choice follows roster, schedule, standings, reload and an explicit shared link', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await openPage(page, '/teams/women')
  await expect(page.locator('.intro-reveal')).toHaveCount(0)
  await page
    .getByRole('navigation', { name: 'Матчи и таблица команды' })
    .getByRole('link', { name: 'Матчи команды' })
    .click()
  await expect(page).toHaveURL(/\/matches\?team=women$/)
  await expect(page.getByRole('combobox', { name: 'Команда', exact: true })).toContainText(
    'Женская команда',
  )

  const navigation = page.getByRole('navigation', {
    name: testInfo.project.name === 'mobile' ? 'Быстрый переход' : 'Основная навигация',
    exact: true,
  })
  await navigation.getByRole('link', { name: 'Таблица', exact: true }).click()
  const team = page.getByRole('combobox', { name: 'Команда', exact: true })
  await expect(team).toContainText('Женская команда')
  await team.click()
  await page.getByRole('option', { name: 'Мужская команда', exact: true }).click()
  await expect(page).toHaveURL(/\/standings\?team=men$/)
  await page.reload()
  await expect(team).toContainText('Мужская команда')

  await page.goto('/standings?team=women')
  await expect(team).toContainText('Женская команда')
  await page.goto('/club')
  await navigation.getByRole('link', { name: 'Матчи', exact: true }).click()
  await expect(team).toContainText('Женская команда')
  await assertNoHorizontalOverflow(page)
  if (testInfo.project.name === 'mobile') {
    await navigation.getByRole('link', { name: 'Команды', exact: true }).click()
    await expect(page).toHaveURL(/\/teams\/women$/)
  }
})

test('home shows the latest result when the next match has not been scheduled', async ({
  page,
}) => {
  const match: Match = {
    id: 'last-match',
    team_id: 'men',
    competition_id: 'cup',
    venue_id: null,
    team: { id: 'men', category: 'men', name: 'Команда клуба', slug: 'men', logo: null },
    competition: { id: 'cup', name: 'Кубок', season: '2026-2027', active: true },
    venue: null,
    starts_at: '2026-10-31T15:00:00Z',
    club_side: 'home',
    home_team_name: 'Команда клуба',
    away_team_name: 'Соперник последней встречи',
    home_score: 83,
    away_score: 70,
    status: 'finished',
    home_logo: null,
    away_logo: null,
    home_logo_asset_id: null,
    away_logo_asset_id: null,
    notes: null,
    featured: false,
  }
  await page.route('**/api/v1/home', (route) =>
    route.fulfill({
      json: { data: { next_match: null, recent_results: [match], teams: [match.team] } },
    }),
  )
  await openPage(page, '/')
  const dashboard = page.locator('.dashboard-main')
  await expect(
    dashboard.getByRole('heading', { name: 'Последний матч', exact: true }),
  ).toBeVisible()
  await expect(dashboard).toContainText('Новая игра пока не назначена')
  await expect(dashboard.locator('article')).toContainText('Соперник последней встречи')
  await expect(dashboard.locator('article')).toContainText('83')
  await assertNoHorizontalOverflow(page)
})

test('compact desktop header and achievement text remain inside the viewport around the breakpoint', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Intermediate desktop widths')
  await openPage(page, '/')
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
  for (const width of [901, 1024, 1150]) {
    await page.setViewportSize({ width, height: 900 })
    const escaped = await page
      .locator(
        '.nav-shell > a, .main-nav .nav-link, .achievement-card, .achievement-card h3, .achievement-card small',
      )
      .evaluateAll((elements) =>
        elements
          .filter((el) => {
            if (!el.getClientRects().length) return false
            const box = el.getBoundingClientRect()
            return box.left < -1 || box.right > window.innerWidth + 1
          })
          .map((el) => ({ element: el.className, text: el.textContent })),
      )
    expect(escaped, `Hidden clipping at ${width}px`).toEqual([])
    await assertNoHorizontalOverflow(page)
  }
})
