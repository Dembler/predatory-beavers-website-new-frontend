import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { assertNoHorizontalOverflow } from './helpers'

const teamId = '11111111-1111-4111-8111-111111111111'
const playerId = '22222222-2222-4222-8222-222222222222'
const competitionId = '33333333-3333-4333-8333-333333333333'
const version = '2026-11-07T08:00:00.000000Z'
const image =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVIUAAAAASUVORK5CYII='
const asset = (index: number) => ({
  id: `44444444-4444-4444-8444-${String(index).padStart(12, '0')}`,
  content_url: image,
  alt_text: index === 25 ? 'Нужная фотография' : `Фотография ${index}`,
  width: 1,
  height: 1,
  size: 100,
  mime: 'image/webp',
  updated_at: version,
})

async function fixture(page: Page) {
  let referenceGate: Promise<void> | null = null
  let releaseGate = () => {}
  const state = {
    player: {
      id: playerId,
      full_name: 'Игрок для редактирования',
      team_id: teamId,
      position: 'Защитник',
      birth_date: null,
      fact: null,
      photo_asset_id: asset(1).id,
      photo: asset(1),
      sort_order: 0,
      active: true,
      updated_at: version,
    },
    patch: null as Record<string, unknown> | null,
    validation: false,
    impactFails: false,
    expire: false,
    loginUserId: teamId,
    holdReferences() {
      referenceGate = new Promise<void>((resolve) => {
        releaseGate = resolve
      })
    },
    releaseReferences() {
      releaseGate()
      referenceGate = null
    },
    searchQueries: [] as string[],
    trashRows: [] as {
      id: string
      title: string
      detail: string
      deleted_at: string
      updated_at: string
    }[],
    restoreError: false,
    restoreBodies: [] as Record<string, unknown>[],
    trashQueries: [] as string[],
  }
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    const ok = (data: unknown) => route.fulfill({ json: { data } })
    const list = (items: unknown[], total = items.length) =>
      route.fulfill({
        json: {
          items,
          total,
          page: Number(url.searchParams.get('page') || 1),
          page_size: Number(url.searchParams.get('page_size') || 15),
          total_pages: Math.ceil(total / Number(url.searchParams.get('page_size') || 15)),
        },
      })
    if (path === '/api/v1/auth/me') return ok({ id: teamId, username: 'Редактор', role: 'ADMIN' })
    if (path === '/api/v1/auth/login')
      return ok({
        user: { id: state.loginUserId, username: 'Другой редактор', role: 'ADMIN' },
        csrf_token: 'new-csrf',
      })
    if (path === '/api/v1/auth/csrf') return ok({ csrf_token: 'test-csrf' })
    if (path === '/api/v1/admin/trash/players' && method === 'GET') {
      const query = url.searchParams.get('q') || ''
      state.trashQueries.push(query)
      const rows = state.trashRows.filter((row) =>
        row.title.toLowerCase().includes(query.toLowerCase()),
      )
      const size = Number(url.searchParams.get('page_size') || 15)
      const current = Number(url.searchParams.get('page') || 1)
      return list(rows.slice((current - 1) * size, current * size), rows.length)
    }
    if (path === `/api/v1/admin/trash/players/${playerId}/restore` && method === 'POST') {
      state.restoreBodies.push(request.postDataJSON())
      if (state.restoreError)
        return route.fulfill({
          status: 409,
          json: {
            code: 'restore_dependency',
            detail: 'Сначала восстановите связанную фотографию в разделе «Фото».',
          },
        })
      state.trashRows = state.trashRows.filter((row) => row.id !== playerId)
      state.player.active = false
      return ok({ id: playerId, message: 'Запись восстановлена и скрыта с сайта.' })
    }
    if (path === '/api/v1/admin/teams' || path === '/api/v1/teams') {
      if (referenceGate) await referenceGate
      return list([
        { id: teamId, name: 'Мужская команда', category: 'men', slug: 'men', active: true },
      ])
    }
    if (path === '/api/v1/admin/venues') return list([])
    if (path === '/api/v1/admin/competitions')
      return list([
        {
          id: competitionId,
          name: 'Тестовый турнир',
          season: '2026-2027',
          active: true,
          updated_at: version,
        },
      ])
    if (path === `/api/v1/admin/competitions/${competitionId}/impact`) {
      if (state.impactFails)
        return route.fulfill({ status: 503, json: { code: 'service_unavailable' } })
      return ok({ matches_count: 10, published_matches_count: 8 })
    }
    if (path === '/api/v1/admin/media') {
      const query = url.searchParams.get('q') || ''
      if (url.searchParams.get('page_size') === '12') state.searchQueries.push(query)
      if (query) return list(query.includes('Нужная') ? [asset(25)] : [])
      const pageSize = Number(url.searchParams.get('page_size') || 15)
      const pageNumber = Number(url.searchParams.get('page') || 1)
      return list(
        Array.from({ length: Math.min(pageSize, 25 - (pageNumber - 1) * pageSize) }, (_, i) =>
          asset((pageNumber - 1) * pageSize + i + 1),
        ),
        25,
      )
    }
    if (path.startsWith('/api/v1/admin/media/')) return ok(asset(1))
    if (path === '/api/v1/admin/players' && method === 'GET') return list([state.player])
    if (path === `/api/v1/admin/players/${playerId}` && method === 'GET') return ok(state.player)
    if (path === `/api/v1/admin/players/${playerId}` && method === 'PATCH') {
      state.patch = request.postDataJSON()
      if (state.expire) return route.fulfill({ status: 401, json: { code: 'unauthorized' } })
      if (state.validation)
        return route.fulfill({
          status: 422,
          json: {
            code: 'validation_error',
            request_id: 'audit-request-42',
            errors: [{ location: 'body.full_name', message: 'Укажите полное имя.' }],
          },
        })
      state.player = { ...state.player, ...state.patch }
      return ok(state.player)
    }
    return list([])
  })
  await page.goto('/admin')
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible()
  return state
}

