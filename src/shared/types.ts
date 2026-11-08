import type { components } from './api/schema'

export interface ApiResponse<T> {
  data: T | null
}
export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}
export type Media = components['schemas']['MediaAssetRead']
export type Team = components['schemas']['TeamRead']
export type Player = components['schemas']['PublicPlayerRead']
export type Competition = components['schemas']['CompetitionRead']
export type Venue = components['schemas']['VenueRead']
export type Match = components['schemas']['MatchRead'] & {
  /** Archive records may omit a precise day or tip-off time. */
  display_date?: string
  date_precision?: 'day' | 'month' | 'year'
}
/** A match card also displays archive records that have no editable database metadata. */
export type MatchCardData = Omit<
  Match,
  'created_at' | 'updated_at' | 'team' | 'competition' | 'venue' | 'status' | 'active'
> & {
  /** Imported archives can also contain unpublished or unrecognized statuses. */
  status: string
  team: Pick<Team, 'id' | 'name' | 'slug' | 'category'> & { logo?: Media | null }
  competition: Pick<Competition, 'id' | 'name' | 'season' | 'active'>
  venue: Pick<Venue, 'id' | 'name' | 'address' | 'description'> | null
}
export interface StandingRow {
  position: number
  team_name: string
  external_team_id?: string | null
  team_logo_url?: string | null
  played: number
  wins: number
  losses: number
  draws: number
  table_points: number
  points_for: number
  points_against: number
  points_difference: number
}
export interface StandingsGame {
  external_id: string
  round_name: string
  round?: number | null
  tree?: number | null
  sort_order: number
  starts_at: string | null
  date_precision: 'day' | 'time'
  home_team_name: string
  home_team_id?: string | null
  home_team_logo_url?: string | null
  away_team_name: string
  away_team_id?: string | null
  away_team_logo_url?: string | null
  home_score: number | null
  away_score: number | null
  status: 'finished' | 'scheduled' | 'unpublished'
  source_url: string
}
export interface Standings {
  competition: Competition
  rows: StandingRow[]
  source_url?: string | null
  tournament_id?: string | null
  tournament_name?: string | null
  stage_name?: string | null
  stage_kind?: string
  games?: StandingsGame[]
}
export type Achievement = components['schemas']['AchievementRead']
export type HomeData = components['schemas']['HomeData']

export type ContentBlock = components['schemas']['ContentRead']

export type User = components['schemas']['UserRead']
