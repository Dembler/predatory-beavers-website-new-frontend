import { expect, test, type Page } from '@playwright/test'
import { openPage } from './helpers'

const firstId = '11111111-1111-4111-8111-111111111111'
const secondId = '22222222-2222-4222-8222-222222222222'
const missingId = '00000000-0000-4000-8000-000000000099'
const families = ['local', 'asb'] as const
type Family = (typeof families)[number]

function profilePath(family: Family, id: string) {
  return family === 'local' ? `/players/local/${id}` : `/teams/men/players/${id}`
}

function apiPath(family: Family, id: string) {
  return family === 'local' ? `/api/v1/players/${id}` : `/api/v1/asb-roster/men/players/${id}`
}

function profileResponse(family: Family, id: string, name: string) {
  if (family === 'local') {
    return {
      data: {
        id,
        full_name: name,
        active: true,
        photo: null,
        position: null,
        age_text: null,
        fact: 'Клубный профиль для проверки метаданных.',
        team: { id: 'local-men', category: 'men', name: 'Хищные Бобры', slug: 'men', logo: null },
      },
    }
  }
  return {
    data: {
      team: 'men',
      current_season: '2026-2027',
      season: '2026-2027',
      is_current_season: true,
      status: 'published',
      notice: null,
      source_url: null,
      stats_source_url: null,
      fetched_at: null,
      player: {
        id,
        external_player_id: id,
        full_name: name,
        photo_url: null,
        games_played: null,
        points_per_game: null,
        assists_per_game: null,
        rebounds_per_game: null,
        minutes_per_game: null,
        statistics_season: null,
        statistics_source_url: null,
      },
    },
  }
}

async function expectRobots(page: Page, indexable: boolean) {
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    indexable ? /^index,\s*follow$/ : /^noindex,\s*follow$/,
  )
}

async function navigateInApp(page: Page, path: string) {
  // Exercise Vue Router's history listener while retaining the mounted profile
  // component and its previous response, as a back/forward navigation would.
  await page.evaluate((destination) => {
    window.history.pushState(window.history.state, '', destination)
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
  }, path)
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[?]/g, '\\?')}$`))
}

for (const family of families) {
  test(`${family} malformed and unknown profiles stay noindex with real API responses`, async ({
    page,
  }) => {
    for (const [id, status] of [
      ['invalid-profile-metadata-id', 422],
      [missingId, 404],
    ] as const) {
      const response = page.waitForResponse(
        (response) => new URL(response.url()).pathname === apiPath(family, id),
      )
      await openPage(page, profilePath(family, id))
      expect((await response).status()).toBe(status)
      await expect(page.getByRole('status').filter({ hasText: 'Игрок не найден' })).toBeVisible()
      await expectRobots(page, false)
      await navigateInApp(page, `${profilePath(family, id)}?from=share`)
      await expectRobots(page, false)
    }
    await page.locator('.profile-back').click()
    await expect(page).toHaveURL(/\/teams\/(men|women)$/)
    await expectRobots(page, true)
  })

  test(`${family} profile metadata follows pending, failure, retry and reused route identity`, async ({
    page,
  }) => {
    const firstName = 'Первый опубликованный игрок'
    const secondName = 'Второй опубликованный игрок'
    await page.route(`**${apiPath(family, firstId)}`, (route) =>
      route.fulfill({ json: profileResponse(family, firstId, firstName) }),
    )
    let releaseResponse!: () => void
    let requestStarted!: () => void
    const responseGate = new Promise<void>((resolve) => (releaseResponse = resolve))
    const started = new Promise<void>((resolve) => (requestStarted = resolve))
    let attempts = 0
    await page.route(`**${apiPath(family, secondId)}`, async (route) => {
      attempts++
      if (attempts === 1) {
        requestStarted()
        await responseGate
        await route.fulfill({ status: 503, json: { detail: 'Temporarily unavailable' } })
      } else {
        await route.fulfill({ json: profileResponse(family, secondId, secondName) })
      }
    })
    try {
      await openPage(page, profilePath(family, firstId))
      await expect(page.locator('main h1')).toHaveText(firstName)
      await expectRobots(page, true)
      await expect(page).toHaveTitle(`${firstName} — БК ВГУ «Хищные Бобры»`)

      await navigateInApp(page, profilePath(family, secondId))
      await started
      await expect(page.getByRole('status', { name: 'Загрузка', exact: true })).toBeVisible()
      await expectRobots(page, false)
      await navigateInApp(page, `${profilePath(family, secondId)}?from=share`)
      await expectRobots(page, false)
      expect(attempts).toBe(1)

      releaseResponse()
      await expect(page.getByRole('alert')).toContainText('Не удалось загрузить данные')
      await expectRobots(page, false)
      await page.getByRole('button', { name: 'Повторить →', exact: true }).click()
      await expect(page.locator('main h1')).toHaveText(secondName)
      await expectRobots(page, true)
      await expect(page).toHaveTitle(`${secondName} — БК ВГУ «Хищные Бобры»`)
      expect(attempts).toBe(2)

      await navigateInApp(page, `${profilePath(family, secondId)}?from=another-share`)
      await expectRobots(page, true)
      await expect(page).toHaveTitle(`${secondName} — БК ВГУ «Хищные Бобры»`)
      expect(attempts).toBe(2)

      await navigateInApp(page, profilePath(family, firstId))
      await expect(page.locator('main h1')).toHaveText(firstName)
      await expectRobots(page, true)
      await expect(page).toHaveTitle(`${firstName} — БК ВГУ «Хищные Бобры»`)
    } finally {
      releaseResponse()
    }
  })
}

test('an ASB profile requires both a published roster and the current season before indexing', async ({
  page,
}) => {
  const response = profileResponse('asb', firstId)
  let context = { is_current_season: true, status: 'not_published' }
  await page.route(`**${apiPath('asb', firstId)}`, (route) =>
    route.fulfill({ json: { data: { ...response.data, ...context } } }),
  )
  await openPage(page, profilePath('asb', firstId))
  await expect(page.getByRole('status').filter({ hasText: 'Игрок не найден' })).toBeVisible()
  await expectRobots(page, false)
  context = { is_current_season: false, status: 'published' }
  await page.reload()
  await expect(page.getByRole('status').filter({ hasText: 'Игрок не найден' })).toBeVisible()
  await expectRobots(page, false)
})