async function editPlayer(page: Page) {
  await page
    .getByRole('button', { name: 'Изменить: Игрок для редактирования', exact: true })
    .click()
  return page.getByRole('dialog', { name: 'Редактировать запись', exact: true })
}

test('editing one field preserves unrelated data in the PATCH request', async ({ page }) => {
  const state = await fixture(page)
  const editor = await editPlayer(page)
  await editor.getByLabel('Имя и фамилия').fill('Новое имя игрока')
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(editor).not.toBeVisible()
  expect(state.patch).toEqual({ full_name: 'Новое имя игрока', expected_updated_at: version })
})

test('server field errors identify and focus the field and keep the draft', async ({ page }) => {
  const state = await fixture(page)
  state.validation = true
  const editor = await editPlayer(page)
  await editor.getByLabel('Имя и фамилия').fill('Несохранённое имя')
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click()
  const field = editor.getByLabel('Имя и фамилия')
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(field).toBeFocused()
  await expect(field).toHaveValue('Несохранённое имя')
  await expect(editor.getByText('Укажите полное имя.', { exact: true })).toBeVisible()
  await expect(editor.getByText('Код обращения: audit-request-42')).toBeVisible()
})

test('photo picker searches the server and selects a thumbnail outside its first page', async ({
  page,
}) => {
  const state = await fixture(page)
  const editor = await editPlayer(page)
  await editor.getByLabel('Фотография', { exact: true }).click()
  await expect(editor.locator('.image-picker__asset')).toHaveCount(12)
  await editor.getByLabel('Поиск фотографии', { exact: true }).fill('Нужная')
  await editor.getByRole('button', { name: 'Нужная фотография', exact: true }).click()
  await expect(editor.locator('.image-picker__selection')).toContainText('Нужная фотография')
  expect(state.searchQueries).toContain('Нужная')
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(editor).not.toBeVisible()
  expect(state.patch).toEqual({ photo_asset_id: asset(25).id, expected_updated_at: version })
})

