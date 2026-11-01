import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Match, Media } from '../../src/shared/types'
import { assertNoHorizontalOverflow, openPage } from './helpers'

test('paginated schedule loads every page, combines filters and separates cancelled games', async ({
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
    away_team_name: 'Женский соперник E2E',
  }
  const requested: number[] = []
  await page.route('**/api/v1/matches?**', async (route) => {
    const url = new URL(route.request().url())
    const current = Number(url.searchParams.get('page') || 1)
    const size = Number(url.searchParams.get('page_size') || 100)
    requested.push(current)
    await route.fulfill({
      json: {
        items: matches.slice((current - 1) * size, current * size),
        total: matches.length,
        page: current,
        page_size: size,
        total_pages: Math.ceil(matches.length / size),
      },
    })
  })
  await openPage(page, '/matches')
  await expect(page.locator('article.match-card')).toHaveCount(104)
  expect(requested).toEqual([1, 2])
  const awayWin = page.locator('article.match-card').filter({ hasText: 'Гостиный соперник' })
  await expect(awayWin).toContainText('Победа')
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
  await page.getByRole('combobox', { name: 'Команда', exact: true }).click()
  await page.getByRole('option', { name: 'Женская команда', exact: true }).click()
  await expect(page.locator('article.match-card')).toHaveCount(1)
  await expect(page.locator('article.match-card')).toContainText('Женский соперник E2E')
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
  await page.route('**/api/v1/matches?**', (route) =>
    route.fulfill({
      json: { items: matches, total: matches.length, page: 1, page_size: 100, total_pages: 1 },
    }),
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
