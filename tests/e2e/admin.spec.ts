import { existsSync, readFileSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import {
  assertNoHorizontalOverflow,
  deleteRow,
  findAdminRecord,
  openPage,
  saveEditor,
} from './helpers'

interface Runtime {
  username: string
  password: string
  databasePath: string
  frontendURL: string
  baseURL: string
  mediaPath: string
  runtimeToken: string
}

const runtimePath =
  process.env.E2E_RUNTIME_FILE ||
  resolve('../predatory-beavers-website-new-backend/data/e2e-credentials.json')
const runtime: Runtime | null = existsSync(runtimePath)
  ? JSON.parse(readFileSync(runtimePath, 'utf8').replace(/^\uFEFF/, ''))
  : null
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const created: string[] = []

test.beforeAll(async ({ request }) => {
  if (!runtime)
    throw new Error(
      'Admin E2E requires the gitignored E2E_RUNTIME_FILE generated for an isolated backend. See tests/e2e/README.md.',
    )
  if (!/^e2e(?:[-_.].*)?\.db$/i.test(basename(runtime.databasePath)))
    throw new Error('Refusing mutations: databasePath must name a disposable e2e database.')
  if (
    ![runtime.frontendURL, runtime.baseURL].every((url) =>
      ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname),
    )
  )
    throw new Error('Refusing mutations against a non-local server.')
  const actualURL = new URL(process.env.E2E_BASE_URL || 'http://127.0.0.1:5173')
  const runtimeURL = new URL(runtime.frontendURL)
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(actualURL.hostname) ||
    actualURL.port !== runtimeURL.port ||
    actualURL.protocol !== runtimeURL.protocol
  )
    throw new Error('Frontend URL does not match the isolated runtime.')
  if (!runtime.runtimeToken)
    throw new Error(
      'Runtime has no disposable-backend verification token. Run backend/scripts/setup_e2e.py again.',
    )
  for (const url of ['/api/v1/health/e2e', `${runtime.baseURL}/api/v1/health/e2e`]) {
    const response = await request
      .get(url, {
        headers: { 'X-E2E-Runtime-Token': runtime.runtimeToken },
      })
      .catch(() => {
        // Playwright's network error includes request headers. Keep the runtime
        // token out of reports when a local API or preview is unavailable.
        throw new Error(
          'Isolated E2E runtime is unavailable. Check the local API and frontend proxy.',
        )
      })
    if (response.status() !== 200)
      throw new Error('Refusing mutations: actual API did not confirm the isolated E2E runtime.')
    const marker = await response.json()
    if (
      marker.isolated !== true ||
      resolve(marker.databasePath).toLowerCase() !== resolve(runtime.databasePath).toLowerCase() ||
      resolve(marker.mediaPath).toLowerCase() !== resolve(runtime.mediaPath).toLowerCase()
    ) {
      throw new Error(
        'Refusing mutations: API database/media paths do not match the isolated E2E runtime.',
      )
    }
  }
})

test.beforeEach(async ({ page, baseURL }) => {
  const allowed = new Set([new URL(baseURL!).origin, new URL(runtime!.baseURL).origin])
  await page.route('**/api/v1/**', async (route) => {
    if (!allowed.has(new URL(route.request().url()).origin)) {
      await route.abort('blockedbyclient')
      throw new Error('Refusing an API request outside the verified isolated runtime.')
    }
    await route.fallback()
  })
})

async function login(page: Page) {
  if (!runtime) throw new Error('Missing isolated runtime')
  await openPage(page, '/admin')
  await page.getByLabel('Логин', { exact: true }).fill(runtime.username)
  await page.getByLabel('Пароль', { exact: true }).fill(runtime.password)
  await page.getByRole('button', { name: /^Войти/ }).click()
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Добавить игрока/ })).toBeVisible()
}

async function tab(page: Page, name: string) {
  const navigation = page.getByRole('navigation', { name: 'Разделы управления', exact: true })
  const target = navigation.getByRole('button', { name, exact: true })
  if (!(await target.isVisible())) {
    await navigation.getByRole('button', { name: /^Раздел управления / }).click()
  }
  await target.click()
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
}

