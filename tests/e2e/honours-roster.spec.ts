import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { assertNoHorizontalOverflow, openPage } from './helpers'

const player = {
  id: '11111111-1111-4111-8111-111111111111',
  external_player_id: 'test',
  full_name: 'Тестовый игрок',
  photo_url: '/images/team-men.webp',
  games_played: 4,
  points_per_game: 14.2,
  assists_per_game: 0,
  rebounds_per_game: null,
  minutes_per_game: 21.5,
  statistics_season: '2026-2027',
  statistics_source_url: 'https://asbasket.ru/team/7433?season=2027&league=asb-cfo-36-m#statistics',
}
const context = {
  team: 'men',
  current_season: '2026-2027',
  season: '2026-2027',
  is_current_season: true,
  status: 'published',
  source_url: 'https://asbasket.ru/team/7433?season=2027&league=asb-cfo-36-m',
  stats_source_url: 'https://asb.sportoteka.org/api/abc/teams/stats?id=7433',
  notice: 'Отдельные показатели АСБ ещё не опубликованы.',
}

test('current roster shows official photo and averages, preserving zero and unknown separately', async ({
  page,
}) => {
  await page.route('**/api/v1/asb-roster/men', (route) =>
    route.fulfill({ json: { data: { ...context, players: [player] } } }),
  )
  await page.route(`**/api/v1/asb-roster/men/players/${player.id}`, (route) =>
    route.fulfill({ json: { data: { ...context, player } } }),
  )
  await openPage(page, '/teams/men')
  await expect(page.locator('.roster-player__photo img')).toBeVisible()
  await expect(page.locator('.player-averages dd')).toHaveText(['14,2', '0', '—', '21:30'])
  await expect(page.locator('.roster-player__games')).toHaveText('Игр в статистике: 4')
  await expect(page.locator('.roster-heading h2')).toHaveText('Состав 2026 / 2027')
  await expect(page.locator('.roster-player__stats-season')).toHaveText('Статистика 2026 / 2027')
  await expect(page.locator('.roster-heading > a')).toHaveAttribute('href', context.source_url)
  await page.getByRole('link', { name: /Тестовый игрок/ }).click()
  await expect(page).toHaveURL(/players\/.+\?team=men/)
  await expect(page.locator('main h1')).toHaveText('Тестовый игрок')
  await expect(page.locator('.player-averages dd')).toHaveText(['14,2', '0', '—', '21:30'])
  await expect(page.locator('.asb-player-profile__season')).toHaveText('В заявке 2026 / 2027')
  await expect(page.locator('.asb-player-profile__statistics-season')).toHaveText(
    'Статистика 2026 / 2027 · Игр в статистике: 4',
  )
  await expect(page.locator('.asb-player-profile__note')).toHaveCount(0)
  await expect(page.locator('.asb-player-profile__statistics-source')).toHaveAttribute(
    'href',
    player.statistics_source_url,
  )
  await expect(page.locator('.asb-player-profile__roster-source')).toHaveAttribute(
    'href',
    context.source_url,
  )
  await assertNoHorizontalOverflow(page)
})

