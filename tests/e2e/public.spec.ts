import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { assertNoHorizontalOverflow, openPage, supportsNativeLinkTabbing } from './helpers'

const routes = [
  ['/', /Хищные/],
  ['/teams/men', /Мужская команда/],
  ['/teams/women', /Команда девушек/],
  ['/matches', /Матчи/],
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
    const firstContent = await page
      .locator('main .page-hero .eyebrow, main .page-hero h1, main .home-hero h1')
      .first()
      .boundingBox()
    if (firstContent && header) {
      const clearance = firstContent.y - header.y - header.height
      expect(
        clearance,
        'Content needs deliberate space below the fixed menu',
      ).toBeGreaterThanOrEqual(
        path === '/admin' ? 24 : testInfo.project.name === 'mobile' ? 35 : 63,
      )
    }
    await page.screenshot({
      path: testInfo.outputPath(`${path.replace(/\W/g, '_') || 'home'}.png`),
      fullPage: true,
      scale: 'css',
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
  await page.route('**/api/v1/asb-roster/*', async (route) => {
    if (fail) await route.abort('failed')
    else
      await route.fulfill({
        json: {
          data: {
            team: 'men',
            current_season: '2026-2027',
            season: null,
            is_current_season: false,
            status: 'not_published',
            notice: 'Заявка нового сезона ещё не опубликована на АСБ.',
            source_url: 'https://asb.infobasket.su/Widget/TeamRoster/7433',
            players: [],
          },
        },
      })
  })
  await openPage(page, '/teams/men')
  await expect(page.getByRole('alert')).toContainText('Не удалось загрузить данные')
  fail = false
  await page.getByRole('button', { name: /Повторить/ }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.roster-waiting')).toContainText(/Заявка нового сезона/)
})

test('switching teams while the first response is delayed cannot show the previous team roster', async ({
  page,
}) => {
  let menStarted!: () => void
  let menCompleted!: () => void
  let releaseMen!: () => void
  const firstRequest = new Promise<void>((resolve) => {
    menStarted = resolve
  })
  const releaseFirst = new Promise<void>((resolve) => {
    releaseMen = resolve
  })
  const firstCompleted = new Promise<void>((resolve) => {
    menCompleted = resolve
  })
  await page.route('**/api/v1/asb-roster/*', async (route) => {
    const category = new URL(route.request().url()).pathname.split('/').at(-1) || 'men'
    if (category === 'men') {
      menStarted()
      await releaseFirst
    }
    try {
      await route.fulfill({
        json: {
          data: {
            team: category,
            current_season: '2026-2027',
            season: '2026-2027',
            is_current_season: true,
            status: 'published',
            source_url: 'https://asbasket.ru/',
            players: [
              {
                id: `player-${category}`,
                full_name:
                  category === 'men' ? 'Игрок мужской команды E2E' : 'Игрок команды девушек E2E',
                photo_url: null,
                games_played: 1,
                points_per_game: 10,
                assists_per_game: 2,
                rebounds_per_game: 3,
                minutes_per_game: 25,
              },
            ],
          },
        },
      })
    } finally {
      if (category === 'men') menCompleted()
    }
  })
  await openPage(page, '/teams/men')
  await firstRequest
  await page
    .locator('.team-switch')
    .getByRole('link', { name: 'Команда девушек', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Игрок команды девушек E2E', exact: true }),
  ).toBeVisible()
  releaseMen()
  // A superseded request may already be aborted; Playwright need not emit a
  // response event. Wait for the held handler to finish delivering it instead.
  await firstCompleted
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  await expect(
    page.getByRole('heading', { name: 'Игрок мужской команды E2E', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Команда девушек', exact: true })).toBeVisible()
})

for (const path of routes.map(([path]) => path)) {
  test(`${path} has no serious or critical accessibility violations`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(45_000)
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
  })
}

test('mobile navigation opens, follows a link and closes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile navigation is tested with a touch viewport')
  await openPage(page, '/')
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Всё о клубе' })).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Все разделы', exact: true })
    .getByRole('link', { name: /^Правила/ })
    .click()
  await expect(page).toHaveURL(/\/rules$/)
  await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
})

test('hall selection updates the Yandex map and map gestures require explicit activation', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000)
  const nativeLinkTabbing = await supportsNativeLinkTabbing(page)
  if (!nativeLinkTabbing)
    testInfo.annotations.push({
      type: 'limitation',
      description:
        'This browser skips native links even on minimal HTML. Tab traversal to the route link is unverified.',
    })
  await openPage(page, '/contacts')
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
  const map = page.locator('.venue-map iframe')
  await expect(map).toHaveAttribute('src', /https:\/\/yandex\.ru\/map-widget\/v1\//)
  const initialSource = await map.getAttribute('src')
  const activation = page.getByRole('button', { name: 'Управлять картой', exact: true })
  const routeLink = page.getByRole('link', { name: 'Проложить маршрут', exact: false })

  async function expectInactiveMapAccessibility(state: string) {
    await expect(map).toHaveAttribute('inert', '')
    await expect(map).toHaveAttribute('aria-hidden', 'true')
    await expect(map).toHaveAttribute('tabindex', '-1')
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    const violations = result.violations.filter((item) =>
      ['serious', 'critical'].includes(item.impact ?? ''),
    )
    await testInfo.attach(`map-accessibility-${state}`, {
      body: JSON.stringify(violations, null, 2),
      contentType: 'application/json',
    })
    expect(
      violations.map((item) => ({ id: item.id, targets: item.nodes.map((node) => node.target) })),
    ).toEqual([])
  }

  await expect(activation).toHaveAttribute('aria-pressed', 'false')
  await expect(map).toHaveCSS('pointer-events', 'none')
  await expectInactiveMapAccessibility('initial')
  // Keyboard traversal skips the entire inactive browsing context, including
  // the map provider's internal controls, and reaches the route link directly.
  if (nativeLinkTabbing) {
    await activation.focus()
    await page.keyboard.press('Tab')
    await expect(routeLink).toBeFocused()
    await page.keyboard.press('Shift+Tab')
  } else await activation.focus()
  await expect(activation).toBeFocused()
  await page.keyboard.press('Enter')
  const deactivation = page.getByRole('button', {
    name: 'Выключить управление картой',
    exact: true,
  })
  await expect(deactivation).toHaveAttribute('aria-pressed', 'true')
  await expect(map).not.toHaveAttribute('inert')
  await expect(map).toHaveAttribute('aria-hidden', 'false')
  await expect(map).toHaveAttribute('tabindex', '0')
  await expect(map).toHaveCSS('pointer-events', 'auto')
  await page.keyboard.press('Tab')
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('venue-map-frame')
  await deactivation.focus()
  await page.keyboard.press('Space')
  await expect(activation).toHaveAttribute('aria-pressed', 'false')
  await expect(map).toHaveCSS('pointer-events', 'none')
  await expectInactiveMapAccessibility('disabled-again')
  if (nativeLinkTabbing) {
    await activation.focus()
    await page.keyboard.press('Tab')
    await expect(routeLink).toBeFocused()
  }
  await expect(routeLink).toHaveAttribute('target', '_blank')
  await expect(routeLink).toHaveAttribute('rel', 'noopener noreferrer')
  await activation.focus()
  await page.keyboard.press('Enter')
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('combobox', { name: 'Выберите зал', exact: true }).click()
    await page.getByRole('option').nth(1).click()
  } else {
    await page.locator('.venue-option').nth(1).click()
    await expect(page.locator('.venue-option[aria-pressed="true"]')).toHaveCount(1)
  }
  await expect(map).not.toHaveAttribute('src', initialSource!)
  await expect(page.getByRole('button', { name: 'Управлять картой', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(map).toHaveCSS('pointer-events', 'none')
  await expect(map).toHaveAttribute('inert', '')
  await expect(map).toHaveAttribute('aria-hidden', 'true')
  await expect(routeLink).toHaveAttribute('href', /https:\/\/yandex\.ru\/maps\/\?rtext=/)
  await assertNoHorizontalOverflow(page)
})

test('club section links reveal history, honours and tournaments below the fixed navigation', async ({
  page,
}) => {
  await openPage(page, '/club')
  const navigation = page.getByRole('navigation', { name: 'Разделы страницы клуба', exact: true })
  for (const [label, target] of [
    ['История клуба', '#club-timeline'],
    ['Достижения', '#club-honours-title'],
    ['Турниры', '#club-tournaments'],
  ]) {
    await navigation.getByRole('link', { name: label, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${target}$`))
    await expect(page.locator(target!)).toBeInViewport()
    const destination = await page.locator(target!).boundingBox()
    const header = await page.locator('.site-header').boundingBox()
    expect(destination!.y).toBeGreaterThanOrEqual(header!.height)
  }
})

test('mobile menu, bottom navigation, focus and contact anchors work without an intro delay or horizontal scrolling', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch navigation only')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await expect(page.locator('.intro-reveal')).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Быстрый переход' })).toBeVisible()
  const trigger = page.getByRole('button', { name: 'Открыть меню', exact: true })
  const menu = page.getByRole('dialog', { name: 'Всё о клубе' })
  for (const [label, path] of [
    ['Матчи', '/matches'],
    ['Таблица', '/standings'],
    ['Мужская команда', '/teams/men'],
  ] as const) {
    await trigger.click()
    await menu.getByRole('link', { name: label }).click()
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
    if (path === '/standings') {
      expect(scrollers.length).toBeGreaterThan(0)
      expect(scrollers.every((name) => /^(league-scroll|bracket-scroll)$/.test(name))).toBe(true)
      await expect(page.locator('main .league-scroll, main .bracket-scroll').first()).toBeVisible()
    } else {
      expect(scrollers).toEqual([])
    }
  }
  await page.locator('main').getByRole('link', { name: 'Команда девушек', exact: true }).click()
  await expect(page).toHaveURL(/\/teams\/women$/)
  await trigger.click()
  await expect(menu.getByRole('button', { name: 'Закрыть меню', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(menu.getByRole('link', { name: /^Управление сайтом/ })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await expect(page.locator('html')).not.toHaveClass(/navigation-open|intro-active/)
  await trigger.click()
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
    await page.goto(`/teams/men/players/${id}`)
    const skip = page.getByRole('button', { name: 'Пропустить', exact: true })
    if (await skip.isVisible().catch(() => false)) await skip.click()
    await expect(
      page.getByText('Игрок не найден в опубликованной заявке текущего сезона.', { exact: false }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /Повторить/ })).toHaveCount(0)
    await page.getByRole('link', { name: 'К составу →', exact: true }).click()
    await expect(page).toHaveURL(/\/teams\/men$/)
  }
})