test('delete remains disabled when tournament impact cannot be checked', async ({ page }) => {
  const state = await fixture(page)
  state.impactFails = true
  await page.goto('/admin?tab=competitions')
  await page.getByRole('button', { name: 'Удалить: Тестовый турнир', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Удалить запись?', exact: true })
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Удалить', exact: true })).toBeDisabled()
})

test('another account cannot see the previous editor draft while references are loading', async ({
  page,
}) => {
  const state = await fixture(page)
  const editor = await editPlayer(page)
  await editor.getByLabel('Имя и фамилия').fill('Личный черновик первого редактора')
  state.expire = true
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByLabel('Логин', { exact: true })).toBeVisible()
  state.holdReferences()
  state.loginUserId = competitionId
  await page.getByLabel('Логин', { exact: true }).fill('another-editor')
  await page.getByLabel('Пароль', { exact: true }).fill('mock-password')
  await page.getByRole('button', { name: /^Войти/ }).click()
  try {
    await expect(page.getByText('Другой редактор', { exact: true })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('#field-full_name')).not.toBeVisible()
  } finally {
    state.releaseReferences()
  }
  await expect(page.getByRole('button', { name: /Добавить игрока/ })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('trash restores a record as hidden and opens it for explicit review', async ({
  page,
}, testInfo) => {
  const state = await fixture(page)
  state.trashRows = [
    {
      id: playerId,
      title: state.player.full_name,
      detail: 'Защитник',
      deleted_at: version,
      updated_at: version,
    },
  ]
  await page.getByRole('button', { name: 'Корзина', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Изменить:/ })).toHaveCount(0)
  await expect(page.locator('.trash-card')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await page.screenshot({
    path: testInfo.outputPath('trash-list.png'),
    fullPage: true,
  })
  const listAccessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    listAccessibility.violations.filter((item) =>
      ['serious', 'critical'].includes(item.impact || ''),
    ),
  ).toEqual([])
  await page
    .getByRole('button', { name: `Восстановить: ${state.player.full_name}`, exact: true })
    .click()
  const confirmation = page.getByRole('dialog', { name: 'Восстановить запись?', exact: true })
  await expect(confirmation).toContainText('останется скрытой с сайта')
  await page.screenshot({
    path: testInfo.outputPath('trash-confirmation.png'),
    fullPage: true,
  })
  await page.screenshot({
    path: testInfo.outputPath('trash-confirmation-viewport.png'),
  })
  const dialogAccessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    dialogAccessibility.violations.filter((item) =>
      ['serious', 'critical'].includes(item.impact || ''),
    ),
  ).toEqual([])
  await confirmation.getByRole('button', { name: 'Восстановить', exact: true }).click()
  await expect(page.getByText('Корзина пуста.', { exact: true })).toBeVisible()
  expect(state.restoreBodies).toEqual([{ expected_updated_at: version }])
  await page.getByRole('button', { name: 'Проверить восстановленную запись', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Редактировать запись', exact: true })
  await expect(editor.getByLabel('Имя и фамилия')).toHaveValue(state.player.full_name)
  await expect(editor.getByLabel('Показывать на сайте')).not.toBeChecked()
  await page.screenshot({
    path: testInfo.outputPath('trash-review.png'),
    fullPage: true,
  })
})

test('trash keeps a failed restoration open and explains the missing dependency', async ({
  page,
}) => {
  const state = await fixture(page)
  state.trashRows = [
    {
      id: playerId,
      title: state.player.full_name,
      detail: 'Защитник',
      deleted_at: version,
      updated_at: version,
    },
  ]
  state.restoreError = true
  await page.getByRole('button', { name: 'Корзина', exact: true }).click()
  await page.getByRole('button', { name: /^Восстановить:/ }).click()
  const confirmation = page.getByRole('dialog', { name: 'Восстановить запись?', exact: true })
  await confirmation.getByRole('button', { name: 'Восстановить', exact: true }).click()
  await expect(confirmation.getByRole('alert')).toContainText(
    'Сначала восстановите связанную фотографию',
  )
  await expect(confirmation).toBeVisible()
  expect(state.trashRows).toHaveLength(1)
  state.restoreError = false
  await confirmation.getByRole('button', { name: 'Восстановить', exact: true }).click()
  await expect(confirmation).not.toBeVisible()
  expect(state.restoreBodies).toHaveLength(2)
})

test('trash searches all pages on the server and resets pagination for the query', async ({
  page,
}) => {
  const state = await fixture(page)
  state.trashRows = Array.from({ length: 17 }, (_, index) => ({
    id: `trash-${index}`,
    title: `Запись ${index + 1}`,
    detail: 'Архив',
    deleted_at: version,
    updated_at: version,
  }))
  await page.getByRole('button', { name: 'Корзина', exact: true }).click()
  await expect(page.locator('.trash-card')).toHaveCount(15)
  await page
    .getByRole('navigation', { name: 'Страницы корзины' })
    .getByRole('button', { name: 'Далее →', exact: true })
    .click()
  await expect(page.locator('.trash-card')).toHaveCount(2)
  await page.getByLabel('Поиск в корзине', { exact: true }).fill('Запись 17')
  await page.getByRole('button', { name: 'Найти', exact: true }).click()
  await expect(page.locator('.trash-card')).toHaveCount(1)
  await expect(page.locator('.trash-card')).toContainText('Запись 17')
  expect(state.trashQueries).toContain('Запись 17')
  await expect(page.getByRole('navigation', { name: 'Страницы корзины' })).not.toBeVisible()
})
