<script setup lang="ts">
import { computed } from 'vue'
import type { Match } from '@/shared/types'

const props = defineProps<{ match: Match; featured?: boolean }>()
const date = computed(() =>
  new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(
    new Date(props.match.starts_at),
  ),
)
</script>

<template>
  <article class="match-card" :class="{ 'match-card--featured': featured, 'match-card--final': match.home_score !== null }">
    <div class="match-card__head">
      <p class="match-card__tournament">{{ match.competition.name }}</p>
      <span>{{ match.home_score !== null ? 'Завершён' : 'Скоро' }}</span>
    </div>
    <div class="match-card__teams">
      <strong>{{ match.home_team_name }}</strong
      ><span>VS</span><strong>{{ match.away_team_name }}</strong>
    </div>
    <p class="match-card__score">{{ match.home_score ?? '—' }} : {{ match.away_score ?? '—' }}</p>
    <p class="match-card__meta">
      {{ date }}<template v-if="match.venue"> · {{ match.venue.name }}</template>
    </p>
  </article>
</template>
