import { expect, test, type Page } from '@playwright/test'
import type { Match } from '../../src/shared/types'
import { assertNoHorizontalOverflow, openPage, supportsNativeLinkTabbing } from './helpers'

async function mainNavigation(page: Page, mobile: boolean) {
  await expect(page.locator('main h1')).toBeVisible()
  if (mobile) {
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Всё о клубе', exact: true })).toBeVisible()
  }
  return page.getByRole('navigation', {
    name: mobile ? 'Все разделы' : 'Основная навигация',
    exact: true,
  })
}

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
    /Девуш|девуш/,
  )

  const mobile = testInfo.project.name === 'mobile'
  const navigation = await mainNavigation(page, mobile)
  await navigation.getByRole('link', { name: /^Таблица(?: |$)/ }).click()
  await expect(page).toHaveURL(/\/standings$/)
  const team = page.getByRole('combobox', { name: 'Команда', exact: true })
  await expect(team).toContainText(/Девуш|девуш/)
  await team.click()
  await page.getByRole('option', { name: 'Мужская команда', exact: true }).click()
  await expect(page).toHaveURL(/\/standings\?team=men$/)
  await page.reload()
  await expect(team).toContainText('Мужская команда')

  await page.goto('/standings?team=women')
  await expect(team).toContainText(/Девуш|девуш/)
  await page.goto('/club')
  await (await mainNavigation(page, mobile)).getByRole('link', { name: /^Матчи(?: |$)/ }).click()
  await expect(page).toHaveURL(/\/matches$/)
  await expect(team).toContainText(/Девуш|девуш/)
  await assertNoHorizontalOverflow(page)
  if (mobile) {
    await (await mainNavigation(page, mobile))
      .getByRole('link', { name: 'Команда девушек' })
      .click()
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
  await expect(dashboard.locator('article')).toHaveCount(1)
  await expect(dashboard.locator('article')).toContainText('Завершён')
  await expect(dashboard.locator('article')).toContainText('Соперник последней встречи')
  await expect(dashboard.locator('article')).toContainText('83')
  await assertNoHorizontalOverflow(page)
})

test('home refreshes scores without overlapping requests and preserves the last data through a failed update', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-07T12:00:00Z') })
  const team = { id: 'men', category: 'men', name: 'Хищные Бобры', slug: 'men', logo: null }
  const match = {
    id: 'live-home-e2e',
    team_id: 'men',
    team,
    competition_id: 'cup',
    competition: { id: 'cup', name: 'Кубок', season: '2026-2027', active: true },
    venue_id: null,
    venue: null,
    club_side: 'home',
    starts_at: '2026-11-07T12:00:00Z',
    home_team_name: 'Хищные Бобры',
    away_team_name: 'Соперник прямого эфира',
    home_score: 80,
    away_score: 70,
    status: 'live',
    home_logo: null,
    away_logo: null,
    home_logo_asset_id: null,
    away_logo_asset_id: null,
    notes: null,
    featured: true,
  }
  let requests = 0
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/home', async (route) => {
    const current = ++requests
    if (current === 2) await held
    if (current === 3) return route.abort('failed')
    await route.fulfill({
      json: {
        data: {
          next_match: { ...match, home_score: current >= 4 ? 86 : current === 2 ? 83 : 80 },
          recent_results: [],
          teams: [team],
        },
      },
    })
  })
  try {
    await openPage(page, '/')
    const scores = page.locator('.dashboard-main .match-card__team-score')
    await expect(scores).toHaveText(['80', '70'])
    await page.clock.fastForward(60_000)
    await expect.poll(() => requests).toBe(2)
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('online'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    // Keep the response inside the transport's 20 s timeout while several
    // resume events compete with the active poll.
    await page.clock.fastForward(1_000)
    expect(requests).toBe(2)
    release()
    await expect(scores).toHaveText(['83', '70'])
    await page.clock.fastForward(60_000)
    const notice = page.locator('.live-refresh-note')
    await expect(notice).toContainText('Показана последняя загруженная версия')
    await expect(scores).toHaveText(['83', '70'])
    await notice.getByRole('button', { name: 'Обновить', exact: true }).click()
    await expect(scores).toHaveText(['86', '70'])
    await expect(notice).toHaveCount(0)
    expect(requests).toBe(4)
  } finally {
    release()
  }
})

test('floating header and menu targets remain inside the viewport around the breakpoint', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Intermediate desktop widths')
  await openPage(page, '/club')
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
  for (const width of [320, 390, 768, 900, 901, 1024, 1150, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    const nav = page.getByRole('navigation', { name: 'Основная навигация', exact: true })
    const trigger = page.getByRole('button', { name: 'Открыть меню', exact: true })
    if (width > 900) {
      await expect(nav).toBeVisible()
      await expect(trigger).toBeHidden()
      const rows = await nav
        .locator(':scope > .nav-link, :scope > .nav-dropdown')
        .evaluateAll(
          (links) =>
            new Set(links.map((link) => Math.round(link.getBoundingClientRect().top))).size,
        )
      expect(rows).toBe(1)
    } else {
      await expect(nav).toBeHidden()
      await expect(trigger).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Быстрый переход' })).toBeVisible()
    }
    const escaped = await page
      .locator('.nav-shell > a, .nav-shell button, .club-nav a, .main-nav .nav-link')
      .evaluateAll((elements) =>
        elements
          .filter((el) => {
            const rect = el.getBoundingClientRect()
            return (
              rect.width &&
              rect.height &&
              getComputedStyle(el).visibility !== 'hidden' &&
              (rect.left < -1 || rect.right > innerWidth + 1)
            )
          })
          .map((el) => el.textContent),
      )
    expect(escaped, `Hidden clipping at ${width}px`).toEqual([])
    const heading = await page.locator('.club-hero .eyebrow').first().boundingBox()
    const header = await page.locator('.site-header').boundingBox()
    expect(heading!.y).toBeGreaterThanOrEqual(header!.y + header!.height)
    await assertNoHorizontalOverflow(page)
  }
})

