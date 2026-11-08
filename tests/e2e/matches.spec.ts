import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Match, Media } from '../../src/shared/types'
import { assertNoHorizontalOverflow, openPage } from './helpers'
import { calendarItem, mockCalendar } from './calendar-fixtures'

test('calendar failure offers a working retry and never falls back to downloading full history', async ({
  page,
}) => {
  const requested = await mockCalendar(page, [])
  let attempts = 0
  const rawRequests: string[] = []
  page.on('request', (request) => {
    if (/\/api\/v1\/(matches|results-archive)(\?|$)/u.test(request.url()))
      rawRequests.push(request.url())
  })
  await page.route('**/api/v1/calendar?**', (route) => {
    attempts++
    return attempts === 1
      ? route.fulfill({ status: 503, json: { detail: 'Temporary failure' } })
      : route.fallback()
  })
  await openPage(page, '/matches?season=all')
  await expect(page.getByRole('alert')).toContainText('Не удалось загрузить данные')
  await page.getByRole('button', { name: 'Повторить →', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText('По выбранным фильтрам матчей нет.', { exact: true })).toBeVisible()
  expect(attempts).toBe(2)
  expect(requested).toHaveLength(1)
  expect(rawRequests).toEqual([])
})

test('bounded calendar refresh pauses in a hidden tab, catches up on return and never downloads raw archive', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-07T12:00:00Z') })
  const team = { id: 'men', category: 'men', name: 'Хищные Бобры', slug: 'men', logo: null }
  let calendarRequests = 0
  let archiveRequests = 0
  await page.route('**/api/v1/results-archive?**', (route) => {
    archiveRequests++
    return route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 100, total_pages: 0 } })
  })
  await mockCalendar(page, () => {
    const current = ++calendarRequests
    return [
      calendarItem(
        {
          id: 'live-calendar-e2e',
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
          home_score: 79 + current,
          away_score: 70,
          status: 'live',
          home_logo: null,
          away_logo: null,
          home_logo_asset_id: null,
          away_logo_asset_id: null,
          notes: null,
          featured: false,
        } as Match,
        { section: 'upcoming' },
      ),
    ]
  })
  await openPage(page, '/matches')
  // Assert the visible score through the card, independent of its inner layout.
  const card = page.locator('article.match-card')
  await expect(card).toContainText('80')
  await page.clock.fastForward(60_000)
  await expect(card).toContainText('81')
  await expect.poll(() => calendarRequests).toBe(2)
  await page.evaluate(() =>
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }),
  )
  await page.clock.fastForward(120_000)
  expect(calendarRequests).toBe(2)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(card).toContainText('82')
  expect(calendarRequests).toBe(3)
  expect(archiveRequests).toBe(0)
  await assertNoHorizontalOverflow(page)
})

test('live refresh clears pagination time and deduplicates resume events until the delayed response completes', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-07T12:00:00Z') })
  let version = 0
  await mockCalendar(page, () => [
    calendarItem(
      {
        id: 'delayed-live-calendar',
        team_id: 'men',
        team: { id: 'men', category: 'men', name: 'ВГУ', slug: 'men', logo: null },
        competition_id: 'cup',
        competition: { id: 'cup', name: 'Кубок', season: '2026-2027', active: true },
        venue_id: null,
        venue: null,
        club_side: 'home',
        starts_at: '2026-11-07T12:00:00Z',
        home_team_name: 'ВГУ',
        away_team_name: 'Соперник задержанного эфира',
        home_score: 80 + version++,
        away_score: 70,
        status: 'live',
        home_logo: null,
        away_logo: null,
        home_logo_asset_id: null,
        away_logo_asset_id: null,
        notes: null,
        featured: false,
      } as Match,
      { section: 'upcoming' },
    ),
  ])

  let releaseResponse!: () => void
  const heldResponse = new Promise<void>((resolve) => {
    releaseResponse = resolve
  })
  const requested: URL[] = []
  let active = 0
  let maxActive = 0
  await page.route('**/api/v1/calendar?**', async (route) => {
    requested.push(new URL(route.request().url()))
    active++
    maxActive = Math.max(maxActive, active)
    try {
      if (requested.length > 1) await heldResponse
      await route.fallback()
    } finally {
      active--
    }
  })
  await openPage(page, '/matches?season=all&at=2026-11-01T09%3A00%3A00Z')
  const score = page.locator('article.match-card .match-card__score')
  await expect(score).toHaveText(/80\s*:\s*70/u)
  expect(requested).toHaveLength(1)
  expect(requested[0]!.searchParams.get('at')).toBe('2026-11-01T09:00:00.000Z')

  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect.poll(() => requested.length).toBe(2)
  await expect(page).not.toHaveURL(/[?&]at=/u)
  expect(requested[1]!.searchParams.has('at')).toBe(false)
  // Resume signals arrive while the same HTTP response is deliberately held.
  // Stay within the request timeout so this tests concurrency, not a timed-out
  // request's legitimate retry.
  try {
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
      for (let attempt = 0; attempt < 3; attempt++) {
        window.dispatchEvent(new Event('focus'))
        window.dispatchEvent(new Event('online'))
        document.dispatchEvent(new Event('visibilitychange'))
      }
    })
    await page.clock.runFor(1_000)
    expect(requested).toHaveLength(2)
    expect(active).toBe(1)
    expect(maxActive).toBe(1)
  } finally {
    releaseResponse()
  }
  await expect(score).toHaveText(/81\s*:\s*70/u)
  await expect.poll(() => active).toBe(0)
  expect(requested).toHaveLength(2)
  // Completion releases the guard so a later reconnect can refresh normally.
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(score).toHaveText(/82\s*:\s*70/u)
  expect(requested).toHaveLength(3)
  expect(maxActive).toBe(1)
})

