import { expect, test } from '@playwright/test'
import type { ContentBlock } from '../../src/shared/types'
import { clubCopy } from '../../src/shared/clubCopy'
import { assertNoHorizontalOverflow, openPage } from './helpers'

test('club timeline opens the matching historical chapter and preserves the complete source history', async ({
  page,
}) => {
  await openPage(page, '/club')
  const response = await page.request.get('/api/v1/content/history')
  const items: ContentBlock[] = (await response.json()).data.items
  await expect(page.locator('.club-chapter')).toHaveCount(items.length)
  await expect(page.locator('.club-archive[open]')).toHaveCount(0)
  await expect(page.locator('.club-chapter[open]')).toHaveCount(0)
  for (const item of items) {
    const chapter = page.locator(`#chapter-${item.id}`)
    const text = (await chapter.locator('.club-chapter__body .prose-text').allTextContents()).join(
      ' ',
    )
    expect(text.replace(/\s+/gu, ' ')).toContain(clubCopy(item.body).replace(/\s+/gu, ' '))
    if (item.link_url)
      await expect(chapter.locator('.club-source')).toHaveAttribute('href', item.link_url)
  }
  const era = page.locator('.club-years button').filter({ hasText: '2024' })
  await era.click()
  await expect(era).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.club-era h3')).toContainText('Краснодар')
  await page.getByRole('button', { name: 'Читать эту главу' }).click()
  const chapter = page.locator('.club-chapter[open]')
  await expect(chapter).toHaveCount(1)
  await expect(chapter.locator('summary')).toBeFocused()
  await expect(chapter.locator('.club-chapter__body')).toBeVisible()
  const box = await chapter.boundingBox()
  const header = await page.locator('.site-header').boundingBox()
  expect(box && header && box.y >= header.y + header.height + 20).toBe(true)
  await assertNoHorizontalOverflow(page)
})

test('court positions support touch and keyboard selection while rules and tips reveal details on request', async ({
  page,
}) => {
  await openPage(page, '/rules')
  const markers = page.locator('.role-marker')
  await expect(markers).toHaveCount(5)
  await markers.first().focus()
  await page.keyboard.press('Tab')
  await expect(markers.nth(1)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(markers.nth(1)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.role-copy h3')).toHaveText('Атакующий защитник')
  await markers.last().click()
  await expect(page.locator('.role-copy h3')).toHaveText('Центровой')
  await expect(page.locator('.role-detail p')).not.toBeVisible()
  await page.locator('.role-detail summary').click()
  await expect(page.locator('.role-detail p')).toBeVisible()
  const targetSize = await markers.evaluateAll((elements) =>
    Math.min(
      ...elements.map((element) =>
        Math.min(element.getBoundingClientRect().width, element.getBoundingClientRect().height),
      ),
    ),
  )
  expect(targetSize).toBeGreaterThanOrEqual(44)
  await expect(page.locator('.rules-library')).not.toHaveAttribute('open')
  await page.locator('.rules-library > summary').click()
  const rule = page.locator('.rule-accordion').first()
  await expect(rule.locator('p')).not.toBeVisible()
  await rule.locator('summary').click()
  await expect(rule.locator('p')).toBeVisible()
  const tip = page.locator('.viewing-tips details').first()
  await expect(tip.locator('p')).not.toBeVisible()
  await tip.locator('summary').click()
  await expect(tip.locator('p')).toBeVisible()
  await assertNoHorizontalOverflow(page)
})
