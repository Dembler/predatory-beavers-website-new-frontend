<script setup lang="ts">
import { computed } from 'vue'
import TeamEmblem from '@/components/TeamEmblem.vue'
import type { Match } from '@/shared/types'

type KnownStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled' | 'unpublished'
type DisplayStatus = KnownStatus | 'unknown'
type Outcome = 'win' | 'loss' | 'draw'

const KNOWN_STATUSES: readonly KnownStatus[] = [
  'scheduled',
  'live',
  'finished',
  'postponed',
  'cancelled',
  'unpublished',
]

const props = withDefaults(
  defineProps<{
    match: Match
    featured?: boolean
    variant?: 'card' | 'row'
  }>(),
  { featured: false, variant: 'card' },
)

const isRow = computed(() => props.variant === 'row')
const status = computed<DisplayStatus>(() =>
  (KNOWN_STATUSES as readonly string[]).includes(props.match.status)
    ? (props.match.status as KnownStatus)
    : 'unknown',
)

const statusLabels: Record<DisplayStatus, string> = {
  scheduled: 'Запланирован',
  live: 'Идёт',
  finished: 'Завершён',
  postponed: 'Перенесён',
  cancelled: 'Отменён',
  unpublished: 'Результат не опубликован',
  unknown: 'Статус уточняется',
}
const statusLabel = computed(() => statusLabels[status.value])

const hasScore = computed(
  () =>
    (status.value === 'finished' || status.value === 'live') &&
    props.match.home_score !== null &&
    props.match.away_score !== null,
)

const difference = computed(() => {
  if (status.value !== 'finished' || !hasScore.value) return null
  if (props.match.club_side !== 'home' && props.match.club_side !== 'away') return null

  const clubScore =
    props.match.club_side === 'home' ? props.match.home_score! : props.match.away_score!
  const opponentScore =
    props.match.club_side === 'home' ? props.match.away_score! : props.match.home_score!

  return clubScore - opponentScore
})
const outcome = computed<Outcome | null>(() =>
  difference.value === null
    ? null
    : difference.value > 0
      ? 'win'
      : difference.value < 0
        ? 'loss'
        : 'draw',
)

const winningSide = computed(() => {
  if (status.value !== 'finished' || !hasScore.value) return null
  if (props.match.home_score === props.match.away_score) return null
  return props.match.home_score! > props.match.away_score! ? 'home' : 'away'
})
const sideClass = (side: 'home' | 'away') => ({
  'is-winner': winningSide.value === side,
  'is-loser': winningSide.value !== null && winningSide.value !== side,
})
const sideDescription = (side: 'home' | 'away') => {
  const name = side === 'home' ? props.match.home_team_name : props.match.away_team_name
  const score = side === 'home' ? props.match.home_score : props.match.away_score
  return `${name}: ${score}${winningSide.value === side ? ', победитель' : ''}`
}
const scoreDescription = computed(() => {
  const scores = `${props.match.home_team_name} ${props.match.home_score}, ${props.match.away_team_name} ${props.match.away_score}`
  if (status.value === 'live') return `Текущий счёт: ${scores}`
  const winner =
    winningSide.value === 'home' ? props.match.home_team_name : props.match.away_team_name
  return `Итоговый счёт: ${scores}. ${winningSide.value ? `Победитель — ${winner}` : 'Равный счёт'}`
})

// The calendar's real notes are stage names, plus a region name. Never render raw
// imported provenance or assume the meaning of ASB's numbered semifinal brackets.
const stage = computed(() => {
  const note = props.match.notes?.trim().replace(/\s+/gu, ' ') ?? ''
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
})

const centerNote = computed(() => {
  if (status.value === 'live') return 'Счёт не указан'
  if (status.value === 'postponed') return 'Дата уточняется'
  if (status.value === 'cancelled') return 'Матч отменён'
  if (status.value === 'finished') return 'Счёт уточняется'
  if (status.value === 'unpublished') return 'Счёт не опубликован'
  return 'Статус уточняется'
})

