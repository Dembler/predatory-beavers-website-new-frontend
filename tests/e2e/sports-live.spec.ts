import { expect, test } from '@playwright/test'
import { openPage } from './helpers'

const player = {
  id: '11111111-1111-4111-8111-111111111111',
  external_player_id: 'test',
  full_name: 'Игрок автообновления',
  photo_url: null,
  games_played: 1,
  points_per_game: 10,
  assists_per_game: 0,
  rebounds_per_game: null,
  minutes_per_game: 20,
  statistics_season: '2026-2027',
  statistics_source_url: null,
}
const context = {
  team: 'women',
  current_season: '2026-2027',
  season: '2026-2027',
  is_current_season: true,
  status: 'published',
  source_url: null,
  stats_source_url: null,
  notice: null,
}

for (const detail of [false, true]) {
  test(`${detail ? 'player profile' : 'team roster'} refreshes published statistics and keeps them after an update fails`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-11-15T12:00:00Z') })
    let requests = 0
    let fail = false
    await page.route('**/api/v1/players?**', (route) =>
      route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 24, total_pages: 0 } }),
    )
    const endpoint = `/api/v1/asb-roster/women${detail ? `/players/${player.id}` : ''}`
    await page.route(`**${endpoint}`, (route) => {
      requests++
      if (fail) return route.fulfill({ status: 503, json: { code: 'unavailable' } })
      const current = { ...player, games_played: requests, points_per_game: 9 + requests }
      return route.fulfill({
        json: { data: { ...context, ...(detail ? { player: current } : { players: [current] }) } },
      })
    })
    const path = `/teams/women${detail ? `/players/${player.id}` : ''}`
    await openPage(page, path)
    const points = page.locator('.player-averages dd').first()
    await expect(points).toHaveText('10')
    await page.clock.fastForward(60_000)
    await expect(points).toHaveText('11')
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    fail = true
    await page.clock.fastForward(60_000)
    await expect.poll(() => requests).toBe(3)
    await expect(points).toHaveText('11')
    await expect(page.locator('main [role="alert"]')).toHaveCount(0)
  })
}

test('standings refreshes rows and filter options without changing the selected stage, retaining data on failure', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-15T12:00:00Z') })
  const competition = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Турнир автообновления',
    season: '2026-2027',
    active: true,
    tournament_id: 'region',
    tournament_name: 'Воронежская область',
    stage_name: 'Круговой турнир',
    stage_kind: 'group',
  }
  let optionRequests = 0
  let fail = false
  const requests: string[] = []
  await page.route('**/api/v1/standings/options?**', (route) => {
    optionRequests++
    if (fail) return route.fulfill({ status: 503, json: { code: 'unavailable' } })
    return route.fulfill({
      json: {
        data: {
          seasons: [competition.season],
          competitions: [competition],
          default_competition_id: competition.id,
        },
      },
    })
  })
  await page.route('**/api/v1/standings?**', (route) => {
    requests.push(new URL(route.request().url()).search)
    if (fail) return route.fulfill({ status: 503, json: { code: 'unavailable' } })
    return route.fulfill({
      json: {
        data: {
          competition,
          tournament_id: competition.tournament_id,
          tournament_name: competition.tournament_name,
          stage_name: competition.stage_name,
          stage_kind: competition.stage_kind,
          rows: [
            {
              position: 1,
              team_name: 'ВГУ',
              external_team_id: '7695',
              team_logo_url: null,
              played: requests.length,
              wins: requests.length,
              losses: 0,
              draws: 0,
              table_points: requests.length * 2,
              points_for: 80,
              points_against: 60,
              points_difference: 20,
            },
          ],
        },
      },
    })
  })
  const path = `/standings?team=women&season=2026-2027&tournament=region&competition=${competition.id}`
  await openPage(page, path)
  const points = page.locator('tbody .league-table__points')
  await expect(points).toHaveText('2')
  await page.clock.fastForward(60_000)
  await expect(points).toHaveText('4')
  await expect.poll(() => optionRequests).toBe(2)
  await expect(page).toHaveURL(new RegExp(`${path.replaceAll('?', '\\?')}$`))
  expect(requests[1]).toBe(requests[0])
  fail = true
  await page.clock.fastForward(60_000)
  await expect.poll(() => requests.length).toBe(3)
  await expect.poll(() => optionRequests).toBe(3)
  await expect(points).toHaveText('4')
  await expect(page.getByRole('combobox', { name: 'Этап', exact: true })).toContainText(
    'Круговой турнир',
  )
  await expect(page.locator('main [role="alert"]')).toHaveCount(0)
})
