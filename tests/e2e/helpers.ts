import { expect, type Page } from '@playwright/test'

export async function openPage(page: Page, path: string) {
  await page.goto(path)
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

export async function saveEditor(page: Page) {
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(dialog).not.toBeVisible()
}

export async function deleteRow(page: Page, name: string) {
  await page.getByRole('button', { name: `Удалить: ${name}`, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Удалить запись?', exact: true })
  await dialog.getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('button', { name: `Изменить: ${name}`, exact: true })).toHaveCount(0)
}
