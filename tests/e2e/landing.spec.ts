import { expect, test } from '@playwright/test'
import type { ContentBlock } from '../../src/shared/types'
import { clubCopy } from '../../src/shared/clubCopy'
import { assertNoHorizontalOverflow, openPage } from './helpers'

test('renamed archive chapters keep a working timeline destination without a date in their title', async ({
  page,
}) => {
  const chapter = {
    id: 'renamed-chapter',
    title: 'Наша история после переименования',
    subtitle: null,
    body: 'Сохранённый редактором текст главы.',
    sort_order: 1,
    link_url: null,
    link_label: null,
  }
  await page.route('**/api/v1/content/history', (route) =>
    route.fulfill({ json: { data: { items: [chapter] } } }),
  )
  await openPage(page, '/club')
  await expect(page.locator('.club-era h3')).toHaveText(chapter.title)
  await expect(page.locator('.club-era p')).toHaveText(chapter.body)
  await page.getByRole('button', { name: 'Читать эту главу' }).click()
  const destination = page.locator(`#chapter-${chapter.id}`)
  await expect(destination).toHaveAttribute('open', '')
  await expect(destination.locator('summary')).toBeFocused()
  await expect(destination.locator('.prose-text')).toHaveText(chapter.body)
})

test('club photo stories are published independently from official honours', async ({ page }) => {
  const title = 'Памятный клубный турнир'
  await page.route('**/api/v1/achievements?**', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: 'memory-e2e',
            title,
            achieved_at: '2026-10-25',
            team: { category: 'women' },
            media: { content_url: '/images/team-women.webp', alt_text: 'Команда после турнира' },
          },
        ],
        total: 1,
        total_pages: 1,
        page: 1,
        page_size: 24,
      },
    }),
  )
  await openPage(page, '/club')
  const memories = page.getByRole('region', { name: 'Памятные моменты', exact: true })
  await expect(memories.getByRole('heading', { name: title })).toBeVisible()
  await expect(memories.getByRole('img', { name: 'Команда после турнира' })).toHaveAttribute(
    'src',
    '/images/team-women.webp',
  )
  await expect(memories).toContainText('Команда девушек')
  await expect(memories.locator('time')).toHaveAttribute('datetime', '2026-10-25')
  await expect(page.locator('.club-honours')).not.toContainText(title)
  await assertNoHorizontalOverflow(page)
})

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
  const era = page.locator('.club-years button').first()
  await era.click()
  await expect(era).toHaveAttribute('aria-pressed', 'true')
  const targetTitle = (await page.locator('.club-era h3').textContent())?.trim()
  expect(items.some((item) => clubCopy(item.title) === targetTitle)).toBe(true)
  await page.getByRole('button', { name: 'Читать эту главу' }).click()
  const chapter = page.locator('.club-chapter[open]')
  await expect(chapter).toHaveCount(1)
  await expect(chapter.locator('summary')).toContainText(targetTitle!)
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
