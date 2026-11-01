<script setup lang="ts">
import { computed } from 'vue'
import TeamEmblem from '@/components/TeamEmblem.vue'
import type { Match } from '@/shared/types'

const props = defineProps<{ matches: Match[] }>()

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Moscow',
})

const rows = computed(() =>
  props.matches.map((match) => {
    const scored =
      match.status === 'finished' && match.home_score !== null && match.away_score !== null
    const difference = !scored
      ? null
      : match.club_side === 'home'
        ? match.home_score! - match.away_score!
        : match.club_side === 'away'
          ? match.away_score! - match.home_score!
          : null
    const outcome =
      difference === null ? null : difference > 0 ? 'win' : difference < 0 ? 'loss' : 'draw'
    const date = new Date(match.starts_at)
    return {
      match,
      scored,
      difference,
      outcome,
      outcomeLabel: outcome === 'win' ? 'Победа' : outcome === 'loss' ? 'Поражение' : 'Ничья',
      date: Number.isNaN(date.getTime()) ? 'Дата уточняется' : dateFormatter.format(date),
      teams: [
        {
          name: match.home_team_name,
          score: match.home_score,
          club: match.club_side === 'home',
          logo: match.home_logo,
          remoteUrl: match.home_logo_url,
        },
        {
          name: match.away_team_name,
          score: match.away_score,
          club: match.club_side === 'away',
          logo: match.away_logo,
          remoteUrl: match.away_logo_url,
        },
      ],
    }
  }),
)

const shared = computed(() => {
  const first = props.matches[0]
  if (!first) return { category: '', competition: '', season: '' }
  return {
    category: props.matches.every((match) => match.team.category === first.team.category)
      ? first.team.category === 'women'
        ? 'Женская команда'
        : 'Мужская команда'
      : 'Команды клуба',
    competition: props.matches.every((match) => match.competition.id === first.competition.id)
      ? first.competition.name
      : '',
    season: props.matches.every((match) => match.competition.season === first.competition.season)
      ? first.competition.season
      : '',
  }
})

const plural = (count: number, words: [string, string, string]) => {
  const form = new Intl.PluralRules('ru-RU').select(count)
  return `${count} ${words[form === 'one' ? 0 : form === 'few' ? 1 : 2]}`
}
const record = computed(() => {
  const wins = rows.value.filter((row) => row.outcome === 'win').length
  const losses = rows.value.filter((row) => row.outcome === 'loss').length
  const draws = rows.value.filter((row) => row.outcome === 'draw').length
  return [
    wins ? plural(wins, ['победа', 'победы', 'побед']) : '',
    losses ? plural(losses, ['поражение', 'поражения', 'поражений']) : '',
    draws ? plural(draws, ['ничья', 'ничьи', 'ничьих']) : '',
  ].filter(Boolean)
})
</script>

<template>
  <div class="recent-results">
    <header class="recent-results__header">
      <div class="recent-results__context">
        <strong>{{ shared.category }}</strong>
        <span v-if="shared.competition">{{ shared.competition }}</span>
        <span v-if="shared.season">Сезон {{ shared.season }}</span>
      </div>
      <p v-if="record.length" class="recent-results__record">
        <span>За {{ plural(matches.length, ['матч', 'матча', 'матчей']) }}</span>
        <strong>{{ record.join(' · ') }}</strong>
      </p>
    </header>

    <ol class="recent-results__list" aria-label="Последние результаты">
      <li v-for="row in rows" :key="row.match.id" class="result-row">
        <time class="result-row__date" :datetime="row.match.starts_at">{{ row.date }}</time>

        <div class="result-row__fixture">
          <div
            v-for="(team, index) in row.teams"
            :key="index"
            class="result-row__team"
            :class="{ 'result-row__team--club': team.club }"
          >
            <span class="result-row__name">
              <TeamEmblem
                v-if="team.logo || team.remoteUrl || team.club"
                class="result-row__emblem"
                :name="team.name"
                :logo="team.logo"
                :remote-url="team.remoteUrl"
                :club="team.club"
                :club-logo="row.match.team?.logo"
              />
              <span>{{ team.name }}</span>
            </span>
            <strong v-if="row.scored" class="result-row__score">{{ team.score }}</strong>
          </div>
          <span v-if="!row.scored" class="result-row__unconfirmed">Счёт уточняется</span>
        </div>

        <div class="result-row__outcome">
          <span
            v-if="row.outcome"
            class="result-row__badge"
            :class="`result-row__badge--${row.outcome}`"
          >
            {{ row.outcomeLabel }}
          </span>
          <span v-if="row.difference !== null" class="result-row__difference">
            {{ row.difference > 0 ? '+' : row.difference < 0 ? '−' : ''
            }}{{ Math.abs(row.difference) }} очк.
          </span>
        </div>

        <div class="result-row__context">
          <p v-if="row.match.notes" class="result-row__stage">{{ row.match.notes }}</p>
          <p class="result-row__meta">
            <span v-if="!shared.competition">{{ row.match.competition.name }}</span>
            <span v-if="shared.category === 'Команды клуба'">
              {{ row.match.team.category === 'women' ? 'Женская команда' : 'Мужская команда' }}
            </span>
            <span v-if="!shared.season">Сезон {{ row.match.competition.season }}</span>
            <span v-if="row.match.venue">{{ row.match.venue.name }}</span>
          </p>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
@media (max-width: 600px) {
  .recent-results {
    min-width: 0;
  }

  .recent-results__header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .recent-results__context {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    gap: 4px 10px;
    overflow-wrap: anywhere;
    font-size: 0.73rem;
  }

  .recent-results__context strong {
    flex-basis: 100%;
    font-size: 0.8rem;
  }

  .recent-results__record {
    display: flex;
    min-width: 0;
    max-width: none;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
    text-align: left;
    font-size: 0.73rem;
  }

  .recent-results__record > span {
    font-size: 0.7rem;
  }

  .result-row {
    gap: 12px 10px;
    padding: 14px;
  }

  .result-row__date {
    min-width: 0;
    font-size: 0.72rem;
  }

  .result-row__outcome {
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 5px 7px;
    max-width: 156px;
  }

  .result-row__badge,
  .result-row__difference {
    font-size: 0.68rem;
  }

  .result-row__team {
    gap: 12px;
    font-size: 0.83rem;
    line-height: 1.5;
  }

  .result-row__emblem,
  .result-row__name :deep(img) {
    width: 24px;
    height: 24px;
  }

  .result-row__name {
    gap: 9px;
    padding-left: 33px;
  }

  .result-row__name:has(.result-row__emblem) {
    padding-left: 0;
  }

  .result-row__score {
    font-size: 1.4rem;
  }

  .result-row__context {
    padding-left: 0;
    border-top: 1px solid #ffffff12;
    padding-top: 10px;
  }

  .result-row__context:has(.result-row__meta:empty):not(:has(.result-row__stage)) {
    display: none;
  }

  .result-row__context > p {
    display: block;
    margin-right: 0;
  }

  .result-row__stage {
    font-size: 0.75rem;
    line-height: 1.5;
  }

  .result-row__context .result-row__meta {
    display: flex;
    margin-top: 5px;
    font-size: 0.7rem;
  }

  .result-row__context .result-row__meta:empty {
    display: none;
  }
}
</style>
