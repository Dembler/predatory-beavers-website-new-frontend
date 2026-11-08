import { expect, test } from '@playwright/test'
import type { CalendarPage } from '../../src/shared/calendar'

test('real calendar API returns a bounded typed page without network mocks', async ({
  request,
}) => {
  const response = await request.get('/api/v1/calendar?season=all&page=1&page_size=24')
  expect(response.status()).toBe(200)
  const feed = (await response.json()) as CalendarPage
  expect(feed.page).toBe(1)
  expect(feed.page_size).toBe(24)
  expect(feed.items.length).toBeLessThanOrEqual(24)
  expect(feed.total).toBeGreaterThan(0)
  expect(Object.values(feed.counts).reduce((sum, count) => sum + count, 0)).toBe(feed.total)
  expect(Number.isFinite(Date.parse(feed.at))).toBe(true)
  expect(feed.seasons).toContain(feed.default_season)
  for (const entry of feed.items) {
    expect(['calendar', 'archive']).toContain(entry.kind)
    expect(['upcoming', 'changed', 'results', 'awaiting']).toContain(entry.section)
    expect(Boolean(entry.match)).not.toBe(Boolean(entry.result))
  }
  expect((await request.get('/api/v1/calendar?page_size=25')).status()).toBe(422)
  if (feed.total_pages > 1) {
    const next = await request.get(
      `/api/v1/calendar?${new URLSearchParams({
        season: 'all',
        page: '2',
        page_size: '24',
        at: feed.at,
      })}`,
    )
    expect(next.status()).toBe(200)
    const second = (await next.json()) as CalendarPage
    expect(second.page).toBe(2)
    expect(second.items.length).toBeLessThanOrEqual(24)
    expect(second.at).toBe(feed.at)
    const id = (item: CalendarPage['items'][number]) => item.match?.id ?? item.result?.id
    const ids = new Set(feed.items.map(id))
    expect(second.items.every((item) => !ids.has(id(item)))).toBe(true)
  }
})