async function saveNew(page: Page, endpoint: string): Promise<string> {
  const response = page.waitForResponse(
    (response) => response.url().endsWith(endpoint) && response.request().method() === 'POST',
  )
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить', exact: true }).click()
  const result = await response
  expect(result.status()).toBe(201)
  const id = (await result.json()).data.id as string
  created.push(`${endpoint}/${id}`)
  await expect(page.getByRole('dialog')).not.toBeVisible()
  return id
}

test.afterEach(async ({ page }) => {
  // Remove only records created by this worker, even when a UI assertion fails halfway through.
  // Dependencies are registered before their users, so reverse order is safe.
  const failures: string[] = []
  for (const path of [...created].reverse()) {
    try {
      const csrf = await page.request.get('/api/v1/auth/csrf')
      if (!csrf.ok()) {
        failures.push(`${path}: CSRF ${csrf.status()}`)
        continue
      }
      const token = (await csrf.json()).data.csrf_token
      const response = await page.request.delete(path, { headers: { 'X-CSRF-Token': token } })
      if ([204, 404].includes(response.status())) created.splice(created.indexOf(path), 1)
      else failures.push(`${path}: DELETE ${response.status()}`)
    } catch {
      failures.push(`${path}: network failure during cleanup`)
    }
  }
  expect(failures, 'Some records created by E2E could not be cleaned up').toEqual([])
})

test('login validation, session restoration, logout and anonymous access', async ({ page }) => {
  await openPage(page, '/admin')
  await page.getByLabel('Логин', { exact: true }).fill(`invalid-${run}`)
  await page.getByLabel('Пароль', { exact: true }).fill('invalid-password')
  await page.getByRole('button', { name: /^Войти/ }).click()
  await expect(page.getByRole('alert')).toContainText('Неверный логин или пароль')
  await login(page)
  await page.screenshot({ path: test.info().outputPath('admin-authenticated.png'), fullPage: true })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Добавить игрока/ })).toBeVisible()
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await expect(page.getByLabel('Логин', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Логин', { exact: true })).toBeVisible()
  expect((await page.request.get('/api/v1/admin/players')).status()).toBe(401)
})

