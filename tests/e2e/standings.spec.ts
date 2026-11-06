import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { assertNoHorizontalOverflow, openPage } from './helpers'

const division = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'АСБ · дивизион Воронеж',
  season: '2024-2025',
  active: true,
}
const cup = {
  ...division,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Отдельный кубок',
}
const newer = {
  ...division,
  id: '33333333-3333-4333-8333-333333333333',
  name: 'АСБ · следующий сезон',
  season: '2025-2026',
}
const row = {
  position: 1,
  team_name: 'ВГТУ',
  external_team_id: '7432',
  team_logo_url: '/images/brand/club-emblem.webp',
  played: 7,
  wins: 6,
  losses: 1,
  draws: 0,
  table_points: 13,
  points_for: 376,
  points_against: 249,
  points_difference: 127,
}
const club = { ...row, position: 2, team_name: 'ВГУ', external_team_id: '7433' }
const rows = [row, club, { ...row, position: 3, team_name: 'ВГУИТ', external_team_id: '7663' }]

async function fixtures(
  page: Page,
  options: { girls?: boolean; unknown?: boolean; failOnce?: boolean } = {},
) {
  const requests: URLSearchParams[] = []
  let failed = false
  await page.route('**/api/v1/standings/options?**', (route) =>
    route.fulfill({
      json: {
        data: {
          seasons: [division.season],
          competitions: [division, cup],
          default_competition_id: division.id,
        },
      },
    }),
  )
  await page.route('**/api/v1/competitions?**', (route) =>
    route.fulfill({
      json: { items: [newer, division, cup], page: 1, page_size: 100, total: 3, total_pages: 1 },
    }),
  )
  await page.route('**/api/v1/standings?**', (route) => {
    const query = new URL(route.request().url()).searchParams
    requests.push(query)
    if (options.failOnce && !failed) {
      failed = true
      return route.fulfill({ status: 500, json: { code: 'server_error' } })
    }
    if (query.get('season') === newer.season || (query.get('team') === 'women' && !options.girls))
      return route.fulfill({ status: 404, json: { code: 'not_found' } })
    const selected = query.get('competition_id') === cup.id ? cup : division
    const selectedRows =
      query.get('team') === 'women'
        ? [{ ...club, position: 1, external_team_id: '7695' }]
        : selected.id === cup.id
          ? [{ ...row, team_name: 'Команда кубка', external_team_id: '9999' }]
          : options.unknown
            ? [
                {
                  ...club,
                  position: 1,
                  played: null,
                  wins: 0,
                  losses: null,
                  table_points: null,
                  points_for: 0,
                  points_against: 50,
                  points_difference: -50,
                },
                { ...row, position: 2, points_difference: null },
              ]
            : rows
    return route.fulfill({ json: { data: { competition: selected, rows: selectedRows } } })
  })
  return requests
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test('championships in one season keep group standings and playoff games separate', async ({
  page,
}) => {
  const group = {
    ...division,
    tournament_id: 'region',
    tournament_name: 'Воронежская область',
    stage_name: 'Групповой этап',
    stage_kind: 'group',
  }
  const playoff = {
    ...division,
    id: cup.id,
    tournament_id: 'region',
    tournament_name: 'Воронежская область',
    stage_name: 'Плей-офф',
    stage_kind: 'playoff',
  }
  const belov = {
    ...division,
    id: newer.id,
    tournament_id: 'belov',
    tournament_name: 'Лига Белова',
    stage_name: 'Квалификация',
    stage_kind: 'playoff',
  }
  const stages = [group, playoff, belov]
  const requests: URLSearchParams[] = []
  await page.route('**/api/v1/standings/options?**', (route) =>
    route.fulfill({
      json: {
        data: {
          seasons: [division.season],
          competitions: stages,
          default_competition_id: group.id,
        },
      },
    }),
  )
  await page.route('**/api/v1/standings?**', (route) => {
    const query = new URL(route.request().url()).searchParams
    requests.push(query)
    const selected =
      stages.find((item) => item.id === query.get('competition_id')) ||
      stages.find((item) => item.tournament_id === query.get('tournament_id')) ||
      group
    return route.fulfill({
      json: {
        data: {
          competition: selected,
          ...selected,
          rows: selected.stage_kind === 'group' ? rows : [],
          games:
            selected.stage_kind !== 'group'
              ? [
                  {
                    external_id: 'game-1',
                    round_name: 'Финал',
                    sort_order: 1,
                    starts_at: '2025-03-01T10:00:00Z',
                    date_precision: 'time',
                    home_team_name: 'ВГУ',
                    home_team_id: '7433',
                    home_team_logo_url: row.team_logo_url,
                    away_team_name: 'ВГТУ',
                    away_team_id: '7432',
                    away_team_logo_url: row.team_logo_url,
                    home_score: 83,
                    away_score: 70,
                    status: 'finished',
                    source_url: 'https://asb.infobasket.su/Widget/PlayOff/48638?format=json',
                  },
                  {
                    external_id: 'game-2',
                    round_name: 'Матч за 3-е место',
                    sort_order: 2,
                    starts_at: null,
                    date_precision: 'day',
                    home_team_name: 'Команда А',
                    away_team_name: 'Команда Б',
                    home_score: null,
                    away_score: null,
                    status: 'unpublished',
                    source_url: 'https://asb.infobasket.su/Widget/PlayOff/48638?format=json',
                  },
                ]
              : [],
        },
      },
    })
  })
  await openPage(page, '/standings?team=men&season=2024-2025')
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Чемпионат', exact: true })).toContainText(
    'Воронежская область',
  )
  await choose(page, 'Этап', 'Плей-офф')
  await expect(page.getByRole('table')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Финал', exact: true })).toBeVisible()
  await expect(page.locator('.league-game').first()).toContainText('83')
  await expect(page.getByText('Результат не опубликован', { exact: true })).toBeVisible()
  await expect(page.locator('.league-game').nth(1).locator('strong')).toHaveText(['—', '—'])
  await choose(page, 'Чемпионат', 'Лига Белова')
  await expect(page.locator('#league-title')).toHaveText('Лига Белова')
  await expect(page.locator('.league-heading__stage')).toHaveText('Квалификация')
  expect(requests.at(-1)?.get('tournament_id')).toBe('belov')
  expect(requests.at(-1)?.has('competition_id')).toBe(false)
  await page.reload()
  await expect(page.locator('#league-title')).toHaveText('Лига Белова')
  await choose(page, 'Чемпионат', 'Воронежская область')
  await expect(page.getByRole('table')).toBeVisible()
  await assertNoHorizontalOverflow(page)
})

test('one published table keeps official order and selects competitions without merging them', async ({
  page,
}) => {
  const requests = await fixtures(page)
  await openPage(page, '/standings?team=men')
  await expect(page.getByRole('table')).toHaveCount(1)
  await expect(page.getByRole('combobox', { name: 'Сезон', exact: true })).toContainText('2024/25')
  await expect(page.getByRole('combobox', { name: 'Этап', exact: true })).toContainText(
    division.name,
  )
  await expect(page.locator('tbody th[scope="row"]')).toHaveText([
    'ВГТУ',
    'ВГУ — наш клуб',
    'ВГУИТ',
  ])
  await expect(page.locator('.league-table__club')).toHaveCount(1)
  await expect(page.locator('.league-table__club')).toContainText('ВГУ')
  await expect(page.locator('.league-team__emblem img').first()).toBeVisible()
  await expect(page.locator('tbody tr').first().locator('td').first()).toHaveText('1')

  await choose(page, 'Этап', cup.name)
  await expect(page.getByRole('table')).toHaveCount(1)
  await expect(page.locator('tbody th[scope="row"]')).toHaveText(['Команда кубка'])
  expect(requests.at(-1)?.get('competition_id')).toBe(cup.id)
  await expect(page).toHaveURL(new RegExp(`competition=${cup.id}`))
  await page.reload()
  await expect(page.locator('tbody th[scope="row"]')).toHaveText(['Команда кубка'])

  await page.getByRole('combobox', { name: 'Сезон', exact: true }).click()
  await expect(page.getByRole('option', { name: '2025/26', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.goto('/standings?team=men&season=2025-2026')
  await expect(
    page.getByText('Таблица для выбранной команды, сезона и соревнования пока не опубликована.'),
  ).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  expect(requests.at(-1)?.has('competition_id')).toBe(false)
  await choose(page, 'Сезон', '2024/25')
  await expect(page.locator('tbody th[scope="row"]')).toHaveCount(3)
  await assertNoHorizontalOverflow(page)
})

test('girls selection uses its own standings and keeps the chosen season', async ({ page }) => {
  const requests = await fixtures(page, { girls: true })
  await openPage(page, '/standings?team=men&season=2024-2025')
  await expect(page.getByRole('table')).toBeVisible()
  await choose(page, 'Команда', 'Команда девушек')
  await expect(page.getByRole('table')).toHaveCount(1)
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('.league-table__club')).toHaveCount(1)
  await expect(page.getByRole('combobox', { name: 'Команда', exact: true })).toContainText(
    'Команда девушек',
  )
  expect(requests.at(-1)?.get('team')).toBe('women')
  expect(requests.at(-1)?.get('season')).toBe('2024-2025')
  await expect(page).toHaveURL(/team=women/)
})

test('unknown values stay distinct from zero and preserve the published difference', async ({
  page,
}) => {
  await fixtures(page, { unknown: true })
  await openPage(page, '/standings?team=men')
  const values = page.locator('tbody tr').first().locator('td')
  await expect(values).toHaveText(['1', '—', '0', '—', '0', '50', '−50', '—'])
  await expect(page.locator('tbody tr').nth(1).locator('.league-table__difference')).toHaveText('—')
  await expect(page.locator('thead th')).toHaveCount(9)
})

test('switching teams clears a competition belonging to the previous team', async ({ page }) => {
  const requests = await fixtures(page, { girls: true })
  await openPage(page, `/standings?team=men&season=2024-2025&competition=${cup.id}`)
  await expect(page.locator('tbody th[scope="row"]')).toHaveText(['Команда кубка'])
  await choose(page, 'Команда', 'Команда девушек')
  await expect(page.locator('tbody th[scope="row"]')).toHaveText(['ВГУ — наш клуб'])
  await expect(page).not.toHaveURL(/competition=/)
  expect(requests.at(-1)?.get('team')).toBe('women')
  expect(requests.at(-1)?.has('competition_id')).toBe(false)
})

test('a failed request retries, and an unpublished girls table never shows the previous team', async ({
  page,
}) => {
  await fixtures(page, { failOnce: true })
  await openPage(page, '/standings?team=men')
  await expect(page.getByRole('alert')).toContainText('Не удалось загрузить данные')
  await page.getByRole('button', { name: 'Повторить →' }).click()
  await expect(page.getByRole('table')).toBeVisible()
  await choose(page, 'Команда', 'Команда девушек')
  await expect(
    page.getByText('Таблица для выбранной команды, сезона и соревнования пока не опубликована.'),
  ).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})

test('query navigation restores a single matching table', async ({ page }) => {
  await fixtures(page)
  await openPage(page, `/standings?team=men&season=2024-2025&competition=${cup.id}`)
  await expect(page.locator('tbody th[scope="row"]')).toHaveText(['Команда кубка'])
  await page.goto('/standings?team=men&season=2024-2025')
  await expect(page.locator('tbody th[scope="row"]')).toHaveCount(3)
  await page.goBack()
  await expect(page.locator('tbody th[scope="row"]')).toHaveText(['Команда кубка'])
  await page.goForward()
  await expect(page.locator('tbody th[scope="row"]')).toHaveCount(3)
})

test('table semantics, keyboard scrolling and layout remain intact from 320 to 1920px', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The width sweep includes all mobile sizes.')
  await fixtures(page)
  await openPage(page, '/standings?team=men')
  await expect(page.getByRole('table')).toBeVisible()
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 })
    await assertNoHorizontalOverflow(page)
    await expect(page.getByRole('table')).toHaveCount(1)
    await expect(page.locator('.standing-card, .standings-mobile')).toHaveCount(0)
    expect(
      await page
        .locator('tbody tr')
        .first()
        .evaluate((element) => getComputedStyle(element).display),
    ).toBe('table-row')
    const scroll = page.getByRole('region', { name: division.name, exact: true })
    await scroll.evaluate((element) => {
      element.scrollLeft = 0
    })
    if (width < 768) {
      expect(await scroll.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
        true,
      )
      await scroll.focus()
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
      await scroll.evaluate((element) => {
        element.scrollLeft = element.scrollWidth
      })
      const regionBox = await scroll.boundingBox()
      const clubBox = await page.locator('.league-table__club th').boundingBox()
      expect(
        clubBox &&
          regionBox &&
          clubBox.x >= regionBox.x &&
          clubBox.x < regionBox.x + regionBox.width,
      ).toBe(true)
      await scroll.evaluate((element) => {
        element.scrollLeft = 0
      })
    }
    await page.screenshot({ path: testInfo.outputPath(`standings-${width}.png`), fullPage: true })
  }
  const audit = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(audit.violations).toEqual([])
})
