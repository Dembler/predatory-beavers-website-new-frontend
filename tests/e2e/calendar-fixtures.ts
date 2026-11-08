import { expect, type Page } from '@playwright/test'
import type { CalendarEntry, CalendarPage, CalendarSection } from '../../src/shared/calendar'
import type { PublicResult } from '../../src/shared/results'
import type { Match } from '../../src/shared/types'

// Fixtures state the server's classification explicitly. Deduplication, season
// inference and default selection are covered by backend integration tests.
export interface CalendarFixture {
  entry: CalendarEntry
  team: string | null
  discipline: string
  status: string
  seasons: string[]
}

export function calendarItem(
  match: Match,
  options: { section?: CalendarSection; season?: string } = {},
): CalendarFixture {
  const season = options.season ?? match.competition.season
  return {
    entry: {
      kind: 'calendar',
      section: options.section ?? 'results',
      season,
      match: match as CalendarEntry['match'],
      result: null,
    },
    team: match.team.category,
    discipline: '5x5',
    status: match.status,
    seasons: [season],
  }
}

export function archiveItem(
  result: PublicResult,
  options: { section?: CalendarSection; seasons?: string[] } = {},
): CalendarFixture {
  const seasons = options.seasons ?? [result.season]
  return {
    entry: {
      kind: 'archive',
      section: options.section ?? 'results',
      season: seasons.length === 1 ? seasons[0]! : 'unknown',
      match: null,
      result,
    },
    team: result.team,
    discipline: result.discipline,
    status: result.status,
    seasons,
  }
}

export async function mockCalendar(
  page: Page,
  source: CalendarFixture[] | ((url: URL) => CalendarFixture[]),
  options: {
    defaultSeason?: string | ((url: URL) => string)
    at?: string
  } = {},
) {
  const requested: URL[] = []
  const sections: CalendarSection[] = ['upcoming', 'changed', 'results', 'awaiting']
  await page.route('**/api/v1/calendar?**', (route) => {
    const url = new URL(route.request().url())
    requested.push(url)
    const query = url.searchParams
    const size = Number(query.get('page_size') || 24)
    expect(size).toBeGreaterThan(0)
    expect(size).toBeLessThanOrEqual(24)
    const fixtures = (typeof source === 'function' ? source(url) : source).filter(
      (item) =>
        (!query.has('team') || item.team === query.get('team')) &&
        (!query.has('discipline') || item.discipline === query.get('discipline')),
    )
    const seasons = [...new Set(fixtures.flatMap((item) => item.seasons))].sort().reverse()
    const defaultSeason =
      typeof options.defaultSeason === 'function'
        ? options.defaultSeason(url)
        : (options.defaultSeason ?? seasons[0] ?? 'all')
    const selectedSeason = query.get('season') ?? defaultSeason
    const rows = fixtures
      .filter(
        (item) =>
          (!query.has('status') || item.status === query.get('status')) &&
          (selectedSeason === 'all' || item.seasons.includes(selectedSeason)),
      )
      .sort((a, b) => sections.indexOf(a.entry.section) - sections.indexOf(b.entry.section))
    const counts = { upcoming: 0, changed: 0, results: 0, awaiting: 0 }
    for (const row of rows) counts[row.entry.section]++
    const totalPages = Math.ceil(rows.length / size)
    const current = Math.min(Math.max(1, Number(query.get('page') || 1)), totalPages || 1)
    const response: CalendarPage = {
      items: rows.slice((current - 1) * size, current * size).map(({ entry, seasons }) => ({
        ...entry,
        season: seasons.length > 1 && selectedSeason !== 'all' ? selectedSeason : entry.season,
      })),
      total: rows.length,
      page: current,
      page_size: size,
      total_pages: totalPages,
      counts,
      seasons,
      default_season: defaultSeason,
      selected_season: selectedSeason,
      at: query.get('at') ?? options.at ?? '2026-11-07T12:00:00Z',
    }
    return route.fulfill({ json: response })
  })
  return requested
}
