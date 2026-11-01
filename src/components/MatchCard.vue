<script setup lang="ts">
import { computed } from 'vue'
import TeamEmblem from '@/components/TeamEmblem.vue'
import type { Match } from '@/shared/types'

type KnownStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'
type DisplayStatus = KnownStatus | 'unknown'
type MatchOutcome = 'win' | 'loss' | 'draw'

const KNOWN_STATUSES: readonly KnownStatus[] = [
  'scheduled',
  'live',
  'finished',
  'postponed',
  'cancelled',
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
  unknown: 'Статус уточняется',
}
const statusLabel = computed(() => statusLabels[status.value])

const hasScore = computed(
  () =>
    (status.value === 'finished' || status.value === 'live') &&
    props.match.home_score !== null &&
    props.match.away_score !== null,
)

const outcome = computed<MatchOutcome | null>(() => {
  if (status.value !== 'finished' || !hasScore.value) return null
  if (props.match.club_side !== 'home' && props.match.club_side !== 'away') return null

  const clubScore =
    props.match.club_side === 'home' ? props.match.home_score! : props.match.away_score!
  const opponentScore =
    props.match.club_side === 'home' ? props.match.away_score! : props.match.home_score!

  if (clubScore === opponentScore) return 'draw'
  return clubScore > opponentScore ? 'win' : 'loss'
})

const outcomeLabel = computed(() => {
  if (outcome.value === 'win') return 'Победа'
  if (outcome.value === 'loss') return 'Поражение'
  if (outcome.value === 'draw') return 'Ничья'
  return ''
})

const centerNote = computed(() => {
  if (status.value === 'postponed') return 'Дата уточняется'
  if (status.value === 'cancelled') return 'Матч отменён'
  if (status.value === 'finished') return 'Счёт уточняется'
  return 'Статус уточняется'
})

const showMetaDate = computed(() => status.value !== 'scheduled' && status.value !== 'unknown')

const teamCategoryLabel = computed(() => {
  if (props.match.team?.category === 'women') return 'Женская команда'
  if (props.match.team?.category === 'men') return 'Мужская команда'
  return 'Команда клуба'
})

const venueMapUrl = computed(() => {
  const address = props.match.venue?.address.trim()
  if (!props.featured || !address || address === props.match.venue?.name || !/\d/u.test(address))
    return null
  return `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`
})

const startsAt = computed(() => new Date(props.match.starts_at))

const formatPart = (formatter: Intl.DateTimeFormat, fallback = '—') =>
  Number.isNaN(startsAt.value.getTime()) ? fallback : formatter.format(startsAt.value)

const dayLabel = computed(() =>
  formatPart(new Intl.DateTimeFormat('ru-RU', { day: 'numeric', timeZone: 'Europe/Moscow' })),
)
const monthShortLabel = computed(() =>
  formatPart(
    new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'Europe/Moscow' }),
  ).replace(/\.$/, ''),
)
const monthLongLabel = computed(() =>
  formatPart(new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'Europe/Moscow' })),
)
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
  formatPart(new Intl.DateTimeFormat('ru-RU', { year: 'numeric', timeZone: 'Europe/Moscow' })),
)

const dateHeading = computed(() =>
  Number.isNaN(startsAt.value.getTime())
    ? 'Дата уточняется'
    : `${dayLabel.value} ${monthLongLabel.value}`,
)
const fullDateLabel = computed(() =>
  Number.isNaN(startsAt.value.getTime())
    ? 'Дата уточняется'
    : `${dayLabel.value} ${monthShortLabel.value} ${yearLabel.value}, ${timeLabel.value}`,
)
</script>

