import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import type { StandingsGame } from '../../src/shared/types'
import { assertNoHorizontalOverflow, openPage } from './helpers'

const stage = {
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Воронежская область / Плей-офф',
  season: '2024-2025',
  active: true,
  tournament_id: 'voronezh',
  tournament_name: 'Воронежская область',
  stage_name: 'Плей-офф',
  stage_kind: 'playoff',
}

const names: Record<string, string> = {
  '7433': 'ВГУ',
  b: 'Воронежский государственный технический университет',
  d: 'ВГУИТ',
  e: 'Липецкий государственный технический университет',
  f: 'ВГПУ',
  g: 'ВГАУ',
  h: 'ВГМУ',
}

function game(
  id: string,
  round: number,
  order: number,
  home: string,
  away: string,
  score: [number, number] | null,
  tree = 1,
): StandingsGame {
  return {
    external_id: id,
    round_name: tree === 2 ? '3 место' : round === 1 ? 'Финал' : `1/${round}`,
    round,
    tree,
    sort_order: order,
    starts_at: score ? '2025-03-01T10:00:00Z' : null,
    date_precision: 'day',
    home_team_name: names[home]!,
    home_team_id: home,
    home_team_logo_url: home === '7433' ? '/images/brand/club-emblem.webp' : null,
    away_team_name: names[away]!,
    away_team_id: away,
    away_team_logo_url: null,
    home_score: score?.[0] ?? null,
    away_score: score?.[1] ?? null,
    status: score ? 'finished' : tree === 2 ? 'unpublished' : 'scheduled',
    source_url: 'https://asb.infobasket.su/Widget/PlayOff/48638?format=json',
  }
}

// Deliberately shuffled, with quarterfinal slot 2 absent from the published data.
const games = [
  game('final', 1, 1, '7433', 'g', null),
  game('qf4', 4, 4, 'g', 'h', [81, 72]),
  game('bronze', 1, 2, 'd', 'e', null, 2),
  game('sf1', 2, 1, '7433', 'd', [83, 70]),
  game('qf1', 4, 1, '7433', 'b', [90, 71]),
  game('sf2', 2, 2, 'e', 'g', [64, 79]),
  game('qf3', 4, 3, 'e', 'f', [76, 60]),
]

async function bracketFixture(page: Page) {
  await page.route('**/api/v1/standings/options?**', (route) =>
    route.fulfill({
      json: {
        data: {
          seasons: [stage.season],
          competitions: [stage],
          default_competition_id: stage.id,
        },
      },
    }),
  )
  await page.route('**/api/v1/standings?**', (route) =>
    route.fulfill({ json: { data: { competition: stage, ...stage, rows: [], games } } }),
  )
  await openPage(page, `/standings?team=men&season=${stage.season}&competition=${stage.id}`)
  await expect(page.locator('.playoff-bracket')).toBeVisible()
}

test('the bracket connects the published progression and keeps placement games separate', async ({
  page,
}) => {
  await bracketFixture(page)
  const bracket = page.locator('.playoff-bracket')
  const match = (id: string) => bracket.locator(`.bracket-game[data-game-id="${id}"]`)
  await expect(bracket.getByRole('heading', { name: /1\/4|четвертьфинал/i })).toHaveCount(1)
  await expect(bracket.getByRole('heading', { name: /1\/2|полуфинал/i })).toHaveCount(1)
  await expect(bracket.getByRole('heading', { name: 'Финал', exact: true })).toHaveCount(1)
  await expect(bracket.getByRole('heading', { name: /3-е место|3 место/i })).toHaveCount(1)
  await expect(bracket.locator('.bracket-game')).toHaveCount(games.length)
  for (const item of games) {
    await expect(match(item.external_id)).toHaveCount(1)
    await expect(match(item.external_id)).toContainText(item.home_team_name)
    await expect(match(item.external_id)).toContainText(item.away_team_name)
  }
  await expect(match('final')).toContainText(/—[\s\S]*—/)
  await expect(match('bronze')).toContainText('Результат не опубликован')
  await expect(match('bronze')).toContainText(/—[\s\S]*—/)
  await expect(match('qf1')).toContainText('90')
  await expect(match('qf1')).toContainText('71')

  const nodes = new Map<string, string>()
  for (const item of games) {
    nodes.set(
      item.external_id,
      await match(item.external_id).evaluate(
        (element) => element.closest<HTMLElement>('.bracket-node')!.dataset.nodeId!,
      ),
    )
  }
  for (const [from, to] of [
    ['qf1', 'sf1'],
    ['qf3', 'sf2'],
    ['qf4', 'sf2'],
    ['sf1', 'final'],
    ['sf2', 'final'],
  ]) {
    const edge = bracket.locator(
      `svg path[data-from="${nodes.get(from!)}"][data-to="${nodes.get(to!)}"]`,
    )
    await expect(edge).toHaveCount(1)
    await expect(edge).toHaveAttribute('d', /\S+/)
  }
  for (const [from, to] of [
    ['qf1', 'sf2'],
    ['qf3', 'sf1'],
    ['qf4', 'sf1'],
  ]) {
    await expect(
      bracket.locator(`svg path[data-from="${nodes.get(from!)}"][data-to="${nodes.get(to!)}"]`),
    ).toHaveCount(0)
  }
  const quarter = await match('qf3').boundingBox()
  const semi = await match('sf2').boundingBox()
  const final = await match('final').boundingBox()
  expect(quarter && semi && final && quarter.x < semi.x && semi.x < final.x).toBe(true)
  await assertNoHorizontalOverflow(page)
})

test('the bracket scrolls within its own region with touch controls and keyboard at mobile widths', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The width sweep covers both mobile sizes.')
  await bracketFixture(page)
  const region = page.getByRole('region', { name: 'Сетка плей-офф', exact: true })
  await expect(region).toHaveAttribute('tabindex', '0')
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await assertNoHorizontalOverflow(page)
    await expect(page.locator('.bracket-game')).toHaveCount(games.length)
    const card = page.locator('.bracket-game').first()
    const bounds = await card.boundingBox()
    expect(bounds?.width).toBeGreaterThanOrEqual(230)
    expect(bounds?.width).toBeLessThanOrEqual(340)
    if (width < 768) {
      expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
        true,
      )
      await region.evaluate((element) => {
        element.scrollLeft = 0
      })
      await region.focus()
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
      await region.evaluate((element) => {
        element.scrollLeft = 0
      })
      const next = page.getByRole('button', { name: 'Следующий раунд', exact: true })
      const previous = page.getByRole('button', { name: 'Предыдущий раунд', exact: true })
      await expect(next).toBeVisible()
      await next.click()
      await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
      const afterNext = await region.evaluate((element) => element.scrollLeft)
      await expect(previous).toBeEnabled()
      await previous.click()
      await expect
        .poll(() => region.evaluate((element) => element.scrollLeft))
        .toBeLessThan(afterNext)
    }
  }
  const audit = await new AxeBuilder({ page })
    .include('.playoff-bracket')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(audit.violations).toEqual([])
})