test('calendar loads one bounded page at a time, combines server filters and separates cancelled games', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.clock.setFixedTime(new Date('2026-11-01T09:00:00Z'))
  const team = { id: 'men', category: 'men', name: 'Хищные Бобры', slug: 'men', logo: null }
  const matches = Array.from({ length: 104 }, (_, index) => ({
    id: `mock-${index}`,
    team_id: 'men',
    team,
    competition_id: 'cup',
    competition: { id: 'cup', name: 'Тестовый кубок', season: '2026-2027', active: true },
    venue_id: null,
    venue: null,
    club_side: 'home',
    starts_at: '2026-11-15T15:00:00Z',
    home_team_name: 'Хищные Бобры',
    away_team_name: `Соперник ${index}`,
    home_score: 80 as number | null,
    away_score: 72 as number | null,
    status: 'finished',
    home_logo: null,
    away_logo: null,
    notes: null,
  }))
  matches[100] = {
    ...matches[100]!,
    club_side: 'away',
    home_team_name: 'Гостиный соперник',
    away_team_name: 'Хищные Бобры',
    home_score: 70,
    away_score: 85,
  }
  matches[101] = {
    ...matches[101]!,
    away_team_name: 'Будущий матч E2E',
    status: 'scheduled',
    home_score: 999,
    away_score: 888,
  }
  matches[102] = {
    ...matches[102]!,
    away_team_name: 'Отменённый матч E2E',
    status: 'cancelled',
    home_score: null,
    away_score: null,
  }
  matches[103] = {
    ...matches[103]!,
    team: { ...team, id: 'women', category: 'women' },
    team_id: 'women',
    away_team_name: 'Соперник девушек E2E',
  }
  const requested = await mockCalendar(page, [
    calendarItem(matches[101]! as Match, { section: 'upcoming' }),
    calendarItem(matches[102]! as Match, { section: 'changed' }),
    calendarItem(matches[100]! as Match),
    ...matches
      .filter((_, index) => ![100, 101, 102].includes(index))
      .map((item) => calendarItem(item as Match)),
  ])
  await openPage(page, '/matches')
  await expect(page.locator('article.match-card')).toHaveCount(24)
  await expect(page.getByRole('navigation', { name: 'Страницы матчей' })).toContainText('1 / 5')
  await expect(page.locator('.match-filters__summary')).toContainText('Найдено: 104')
  expect(requested.map((url) => url.searchParams.get('page'))).toEqual(['1'])
  expect(requested[0]!.searchParams.get('page_size')).toBe('24')
  await expect(page.locator('.calendar-range')).toContainText('Показаны 1–24 из 104')
  const awayWin = page.locator('article.match-card').filter({ hasText: 'Гостиный соперник' })
  await expect(awayWin).toHaveAttribute('data-winning-side', 'away')
  await expect(awayWin.locator('.match-card__score [data-side="away"]')).toHaveClass(/is-winner/)
  await expect(awayWin.locator('.match-outcome')).toHaveCount(0)
  await expect(awayWin).toHaveClass(/match-card--win/)
  const scheduled = page.locator('article.match-card').filter({ hasText: 'Будущий матч E2E' })
  await expect(scheduled.locator('.match-card__score')).toHaveCount(0)
  await expect(scheduled).not.toContainText('999')
  const changed = page
    .locator('section.match-group')
    .filter({ has: page.getByRole('heading', { name: 'Изменения в расписании', exact: true }) })
  await expect(changed).toContainText('Отменённый матч E2E')
  await expect(
    page
      .locator('section.match-group')
      .filter({ has: page.getByRole('heading', { name: 'Ближайшие', exact: true }) }),
  ).not.toContainText('Отменённый матч E2E')
  await assertNoHorizontalOverflow(page)
  const axe = await new AxeBuilder({ page })
    .exclude('#__vue-devtools-container__')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    axe.violations
      .filter((item) => ['serious', 'critical'].includes(item.impact || ''))
      .map((item) => ({ id: item.id, targets: item.nodes.map((node) => node.target) })),
  ).toEqual([])
  await page.getByRole('button', { name: 'Дальше →', exact: true }).click()
  await expect(page.locator('article.match-card')).toHaveCount(24)
  await expect(page.getByRole('navigation', { name: 'Страницы матчей' })).toContainText('2 / 5')
  await expect(page.locator('.calendar-range')).toContainText('Показаны 25–48 из 104')
  expect(requested.map((url) => url.searchParams.get('page'))).toEqual(['1', '2'])
  expect(requested.every((url) => url.searchParams.get('page_size') === '24')).toBe(true)
  expect(requested[1]!.searchParams.get('at')).toBe('2026-11-07T12:00:00.000Z')
  await page.getByRole('combobox', { name: 'Команда', exact: true }).click()
  await page.getByRole('option', { name: 'Девушки', exact: true }).click()
  await expect(page.locator('article.match-card')).toHaveCount(1)
  await expect(page.locator('article.match-card')).toContainText('Соперник девушек E2E')
  await page.getByRole('combobox', { name: 'Статус', exact: true }).click()
  await page.getByRole('option', { name: 'Запланирован', exact: true }).click()
  await expect(page.locator('article.match-card')).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('По выбранным фильтрам матчей нет')
  await page.getByRole('combobox', { name: 'Команда', exact: true }).click()
  await page.getByRole('option', { name: 'Все команды', exact: true }).click()
  await expect(page.locator('article.match-card')).toHaveCount(1)
  await expect(page.locator('article.match-card')).toContainText('Будущий матч E2E')
})

