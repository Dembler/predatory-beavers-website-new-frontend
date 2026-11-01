import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { assertNoHorizontalOverflow, openPage } from './helpers'

const routes = [
  ['/', /Хищные/],
  ['/teams/men', /Мужская команда/],
  ['/teams/women', /Женская команда/],
  ['/matches', /Расписание/],
  ['/standings', /таблица/i],
  ['/club', /О клубе/],
  ['/rules', /правила|Пойми игру/i],
  ['/contacts', /Контакты/],
  ['/admin', /Управление сайтом/],
  ['/missing-page-e2e', /Здесь ничего нет|404|не найдена/],
] as const

for (const [path, title] of routes) {
  test(`${path} renders without runtime errors, horizontal overflow or a heading hidden under the header`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await openPage(page, path)
    await expect(page.locator('main h1')).toHaveText(title)
    await expect(page).toHaveTitle(/Бобры/)
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
    await assertNoHorizontalOverflow(page)
    const heading = await page.locator('main h1').boundingBox()
    const header = await page.locator('header.site-header').boundingBox()
    expect(
      heading && header && heading.y >= header.y + header.height,
      'The page heading is covered by the fixed header',
    ).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath(`${path.replace(/\W/g, '_') || 'home'}.png`),
      fullPage: true,
    })
    const timing = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming
      return {
        path: location.pathname,
        ttfbMs: navigation.responseStart,
        domReadyMs: navigation.domContentLoadedEventEnd,
        loadMs: navigation.loadEventEnd,
        requests: performance.getEntriesByType('resource').length,
      }
    })
    await testInfo.attach('page-timing', {
      body: JSON.stringify(timing),
      contentType: 'application/json',
    })
    expect(errors).toEqual([])
  })
}

test('failed API request displays retry and recovers without reloading the page', async ({
  page,
}) => {
  let fail = true
  await page.route('**/api/v1/players?**', async (route) => {
    if (fail) await route.abort('failed')
    else
      await route.fulfill({
        json: { items: [], total: 0, page: 1, page_size: 100, total_pages: 0 },
      })
  })
  await openPage(page, '/teams/men')
  await expect(page.getByRole('alert')).toContainText('Не удалось загрузить данные')
  fail = false
  await page.getByRole('button', { name: /Повторить/ }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText(/пока нет|скоро появится/)
})

test('switching teams while the first response is delayed cannot show the previous team roster', async ({
  page,
}) => {
  const team = (category: string) => ({
    id: `team-${category}`,
    category,
    name: category,
    slug: category,
    logo: null,
  })
  let menStarted!: () => void
  let releaseMen!: () => void
  const firstRequest = new Promise<void>((resolve) => {
    menStarted = resolve
  })
  const releaseFirst = new Promise<void>((resolve) => {
    releaseMen = resolve
  })
  await page.route('**/api/v1/players?**', async (route) => {
    const category = new URL(route.request().url()).searchParams.get('category') || 'men'
    if (category === 'men') {
      menStarted()
      await releaseFirst
    }
    await route.fulfill({
      json: {
        items: [
          {
            id: `player-${category}`,
            full_name:
              category === 'men' ? 'Игрок мужской команды E2E' : 'Игрок женской команды E2E',
            team_id: `team-${category}`,
            team: team(category),
            photo: null,
            active: true,
          },
        ],
        page: 1,
        page_size: 100,
        total: 1,
        total_pages: 1,
      },
    })
  })
  await openPage(page, '/teams/men')
  await firstRequest
  await page
    .locator('.team-switch')
    .getByRole('link', { name: 'Женская команда', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Игрок женской команды E2E', exact: true }),
  ).toBeVisible()
  const staleResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/players?category=men'),
  )
  releaseMen()
  await (await staleResponse).finished()
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  await expect(
    page.getByRole('heading', { name: 'Игрок мужской команды E2E', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Женская команда', exact: true })).toBeVisible()
})

test('public pages have no serious or critical accessibility violations', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  for (const path of [
    '/',
    '/teams/men',
    '/matches',
    '/standings',
    '/club',
    '/rules',
    '/contacts',
    '/admin',
  ]) {
    await openPage(page, path)
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
    // Vite injects a third-party development toolbar that is absent from the production site.
    const result = await new AxeBuilder({ page })
      .exclude('#__vue-devtools-container__')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    const violations = result.violations.filter((item) =>
      ['serious', 'critical'].includes(item.impact || ''),
    )
    await testInfo.attach(`accessibility-${path.replace(/\W/g, '_') || 'home'}`, {
      body: JSON.stringify(violations, null, 2),
      contentType: 'application/json',
    })
    expect
      .soft(
        violations.map((item) => ({
          id: item.id,
          impact: item.impact,
          targets: item.nodes.map((node) => node.target),
        })),
        path,
      )
      .toEqual([])
  }
})

test('mobile navigation opens, follows a link and closes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile navigation is tested with a touch viewport')
  await openPage(page, '/')
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Всё о клубе' })).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Все разделы', exact: true })
    .getByRole('link', { name: 'Правила', exact: true })
    .click()
  await expect(page).toHaveURL(/\/rules$/)
  await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
})