<template>
  <article
    v-if="!isRow"
    class="match-card"
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
      <span class="match-card__status" :class="`match-card__status--${status}`">
        <i v-if="status === 'live'" class="match-card__live-dot" aria-hidden="true"></i>
        {{ statusLabel }}
      </span>
    </header>

    <div class="match-card__main">
      <div class="match-card__team">
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
      </div>

      <div class="match-card__center">
        <template v-if="hasScore">
          <p
            class="match-card__score"
            :aria-live="status === 'live' ? 'polite' : undefined"
            :aria-atomic="status === 'live' ? 'true' : undefined"
          >
            <span>{{ match.home_score }}</span
            ><i>:</i><span>{{ match.away_score }}</span>
          </p>
          <span
            v-if="outcome"
            class="match-card__outcome"
            :class="`match-card__outcome--${outcome}`"
          >
            {{ outcomeLabel }}
          </span>
          <span v-else-if="status === 'live'" class="match-card__live-label">Идёт</span>
          <span v-else class="match-card__outcome">Завершён</span>
        </template>
        <template v-else-if="status === 'live'">
          <span class="match-card__no-score">Счёт не указан</span>
          <span class="match-card__live-label">Идёт</span>
        </template>
        <template v-else-if="status === 'scheduled' || status === 'unknown'">
          <time class="match-card__time" :datetime="match.starts_at">{{ timeLabel }}</time>
          <span class="match-card__date">{{ dateHeading }}</span>
        </template>
        <template v-else>
          <span class="match-card__no-score">{{ centerNote }}</span>
        </template>
      </div>

      <div class="match-card__team">
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
      </div>
    </div>

    <footer class="match-card__meta">
      <span v-if="showMetaDate" class="match-card__meta-item">{{ fullDateLabel }}</span>
      <span v-if="match.venue" class="match-card__meta-item">{{ match.venue.name }}</span>
      <span class="match-card__meta-item">{{ teamCategoryLabel }}</span>
      <a
        v-if="venueMapUrl"
        class="match-card__map-link"
        :href="venueMapUrl"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="`Открыть ${match.venue?.name} на карте`"
        >На карте ↗</a
      >
    </footer>

    <details v-if="match.notes" class="match-card__details">
      <summary>Подробнее о матче</summary>
      <p>{{ match.notes }}</p>
    </details>
  </article>

  <article
    v-else
    class="match-card match-card--row"
    :class="[
      `match-card--${status}`,
      {
        'match-card--win': outcome === 'win',
        'match-card--loss': outcome === 'loss',
        'match-card--draw': outcome === 'draw',
      },
    ]"
  >
    <div class="match-card__row-date">
      <time :datetime="match.starts_at" :title="fullDateLabel">
        <b>{{ dayLabel }}</b>
        <span>{{ monthShortLabel }}</span>
        <small>
          {{ weekdayLabel }}<template v-if="status !== 'scheduled'"> · {{ timeLabel }}</template>
        </small>
        <span class="match-card__row-year">{{ yearLabel }}</span>
      </time>
    </div>

    <div class="match-card__row-body">
      <div class="match-card__row-teams">
        <div class="match-card__row-team">
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
            :aria-live="status === 'live' ? 'polite' : undefined"
            >{{ match.home_score }}</span
          >
        </div>
        <span class="match-card__row-sep" aria-hidden="true">—</span>
        <div class="match-card__row-team">
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
            :aria-live="status === 'live' ? 'polite' : undefined"
            >{{ match.away_score }}</span
          >
        </div>
      </div>
      <p class="match-card__row-meta">
        <span>{{ match.competition.name }}</span>
        <span v-if="match.venue">· {{ match.venue.name }}</span>
        <span>· {{ teamCategoryLabel }}</span>
      </p>
    </div>

    <div class="match-card__row-result">
      <template v-if="hasScore">
        <p
          class="match-card__score"
          :aria-live="status === 'live' ? 'polite' : undefined"
          :aria-atomic="status === 'live' ? 'true' : undefined"
        >
          <span>{{ match.home_score }}</span
          ><i>:</i><span>{{ match.away_score }}</span>
        </p>
        <span v-if="outcome" class="match-card__outcome" :class="`match-card__outcome--${outcome}`">
          {{ outcomeLabel }}
        </span>
        <span v-else class="match-card__status" :class="`match-card__status--${status}`">
          {{ statusLabel }}
        </span>
      </template>
      <template v-else-if="status === 'scheduled'">
        <time class="match-card__time" :datetime="match.starts_at">{{ timeLabel }}</time>
        <span class="match-card__status" :class="`match-card__status--${status}`">
          {{ statusLabel }}
        </span>
      </template>
      <template v-else>
        <span class="match-card__status" :class="`match-card__status--${status}`">
          {{ statusLabel }}
        </span>
      </template>
    </div>

    <details v-if="match.notes" class="match-card__details match-card__details--row">
      <summary>Подробнее о матче</summary>
      <p>{{ match.notes }}</p>
    </details>
  </article>