test('match emblems use uploaded and remote logos for both sides and recover from unavailable images', async ({
  page,
}) => {
  const remoteBase = 'https://logos.e2e.invalid'
  const uploadBase = 'https://uploads.e2e.invalid'
  const logo = (name: string): Media => ({
    id: name,
    content_url: `${uploadBase}/${name}.svg`,
    alt_text: null,
    mime: 'image/svg+xml',
    size: 120,
    width: 32,
    height: 32,
  })
  const fixture = (id: string, changes: Partial<Match>): Match => ({
    id,
    team_id: 'men',
    team: { id: 'men', category: 'men', name: 'Хищные Бобры', slug: 'men', logo: null },
    competition_id: 'cup',
    competition: { id: 'cup', name: 'Кубок эмблем', season: '2026-2027', active: true },
    venue_id: null,
    venue: null,
    club_side: 'home',
    starts_at: '2026-10-15T15:00:00Z',
    home_team_name: 'Хищные Бобры',
    away_team_name: 'Соперник',
    home_score: 80,
    away_score: 72,
    status: 'finished',
    home_logo: null,
    away_logo: null,
    home_logo_asset_id: null,
    away_logo_asset_id: null,
    home_logo_url: null,
    away_logo_url: null,
    notes: null,
    featured: false,
    ...changes,
  })
  const matches = [
    fixture('remote', {
      away_team_name: 'Эмблемы из АСБ',
      home_logo_url: `${remoteBase}/home.svg`,
      away_logo_url: `${remoteBase}/away.svg`,
    }),
    fixture('uploaded', {
      club_side: 'away',
      home_team_name: 'Приоритет загрузок',
      home_logo: logo('home-uploaded'),
      away_logo: logo('away-uploaded'),
      home_logo_url: `${remoteBase}/superseded-home.svg`,
      away_logo_url: `${remoteBase}/superseded-away.svg`,
    }),
    fixture('unavailable', {
      club_side: 'away',
      home_team_name: 'Северный университет',
      away_team_name: 'Клуб с недоступной эмблемой',
      home_logo_url: `${remoteBase}/missing-opponent.svg`,
      away_logo_url: `${remoteBase}/missing-club.svg`,
    }),
    fixture('empty', {
      home_team_name: 'Клуб без логотипов',
      away_team_name: 'Западный институт',
    }),
    fixture('upload-unavailable', {
      away_team_name: 'Резерв после недоступной загрузки',
      home_logo: logo('missing-home-upload'),
      away_logo: logo('missing-away-upload'),
      home_logo_url: `${remoteBase}/recovered-home.svg`,
      away_logo_url: `${remoteBase}/recovered-away.svg`,
    }),
    fixture('team-fallback', {
      away_team_name: 'Клубный логотип команды',
      team: {
        id: 'men',
        category: 'men',
        name: 'Хищные Бобры',
        slug: 'men',
        logo: logo('club-team'),
      },
    }),
  ]
  const requestedImages: string[] = []
  await page.route(/^https:\/\/(logos|uploads)\.e2e\.invalid\//, async (route) => {
    const url = route.request().url()
    requestedImages.push(url)
    await route.fulfill(
      url.includes('/missing-')
        ? { status: 404, contentType: 'text/plain', body: 'Image unavailable' }
        : {
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="#042a4e" d="M2 2h28v20L16 31 2 22z"/></svg>',
          },
    )
  })
  await mockCalendar(
    page,
    matches.map((item) => calendarItem(item)),
  )
  await openPage(page, '/matches')
  await expect(page.locator('article.match-card')).toHaveCount(matches.length)
  const card = (text: string) => page.locator('article.match-card').filter({ hasText: text })

  const remote = card('Эмблемы из АСБ')
  await remote.scrollIntoViewIfNeeded()
  await expect(remote.locator('.match-card__row-team').nth(0).locator('img')).toHaveAttribute(
    'src',
    `${remoteBase}/home.svg`,
  )
  await expect(remote.locator('.match-card__row-team').nth(1).locator('img')).toHaveAttribute(
    'src',
    `${remoteBase}/away.svg`,
  )

  const uploaded = card('Приоритет загрузок')
  await uploaded.scrollIntoViewIfNeeded()
  await expect(uploaded.locator('.match-card__row-team').nth(0).locator('img')).toHaveAttribute(
    'src',
    `${uploadBase}/home-uploaded.svg`,
  )
  await expect(uploaded.locator('.match-card__row-team').nth(1).locator('img')).toHaveAttribute(
    'src',
    `${uploadBase}/away-uploaded.svg`,
  )

  const unavailable = card('Клуб с недоступной эмблемой')
  await unavailable.scrollIntoViewIfNeeded()
  await expect(
    unavailable.locator('.match-card__row-team').nth(0).locator('.team-emblem--fallback'),
  ).toHaveText('СУ')
  await expect(unavailable.locator('.match-card__row-team').nth(0).locator('img')).toHaveCount(0)
  await expect(unavailable.locator('.match-card__row-team').nth(1).locator('img')).toHaveAttribute(
    'src',
    '/images/brand/club-emblem.webp',
  )

  const empty = card('Клуб без логотипов')
  await empty.scrollIntoViewIfNeeded()
  await expect(empty.locator('.match-card__row-team').nth(0).locator('img')).toHaveAttribute(
    'src',
    '/images/brand/club-emblem.webp',
  )
  await expect(
    empty.locator('.match-card__row-team').nth(1).locator('.team-emblem--fallback'),
  ).toHaveText('ЗИ')
  await expect(empty.locator('.match-card__row-team').nth(1).locator('img')).toHaveCount(0)

  const recovered = card('Резерв после недоступной загрузки')
  await recovered.scrollIntoViewIfNeeded()
  await expect(recovered.locator('.match-card__row-team').nth(0).locator('img')).toHaveAttribute(
    'src',
    `${remoteBase}/recovered-home.svg`,
  )
  await expect(recovered.locator('.match-card__row-team').nth(1).locator('img')).toHaveAttribute(
    'src',
    `${remoteBase}/recovered-away.svg`,
  )

  const teamFallback = card('Клубный логотип команды')
  await teamFallback.scrollIntoViewIfNeeded()
  await expect(teamFallback.locator('.match-card__row-team').nth(0).locator('img')).toHaveAttribute(
    'src',
    `${uploadBase}/club-team.svg`,
  )
  await expect(
    teamFallback.locator('.match-card__row-team').nth(1).locator('.team-emblem--fallback'),
  ).toHaveText('КЛК')

  await expect
    .poll(() =>
      page
        .locator('article.match-card img')
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true)
  expect(requestedImages).not.toContain(`${remoteBase}/superseded-home.svg`)
  expect(requestedImages).not.toContain(`${remoteBase}/superseded-away.svg`)
  await assertNoHorizontalOverflow(page)
})
