<script setup lang="ts">
import { computed } from 'vue'
import MatchCard from '@/components/MatchCard.vue'
import { resultDate, type PublicResult } from '@/shared/results'
import type { Match } from '@/shared/types'

const props = defineProps<{ result: PublicResult }>()
const match = computed<Match>(() => {
  const row = props.result
  return {
    id: row.id,
    source: row.source,
    external_id: row.external_id,
    team_id: row.team,
    team: { id: row.team, name: row.team_name, slug: row.team, category: row.team, logo: null },
    competition_id: `archive-${row.tournament}`,
    competition: {
      id: `archive-${row.tournament}`,
      name: row.tournament,
      season: row.season,
      active: false,
    },
    venue_id: null,
    venue: row.location
      ? { id: `archive-${row.location}`, name: row.location, address: '', description: null }
      : null,
    club_side: 'home',
    starts_at: row.event_date ?? '',
    display_date: resultDate(row),
    date_precision:
      row.date_precision === 'month' || row.date_precision === 'year' ? row.date_precision : 'day',
    home_team_name: row.team_name,
    away_team_name: row.opponent_name!,
    home_score: row.club_score,
    away_score: row.opponent_score,
    status: row.status,
    home_logo: null,
    away_logo: null,
    home_logo_url: row.emblem_url,
    away_logo_url: row.opponent_emblem_url,
    home_logo_asset_id: null,
    away_logo_asset_id: null,
    notes: row.tournament,
    featured: false,
  }
})
</script>

<template>
  <MatchCard v-if="result.opponent_name" :match="match" variant="row" />
</template>