test('player CRUD, real photo upload, public profile, photo reference protection and media deletion', async ({
  page,
}) => {
  await login(page)
  const name = `E2E Игрок ${run}`
  const renamed = `${name} обновлён`
  const photoName = `E2E Фото ${run}`
  await page.getByRole('button', { name: /Добавить игрока/ }).click()
  const editor = page.getByRole('dialog', { name: 'Добавить игрока', exact: true })
  await editor.getByLabel('Имя и фамилия').fill(name)
  await editor.getByLabel('Команда', { exact: false }).selectOption({ label: 'Мужская команда' })
  await editor.getByLabel('Амплуа').fill('Защитник')
  await editor.getByLabel('Об игроке').fill('Тестовая биография.\n\nВторой абзац.')
  const upload = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/admin/media') && response.request().method() === 'POST',
  )
  // Each run needs distinct pixels: the API intentionally reuses identical images.
  const pixels = await page.evaluate((seed) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 16
    const context = canvas.getContext('2d')!
    for (let i = 0; i < 256; i++) {
      const value = seed.charCodeAt(i % seed.length) + i * 31
      context.fillStyle = `rgb(${value % 256},${(value * 7) % 256},${(value * 13) % 256})`
      context.fillRect(i % 16, Math.floor(i / 16), 1, 1)
    }
    return canvas.toDataURL('image/png').split(',')[1]!
  }, photoName)
  await editor.locator('input[type="file"]').setInputFiles({
    name: `${photoName}.png`,
    mimeType: 'image/png',
    buffer: Buffer.from(pixels, 'base64'),
  })
  const photoResponse = await upload
  expect(photoResponse.status()).toBe(201)
  const photo = (await photoResponse.json()).data
  created.push(`/api/v1/admin/media/${photo.id}`)
  await expect(editor.locator('.image-picker__preview')).toBeVisible()
  const id = await saveNew(page, '/api/v1/admin/players')
  await page.getByRole('button', { name: `Изменить: ${name}`, exact: true }).click()
  await page.getByRole('dialog').getByLabel('Имя и фамилия').fill(renamed)
  await saveEditor(page)
  const teamFilter = page.getByRole('search').getByLabel('Команда', { exact: true })
  await teamFilter.selectOption('women')
  await expect(page.getByRole('button', { name: `Изменить: ${renamed}`, exact: true })).toHaveCount(
    0,
  )
  await teamFilter.selectOption('men')
  await expect(
    page.getByRole('button', { name: `Изменить: ${renamed}`, exact: true }),
  ).toBeVisible()
  await openPage(page, `/players/local/${id}`)
  await expect(page.locator('main h1')).toHaveText(renamed)
  await expect(page.getByText('Тестовая биография.', { exact: false })).toBeVisible()
  await expect(page.locator('main img').first()).toBeVisible()
  await openPage(page, '/teams/men')
  await expect(page.getByRole('heading', { name: renamed, exact: true })).toBeVisible()
  await openPage(page, '/admin?tab=media')
  await expect(page.getByRole('heading', { name: photoName, exact: true })).toBeVisible()
  await page.getByRole('button', { name: `Удалить фото: ${photoName}`, exact: true }).click()
  const deletePhoto = page.getByRole('dialog', { name: 'Удалить фотографию?', exact: true })
  await expect(deletePhoto.getByRole('link', { name: renamed, exact: false })).toBeVisible()
  await expect(deletePhoto.getByRole('button', { name: 'Удалить', exact: true })).toBeDisabled()
  const csrf = (await (await page.request.get('/api/v1/auth/csrf')).json()).data.csrf_token
  expect(
    (
      await page.request.delete(`/api/v1/admin/media/${photo.id}`, {
        headers: { 'X-CSRF-Token': csrf },
      })
    ).status(),
  ).toBe(409)
  await deletePhoto.getByRole('button', { name: 'Отмена', exact: true }).click()
  await tab(page, 'Игроки')
  await deleteRow(page, renamed)
  await tab(page, 'Фотографии')
  await page.getByRole('button', { name: `Удалить фото: ${photoName}`, exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('heading', { name: photoName, exact: true })).toHaveCount(0)
  const missing = await page.request.get(`/api/v1/players/${id}`)
  expect(missing.status()).toBe(404)
})

