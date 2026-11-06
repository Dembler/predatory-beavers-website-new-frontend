export interface PublicResult {
  id: string
  external_id: string
  discipline: '5x5' | '3x3' | 'phygital'
  team: 'men' | 'women'
  season: string
  year: number
  tournament: string
  event_date: string | null
  date_precision: string
  location: string | null
  team_name: string
  opponent_name: string | null
  club_score: number | null
  opponent_score: number | null
  place: number | null
  status: string
  source: string
  source_url: string | null
  source_label: string
  emblem_url: string | null
  opponent_emblem_url: string | null
  notes: string | null
}

export interface ResultCoverage {
  provider: string
  team: string
  season: string
  records: number
  status: string
  note: string
  source_url: string | null
}

export interface ResultSummary {
  data: { coverage: ResultCoverage[] }
}

// A calendar year is not an explicit season. Keep source dates unchanged and
// derive the browsing season only when the source contains a real month.
export function explicitSeason(value: string | null | undefined): string | undefined {
  const parts = value?.match(/^(\d{4})\s*[-/]\s*(\d{4})$/u)
  if (!parts || Number(parts[2]) !== Number(parts[1]) + 1) return undefined
  return `${parts[1]}-${parts[2]}`
}

export function seasonAtDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  let year: number
  let month: number
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    year = Number(value.slice(0, 4))
    month = Number(value.slice(5, 7))
  } else {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return undefined
    const parts = new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: 'numeric',
      timeZone: 'Europe/Moscow',
    }).formatToParts(date)
    year = Number(parts.find((part) => part.type === 'year')?.value)
    month = Number(parts.find((part) => part.type === 'month')?.value)
  }
  if (!year || month < 1 || month > 12) return undefined
  const start = month >= 7 ? year : year - 1
  return `${start}-${start + 1}`
}

export function resultSeasons(result: PublicResult): string[] {
  const declared = explicitSeason(result.season)
  if (declared) return [declared]
  const dated = result.date_precision !== 'year' ? seasonAtDate(result.event_date) : undefined
  if (dated) return [dated]
  // An undated calendar year overlaps two seasons. Include the evidence in both
  // possible filters, without claiming a month or duplicating the all-seasons list.
  return [`${result.year - 1}-${result.year}`, `${result.year}-${result.year + 1}`]
}

export function publicSourceUrl(value: string | null) {
  return value && /^https?:\/\//u.test(value) ? value : undefined
}

export function resultDate(result: PublicResult) {
  if (!result.event_date || result.date_precision === 'year') return `${result.year} год`
  const date = new Date(result.event_date)
  if (Number.isNaN(date.getTime())) return result.event_date
  return new Intl.DateTimeFormat('ru-RU', {
    ...(result.date_precision === 'month' ? {} : { day: 'numeric' as const }),
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Moscow',
  }).format(date)
}
