import { expect, test } from '@playwright/test'
import { assertNoHorizontalOverflow } from './helpers'

const version = '2026-11-14T08:00:00Z'
const id = '11111111-1111-4111-8111-111111111111'
const photo = {
  id: '22222222-2222-4222-8222-222222222222',
  content_url: '/images/brand/club-emblem.webp',
  alt_text: 'Фото капитана',
}

test('captain editor saves multiple contacts and clears a portrait without changing other fields', async ({
  page,
}) => {
  let patch: Record<string, unknown> | undefined
  let captain = {
    id,
    section: 'captains',
    title: 'Тестовый капитан',
    body: 'Мужская команда',
    subtitle: null,
    link_url: null,
    link_label: null,
    active: true,
    sort_order: 0,
    photo_asset_id: photo.id,
    photo,
    contacts: [
      { label: 'Почта', value: 'captain@example.test', url: 'mailto:captain@example.test' },
    ],
    updated_at: version,
  }
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const ok = (data: unknown) => route.fulfill({ json: { data } })
    const list = (items: unknown[]) =>
      route.fulfill({
        json: { items, total: items.length, page: 1, page_size: 100, total_pages: 1 },
      })
    if (path === '/api/v1/auth/me') return ok({ id, username: 'Редактор', role: 'ADMIN' })
    if (path === '/api/v1/auth/csrf') return ok({ csrf_token: 'fixture' })
    if (path === `/api/v1/admin/content/${id}`) {
      if (route.request().method() === 'PATCH') {
        patch = route.request().postDataJSON()
        captain = { ...captain, ...patch }
      }
      return ok(captain)
    }
    if (path === '/api/v1/admin/content') return list([captain])
    if (path === '/api/v1/admin/media') return list([photo])
    return list([])
  })
  await page.goto('/admin?tab=captains')
  await page
    .getByRole('button', { name: 'Изменить: Тестовый капитан', exact: true })
    .first()
    .click()
  const editor = page.getByRole('dialog', { name: 'Редактировать запись' })
  await expect(editor.getByLabel('Контакт или подпись *', { exact: true })).toHaveValue(
    'captain@example.test',
  )
  await editor.getByRole('button', { name: 'Добавить контакт', exact: true }).click()
  const phone = editor.getByRole('group', { name: 'Контакт 2', exact: true })
  await phone.getByLabel('Название *', { exact: true }).fill('Телефон')
  await phone.getByLabel('Контакт или подпись *', { exact: true }).fill('+7 900 123-45-67')
  await phone.getByLabel('Ссылка', { exact: true }).fill('tel:+79001234567')
  await editor.getByRole('button', { name: 'Убрать', exact: true }).click()
  await assertNoHorizontalOverflow(page)
  await editor.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(editor).not.toBeVisible()
  expect(patch).toEqual({
    photo_asset_id: null,
    expected_updated_at: version,
    contacts: [
      { label: 'Почта', value: 'captain@example.test', url: 'mailto:captain@example.test' },
      { label: 'Телефон', value: '+7 900 123-45-67', url: 'tel:+79001234567' },
    ],
  })
})

test('public captain portraits and contacts render on mobile and desktop', async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/content/captains')
      return route.fulfill({
        json: {
          data: {
            items: [
              {
                id,
                title: 'Капитан клуба',
                body: 'Мужская команда',
                photo,
                contacts: [
                  { label: 'Телефон', value: '+7 900 123-45-67', url: 'tel:+79001234567' },
                  {
                    label: 'Почта',
                    value: 'captain@example.test',
                    url: 'mailto:captain@example.test',
                  },
                  {
                    label: 'Соцсеть',
                    value: 'Профиль капитана',
                    url: 'https://example.test/captain',
                  },
                ],
              },
            ],
          },
        },
      })
    if (path.startsWith('/api/v1/content/')) return route.fulfill({ json: { data: { items: [] } } })
    return route.fulfill({ json: { items: [], total: 0, total_pages: 0 } })
  })
  await page.goto('/contacts')
  const card = page.locator('.club-captain')
  const portrait = card.getByRole('img', { name: 'Фото капитана' })
  await expect(portrait).toBeVisible()
  await portrait.scrollIntoViewIfNeeded()
  await expect
    .poll(() => portrait.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0)
  const portraitBounds = await portrait.boundingBox()
  expect(portraitBounds).not.toBeNull()
  expect(portraitBounds!.width).toBeCloseTo(portraitBounds!.height, 0)
  await expect(card.getByRole('link', { name: '+7 900 123-45-67' })).toHaveAttribute(
    'href',
    'tel:+79001234567',
  )
  await expect(card.getByRole('link', { name: 'captain@example.test' })).toHaveAttribute(
    'href',
    'mailto:captain@example.test',
  )
  await expect(card.getByRole('link', { name: 'Профиль капитана' })).toHaveAttribute(
    'target',
    '_blank',
  )
  await assertNoHorizontalOverflow(page)
})