test('new competition and venue become usable immediately; match validation and CRUD update public schedule', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await login(page)
  const competition = `E2E Турнир ${run}`
  const venue = `E2E Зал ${run}`
  const opponent = `E2E Соперник ${run}`
  await tab(page, 'Турниры')
  await page.getByRole('button', { name: /Добавить турнир/ }).click()
  await page.getByRole('dialog').getByLabel('Название').fill(competition)
  await page.getByRole('dialog').getByLabel('Сезон').fill('2026-2027')
  await saveNew(page, '/api/v1/admin/competitions')
  await tab(page, 'Залы')
  await page.getByRole('button', { name: /Добавить зал/ }).click()
  await page.getByRole('dialog').getByLabel('Название').fill(venue)
  await page.getByRole('dialog').getByLabel('Адрес').fill('Воронеж, Университетская площадь, 1')
  await page.getByRole('dialog').getByLabel('Широта', { exact: false }).fill('51.656393')
  await page.getByRole('dialog').getByLabel('Долгота', { exact: true }).fill('39.206925')
  const venueId = await saveNew(page, '/api/v1/admin/venues')
  await tab(page, 'Матчи')
  await page.getByRole('button', { name: /Добавить матч/ }).click()
  const editor = page.getByRole('dialog', { name: 'Добавить матч', exact: true })
  await editor
    .getByLabel('Турнир', { exact: false })
    .selectOption({ label: `${competition} · 2026-2027` })
  await editor.getByLabel('Зал', { exact: true }).selectOption({ label: venue })
  await editor.getByLabel('Гости', { exact: false }).fill(opponent)
  await editor.getByLabel('Дата и время').fill('2026-11-20T18:30')
  await editor.getByLabel('Статус', { exact: false }).selectOption('finished')
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(editor.getByRole('alert')).toContainText('очки обеих команд')
  await editor.getByLabel('Очки хозяев').fill('80')
  await editor.getByLabel('Очки гостей').fill('80')
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(editor.getByRole('alert')).toContainText('не заканчивается вничью')
  await editor.getByLabel('Очки гостей').fill('72')
  await editor.getByLabel('Клуб играет', { exact: false }).selectOption('away')
  await expect(editor.getByLabel('Хозяева', { exact: false })).toHaveValue(opponent)
  await expect(editor.getByLabel('Гости', { exact: false })).toHaveValue('Хищные Бобры')
  await expect(editor.getByLabel('Очки хозяев')).toHaveValue('72')
  await expect(editor.getByLabel('Очки гостей')).toHaveValue('80')
  await editor.getByLabel('Клуб играет', { exact: false }).selectOption('home')
  await expect(editor.getByLabel('Хозяева', { exact: false })).toHaveValue('Хищные Бобры')
  await expect(editor.getByLabel('Очки хозяев')).toHaveValue('80')
  const id = await saveNew(page, '/api/v1/admin/matches')
  const matchName = `Хищные Бобры — ${opponent}`
  await findAdminRecord(page, matchName)
  await expect(
    page.getByRole('row').or(page.getByRole('article')).filter({ hasText: opponent }),
  ).toContainText('80 : 72')
  await page.getByRole('button', { name: `Изменить: ${matchName}`, exact: true }).click()
  await page.getByRole('dialog').getByLabel('Очки хозяев').fill('82')
  await saveEditor(page)
  await openPage(page, '/matches')
  const card = page.locator('article').filter({ hasText: opponent })
  await expect(card).toContainText('82')
  await expect(card).toContainText('72')
  await expect(card).toContainText(venue)

  await openPage(page, '/admin?tab=venues')
  await deleteRow(page, venue)
  const publicMatch = await page.request.get(`/api/v1/matches/${id}`)
  expect(publicMatch.status()).toBe(200)
  expect((await publicMatch.json()).data.venue).toBeNull()
  await openPage(page, '/matches')
  await expect(card).toContainText('82')
  await expect(card).not.toContainText(venue)
  await openPage(page, `/admin?tab=matches&edit=${id}`)
  const retainedVenue = page.getByRole('dialog').getByLabel('Зал', { exact: true })
  await expect(retainedVenue).toHaveValue(venueId)
  await expect(retainedVenue.locator('option:checked')).toHaveText(`${venue} (нет в списке)`)
  await page.getByRole('dialog').getByLabel('Очки хозяев').fill('84')
  await saveEditor(page)
  const editedMatch = (await (await page.request.get(`/api/v1/matches/${id}`)).json()).data
  expect(editedMatch.home_score).toBe(84)
  expect(editedMatch.venue).toBeNull()
  await openPage(page, '/admin?tab=matches')
  await deleteRow(page, matchName)
  expect((await page.request.get(`/api/v1/matches/${id}`)).status()).toBe(404)
  await tab(page, 'Турниры')
  await deleteRow(page, competition)
})

