<script setup lang="ts">
import { computed } from 'vue'
import type { Match } from '@/shared/types'

const props = defineProps<{ match: Match; featured?: boolean; resultCard?: boolean }>()
const date = computed(() =>
  new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(
    new Date(props.match.starts_at),
  ),
)

type MatchOutcome = 'win' | 'loss' | 'draw'

const outcome = computed<MatchOutcome | null>(() => {
  if (props.match.home_score === null || props.match.away_score === null) return null

  const homeIsClub = props.match.home_team_name.toLocaleUpperCase('ru-RU').includes('ВГУ')
  const awayIsClub = props.match.away_team_name.toLocaleUpperCase('ru-RU').includes('ВГУ')
  if (!homeIsClub && !awayIsClub) return null

  const clubScore = homeIsClub ? props.match.home_score : props.match.away_score
  const opponentScore = homeIsClub ? props.match.away_score : props.match.home_score
  if (clubScore === opponentScore) return 'draw'
  return clubScore > opponentScore ? 'win' : 'loss'
})

const statusLabel = computed(() => {
  if (outcome.value === 'win') return 'Победа'
  if (outcome.value === 'loss') return 'Поражение'
  if (outcome.value === 'draw') return 'Ничья'
  return props.match.home_score !== null ? 'Завершён' : 'Скоро'
})

const resultLabel = computed(() => {
  if (outcome.value === 'win') return 'Победа ВГУ'
  if (outcome.value === 'loss') return 'Поражение ВГУ'
  if (outcome.value === 'draw') return 'Ничья'
  return statusLabel.value
})

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 3)
</script>

<template>
  <article
    class="match-card"
    :class="[
      {
        'match-card--featured': featured,
        'match-card--result': resultCard,
        'match-card--final': match.home_score !== null,
      },
      outcome && `match-card--${outcome}`,
    ]"
  >
    <template v-if="resultCard">
      <div class="match-card__head">
        <p class="match-card__tournament">
          <span aria-hidden="true">◉</span>{{ match.competition.name }}
        </p>
        <span class="match-card__status">Завершён</span>
      </div>
      <div class="match-card__versus">
        <div class="match-card__team">
          <div class="match-card__logo">
            <img
              v-if="match.home_logo"
              :src="match.home_logo.content_url"
              :alt="match.home_logo.alt_text || ''"
            />
            <span v-else>{{ initials(match.home_team_name) }}</span>
          </div>
          <strong>{{ match.home_team_name }}</strong>
        </div>
        <b class="match-card__vs">VS</b>
        <div class="match-card__team">
          <div class="match-card__logo">
            <img
              v-if="match.away_logo"
              :src="match.away_logo.content_url"
              :alt="match.away_logo.alt_text || ''"
            />
            <span v-else>{{ initials(match.away_team_name) }}</span>
          </div>
          <strong>{{ match.away_team_name }}</strong>
        </div>
      </div>
      <p class="match-card__score">
        <span>{{ match.home_score ?? '—' }}</span
        ><i>:</i><span>{{ match.away_score ?? '—' }}</span>
      </p>
      <div class="match-card__outcome" :class="outcome && `match-card__outcome--${outcome}`">
        <b>{{ outcome === 'loss' ? 'L' : outcome === 'draw' ? 'D' : 'W' }}</b>
        <span>{{ resultLabel }}</span>
      </div>
      <p class="match-card__meta">
        <span class="match-card__meta-item"><i aria-hidden="true">▦</i>{{ date }}</span>
        <span v-if="match.venue" class="match-card__meta-item"
          ><i aria-hidden="true">⌖</i>{{ match.venue.name }}</span
        >
      </p>
    </template>
    <template v-else>
      <div class="match-card__head">
        <p class="match-card__tournament">{{ match.competition.name }}</p>
        <span class="match-card__status" :class="outcome && `match-card__status--${outcome}`">
          {{ statusLabel }}
        </span>
      </div>
      <div class="match-card__teams">
        <strong>{{ match.home_team_name }}</strong
        ><span>VS</span><strong>{{ match.away_team_name }}</strong>
      </div>
      <p class="match-card__score">{{ match.home_score ?? '—' }} : {{ match.away_score ?? '—' }}</p>
      <p class="match-card__meta">
        {{ date }}<template v-if="match.venue"> · {{ match.venue.name }}</template>
      </p>
    </template>
  </article>
</template>
