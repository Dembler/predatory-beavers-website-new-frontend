import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { PublicResult } from '../../src/shared/results'
import { archiveItem, mockCalendar } from './calendar-fixtures'
import { assertNoHorizontalOverflow, openPage } from './helpers'

const rosatom: PublicResult = {
  id: 'rosatom-men',
  external_id: '20726-men',
  source: 'vsu',
  discipline: '3x3',
  team: 'men',
  season: '2026-2027',
  year: 2026,
  tournament: 'Кубок «Оранжевый атом»',
  event_date: '2026-10-03',
  date_precision: 'day',
  location: 'Воронеж',
  team_name: 'ВГУ',
  opponent_name: null,
  club_score: null,
  opponent_score: null,
  place: 3,
  status: 'participated',
  source_url: 'https://www.vsu.ru/ru/news/feed/2026/10/20726',
  source_label: 'ВГУ · итоги соревнований',
  emblem_url: null,
  opponent_emblem_url: null,
  notes: null,
}

test('season calendar shows Rosatom and ASB 3x3 places with source links and team filters', async ({
  page,
}) => {
  await mockCalendar(
    page,
    [
      rosatom,
      { ...rosatom, id: 'rosatom-women', external_id: '20726-women', team: 'women', place: 4 },
      {
        ...rosatom,
        id: 'asb-3x3',
        external_id: '20708-sukhumi-men',
        tournament: 'АСБ 3×3 · Сухум',
        event_date: '2026-09-27',
      },
    ].map((row) => archiveItem(row as PublicResult)),
    { defaultSeason: '2026-2027' },
  )
  await openPage(page, '/matches?season=2026-2027')
  await expect(page.getByRole('heading', { name: 'Результаты матчей и турниров' })).toBeVisible()
  const cards = page.locator('.tournament-result')
  await expect(cards).toHaveCount(3)
  await expect(cards.first()).toContainText('3 октября 2026')
  await expect(cards.first()).toContainText('3 место')
  await expect(cards.nth(1)).toContainText('Девушки')
  await expect(cards.nth(1)).toContainText('4 место')
  await expect(cards.nth(2)).toContainText('АСБ 3×3')
  const emblemImage = cards.first().locator('.team-emblem img')
  await emblemImage.evaluate((image) => (image as HTMLImageElement).decode())
  const emblem = await cards.first().locator('.team-emblem').boundingBox()
  const image = await emblemImage.boundingBox()
  expect(image!.width).toBeLessThanOrEqual(emblem!.width)
  expect(image!.height).toBeLessThanOrEqual(emblem!.height)
  await expect(cards.first().getByRole('link')).toHaveAttribute('href', rosatom.source_url!)
  await expect(cards.first().getByRole('link')).toHaveAttribute('target', '_blank')
  await expect(page.locator('.match-card__score')).toHaveCount(0)
  await expect(page.locator('main')).not.toContainText('0:0')
  await assertNoHorizontalOverflow(page)
  const accessibility = await new AxeBuilder({ page })
    .include('.tournament-result')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])
  await page.getByRole('combobox', { name: 'Команда', exact: true }).click()
  await page.getByRole('option', { name: 'Девушки', exact: true }).click()
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toContainText('4 место')
  await assertNoHorizontalOverflow(page)
})
