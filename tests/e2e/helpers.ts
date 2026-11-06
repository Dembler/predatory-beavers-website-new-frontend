import { expect, type Page } from '@playwright/test'

export async function openPage(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  const skip = page.getByRole('button', { name: 'Пропустить', exact: true })
  if (await skip.isVisible().catch(() => false)) await skip.click()
  await expect(page.locator('.intro-reveal')).toHaveCount(0)
  await expect(page.locator('main h1')).toBeVisible()
}

export async function assertNoHorizontalOverflow(page: Page) {
  const size = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }))
  expect(
    size.scroll,
    `Page overflows horizontally: ${size.scroll}px / ${size.width}px`,
  ).toBeLessThanOrEqual(size.width + 1)
}

export async function mockEmptyHistoricalResults(page: Page) {
  await page.route('**/api/v1/results-archive?**', (route) =>
    route.fulfill({
      json: { items: [], total: 0, page: 1, page_size: 100, total_pages: 1 },
    }),
  )
  await page.route('**/api/v1/results-archive/summary', (route) =>
    route.fulfill({
      json: { data: { coverage: [] } },
    }),
  )
}

export async function saveEditor(page: Page) {
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(dialog).not.toBeVisible()
}

export async function findAdminRecord(page: Page, name: string) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
  const edit = page.getByRole('button', { name: `Изменить: ${name}`, exact: true })
  const pagination = page.getByRole('navigation', { name: 'Страницы записей', exact: true })
  for (let attempts = 0; attempts < 100 && !(await edit.count()); attempts++) {
    await expect(pagination).toBeVisible()
    const previous = await pagination.locator('strong').textContent()
    const [current, total] = (previous || '').split('/').map(Number)
    if (!current || !total || current >= total) break
    const next = pagination.getByRole('button', { name: 'Далее →', exact: true })
    await expect(next).toBeEnabled()
    await next.click()
    await expect(pagination.locator('strong')).not.toHaveText(previous || '')
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
  }
  await expect(edit).toBeVisible()
  return edit
}

export async function deleteRow(page: Page, name: string) {
  await findAdminRecord(page, name)
  await page.getByRole('button', { name: `Удалить: ${name}`, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Удалить запись?', exact: true })
  await dialog.getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('button', { name: `Изменить: ${name}`, exact: true })).toHaveCount(0)
}