for (const section of [
  { tab: 'История', key: 'history', route: '/club' },
  { tab: 'Правила', key: 'rules', route: '/rules' },
]) {
  test(`${section.tab}: draft stays private; publishing, escaped text, editing and deletion reach the public page`, async ({
    page,
  }) => {
    await login(page)
    const title = `E2E ${section.tab} ${run}`
    const updated = `${title} обновлено`
    await tab(page, section.tab)
    await page.getByRole('button', { name: /Добавить раздел/ }).click()
    const editor = page.getByRole('dialog', { name: 'Добавить раздел', exact: true })
    await editor.getByLabel('Заголовок').fill(title)
    await editor
      .getByLabel('Текст', { exact: false })
      .fill('Первый абзац.\n\n<script>window.__e2eUnsafe = true</script>')
    await editor.getByLabel('Опубликовать на сайте').uncheck()
    const id = await saveNew(page, '/api/v1/admin/content')
    await openPage(page, section.route)
    await expect(page.getByText(title, { exact: true })).toHaveCount(0)
    const drafts = await page.request.get(`/api/v1/content/${section.key}`)
    expect((await drafts.json()).data.items.some((item: { id: string }) => item.id === id)).toBe(
      false,
    )
    await openPage(page, `/admin?tab=${section.key}`)
    await page.getByRole('button', { name: `Изменить: ${title}`, exact: true }).click()
    await page.getByRole('dialog').getByLabel('Заголовок').fill(updated)
    await page.getByRole('dialog').getByLabel('Опубликовать на сайте').check()
    await saveEditor(page)
    await openPage(page, section.route)
    const accordion =
      section.key === 'rules'
        ? page.locator('.rule-accordion').filter({ hasText: updated })
        : page.locator('.club-chapter').filter({ hasText: updated })
    await expect(accordion).toHaveCount(1)
    const outer =
      section.key === 'rules'
        ? page.locator('.rules-library')
        : page.locator('.club-archive').filter({ has: accordion })
    if (!(await outer.evaluate((element) => (element as HTMLDetailsElement).open)))
      await outer.locator(':scope > summary').click()
    await expect(accordion.locator(':scope > summary')).toBeVisible()
    if (!(await accordion.evaluate((element) => (element as HTMLDetailsElement).open)))
      await accordion.locator(':scope > summary').click()
    await expect(
      page.getByText('<script>window.__e2eUnsafe = true</script>', { exact: false }),
    ).toBeVisible()
    expect(await page.evaluate(() => '__e2eUnsafe' in window)).toBe(false)
    await openPage(page, `/admin?tab=${section.key}`)
    await deleteRow(page, updated)
    await openPage(page, section.route)
    await expect(page.getByText(updated, { exact: true })).toHaveCount(0)
  })
}

test('admin editor has accessible controls and keyboard cancellation preserves unsaved data when rejected', async ({
  page,
}, testInfo) => {
  await login(page)
  await page.getByRole('button', { name: /Добавить игрока/ }).click()
  const editor = page.getByRole('dialog', { name: 'Добавить игрока', exact: true })
  await editor.getByLabel('Имя и фамилия').fill(`E2E Несохранённый ${run}`)
  await page.screenshot({ path: testInfo.outputPath('admin-player-editor.png'), fullPage: true })
  const result = await new AxeBuilder({ page })
    .exclude('#__vue-devtools-container__')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  const violations = result.violations.filter((item) =>
    ['serious', 'critical'].includes(item.impact || ''),
  )
  await testInfo.attach('admin-dialog-accessibility', {
    body: JSON.stringify(violations, null, 2),
    contentType: 'application/json',
  })
  expect
    .soft(
      violations.map((item) => ({ id: item.id, targets: item.nodes.map((node) => node.target) })),
    )
    .toEqual([])
  await assertNoHorizontalOverflow(page)
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.keyboard.press('Escape')
  await expect(editor).toBeVisible()
  await expect(editor.getByLabel('Имя и фамилия')).toHaveValue(`E2E Несохранённый ${run}`)
  page.once('dialog', (dialog) => dialog.accept())
  await page.keyboard.press('Escape')
  await expect(editor).not.toBeVisible()
})