const showMetaDate = computed(() => status.value !== 'scheduled' && status.value !== 'unknown')

const teamCategory = computed(() => {
  if (props.match.team?.category === 'women') return { short: 'Ж', label: 'Женский матч' }
  if (props.match.team?.category === 'men') return { short: 'М', label: 'Мужской матч' }
  return null
})

const startsAt = computed(() => new Date(props.match.starts_at))
const timeKnown = computed(
  () => !props.match.date_precision && !Number.isNaN(startsAt.value.getTime()),
)

const formatPart = (formatter: Intl.DateTimeFormat, fallback = '—') =>
  Number.isNaN(startsAt.value.getTime()) ? fallback : formatter.format(startsAt.value)

const dayLabel = computed(() =>
  formatPart(new Intl.DateTimeFormat('ru-RU', { day: 'numeric', timeZone: 'Europe/Moscow' })),
)
const monthPart = (month: 'short' | 'long') =>
  Number.isNaN(startsAt.value.getTime())
    ? '—'
    : (new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month, timeZone: 'Europe/Moscow' })
        .formatToParts(startsAt.value)
        .find((part) => part.type === 'month')?.value ?? '—')
const monthShortLabel = computed(() => monthPart('short').replace(/\.$/, ''))
const monthLongLabel = computed(() => monthPart('long'))
const weekdayLabel = computed(() =>
  formatPart(
    new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'Europe/Moscow' }),
  ).replace(/\.$/, ''),
)
const timeLabel = computed(() =>
  formatPart(
    new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Moscow',
    }),
  ),
)
const yearLabel = computed(() =>
  props.match.date_precision === 'year'
    ? (props.match.display_date?.match(/\b20\d{2}\b/u)?.[0] ?? '—')
    : formatPart(new Intl.DateTimeFormat('ru-RU', { year: 'numeric', timeZone: 'Europe/Moscow' })),
)

const dateHeading = computed(() =>
  Number.isNaN(startsAt.value.getTime())
    ? 'Дата уточняется'
    : `${dayLabel.value} ${monthLongLabel.value}`,
)
const fullDateLabel = computed(
  () =>
    props.match.display_date ||
    (Number.isNaN(startsAt.value.getTime())
      ? 'Дата уточняется'
      : `${dayLabel.value} ${monthShortLabel.value} ${yearLabel.value}${timeKnown.value ? `, ${timeLabel.value}` : ''}`),
)
</script>