</template>

<style scoped>
.match-card__row-team-score,
.match-card__row-year {
  display: none;
}

.match-card__details p {
  overflow-wrap: anywhere;
}

.match-card__map-link {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  padding: 6px 10px;
  border: 1px solid #cad6e2;
  border-radius: 6px;
  color: var(--navy);
  background: #fff;
  font-size: 0.75rem;
  font-weight: 600;
}

.match-card__map-link:hover {
  background: #edf2f7;
}

.match-card__map-link:focus-visible {
  outline: 3px solid #4d82b2;
  outline-offset: 3px;
}

.match-card__row-team strong {
  min-width: 0;
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
  overflow-wrap: anywhere;
}

.match-card--row .match-card__logo {
  flex-shrink: 0;
}

.match-card__row-meta {
  overflow-wrap: anywhere;
}

.match-card:not(.match-card--row) .match-card__team strong {
  display: block;
  overflow: visible;
  overflow-wrap: anywhere;
  -webkit-line-clamp: unset;
}

@media (min-width: 701px) {
  .match-card__row-teams {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 16px minmax(0, 1fr);
  }
}

@media (max-width: 700px) {
  .match-card--row {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'date result'
      'body body'
      'details details';
    align-items: start;
    gap: 12px;
    min-width: 0;
    padding: 14px;
  }

  .match-card__row-date {
    grid-area: date;
    min-width: 0;
    padding: 0;
    border: 0;
  }

  .match-card__row-date time {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 3px 5px;
    line-height: 1.4;
  }

  .match-card__row-date b {
    font:
      700 0.8rem/1.4 'Roboto',
      sans-serif;
  }

  .match-card__row-date span {
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
  }

  .match-card__row-date small {
    flex-basis: 100%;
    order: 1;
    font-size: 0.68rem;
  }

  .match-card__row-date .match-card__row-year {
    display: inline;
    order: 0;
    color: #526477;
    font-size: 0.75rem;
  }

  .match-card__row-body {
    grid-area: body;
  }

  .match-card__row-teams {
    gap: 9px;
  }

  .match-card__row-team {
    gap: 9px;
  }

  .match-card__row-team strong {
    flex: 1;
    min-width: 0;
    overflow: visible;
    font:
      600 0.83rem/1.4 'Roboto',
      sans-serif;
    text-overflow: clip;
    white-space: normal;
    text-transform: none;
  }

  .match-card__row-team-score {
    display: inline;
    flex-shrink: 0;
    min-width: 2ch;
    color: var(--navy);
    font:
      600 1.35rem/1 'Oswald',
      sans-serif;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .match-card__row-result {
    grid-area: result;
    max-width: 112px;
    gap: 6px;
    padding-top: 2px;
  }

  .match-card__row-result .match-card__score {
    display: none;
  }

  .match-card__row-result .match-card__outcome {
    margin: 0;
    padding: 5px 8px;
    border-radius: 6px;
    background: #edf2f7;
    font-size: 0.62rem;
    letter-spacing: 0.02em;
  }

  .match-card__row-result .match-card__outcome--loss {
    background: #fff0ef;
  }

  .match-card__row-meta {
    gap: 4px 8px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid #e5ebf1;
    font-size: 0.75rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .match-card__details--row {
    grid-area: details;
    margin: 0;
    padding-top: 0;
    border: 0;
  }

  .match-card__details summary {
    display: flex;
    min-height: 44px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    list-style: none;
  }

  .match-card__details summary::after {
    content: '+';
    font-size: 1.2rem;
    font-weight: 400;
  }

  .match-card__details[open] summary::after {
    content: '−';
  }

  .match-card:not(.match-card--row) {
    min-width: 0;
  }

  .match-card:not(.match-card--row) .match-card__main {
    grid-template-columns: minmax(0, 1fr) minmax(70px, auto) minmax(0, 1fr);
    gap: 6px;
    padding-inline: 12px;
  }

  .match-card:not(.match-card--row) .match-card__center {
    min-width: 0;
  }

  .match-card:not(.match-card--row) .match-card__team strong {
    font-size: 0.78rem;
    line-height: 1.4;
  }

  .match-card__head,
  .match-card__meta-item {
    min-width: 0;
    overflow-wrap: anywhere;
  }
}
</style>
