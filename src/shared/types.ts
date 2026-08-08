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
  content_url: string
  alt_text: string | null
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
  full_name: string
  position: string | null
  age_text: string | null
  fact: string | null
  photo: Media | null
  team: Team
}
export interface Competition {
  name: string
  season: string
}
export interface Venue {
  name: string
  address: string
  description: string | null
}
export interface Match {
  id: string
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
}
export interface StandingRow {
  position: number
  team_name: string
  played: number
  wins: number
  losses: number
  draws: number
  table_points: number
}
export interface Standings {
  competition: Competition
  rows: StandingRow[]
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