<template>
  <article
    v-if="!isRow"
    class="match-card"
    :data-outcome="outcome"
    :data-winning-side="winningSide"
    :class="[
      `match-card--${status}`,
      {
        'match-card--featured': featured,
        'match-card--win': outcome === 'win',
        'match-card--loss': outcome === 'loss',
        'match-card--draw': outcome === 'draw',
      },
    ]"
  >
    <header class="match-card__head">
      <p class="match-card__tournament" :title="match.competition.name">
        {{ match.competition.name }}
      </p>
      <div class="match-card__labels">
        <span
          v-if="teamCategory"
          class="match-card__category"
          role="img"
          :aria-label="teamCategory.label"
          :title="teamCategory.label"
          >{{ teamCategory.short }}</span
        >
        <span class="match-card__status" :class="`match-card__status--${status}`">
          <i v-if="status === 'live'" class="match-card__live-dot" aria-hidden="true"></i>
          {{ statusLabel }}
        </span>
      </div>
    </header>

    <div class="match-card__main" :class="{ 'match-card__main--scored': hasScore }">
      <div class="match-card__team" :class="sideClass('home')">
        <TeamEmblem
          class="match-card__logo"
          :name="match.home_team_name"
          :logo="match.home_logo"
          :remote-url="match.home_logo_url"
          :club="match.club_side === 'home'"
          :club-logo="match.team?.logo"
          :eager="featured"
        />
        <strong :title="match.home_team_name">{{ match.home_team_name }}</strong>
        <span
          v-if="hasScore"
          class="match-card__team-score"
          role="img"
          :aria-label="sideDescription('home')"
          :aria-live="status === 'live' ? 'polite' : undefined"
          >{{ match.home_score }}</span
        >
      </div>

      <div class="match-card__center">
        <template v-if="hasScore">
          <p
            class="match-card__score"
            role="group"
            :aria-label="scoreDescription"
            :aria-live="status === 'live' ? 'polite' : undefined"
            :aria-atomic="status === 'live' ? 'true' : undefined"
          >
            <span :class="sideClass('home')" data-side="home">{{ match.home_score }}</span
            ><i>:</i><span :class="sideClass('away')" data-side="away">{{ match.away_score }}</span>
          </p>
          <span v-if="status === 'live'" class="match-card__live-label">Идёт</span>
        </template>
        <template v-else-if="status === 'live'">
          <span class="match-card__no-score">Счёт не указан</span>
          <span class="match-card__live-label">Идёт</span>
        </template>
        <template v-else-if="status === 'scheduled' || status === 'unknown'">
          <time v-if="timeKnown" class="match-card__time" :datetime="match.starts_at">{{
            timeLabel
          }}</time>
          <span class="match-card__date">{{ match.display_date || dateHeading }}</span>
        </template>
        <template v-else>
          <span class="match-card__no-score">{{ centerNote }}</span>
        </template>
      </div>

      <div class="match-card__team" :class="sideClass('away')">
        <TeamEmblem
          class="match-card__logo"
          :name="match.away_team_name"
          :logo="match.away_logo"
          :remote-url="match.away_logo_url"
          :club="match.club_side === 'away'"
          :club-logo="match.team?.logo"
          :eager="featured"
        />
        <strong :title="match.away_team_name">{{ match.away_team_name }}</strong>
        <span
          v-if="hasScore"
          class="match-card__team-score"
          role="img"
          :aria-label="sideDescription('away')"
          :aria-live="status === 'live' ? 'polite' : undefined"
          >{{ match.away_score }}</span
        >
      </div>
    </div>

    <footer class="match-card__meta">
      <span v-if="showMetaDate" class="match-card__meta-item">{{ fullDateLabel }}</span>
      <span v-if="match.venue" class="match-card__meta-item">{{ match.venue.name }}</span>
    </footer>

    <p v-if="stage" class="match-card__stage">{{ stage }}</p>
  </article>

  <article
    v-else
    class="match-card match-card--row"
    :data-outcome="outcome"
    :data-winning-side="winningSide"
    :class="[
      `match-card--${status}`,
      {
        'match-card--win': outcome === 'win',
        'match-card--loss': outcome === 'loss',
        'match-card--draw': outcome === 'draw',
      },
    ]"
  >
    <header class="match-card__row-heading">
      <div class="match-card__row-date">
        <time :datetime="match.starts_at || undefined" :title="fullDateLabel">
          <template v-if="match.date_precision === 'year'">
            <b>{{ yearLabel }}</b
            ><span>год</span>
          </template>
          <template
            v-else-if="match.date_precision === 'month' || Number.isNaN(startsAt.getTime())"
          >
            <span>{{ fullDateLabel }}</span>
          </template>
          <template v-else>
            <b>{{ dayLabel }}</b>
            <span>{{ monthShortLabel }}</span>
            <span class="match-card__row-year">{{ yearLabel }}</span>
            <small v-if="timeKnown">{{ weekdayLabel }} · {{ timeLabel }}</small>
          </template>
        </time>
      </div>
      <div class="match-card__labels">
        <span
          v-if="teamCategory"
          class="match-card__category"
          role="img"
          :aria-label="teamCategory.label"
          :title="teamCategory.label"
          >{{ teamCategory.short }}</span
        >
        <span class="match-card__status" :class="`match-card__status--${status}`">
          <i v-if="status === 'live'" class="match-card__live-dot" aria-hidden="true"></i>
          {{ statusLabel }}
        </span>
      </div>
    </header>

    <div class="match-card__row-body">
      <div class="match-card__row-teams">
        <div class="match-card__row-team" :class="sideClass('home')">
          <TeamEmblem
            class="match-card__logo"
            :name="match.home_team_name"
            :logo="match.home_logo"
            :remote-url="match.home_logo_url"
            :club="match.club_side === 'home'"
            :club-logo="match.team?.logo"
          />
          <strong :title="match.home_team_name">{{ match.home_team_name }}</strong>
          <span
            v-if="hasScore"
            class="match-card__row-team-score"
            role="img"
            :aria-label="sideDescription('home')"
            :aria-live="status === 'live' ? 'polite' : undefined"
            >{{ match.home_score }}</span
          >
        </div>
        <div class="match-card__row-result">
          <template v-if="hasScore">
            <p
              class="match-card__score"
              role="group"
              :aria-label="scoreDescription"
              :aria-live="status === 'live' ? 'polite' : undefined"
              :aria-atomic="status === 'live' ? 'true' : undefined"
            >
              <span :class="sideClass('home')" data-side="home">{{ match.home_score }}</span
              ><i>:</i
              ><span :class="sideClass('away')" data-side="away">{{ match.away_score }}</span>
            </p>
            <span v-if="status === 'live'" class="match-card__score-caption">Текущий счёт</span>
          </template>
          <template v-else-if="status === 'scheduled' || status === 'unknown'">
            <time v-if="timeKnown" class="match-card__time" :datetime="match.starts_at">{{
              timeLabel
            }}</time>
            <span class="match-card__score-caption">{{
              timeKnown ? 'Начало · МСК' : fullDateLabel
            }}</span>
          </template>
          <span v-else class="match-card__no-score">{{ centerNote }}</span>
        </div>
        <div class="match-card__row-team" :class="sideClass('away')">
          <TeamEmblem
            class="match-card__logo"
            :name="match.away_team_name"
            :logo="match.away_logo"
            :remote-url="match.away_logo_url"
            :club="match.club_side === 'away'"
            :club-logo="match.team?.logo"
          />
          <strong :title="match.away_team_name">{{ match.away_team_name }}</strong>
          <span
            v-if="hasScore"
            class="match-card__row-team-score"
            role="img"
            :aria-label="sideDescription('away')"
            :aria-live="status === 'live' ? 'polite' : undefined"
            >{{ match.away_score }}</span
          >
        </div>
      </div>
      <p class="match-card__row-meta">
        <span>{{ match.competition.name }}</span>
        <span v-if="match.venue">{{ match.venue.name }}</span>
      </p>
    </div>

    <p v-if="stage" class="match-card__stage match-card__stage--row">{{ stage }}</p>
  </article>
