export interface RosterPlayer {
  id: string
  external_player_id: string
  full_name: string
  photo_url: string | null
  games_played: number | null
  points_per_game: number | null
  assists_per_game: number | null
  rebounds_per_game: number | null
  minutes_per_game: number | null
  statistics_season: string | null
  statistics_source_url: string | null
}
export interface RosterContext {
  team: 'men' | 'women'
  current_season: string
  season: string | null
  is_current_season: boolean
  status: 'published' | 'not_published'
  notice: string | null
  source_url: string | null
  stats_source_url: string | null
  fetched_at: string | null
}
export interface AsbRoster extends RosterContext {
  players: RosterPlayer[]
}
export interface AsbPlayerProfile extends RosterContext {
  player: RosterPlayer
}
export function average(value: number | null | undefined): string {
  return value == null
    ? '—'
    : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value)
}
export function playingTime(value: number | null | undefined): string {
  if (value == null) return '—'
  const seconds = Math.round(value * 60)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
export function initials(name: string): string {
  return name
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
}
export function seasonLabel(value: string | null | undefined): string {
  return value?.replace('-', ' / ') ?? '—'
}