test('desktop team navigation stays synchronized with click, Escape and keyboard focus', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop',
    'Desktop dropdown is replaced by the touch navigation',
  )
  await openPage(page, '/club')
  const trigger = page.getByRole('button', { name: 'Команды', exact: true })
  const menu = page.locator('#team-navigation')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).not.toBeVisible()
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(menu.getByRole('link', { name: 'Мужская команда', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).not.toBeVisible()
  await trigger.hover()
  await expect(menu).not.toBeVisible()
  await trigger.click()
  await expect(menu).toBeVisible()
  await trigger.click()
  await expect(menu).not.toBeVisible()
  await trigger.click()
  await expect(menu).toBeVisible()
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(menu.getByRole('link', { name: 'Мужская команда', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(menu.getByRole('link', { name: 'Женская команда', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).not.toBeVisible()
})

test('mobile shortcuts, menu focus and contact anchors work without an intro delay or horizontal scrolling', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch navigation only')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await expect(page.locator('.intro-reveal')).toHaveCount(0)
  const shortcuts = page.getByRole('navigation', { name: 'Быстрый переход' })
  for (const [label, path] of [
    ['Матчи', '/matches'],
    ['Таблица', '/standings'],
    ['Команды', '/teams/men'],
  ] as const) {
    await shortcuts.getByRole('link', { name: label, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
    await assertNoHorizontalOverflow(page)
    const scrollers = await page
      .locator('main *')
      .evaluateAll((elements) =>
        elements
          .filter(
            (el) =>
              el.getClientRects().length &&
              el.clientWidth > 0 &&
              el.scrollWidth > el.clientWidth + 2 &&
              /auto|scroll/.test(getComputedStyle(el).overflowX),
          )
          .map((el) => el.className),
      )
    expect(scrollers).toEqual([])
  }
  await page.locator('main').getByRole('link', { name: 'Женская команда', exact: true }).click()
  await expect(page).toHaveURL(/\/teams\/women$/)
  const trigger = page.getByRole('button', { name: 'Открыть меню', exact: true })
  await trigger.click()
  const menu = page.getByRole('dialog', { name: 'Всё о клубе' })
  await expect(menu.getByRole('button', { name: 'Закрыть меню', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(menu.getByRole('link', { name: 'Управление сайтом', exact: false })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await expect(page.locator('html')).not.toHaveClass(/navigation-open|intro-active/)
  await shortcuts.getByRole('button', { name: 'Меню — все разделы', exact: true }).click()
  await menu.getByRole('link', { name: 'Контакты', exact: false }).click()
  await expect(page).toHaveURL(/\/contacts$/)
  await page
    .getByRole('navigation', { name: 'На странице контактов' })
    .getByRole('link', { name: 'Залы и адреса' })
    .click()
  const target = await page.locator('#venues-title').boundingBox()
  const header = await page.locator('.site-header').boundingBox()
  expect(target && header && target.y >= header.y + header.height).toBe(true)
})

test('rules shot controls update the court and the quiz scores once per answer and resets', async ({
  page,
}) => {
  await openPage(page, '/rules')
  const controls = page.locator('.shot-options')
  for (const [name, points] of [
    ['Штрафной бросок', 1],
    ['Внутри дуги', 2],
    ['За дугой', 3],
  ] as const) {
    await controls.getByRole('button', { name, exact: true }).click()
    await expect(controls.getByRole('button', { name, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.locator('.shot-description strong')).toHaveText(`+${points}`)
    await expect(
      page.getByRole('img', { name: `Схема половины площадки: ${name}`, exact: true }),
    ).toBeVisible()
  }
  const quiz = page.locator('.quiz-card')
  for (const [index, answer] of ['Два', 'Пять', 'Овертайм', 'Одно'].entries()) {
    await expect(quiz.locator('.quiz-progress')).toHaveText(`Вопрос ${index + 1} из 4`)
    await quiz.getByRole('button', { name: answer, exact: true }).click()
    await expect(quiz.getByRole('status')).toContainText('Верно!')
    for (const button of await quiz.locator('.quiz-answers button').all())
      await expect(button).toBeDisabled()
    await quiz
      .getByRole('button', { name: index === 3 ? /Узнать результат/ : /Следующий вопрос/ })
      .click()
  }
  await expect(
    quiz.getByRole('heading', { name: 'Ваш результат: 4 / 4', exact: true }),
  ).toBeVisible()
  await quiz.getByRole('button', { name: /Пройти ещё раз/ }).click()
  await expect(quiz.locator('.quiz-progress')).toHaveText('Вопрос 1 из 4')
  await quiz.getByRole('button', { name: 'Три', exact: true }).click()
  await expect(quiz.getByRole('status')).toContainText('Почти!')
  await expect(quiz.getByRole('status')).toContainText('Линия дуги относится к двухочковой зоне')
})

test('missing and malformed player IDs show a useful state with a working roster link', async ({
  page,
}) => {
  for (const id of ['00000000-0000-0000-0000-000000000000', 'invalid-e2e-id']) {
    await page.goto(`/players/${id}`)
    const skip = page.getByRole('button', { name: 'Пропустить', exact: true })
    if (await skip.isVisible().catch(() => false)) await skip.click()
    await expect(page.getByText('Игрок не найден.', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: /Повторить/ })).toHaveCount(0)
    await page.getByRole('link', { name: /К составу/ }).click()
    await expect(page).toHaveURL(/\/teams\/men$/)
  }
})
