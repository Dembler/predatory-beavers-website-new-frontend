import { expect, test } from '@playwright/test'
import { clubCopy } from '../../src/shared/clubCopy'
import { assertNoHorizontalOverflow, openPage } from './helpers'

interface Tournament {
  key: string
  name: string
  description: string
  logo_url: string | null
  logo_alt: string
  results: { id: string; tournament: string; team: string; place: number | null }[]
}

test('club tournament stories expose every reviewed result with the correct logo and description', async ({
  page,
}) => {
  const response = await page.request.get('/api/v1/results-archive/tournaments')
  expect(response.ok()).toBe(true)
  const { items, result_count }: { items: Tournament[]; result_count: number } = (
    await response.json()
  ).data
  expect(items.length).toBeGreaterThan(0)
  expect(items.reduce((total, item) => total + item.results.length, 0)).toBe(result_count)
  await openPage(page, '/club')
  const section = page.locator('#club-tournaments')
  await expect(section.locator('.tournament-story')).toHaveCount(Math.min(items.length, 6))
  if (items.length > 6) await section.locator('.tournaments-more').click()
  await expect(section.locator('.tournament-story')).toHaveCount(items.length)
  let displayedResults = 0
  for (const [index, item] of items.entries()) {
    const article = section.locator('.tournament-story').nth(index)
    await expect(article.locator('h3')).toHaveText(clubCopy(item.name))
    await expect(article.locator('.tournament-story__description')).toHaveText(
      clubCopy(item.description),
    )
    expect(item.logo_url, `${item.name} has reviewed visual identity`).not.toBeNull()
    const logo = article.locator('.tournament-story__logo img')
    await logo.scrollIntoViewIfNeeded()
    await expect(logo).toHaveAttribute('src', item.logo_url!)
    await expect(logo).toHaveAttribute('alt', item.logo_alt)
    await expect
      .poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0)
    const neighbour = section.locator('.tournament-story').nth(index === 0 ? 1 : 0)
    const neighbourHeight = items.length > 1 ? (await neighbour.boundingBox())?.height : undefined
    await article.locator('summary').click()
    if (neighbourHeight !== undefined)
      expect((await neighbour.boundingBox())!.height).toBeCloseTo(neighbourHeight, 0)
    await expect(article.locator('li')).toHaveCount(item.results.length)
    for (const [resultIndex, result] of item.results.entries()) {
      const row = article.locator('li').nth(resultIndex)
      await expect(row.locator('h4')).toHaveText(clubCopy(result.tournament))
      await expect(row.locator('.tournament-story__place')).toHaveAttribute(
        'aria-label',
        result.place ? `${result.place} место` : 'Участие',
      )
    }
    displayedResults += await article.locator('li').count()
  }
  expect(displayedResults).toBe(result_count)
  await assertNoHorizontalOverflow(page)
})

test('club tournament team filter preserves every result for the selected team', async ({
  page,
}) => {
  const response = await page.request.get('/api/v1/results-archive/tournaments')
  const items: Tournament[] = (await response.json()).data.items
  const women = items.flatMap((item) => item.results).filter((result) => result.team === 'women')
  await openPage(page, '/club')
  const section = page.locator('#club-tournaments')
  await expect(section.locator('.tournament-story').first()).toBeVisible()
  await section.getByRole('button', { name: 'Девушки', exact: true }).click()
  const more = section.locator('.tournaments-more')
  if (await more.isVisible()) await more.click()
  for (const summary of await section.locator('summary').all()) await summary.click()
  await expect(section.locator('li')).toHaveCount(women.length)
  await expect(
    section.locator('.tournament-story__meta').filter({ hasText: 'Мужчины' }),
  ).toHaveCount(0)
  await assertNoHorizontalOverflow(page)
})