test('desktop team dropdown opens with Enter, follows either team and closes with Escape', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop dropdown navigation')
  await openPage(page, '/club')
  const nav = page.getByRole('navigation', { name: 'Основная навигация', exact: true })
  const teams = nav.getByRole('button', { name: 'Команды' })
  for (const [name, path] of [
    ['Мужская команда', '/teams/men'],
    ['Команда девушек', '/teams/women'],
  ] as const) {
    await teams.focus()
    await page.keyboard.press('Enter')
    await expect(teams).toHaveAttribute('aria-expanded', 'true')
    const destination = nav.getByRole('link', { name, exact: true })
    await expect(destination).toBeVisible()
    await destination.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(teams).toHaveAttribute('aria-expanded', 'false')
  }
  await teams.focus()
  await page.keyboard.press('Enter')
  await expect(teams).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(teams).toHaveAttribute('aria-expanded', 'false')
})

test('desktop team dropdown supports keyboard navigation and closes after choosing a team', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop dropdown navigation')
  test.skip(
    !(await supportsNativeLinkTabbing(page)),
    'This browser skips native links even on a minimal HTML page; native Tab traversal is unverified.',
  )
  await openPage(page, '/club')
  const nav = page.getByRole('navigation', { name: 'Основная навигация', exact: true })
  await expect(nav.locator(':scope > a')).toHaveText([
    'Главная',
    'Матчи',
    'Таблица',
    'Клуб',
    'Правила',
    'Контакты',
  ])
  const teams = nav.getByRole('button', { name: 'Команды' })
  await teams.focus()
  await page.keyboard.press('Enter')
  await expect(teams).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Tab')
  await expect(nav.getByRole('link', { name: 'Мужская команда', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(nav.getByRole('link', { name: 'Команда девушек', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/teams\/women$/)
  await expect(teams).toHaveAttribute('aria-expanded', 'false')
  await teams.click()
  await page.keyboard.press('Escape')
  await expect(teams).toHaveAttribute('aria-expanded', 'false')
  await nav.getByRole('link', { name: 'Матчи', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(nav.getByRole('link', { name: 'Таблица', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/standings$/)
  await expect(nav.getByRole('link', { name: 'Таблица', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(
    page.locator('.site-header').getByRole('link', { name: 'Матчи', exact: true }),
  ).toHaveCount(1)
})

test('mobile card keeps focus, locks background, closes on navigation and restores its trigger', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch navigation')
  await openPage(page, '/club')
  const trigger = page.getByRole('button', { name: 'Открыть меню', exact: true })
  await trigger.click()
  const menu = page.getByRole('dialog', { name: 'Всё о клубе', exact: true })
  await expect(menu).toBeVisible()
  const destinations = await menu
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  expect(destinations).toEqual(
    expect.arrayContaining([
      '/',
      '/matches',
      '/standings',
      '/teams/men',
      '/teams/women',
      '/club',
      '/rules',
      '/contacts',
      '/admin',
    ]),
  )
  expect(new Set(destinations).size).toBe(destinations.length)
  await expect(menu.getByRole('link', { name: /^Команда девушек/ })).toBeVisible()
  await expect(page.locator('html')).toHaveClass(/navigation-open/)
  await expect(page.locator('html')).toHaveCSS('overflow', 'hidden')
  const close = menu.getByRole('button', { name: 'Закрыть меню', exact: true })
  await expect(close).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(menu.getByRole('link', { name: /^Управление сайтом/ })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(trigger).toBeFocused()
  await expect(page.locator('html')).not.toHaveClass(/navigation-open/)
  await trigger.click()
  await menu.getByRole('link', { name: /^Команда девушек/ }).click()
  await expect(page).toHaveURL(/\/teams\/women$/)
  await expect(menu).toBeHidden()
  const bottom = page.getByRole('navigation', { name: 'Быстрый переход' })
  await bottom.getByRole('link', { name: 'Команды', exact: true }).click()
  await expect(page).toHaveURL(/\/teams\/women$/)
  const bottomTrigger = bottom.getByRole('button', { name: 'Меню — все разделы', exact: true })
  await bottomTrigger.click()
  await expect(menu).toBeVisible()
  await close.click()
  await expect(bottomTrigger).toBeFocused()
  await trigger.click()
  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(menu).toBeHidden()
  await expect(page.locator('html')).not.toHaveClass(/navigation-open/)
  await assertNoHorizontalOverflow(page)
})

test('desktop header becomes compact when the page scrolls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop floating header')
  await openPage(page, '/club')
  const shell = page.locator('.nav-shell')
  const initial = await shell.boundingBox()
  await page.evaluate(() => window.scrollTo(0, 400))
  await expect(page.locator('.site-header')).toHaveClass(/site-header--compact/)
  await expect.poll(async () => (await shell.boundingBox())!.height).toBeLessThan(initial!.height)
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(page.locator('.site-header')).not.toHaveClass(/site-header--compact/)
})
