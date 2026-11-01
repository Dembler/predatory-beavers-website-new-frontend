<script setup lang="ts">
import { computed } from 'vue'
import MatchOutcome from '@/components/MatchOutcome.vue'
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
    const outcome: 'win' | 'loss' | 'draw' | null =
      difference === null ? null : difference > 0 ? 'win' : difference < 0 ? 'loss' : 'draw'
    const date = new Date(match.starts_at)
    return {
      match,
      scored,
      difference,
      outcome,
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

        <div v-if="row.outcome" class="result-row__outcome">
          <MatchOutcome :outcome="row.outcome" :difference="row.difference" tone="dark" />
        </div>

        <div
          v-if="
            row.match.notes ||
            !shared.competition ||
            shared.category === 'Команды клуба' ||
            !shared.season ||
            row.match.venue
          "
          class="result-row__context"
        >
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
.recent-results {
  min-width: 0;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.recent-results__header {
  align-items: flex-start;
  gap: 20px;
  padding: 0 0 20px;
  border: 0;
  background: transparent;
}

.recent-results__context {
  min-width: 0;
  gap: 6px 16px;
  font-size: 0.88rem;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.recent-results__context strong {
  font-size: 0.95rem;
}

.recent-results__record {
  min-width: 0;
  max-width: 40%;
  flex-shrink: 1;
  gap: 5px;
  font-size: 0.9rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.recent-results__record > span {
  font-size: 0.8rem;
}

.recent-results__list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.result-row {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 20px 12px;
  min-width: 0;
  min-height: 0;
  padding: 22px 24px;
  border: 1px solid #ffffff26;
  border-radius: 14px;
  background: #031f39f5;
  box-shadow: 0 8px 24px #00101f1f;
}

.result-row + .result-row {
  border-top: 1px solid #ffffff26;
}

.result-row__date {
  grid-column: 1;
  grid-row: 1;
  min-width: 0;
  align-self: start;
  padding-top: 3px;
  font-size: 0.88rem;
  line-height: 1.5;
}

.result-row__fixture {
  grid-column: 1 / -1;
  grid-row: 2;
  gap: 14px;
}

.result-row__team {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  font-size: 1.05rem;
  line-height: 1.45;
}

.result-row__name {
  gap: 12px;
  padding-left: 0;
}

.result-row__name > span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.result-row__emblem {
  width: 40px;
  height: 40px;
  border-radius: 8px;
}

.result-row__emblem :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.result-row__emblem :deep(span) {
  font-size: 0.75rem;
}

.result-row__score {
  min-width: 2.2ch;
  font-size: 2rem;
  line-height: 1.1;
}

.result-row__unconfirmed {
  font-size: 0.88rem;
  line-height: 1.5;
}

.result-row__outcome {
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
  max-width: 100%;
  justify-self: end;
}

.result-row__context {
  grid-column: 1 / -1;
  grid-row: 3;
  padding: 14px 0 0;
  border-top: 1px solid #ffffff18;
}

.result-row__context > p {
  display: block;
  margin-right: 0;
}

.result-row__stage {
  font-size: 0.9rem;
  line-height: 1.6;
}

.result-row__context .result-row__meta {
  display: flex;
  gap: 5px 16px;
  margin-top: 6px;
  font-size: 0.8rem;
  line-height: 1.55;
}

.result-row__context .result-row__meta:empty {
  display: none;
}

@media (max-width: 1200px) {
  .recent-results__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .recent-results__list {
    grid-template-columns: minmax(0, 1fr);
  }

  .result-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 16px 20px;
  }

  .result-row__outcome {
    grid-column: 2;
    grid-row: 1;
  }

  .result-row__fixture {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .result-row__context {
    grid-column: 1 / -1;
    grid-row: 3;
  }
}

@media (max-width: 600px) {
  .recent-results__header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding-bottom: 18px;
  }

  .recent-results__context {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 12px;
    font-size: 0.85rem;
  }

  .recent-results__context strong {
    flex-basis: 100%;
    font-size: 0.95rem;
  }

  .recent-results__record {
    display: flex;
    max-width: none;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 12px;
    text-align: left;
    font-size: 0.88rem;
  }

  .result-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    padding: 20px;
  }

  .result-row__date,
  .result-row__fixture,
  .result-row__outcome,
  .result-row__context {
    grid-column: 1;
    grid-row: auto;
  }

  .result-row__date {
    padding-top: 0;
    font-size: 0.85rem;
  }

  .result-row__team {
    gap: 14px;
    font-size: 1rem;
    line-height: 1.45;
  }

  .result-row__emblem {
    width: 36px;
    height: 36px;
  }

  .result-row__score {
    font-size: 1.9rem;
  }

  .result-row__outcome {
    display: block;
    justify-self: start;
  }

  .result-row__context {
    padding-top: 14px;
  }

  .result-row__stage {
    font-size: 0.88rem;
  }
}
</style>
