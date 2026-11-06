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
export interface Media {
  id: string
  content_url: string
  alt_text: string | null
  mime: string
  size: number
  width: number | null
  height: number | null
}
export interface Team {
  id: string
  name: string
  slug: string
  category: 'men' | 'women'
  logo: Media | null
}
export interface Player {
  id: string
  team_id: string
  full_name: string
  birth_date: string | null
  position: string | null
  age_text: string | null
  fact: string | null
  photo: Media | null
  team: Team
  photo_asset_id: string | null
  sort_order: number
  active: boolean
}
export interface Competition {
  id: string
  name: string
  season: string
  active: boolean
}
export interface Venue {
  id: string
  name: string
  address: string
  latitude?: number | null
  longitude?: number | null
  description: string | null
}
export interface Match {
  /** Public archive labels preserve a missing day or tip-off time. */
  display_date?: string
  date_precision?: 'day' | 'month' | 'year'
  id: string
  source?: string
  external_id?: string | null
  team_id: string
  team: Team
  competition_id: string
  venue_id: string | null
  club_side: 'home' | 'away'
  competition: Competition
  venue: Venue | null
  starts_at: string
  home_team_name: string
  away_team_name: string
  home_score: number | null
  away_score: number | null
  status: string
  home_logo: Media | null
  away_logo: Media | null
  home_logo_url?: string | null
  away_logo_url?: string | null
  home_logo_asset_id: string | null
  away_logo_asset_id: string | null
  notes: string | null
  featured: boolean
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
export interface Achievement {
  id: string
  title: string
  achieved_at: string | null
  media: Media
  team: Team
}
export interface HomeData {
  next_match: Match | null
  recent_results: Match[]
  teams: Team[]
}

export interface ContentBlock {
  id: string
  section: 'history' | 'rules' | 'contact_channels' | 'captains' | 'player_roles' | 'viewing_tips'
  title: string
  body: string
  subtitle?: string | null
  link_url?: string | null
  link_label?: string | null
  sort_order: number
  active: boolean
}

export interface User {
  id: string
  username: string
  role: 'USER' | 'EDITOR' | 'ADMIN'
}