test('historical averages keep the current roster and identify a separate statistics season and source per player', async ({
  page,
}) => {
  const previousSeasonPlayer = {
    ...player,
    statistics_season: '2025-2026',
    statistics_source_url:
      'https://asbasket.ru/team/7433?season=2026&league=asb-cfo-36-m#statistics',
  }
  const earlierSeasonPlayer = {
    ...player,
    id: '22222222-2222-4222-8222-222222222222',
    external_player_id: 'test-earlier',
    full_name: 'Другой текущий игрок',
    statistics_season: '2024-2025',
    statistics_source_url:
      'https://asbasket.ru/team/7433?season=2025&league=asb-cfo-36-m#statistics',
  }
  const notice =
    'Текущий состав 2026/27. Для игроков показан последний опубликованный сезон статистики.'
  await page.route('**/api/v1/asb-roster/men', (route) =>
    route.fulfill({
      json: { data: { ...context, notice, players: [previousSeasonPlayer, earlierSeasonPlayer] } },
    }),
  )
  await page.route(`**/api/v1/asb-roster/men/players/${player.id}`, (route) =>
    route.fulfill({ json: { data: { ...context, notice, player: previousSeasonPlayer } } }),
  )
  await openPage(page, '/teams/men')
  await expect(page.locator('.roster-heading h2')).toHaveText('Состав 2026 / 2027')
  await expect(page.locator('.roster-player')).toHaveCount(2)
  await expect(page.locator('.roster-player h3')).toHaveText([
    'Тестовый игрок',
    'Другой текущий игрок',
  ])
  await expect(page.locator('.roster-player__stats-season')).toHaveText([
    'Статистика 2025 / 2026',
    'Статистика 2024 / 2025',
  ])
  await expect(page.locator('.roster-heading > a')).toHaveAttribute('href', context.source_url)
  await expect(page.locator('.roster-explainer')).toHaveCount(0)
  await assertNoHorizontalOverflow(page)
  await page.locator('.roster-player').first().click()
  await expect(page).toHaveURL(new RegExp(`/players/${player.id}\\?team=men$`))
  await expect(page.locator('main h1')).toHaveText(player.full_name)
  await expect(page.locator('.asb-player-profile__season')).toHaveText('В заявке 2026 / 2027')
  await expect(page.locator('.asb-player-profile__statistics-season')).toHaveText(
    'Статистика 2025 / 2026 · Игр в статистике: 4',
  )
  await expect(page.locator('.player-averages dd')).toHaveText(['14,2', '0', '—', '21:30'])
  await expect(page.locator('.asb-player-profile__note')).toHaveCount(0)
  const source = page.locator('.asb-player-profile__statistics-source')
  await expect(source).toHaveAttribute('href', previousSeasonPlayer.statistics_source_url)
  await expect(source).toContainText('Источник статистики АСБ · 2025 / 2026')
  await expect(page.locator('.asb-player-profile__roster-source')).toHaveAttribute(
    'href',
    context.source_url,
  )
  await expect(page.locator('.asb-player-profile__roster-source')).toContainText('Текущая заявка')
  await assertNoHorizontalOverflow(page)
  await page.locator('.profile-back').click()
  await expect(page).toHaveURL(/\/teams\/men$/)
  await expect(page.locator('.roster-heading h2')).toHaveText('Состав 2026 / 2027')
  await expect(page.locator('.roster-player h3')).toHaveText([
    'Тестовый игрок',
    'Другой текущий игрок',
  ])
})

test('a current member without published statistics shows unknown values and retains only the roster source', async ({
  page,
}) => {
  const noStatistics = {
    ...player,
    games_played: null,
    points_per_game: null,
    assists_per_game: null,
    rebounds_per_game: null,
    minutes_per_game: null,
    statistics_season: null,
    statistics_source_url: null,
  }
  await page.route('**/api/v1/asb-roster/men', (route) =>
    route.fulfill({ json: { data: { ...context, players: [noStatistics] } } }),
  )
  await page.route(`**/api/v1/asb-roster/men/players/${player.id}`, (route) =>
    route.fulfill({ json: { data: { ...context, player: noStatistics } } }),
  )
  await openPage(page, '/teams/men')
  await expect(page.locator('.roster-heading h2')).toHaveText('Состав 2026 / 2027')
  await expect(page.locator('.roster-player')).toHaveCount(1)
  await expect(page.locator('.roster-player__stats-season')).toHaveText(
    'Статистика пока не опубликована',
  )
  await expect(page.locator('.roster-player__games')).toHaveCount(0)
  await expect(page.locator('.player-averages dd')).toHaveText(['—', '—', '—', '—'])
  await page.locator('.roster-player').click()
  await expect(page.locator('.asb-player-profile__season')).toHaveText('В заявке 2026 / 2027')
  await expect(page.locator('.asb-player-profile__statistics-season')).toHaveText(
    'Статистика пока не опубликована',
  )
  await expect(page.locator('.player-averages dd')).toHaveText(['—', '—', '—', '—'])
  await expect(page.locator('.asb-player-profile__statistics-source')).toHaveCount(0)
  await expect(page.locator('.asb-player-profile__roster-source')).toHaveAttribute(
    'href',
    context.source_url,
  )
  await assertNoHorizontalOverflow(page)
})