</template>

<style scoped>
.match-card__labels {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.match-card__category {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  min-height: 26px;
  flex-shrink: 0;
  padding: 2px 8px;
  border: 1px solid #d7e1eb;
  border-radius: 7px;
  background: #f5f8fb;
  color: #435b73;
  font:
    700 0.75rem/1.4 'Roboto',
    sans-serif;
}
.match-card__row-team-score,
.match-card__team-score {
  display: none;
}
.match-card__score-caption {
  display: block;
  margin-top: 8px;
  color: #607287;
  font:
    500 0.7rem/1.4 'Roboto',
    sans-serif;
}
.match-card__head {
  flex-wrap: wrap;
  gap: 12px;
  padding: 20px 24px 0;
}
.match-card__tournament {
  flex: 1 1 180px;
  max-width: none;
  overflow: visible;
  font-size: 0.75rem;
  line-height: 1.5;
  text-overflow: clip;
  white-space: normal;
  overflow-wrap: anywhere;
}
.match-card:not(.match-card--row) .match-card__main {
  min-height: 180px;
  grid-template-columns: minmax(0, 1fr) minmax(120px, auto) minmax(0, 1fr);
  gap: 18px;
  padding: 26px 24px;
}
.match-card:not(.match-card--row) .match-card__logo {
  width: 72px;
  height: 72px;
  border-radius: 16px;
}
.match-card:not(.match-card--row) .match-card__team {
  gap: 12px;
}
.match-card:not(.match-card--row) .match-card__team strong {
  display: block;
  min-height: 0;
  overflow: visible;
  font-size: 1.2rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
  -webkit-line-clamp: unset;
}
.match-card:not(.match-card--row) .match-card__score {
  font-size: clamp(2.6rem, 4vw, 3.4rem);
  gap: 8px;
}
.match-card__meta-item {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}
.match-card--row {
  display: block;
  min-width: 0;
  padding: 0;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 4px 16px #042a4e0a;
}
.match-card__row-heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  padding: 16px 24px;
  border-bottom: 1px solid #e3eaf1;
  background: #f5f8fb;
}
.match-card__row-date {
  min-width: 0;
  padding: 0;
  border: 0;
}
.match-card__row-date time {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 5px;
}
.match-card__row-date b {
  font-size: 1.5rem;
  line-height: 1.2;
}
.match-card__row-date span {
  font-size: 0.8rem;
  letter-spacing: 0;
  text-transform: none;
}
.match-card__row-date .match-card__row-year {
  display: inline;
  font-weight: 400;
}
.match-card__row-date small {
  margin-left: 8px;
  font-size: 0.77rem;
  white-space: normal;
}
.match-card__row-body {
  min-width: 0;
  padding: 24px;
}
.match-card__row-teams {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 170px minmax(0, 1fr);
  align-items: center;
  gap: 24px;
  min-width: 0;
}
.match-card__row-team {
  min-width: 0;
  gap: 16px;
}
.match-card__row-team:first-child {
  flex-direction: row-reverse;
  text-align: right;
}
.match-card__row-team strong {
  flex: 1;
  min-width: 0;
  overflow: visible;
  font-size: clamp(1.05rem, 1.6vw, 1.35rem);
  line-height: 1.4;
  text-overflow: clip;
  white-space: normal;
  overflow-wrap: anywhere;
}
.match-card--row .match-card__logo {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 12px;
}
.match-card--row .match-card__logo :deep(img) {
  padding: 5px;
}
.match-card--row .match-card__logo :deep(span) {
  font-size: 0.85rem;
}
.match-card__row-result {
  min-width: 0;
  align-items: center;
  gap: 0;
  text-align: center;
}
.match-card__row-result .match-card__score {
  gap: 7px;
  font-size: 2.7rem;
}
.match-card__row-result .match-card__time {
  font-size: 2.2rem;
}
.match-card__row-meta {
  justify-content: center;
  gap: 8px 16px;
  margin: 20px 0 0;
  font-size: 0.8rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.match-card__row-meta > span + span {
  padding-left: 16px;
  border-left: 1px solid #d7e1eb;
}
.match-card__stage {
  margin: 0 24px;
  padding: 14px 0 18px;
  border-top: 1px solid #e3eaf1;
  color: #435b73;
  font:
    600 0.8rem/1.5 'Roboto',
    sans-serif;
}
.match-card__score > span {
  position: relative;
  min-width: 2ch;
}
.match-card .is-loser > strong,
.match-card .match-card__score > .is-loser,
.match-card .is-loser > .match-card__team-score,
.match-card .is-loser > .match-card__row-team-score {
  color: #53667a;
  font-weight: 400;
}
.match-card .is-winner > strong,
.match-card .match-card__score > .is-winner,
.match-card .is-winner > .match-card__team-score,
.match-card .is-winner > .match-card__row-team-score {
  color: #042a4e;
  font-weight: 700;
}
.match-card__score > .is-winner::after,
.is-winner > .match-card__team-score::after,
.is-winner > .match-card__row-team-score::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -7px;
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-right: 5px solid currentColor;
  transform: translateY(-50%);
}
.match-card__team-score,
.match-card__row-team-score {
  position: relative;
}
@media (min-width: 701px) and (max-width: 1000px) {
  .match-card__row-teams {
    grid-template-columns: minmax(0, 1fr) 132px minmax(0, 1fr);
    gap: 16px;
  }
  .match-card__row-team {
    gap: 12px;
  }
  .match-card--row .match-card__logo {
    width: 48px;
    height: 48px;
  }
}
@media (max-width: 700px) {
  .match-card__stage {
    margin-inline: 18px;
  }
  .match-card__head,
  .match-card--featured .match-card__head {
    padding: 18px 18px 0;
  }
  .match-card:not(.match-card--row) .match-card__main {
    min-height: 0;
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
    padding: 8px 18px 18px;
  }
  .match-card:not(.match-card--row) .match-card__team {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) auto;
    gap: 12px;
    padding: 14px 0;
    text-align: left;
  }
  .match-card:not(.match-card--row) .match-card__team:last-child {
    border-top: 1px solid #e3eaf1;
  }
  .match-card:not(.match-card--row) .match-card__logo {
    width: 44px;
    height: 44px;
    border-radius: 12px;
  }
  .match-card:not(.match-card--row) .match-card__team strong {
    font:
      600 0.95rem/1.45 'Roboto',
      sans-serif;
    text-transform: none;
  }
  .match-card:not(.match-card--row) .match-card__score {
    gap: 4px;
    font-size: 2.35rem;
  }
  .match-card:not(.match-card--row) .match-card__center {
    min-width: 0;
    order: 1;
    padding-top: 14px;
    border-top: 1px solid #e3eaf1;
  }
  .match-card:not(.match-card--row) .match-card__main--scored .match-card__center {
    display: none;
  }
  .match-card__score-caption {
    font-size: 0.66rem;
  }
  .match-card__row-heading {
    display: flex;
    padding: 14px 18px;
    gap: 12px;
  }
  .match-card__row-date b {
    font:
      600 0.9rem/1.4 'Roboto',
      sans-serif;
  }
  .match-card__row-date span {
    font-size: 0.8rem;
    font-weight: 500;
  }
  .match-card__row-date small {
    flex-basis: 100%;
    margin: 0;
    font-size: 0.72rem;
  }
  .match-card__row-body {
    padding: 6px 18px 18px;
  }
  .match-card__row-teams {
    display: flex;
    align-items: stretch;
    flex-direction: column;
    gap: 0;
  }
  .match-card__row-team,
  .match-card__row-team:first-child {
    flex-direction: row;
    gap: 12px;
    padding: 14px 0;
    text-align: left;
  }
  .match-card__row-team:last-child {
    border-top: 1px solid #e9eef4;
  }
  .match-card__row-team strong {
    font:
      600 0.95rem/1.45 'Roboto',
      sans-serif;
    text-transform: none;
  }
  .match-card--row .match-card__logo {
    width: 44px;
    height: 44px;
  }
  .match-card__row-team-score,
  .match-card__team-score {
    display: block;
    min-width: 2ch;
    flex-shrink: 0;
    color: var(--navy);
    font:
      700 1.9rem/1.2 'Oswald',
      sans-serif;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .match-card__row-result {
    display: none;
  }
  .match-card__row-result:has(.match-card__no-score) {
    display: block;
    order: 1;
    padding-top: 12px;
  }
  .match-card__row-meta {
    justify-content: flex-start;
    gap: 5px 12px;
    margin-top: 8px;
    padding-top: 14px;
    border-top: 1px solid #e3eaf1;
    font-size: 0.77rem;
  }
  .match-card__row-meta > span + span {
    padding-left: 0;
    border-left: 0;
  }
}
</style>
