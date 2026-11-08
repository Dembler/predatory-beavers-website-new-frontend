import type { components } from './api/schema'

export type PublicResult = components['schemas']['ArchiveResultRead']

const resultDateFormatters = {
  day: new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Moscow',
  }),
  month: new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Moscow',
  }),
}

// A calendar year is not an explicit season. Keep source dates unchanged and
// derive the browsing season only when the source contains a real month.
export function explicitSeason(value: string | null | undefined): string | undefined {
  const parts = value?.match(/^(\d{4})\s*[-/]\s*(\d{4})$/u)
  if (!parts || Number(parts[2]) !== Number(parts[1]) + 1) return undefined
  return `${parts[1]}-${parts[2]}`
}

export function resultDate(result: PublicResult) {
  if (!result.event_date || result.date_precision === 'year') return `${result.year} год`
  const date = new Date(result.event_date)
  if (Number.isNaN(date.getTime())) return result.event_date
  return resultDateFormatters[result.date_precision === 'month' ? 'month' : 'day'].format(date)
}
