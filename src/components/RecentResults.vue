<script setup lang="ts">
import { computed } from 'vue'
import TeamEmblem from '@/components/TeamEmblem.vue'
import type { Match } from '@/shared/types'

const props = defineProps<{ matches: Match[] }>()

function matchStage(notes: string | null) {
  const note = notes?.trim().replace(/\s+/gu, ' ') ?? ''
  const place = note.match(/^(?:(?:финал|матч)\s+за\s+)?([35])(?:-?[еe])?\s+место(?:[.;]|$)/iu)
  if (place) return `Матч за ${place[1]}-е место`
  if (/^1\/2(?:\s+финала)?(?:\s*\(\d+\))?$/u.test(note)) return 'Полуфинал'
  if (/^1\/4(?:\s+финала)?(?:\s*\(\d+\))?$/u.test(note)) return 'Четвертьфинал'
  if (/^1\/8(?:\s+финала)?(?:\s*\(\d+\))?$/u.test(note)) return '1/8 финала'
  if (/^4\s*[-–]\s*6\s+мест[ао]$/u.test(note)) return 'Матчи за 4–6-е места'
  if (/^финал(?:ьный матч)?(?:[.;]|$)/iu.test(note)) return 'Финал'
  if (/^(?:полуфинал|четвертьфинал)(?:[.;]|$)/iu.test(note)) return note.split(/[.;]/u)[0]!
  return /^(?:круговой турнир|групповой этап|плей-офф|товарищеский матч|демонстрационный матч|группа [А-ЯA-Z\d])$/iu.test(
    note,
  )
    ? note
    : null
}

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
      category:
        match.team?.category === 'men'
          ? { short: 'М', label: 'Мужской матч' }
          : match.team?.category === 'women'
            ? { short: 'Ж', label: 'Женский матч' }
            : null,
      winner:
        !scored || match.home_score === match.away_score
          ? null
          : match.home_score! > match.away_score!
            ? 0
            : 1,
      stage: matchStage(match.notes),
      outcome,
      date:
        match.display_date ||
        (Number.isNaN(date.getTime()) ? 'Дата уточняется' : dateFormatter.format(date)),
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
</script>

<template>
  <div class="recent-results">
    <ol class="recent-results__list" aria-label="Последние результаты">
      <li
        v-for="row in rows"
        :key="row.match.id"
        class="result-row"
        :data-outcome="row.outcome"
        :data-winning-side="row.winner === 0 ? 'home' : row.winner === 1 ? 'away' : undefined"
      >
        <div class="result-row__heading">
          <time class="result-row__date" :datetime="row.match.starts_at || undefined">{{
            row.date
          }}</time>
          <span
            v-if="row.category"
            class="result-row__category"
            role="img"
            :aria-label="row.category.label"
            :title="row.category.label"
            >{{ row.category.short }}</span
          >
        </div>

        <div class="result-row__fixture">
          <div
            v-for="(team, index) in row.teams"
            :key="index"
            class="result-row__team"
            :class="{
              'result-row__team--club': team.club,
              'is-winner': row.winner === index,
              'is-loser': row.winner !== null && row.winner !== index,
            }"
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
            <strong
              v-if="row.scored"
              class="result-row__score"
              role="img"
              :aria-label="`${team.name}: ${team.score}${row.winner === index ? ', победитель' : ''}`"
              >{{ team.score }}</strong
            >
          </div>
          <span v-if="!row.scored" class="result-row__unconfirmed">Счёт уточняется</span>
        </div>

        <div class="result-row__context">
          <p v-if="row.stage" class="result-row__stage">{{ row.stage }}</p>
          <p class="result-row__meta">
            <span>{{ row.match.competition.name }}</span>
            <span
              v-if="
                row.match.competition.season &&
                !row.match.competition.name.includes(row.match.competition.season)
              "
              >Сезон {{ row.match.competition.season }}</span
            >
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

.result-row__heading {
  display: flex;
  grid-column: 1 / -1;
  grid-row: 1;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.result-row__category {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  min-height: 26px;
  flex-shrink: 0;
  padding: 2px 8px;
  border: 1px solid #ffffff30;
  border-radius: 7px;
  background: #ffffff0a;
  color: #e3edf6;
  font:
    700 0.75rem/1.4 'Roboto',
    sans-serif;
}

.result-row__date {
  min-width: 0;
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

.result-row .is-winner .result-row__name > span,
.result-row .is-winner .result-row__score {
  color: #fff;
  font-weight: 700;
}
.result-row .is-loser .result-row__name > span,
.result-row .is-loser .result-row__score {
  color: #aebdcb;
  font-weight: 400;
}
.result-row__score {
  position: relative;
}
.result-row .is-winner .result-row__score::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -7px;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-right: 5px solid currentColor;
  transform: translateY(-50%);
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
  .result-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    padding: 20px;
  }

  .result-row__heading,
  .result-row__fixture,
  .result-row__context {
    grid-column: 1;
    grid-row: auto;
  }

  .result-row__date {
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

  .result-row__context {
    padding-top: 14px;
  }

  .result-row__stage {
    font-size: 0.88rem;
  }
}
</style>