test('media library rejects invalid or oversized files, uploads a photo and edits its accessible description', async ({
  page,
}) => {
  await login(page)
  await tab(page, 'Фотографии')
  const file = page.locator('.media-upload input[type="file"]')
  await file.setInputFiles({
    name: 'invalid.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  })
  await expect(page.getByRole('alert')).toContainText(
    'Выберите JPEG, PNG или WebP размером до 8 МБ',
  )
  await file.setInputFiles({
    name: 'oversized.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(8 * 1024 * 1024 + 1),
  })
  await expect(page.getByRole('alert')).toContainText(
    'Выберите JPEG, PNG или WebP размером до 8 МБ',
  )
  const title = `E2E Медиатека ${run}`
  const updated = `${title} — новое описание`
  await page.getByLabel('Описание нового фото', { exact: true }).fill(title)
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/admin/media') && response.request().method() === 'POST',
  )
  await file.setInputFiles({
    name: 'valid.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  })
  const upload = await response
  expect(upload.status()).toBe(201)
  const asset = (await upload.json()).data
  const id = asset.id
  created.push(`/api/v1/admin/media/${id}`)
  if (asset.reused) {
    await expect(
      page.getByRole('status').filter({ hasText: 'Эта фотография уже есть в медиатеке' }),
    ).toContainText('Сохранено её прежнее описание')
    await page
      .getByRole('button', { name: 'Изменить описание существующего фото', exact: true })
      .click()
    const description = page
      .getByRole('dialog')
      .getByLabel('Описание для читателей и экранных дикторов')
    await expect(description).toHaveValue(title)
    await saveEditor(page)
  }
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await page.getByRole('button', { name: `Изменить описание: ${title}`, exact: true }).click()
  await page
    .getByRole('dialog')
    .getByLabel('Описание для читателей и экранных дикторов')
    .fill(updated)
  await saveEditor(page)
  await expect(page.getByRole('img', { name: updated, exact: true })).toBeVisible()
  await page.getByRole('button', { name: `Удалить фото: ${updated}`, exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('heading', { name: updated, exact: true })).toHaveCount(0)
})

test('failed save keeps the form values and can be retried without creating duplicates', async ({
  page,
}) => {
  await login(page)
  let fail = true
  await page.route('**/api/v1/admin/players', async (route) => {
    if (route.request().method() === 'POST' && fail) await route.abort('failed')
    else await route.continue()
  })
  const title = `E2E Повтор ${run}`
  await page.getByRole('button', { name: /Добавить игрока/ }).click()
  const editor = page.getByRole('dialog', { name: 'Добавить игрока', exact: true })
  await editor.getByLabel('Имя и фамилия').fill(title)
  await editor.getByLabel('Команда', { exact: false }).selectOption({ label: 'Мужская команда' })
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(editor.getByRole('alert')).toContainText('Не удалось связаться с сервером')
  await expect(editor.getByLabel('Имя и фамилия')).toHaveValue(title)
  fail = false
  await saveNew(page, '/api/v1/admin/players')
  await expect(page.getByRole('button', { name: `Изменить: ${title}`, exact: true })).toHaveCount(1)
  await deleteRow(page, title)
})

test('an expired session hides admin data and restores the draft after signing in again', async ({
  page,
}) => {
  await login(page)
  let expire = true
  await page.route('**/api/v1/admin/players', async (route) => {
    if (route.request().method() === 'POST' && expire) {
      expire = false
      await route.fulfill({ status: 401, json: { code: 'INVALID_SESSION' } })
    } else await route.continue()
  })
  await page.getByRole('button', { name: /Добавить игрока/ }).click()
  await page.getByRole('dialog').getByLabel('Имя и фамилия').fill(`E2E Истекшая сессия ${run}`)
  await page
    .getByRole('dialog')
    .getByLabel('Команда', { exact: false })
    .selectOption({ label: 'Мужская команда' })
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByLabel('Логин', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Разделы управления', exact: true }),
  ).not.toBeVisible()
  await page.getByLabel('Логин', { exact: true }).fill(runtime!.username)
  await page.getByLabel('Пароль', { exact: true }).fill(runtime!.password)
  await page.getByRole('button', { name: /^Войти/ }).click()
  const restored = page.getByRole('dialog', { name: 'Добавить игрока', exact: true })
  await expect(restored).toBeVisible()
  await expect(restored.getByLabel('Имя и фамилия')).toHaveValue(`E2E Истекшая сессия ${run}`)
  await saveNew(page, '/api/v1/admin/players')
  await deleteRow(page, `E2E Истекшая сессия ${run}`)
})

test('retry after a committed create loses its response reuses the same record', async ({
  page,
}) => {
  await login(page)
  const name = `E2E Потерянный ответ ${run}`
  let lostId = ''
  let sentKey = ''
  let loseResponse = true
  await page.route('**/api/v1/admin/players', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    if (!loseResponse) {
      expect(route.request().headers()['idempotency-key']).toBe(sentKey)
      return route.fallback()
    }
    sentKey = route.request().headers()['idempotency-key'] || ''
    expect(sentKey).not.toBe('')
    const committed = await route.fetch()
    expect(committed.status()).toBe(201)
    lostId = (await committed.json()).data.id
    created.push(`/api/v1/admin/players/${lostId}`)
    loseResponse = false
    await route.abort('failed')
  })
  await page.getByRole('button', { name: /Добавить игрока/ }).click()
  const editor = page.getByRole('dialog')
  await editor.getByLabel('Имя и фамилия').fill(name)
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(editor.getByRole('alert')).toBeVisible()
  await expect(editor.getByLabel('Имя и фамилия')).toHaveValue(name)
  const recoveredId = await saveNew(page, '/api/v1/admin/players')
  expect(recoveredId).toBe(lostId)
  const readback = await page.request.get(`/api/v1/admin/players?q=${encodeURIComponent(name)}`)
  expect((await readback.json()).total).toBe(1)
})

test('a stale editor cannot overwrite another editor and keeps the unsaved draft', async ({
  page,
}) => {
  await login(page)
  const name = `E2E Конфликт ${run}`
  await page.getByRole('button', { name: /Добавить игрока/ }).click()
  await page.getByRole('dialog').getByLabel('Имя и фамилия').fill(name)
  const id = await saveNew(page, '/api/v1/admin/players')
  await page.getByRole('button', { name: `Изменить: ${name}`, exact: true }).click()
  const editor = page.getByRole('dialog')
  await editor.getByLabel('Имя и фамилия').fill(`${name} мой черновик`)
  const current = (await (await page.request.get(`/api/v1/admin/players/${id}`)).json()).data
  const csrf = (await (await page.request.get('/api/v1/auth/csrf')).json()).data.csrf_token
  const changed = await page.request.patch(`/api/v1/admin/players/${id}`, {
    headers: { 'X-CSRF-Token': csrf },
    data: { position: 'Изменено другим редактором', expected_updated_at: current.updated_at },
  })
  expect(changed.status()).toBe(200)
  const save = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/admin/players/${id}`) &&
      response.request().method() === 'PATCH',
  )
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click()
  expect((await save).status()).toBe(409)
  await expect(editor.getByRole('alert')).toContainText(/измен|редактор|верс/i)
  await expect(editor.getByLabel('Имя и фамилия')).toHaveValue(`${name} мой черновик`)
  const preserved = (await (await page.request.get(`/api/v1/admin/players/${id}`)).json()).data
  expect(preserved.full_name).toBe(name)
  expect(preserved.position).toBe('Изменено другим редактором')
  page.once('dialog', (dialog) => dialog.accept())
  await editor.getByRole('button', { name: 'Отмена', exact: true }).click()
})

test('trash recovery preserves a player and requires explicit publication', async ({ page }) => {
  await login(page)
  const name = `E2E Восстановление ${run}`
  await page.getByRole('button', { name: /Добавить игрока/ }).click()
  const creation = page.getByRole('dialog', { name: 'Добавить игрока', exact: true })
  await creation.getByLabel('Имя и фамилия').fill(name)
  await creation.getByLabel('Команда', { exact: false }).selectOption({ label: 'Мужская команда' })
  const id = await saveNew(page, '/api/v1/admin/players')
  expect((await page.request.get(`/api/v1/players/${id}`)).status()).toBe(200)
  await deleteRow(page, name)
  expect((await page.request.get(`/api/v1/players/${id}`)).status()).toBe(404)
  await page.getByRole('button', { name: 'Корзина', exact: true }).click()
  await page.getByLabel('Поиск в корзине', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'Найти', exact: true }).click()
  await page.getByRole('button', { name: `Восстановить: ${name}`, exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Восстановить запись?', exact: true })
  await confirmation.getByRole('button', { name: 'Восстановить', exact: true }).click()
  await expect(confirmation).not.toBeVisible()
  await expect(page.getByText(/Запись восстановлена и скрыта/)).toBeVisible()
  expect((await page.request.get(`/api/v1/players/${id}`)).status()).toBe(404)
  await page.getByRole('button', { name: 'Проверить восстановленную запись', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Редактировать запись', exact: true })
  await expect(editor.getByLabel('Имя и фамилия')).toHaveValue(name)
  await expect(editor.getByLabel('Показывать на сайте')).not.toBeChecked()
  await editor.getByLabel('Показывать на сайте').check()
  await saveEditor(page)
  expect((await page.request.get(`/api/v1/players/${id}`)).status()).toBe(200)
})

test('parallel match-logo uploads after reload share one CSRF request and both persist', async ({
  page,
}) => {
  await login(page)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible()
  await tab(page, 'Матчи')
  await page.getByRole('button', { name: /Добавить матч/ }).click()
  const editor = page.getByRole('dialog', { name: 'Добавить матч', exact: true })
  let csrfRequests = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/auth/csrf') csrfRequests++
  })
  const uploaded: string[] = []
  const responses: Promise<number>[] = []
  page.on('response', (response) => {
    if (
      new URL(response.url()).pathname !== '/api/v1/admin/media' ||
      response.request().method() !== 'POST'
    )
      return
    responses.push(
      (async () => {
        if (response.status() === 201) {
          const id = (await response.json()).data.id as string
          uploaded.push(id)
          if (!created.includes(`/api/v1/admin/media/${id}`))
            created.push(`/api/v1/admin/media/${id}`)
        }
        return response.status()
      })(),
    )
  })
  let releaseAway!: () => void
  let awayStarted!: () => void
  const holdAway = new Promise<void>((resolve) => {
    releaseAway = resolve
  })
  const awayRequest = new Promise<void>((resolve) => {
    awayStarted = resolve
  })
  await page.route('**/api/v1/admin/media', async (route) => {
    if (
      route.request().method() === 'POST' &&
      route.request().postDataBuffer()?.includes(Buffer.from('filename="logo-away.png"'))
    ) {
      awayStarted()
      await holdAway
    }
    await route.fallback()
  })
  const files = editor.locator('input[type="file"]')
  await expect(files).toHaveCount(2)
  await Promise.all([
    files.nth(0).setInputFiles(resolve('tests/e2e/fixtures/logo-home.png')),
    files.nth(1).setInputFiles(resolve('tests/e2e/fixtures/logo-away.png')),
  ])
  await awayRequest
  await expect.poll(() => responses.length).toBe(1)
  await Promise.all(responses)
  await expect(editor.locator('.image-picker__preview')).toHaveCount(1)
  await expect(editor.locator('button[type="submit"]')).toBeDisabled()
  releaseAway()
  await expect.poll(() => responses.length).toBe(2)
  expect(await Promise.all(responses)).toEqual([201, 201])
  expect(csrfRequests).toBe(1)
  expect(new Set(uploaded).size).toBe(2)
  await expect(editor.locator('.image-picker__preview')).toHaveCount(2)
  await expect(editor.getByRole('alert')).toHaveCount(0)
  page.once('dialog', (dialog) => dialog.accept())
  await editor.getByRole('button', { name: 'Отмена', exact: true }).click()
  await expect(editor).not.toBeVisible()
})