test('published zero averages and zero minutes remain numeric rather than becoming unavailable', async ({
  page,
}) => {
  const zeroStatistics = {
    ...player,
    games_played: 1,
    points_per_game: 0,
    assists_per_game: 0,
    rebounds_per_game: 0,
    minutes_per_game: 0,
  }
  await page.route('**/api/v1/asb-roster/men', (route) =>
    route.fulfill({ json: { data: { ...context, players: [zeroStatistics] } } }),
  )
  await page.route(`**/api/v1/asb-roster/men/players/${player.id}`, (route) =>
    route.fulfill({ json: { data: { ...context, player: zeroStatistics } } }),
  )
  await openPage(page, '/teams/men')
  await expect(page.locator('.roster-player__stats-season')).toHaveText('Статистика 2026 / 2027')
  await expect(page.locator('.roster-player__games')).toHaveText('Игр в статистике: 1')
  await expect(page.locator('.player-averages dd')).toHaveText(['0', '0', '0', '0:00'])
  await page.locator('.roster-player').click()
  await expect(page.locator('.asb-player-profile__statistics-season')).toHaveText(
    'Статистика 2026 / 2027 · Игр в статистике: 1',
  )
  await expect(page.locator('.player-averages dd')).toHaveText(['0', '0', '0', '0:00'])
  await expect(page.locator('.asb-player-profile__statistics-source')).toHaveAttribute(
    'href',
    player.statistics_source_url,
  )
  await assertNoHorizontalOverflow(page)
})

test('an unpublished current roster never substitutes last season players', async ({ page }) => {
  await page.route('**/api/v1/asb-roster/men', (route) =>
    route.fulfill({
      json: {
        data: {
          ...context,
          season: '2025-2026',
          is_current_season: false,
          status: 'not_published',
          notice: 'Заявка 2026/27 ещё не опубликована на АСБ.',
          players: [player],
        },
      },
    }),
  )
  await openPage(page, '/teams/men')
  await expect(page.getByRole('status')).toContainText('ещё не опубликована')
  await expect(page.locator('.roster-player')).toHaveCount(0)
  await expect(page.getByText('Тестовый игрок', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Проверить заявку на АСБ ↗' })).toHaveAttribute(
    'href',
    /^https:\/\/asbasket\.ru\/team\//,
  )
  await assertNoHorizontalOverflow(page)
})

test('honours show medals and filter tournament awards without source and methodology copy', async ({
  page,
}) => {
  const awards = Array.from({ length: 24 }, (_, index) => ({
    id: `award-${index}`,
    team: [0, 1, 8, 15].includes(index) ? 'women' : 'men',
    discipline: index % 2 ? '3x3' : '5x5',
    year: 2026 - (index % 3),
    tournament: `Турнир клуба ${index + 1}`,
    location: 'Воронеж',
    place: index < 8 ? 1 : index < 15 ? 2 : 3,
    source_label: 'Техническое происхождение записи',
    source_url: 'https://example.invalid/provenance',
  }))
  await page.route('**/api/v1/results-archive/honours*', (route) => {
    const selectedTeam = new URL(route.request().url()).searchParams.get('team')
    const items = awards.filter((item) => !selectedTeam || item.team === selectedTeam)
    return route.fulfill({
      json: {
        data: {
          titles: items.filter((item) => item.place === 1).length,
          championships: 1,
          silver: items.filter((item) => item.place === 2).length,
          bronze: items.filter((item) => item.place === 3).length,
          podiums: items.length,
          methodology: 'Техническое описание методологии',
          items,
        },
      },
    })
  })
  await openPage(page, '/')
  const honours = page.locator('.club-honours')
  await expect(honours.getByRole('heading', { name: 'Победы клуба', exact: true })).toBeVisible()
  await expect(honours.locator('.honours-period')).toHaveText('2024–2026')
  await expect(honours.locator('.honours-medal strong')).toHaveText(['8', '7', '9'])
  await expect(honours.locator('.honours-championships')).toContainText('1')
  await expect(honours.locator('.honours-total strong')).toHaveText('24')
  await expect(honours.locator('.honour-row:visible')).toHaveCount(4)
  await honours.locator('.honours-more summary').click()
  await expect(honours.locator('.honour-row:visible')).toHaveCount(8)
  await expect(honours.locator('.honours-scope, .honours-method, .honour-row__source')).toHaveCount(
    0,
  )
  await expect(honours).not.toContainText('Техническое')
  await expect(honours).not.toContainText('Лучший студенческий клуб сезона')
  await honours.getByRole('button', { name: 'Девушки', exact: true }).click()
  await expect(honours.locator('.honours-medal strong')).toHaveText(['2', '1', '1'])
  await expect(honours.locator('.honours-total strong')).toHaveText('4')
  await honours.getByRole('button', { name: /Все призовые места/ }).click()
  await expect(honours.locator('.honour-row:visible')).toHaveCount(4)
  await expect(honours.locator('.honour-row').first()).toContainText('Девушки')
  await assertNoHorizontalOverflow(page)
  const result = await new AxeBuilder({ page })
    .include('.club-honours')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    result.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
  ).toEqual([])
})
