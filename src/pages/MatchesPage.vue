<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AsyncState from '@/components/AsyncState.vue'
import AppSelect from '@/components/AppSelect.vue'
import MatchCard from '@/components/MatchCard.vue'
import HistoricalMatchCard from '@/components/HistoricalMatchCard.vue'
import { useLoad } from '@/composables/useLoad'
import { useTeamFilter } from '@/composables/useTeamPreference'
import { allPages } from '@/shared/api'
import { explicitSeason, resultSeasons, seasonAtDate, type PublicResult } from '@/shared/results'
import type { Match } from '@/shared/types'

const route = useRoute()
const router = useRouter()
const rememberedTeam = useTeamFilter('all')
function updateQuery(values: Record<string, string | undefined>) {
  void router.push({ query: { ...route.query, page: undefined, ...values } })
}
const team = computed({
  get: () => rememberedTeam.value,
  set: (value: 'all' | 'men' | 'women') => updateQuery({ team: value }),
})
function queryFilter(name: string, allowed?: string[]) {
  return computed({
    get: () => {
      const value = route.query[name]
      return typeof value === 'string' && (!allowed || allowed.includes(value)) ? value : 'all'
    },
    set: (value: string) => {
      updateQuery({ [name]: value === 'all' ? undefined : value })
    },
  })
}
const legacyYearSeason = (value: unknown) =>
  typeof value === 'string' && /^(20\d{2}|21\d{2}|2200)$/u.test(value)
    ? `${Number(value) - 1}-${value}`
    : undefined
const querySeason = computed(() => {
  if (route.query.season === 'all') return 'all'
  const value = typeof route.query.season === 'string' ? route.query.season : undefined
  return explicitSeason(value) ?? legacyYearSeason(value) ?? legacyYearSeason(route.query.year)
})
const season = computed({
  get: () => querySeason.value ?? defaultSeason.value,
  set: (value: string) => updateQuery({ season: value, year: undefined }),
})
watch(
  () => [route.query.season, route.query.year],
  () => {
    if (
      route.query.year !== undefined ||
      (route.query.season !== undefined && route.query.season !== querySeason.value)
    )
      void router.replace({
        query: { ...route.query, season: querySeason.value, year: undefined, page: undefined },
        hash: route.hash,
      })
  },
  { immediate: true },
)
const discipline = queryFilter('discipline', ['5x5', '3x3', 'phygital'])
const status = queryFilter('status', [
  'scheduled',
  'live',
  'finished',
  'postponed',
  'cancelled',
  'unpublished',
])
const now = ref(Date.now())
let clockTimer: number | undefined
onMounted(() => {
  clockTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 30_000)
})
onUnmounted(() => window.clearInterval(clockTimer))
const hasFilters = computed(
  () =>
    team.value !== 'all' ||
    status.value !== 'all' ||
    season.value !== defaultSeason.value ||
    discipline.value !== 'all',
)
function resetFilters() {
  void router.push({ query: { team: 'all' } })
}
const teamOptions = [
  { value: 'all', label: 'Все команды' },
  { value: 'men', label: 'Мужская команда' },
  { value: 'women', label: 'Девушки' },
]
const statusOptions = [
  { value: 'all', label: 'Все статусы' },
  { value: 'scheduled', label: 'Запланирован' },
  { value: 'live', label: 'Идёт' },
  { value: 'finished', label: 'Завершён' },
  { value: 'postponed', label: 'Перенесён' },
  { value: 'cancelled', label: 'Отменён' },
  { value: 'unpublished', label: 'Результат не опубликован' },
]
const disciplineOptions = [
  { value: 'all', label: 'Все форматы' },
  { value: '5x5', label: '5×5 — классический баскетбол' },
  { value: '3x3', label: '3×3 — на одно кольцо' },
  { value: 'phygital', label: 'Фиджитал-баскетбол' },
]
const calendar = useLoad(() => allPages<Match>('/api/v1/matches'))
const history = useLoad(() => allPages<PublicResult>('/api/v1/results-archive'))
const matches = computed(() => calendar.data.value ?? [])
const historical = computed(() =>
  (history.data.value ?? []).filter((item) => Boolean(item.opponent_name)),
)
const loading = computed(() => calendar.pending.value || history.pending.value)
const pending = computed(() => loading.value && !matches.value.length && !historical.value.length)
const error = computed(() => calendar.error.value && history.error.value)
async function load() {
  await Promise.all([calendar.load(), history.load()])
}

// Public source identities connect the calendar copy to the historical evidence.
// Prefer the calendar card, including editor changes; never repeat an imported ASB game.
const identity = (item: { source?: string; external_id?: string | null }) =>
  item.source && item.external_id ? `${item.source}/${item.external_id}` : null
const calendarIdentities = computed(() => new Set(matches.value.map(identity).filter(Boolean)))
const additional = computed(() =>
  historical.value.filter((item) => !calendarIdentities.value.has(identity(item))),
)
const startTime = (match: Match) => new Date(match.starts_at).getTime()
const matchSeason = (match: Match) =>
  explicitSeason(match.competition.season) ?? seasonAtDate(match.starts_at)
const seasonLabel = (value: string) =>
  value === 'unknown' ? 'Сезон не уточнён' : value.replace('-', ' / ')
const defaultSeason = computed(() => {
  if (discipline.value === 'all' || discipline.value === '5x5') {
    const next = matches.value
      .filter(
        (match) =>
          (team.value === 'all' || match.team?.category === team.value) &&
          (match.status === 'live' ||
            (match.status === 'scheduled' && startTime(match) >= now.value)),
      )
      .sort((a, b) => startTime(a) - startTime(b))[0]
    if (next && matchSeason(next)) return matchSeason(next)!
    const published = [
      ...matches.value
        .filter(
          (match) =>
            match.status === 'finished' &&
            (team.value === 'all' || match.team?.category === team.value),
        )
        .map(matchSeason)
        .filter((value): value is string => Boolean(value)),
      ...historical.value
        .filter(
          (item) =>
            item.discipline === '5x5' &&
            item.status === 'finished' &&
            (team.value === 'all' || item.team === team.value) &&
            resultSeasons(item).length === 1,
        )
        .flatMap(resultSeasons),
    ]
      .sort()
      .reverse()[0]
    if (published) return published
  }
  return (
    historical.value
      .filter(
        (item) =>
          (discipline.value === 'all' || item.discipline === discipline.value) &&
          (team.value === 'all' || item.team === team.value),
      )
      .flatMap(resultSeasons)
      .sort()
      .reverse()[0] ?? 'all'
  )
})
const seasonOptions = computed(() => {
  const values = new Set<string>()
  for (const match of matches.value)
    if (discipline.value === 'all' || discipline.value === '5x5')
      if (matchSeason(match)) values.add(matchSeason(match)!)
  for (const item of historical.value)
    if (discipline.value === 'all' || item.discipline === discipline.value)
      resultSeasons(item).forEach((value) => values.add(value))
  if (season.value !== 'all') values.add(season.value)
  return [
    { value: 'all', label: 'Все сезоны' },
    ...Array.from(values)
      .sort()
      .reverse()
      .map((value) => ({ value, label: seasonLabel(value) })),
  ]
})
const filtered = computed(() =>
  matches.value.filter(
    (match) =>
      (discipline.value === 'all' || discipline.value === '5x5') &&
      (team.value === 'all' || match.team?.category === team.value) &&
      (status.value === 'all' || match.status === status.value) &&
      (season.value === 'all' || matchSeason(match) === season.value),
  ),
)
const filteredAdditional = computed(() =>
  additional.value.filter(
    (item) =>
      (discipline.value === 'all' || item.discipline === discipline.value) &&
      (team.value === 'all' || item.team === team.value) &&
      (status.value === 'all' || item.status === status.value) &&
      (season.value === 'all' || resultSeasons(item).includes(season.value)),
  ),
)
const total = computed(() => filtered.value.length + filteredAdditional.value.length)
const statusRank = (match: Match) =>
  match.status === 'live' ? 0 : match.status === 'scheduled' ? 1 : 2
const upcoming = computed(() =>
  filtered.value
    .filter(
      (match) =>
        match.status === 'live' || (match.status === 'scheduled' && startTime(match) >= now.value),
    )
    .slice()
    .sort((a, b) => statusRank(a) - statusRank(b) || startTime(a) - startTime(b)),
)
const changed = computed(() =>
  filtered.value
    .filter((match) => !['live', 'scheduled', 'finished'].includes(match.status))
    .slice()
    .sort((a, b) => startTime(b) - startTime(a)),
)
const awaitingResult = computed(() =>
  filtered.value
    .filter((match) => match.status === 'scheduled' && startTime(match) < now.value)
    .slice()
    .sort((a, b) => startTime(b) - startTime(a)),
)
const awaitingHistorical = computed(() =>
  filteredAdditional.value.filter((item) => !['finished', 'participated'].includes(item.status)),
)
type ResultEntry = {
  key: string
  season: string
  timestamp: number
  match?: Match
  result?: PublicResult
}
const results = computed<ResultEntry[]>(() =>
  [
    ...filtered.value
      .filter((match) => match.status === 'finished')
      .map((match) => ({
        key: `match-${match.id}`,
        season: matchSeason(match) ?? 'unknown',
        timestamp: startTime(match),
        match,
      })),
    ...filteredAdditional.value
      .filter((item) => ['finished', 'participated'].includes(item.status))
      .map((result) => ({
        key: `result-${result.id}`,
        season:
          resultSeasons(result).length === 1
            ? resultSeasons(result)[0]!
            : season.value === 'all'
              ? 'unknown'
              : season.value,
        timestamp: new Date(result.event_date ?? `${result.year}-01-01`).getTime(),
        result,
      })),
  ].sort((a, b) => b.timestamp - a.timestamp || a.key.localeCompare(b.key)),
)
const totalPages = computed(() => Math.max(1, Math.ceil(results.value.length / 24)))
const page = computed(() =>
  Math.min(totalPages.value, Math.max(1, Number.parseInt(String(route.query.page), 10) || 1)),
)
function changePage(value: number) {
  void router.push({ query: { ...route.query, page: value === 1 ? undefined : String(value) } })
  document.getElementById('match-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
const resultGroups = computed(() => {
  const groups = new Map<string, ResultEntry[]>()
  for (const item of results.value.slice((page.value - 1) * 24, page.value * 24)) {
    if (!groups.has(item.season)) groups.set(item.season, [])
    groups.get(item.season)!.push(item)
  }
  return Array.from(groups, ([name, items]) => ({ name, items }))
})
const hasVisibleMatches = computed(() => total.value > 0)
</script>

<template>
  <div class="matches-page">
    <section class="page-hero page-hero--compact">
      <div class="container">
        <h1>Матчи</h1>
      </div>
    </section>
    <section class="section section--light">
      <div class="container">
        <div class="filters match-filters">
          <AppSelect v-model="team" label="Команда" :options="teamOptions" />
          <AppSelect v-model="season" label="Сезон" :options="seasonOptions" />
          <AppSelect v-model="discipline" label="Формат игры" :options="disciplineOptions" />
          <AppSelect v-model="status" label="Статус" :options="statusOptions" />
          <p class="match-filters__summary" aria-live="polite">
            Найдено: {{ loading ? '…' : total }}
          </p>
          <button
            v-if="hasFilters"
            class="match-filters__reset"
            type="button"
            @click="resetFilters"
          >
            Сбросить фильтры
          </button>
        </div>
        <p
          v-if="!error && (calendar.error.value || history.error.value)"
          class="match-load-note"
          role="status"
        >
          Часть данных не удалось загрузить.
          <button type="button" @click="load">Повторить загрузку</button>
        </p>
        <AsyncState
          :pending="pending"
          :error="error"
          :empty="!hasVisibleMatches"
          empty-text="По выбранным фильтрам матчей нет."
          @retry="load"
        >
          <section v-if="upcoming.length" class="match-group">
            <div class="match-group__heading">
              <h2>Ближайшие</h2>
              <span>{{ upcoming.length }}</span>
            </div>
            <div class="match-list">
              <MatchCard v-for="match in upcoming" :key="match.id" :match="match" variant="row" />
            </div>
          </section>
          <section v-if="changed.length" class="match-group">
            <div class="match-group__heading">
              <h2>Изменения в расписании</h2>
              <span>{{ changed.length }}</span>
            </div>
            <div class="match-list">
              <MatchCard v-for="match in changed" :key="match.id" :match="match" variant="row" />
            </div>
          </section>
          <section v-if="results.length" id="match-results" class="match-group">
            <div class="match-group__heading">
              <h2>Сыгранные матчи</h2>
              <span>{{ results.length }}</span>
            </div>
            <div class="match-seasons">
              <section v-for="group in resultGroups" :key="group.name" class="match-season">
                <h3 v-if="season === 'all'" class="match-season__heading">
                  {{ seasonLabel(group.name) }}
                </h3>
                <div class="match-list">
                  <template v-for="entry in group.items" :key="entry.key">
                    <MatchCard v-if="entry.match" :match="entry.match" variant="row" />
                    <HistoricalMatchCard v-else-if="entry.result" :result="entry.result" />
                  </template>
                </div>
              </section>
            </div>
            <nav v-if="totalPages > 1" class="match-pagination" aria-label="Страницы матчей">
              <button type="button" :disabled="page === 1" @click="changePage(page - 1)">
                ← Назад
              </button>
              <span aria-live="polite">{{ page }} / {{ totalPages }}</span>
              <button type="button" :disabled="page >= totalPages" @click="changePage(page + 1)">
                Дальше →
              </button>
            </nav>
          </section>
          <section
            v-if="awaitingResult.length || awaitingHistorical.length"
            class="match-group match-group--awaiting-result"
          >
            <div class="match-group__heading">
              <h2>Счёт уточняется</h2>
              <span>{{ awaitingResult.length + awaitingHistorical.length }}</span>
            </div>
            <p class="match-group__explanation">Официальный результат пока не опубликован.</p>
            <div class="match-list">
              <MatchCard
                v-for="match in awaitingResult"
                :key="match.id"
                :match="match"
                variant="row"
              />
              <HistoricalMatchCard
                v-for="result in awaitingHistorical"
                :key="result.id"
                :result="result"
              />
            </div>
          </section>
        </AsyncState>
      </div>
    </section>
  </div>
</template>

<style scoped>
.match-filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: end;
  gap: 20px;
  margin-bottom: 24px;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: #fff;
}
.match-filters :deep(.app-select) {
  width: 100%;
  min-width: 0;
}
.match-filters__summary {
  grid-column: 1 / 3;
  margin: 0;
  align-self: center;
  font-size: 0.85rem;
  color: #52677b;
}
.match-filters__reset {
  grid-column: 3 / -1;
  justify-self: end;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid #cbd6e2;
  border-radius: 8px;
  background: #fff;
  color: var(--navy);
  font-size: 0.8rem;
  cursor: pointer;
}
.match-filters__reset:hover {
  border-color: var(--navy);
  background: #edf2f7;
}
.match-filters__reset:focus-visible {
  outline: 3px solid #4d82b2;
  outline-offset: 3px;
}
.match-load-note {
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
  line-height: 1.6;
}
.match-load-note button {
  min-height: 44px;
  border: 0;
  background: transparent;
  text-decoration: underline;
  color: var(--navy);
  cursor: pointer;
}
.match-seasons {
  display: grid;
  gap: 48px;
}
.match-list {
  gap: 20px;
}
.match-season__heading {
  margin: 0 0 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #cbd6e2;
  color: #52677b;
  font-size: 1rem;
  font-weight: 600;
}
.match-group__explanation {
  margin: 0 0 24px;
  color: #526477;
  font-size: 0.85rem;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
#match-results {
  scroll-margin-top: 140px;
}
.match-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-top: 32px;
  font-size: 0.85rem;
}
.match-pagination button {
  min-height: 44px;
  padding: 8px 16px;
  border: 1px solid #cbd6e2;
  border-radius: 8px;
  background: #fff;
  color: var(--navy);
  font: inherit;
  cursor: pointer;
}
.match-pagination button:disabled {
  opacity: 0.45;
  cursor: default;
}
@media (max-width: 1000px) {
  .match-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .match-filters__summary {
    grid-column: 1;
  }
  .match-filters__reset {
    grid-column: 2;
  }
}
@media (max-width: 600px) {
  .match-filters {
    gap: 16px;
    padding: 20px;
  }
  .match-filters :deep(.app-select) {
    grid-column: 1 / -1;
  }
  .match-filters__summary {
    font-size: 0.8rem;
  }
  .match-group__heading {
    align-items: start;
    gap: 12px;
  }
  .match-group__heading h2 {
    flex: 1;
    min-width: 0;
    font-size: 1.4rem;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .match-group__heading > span {
    flex-shrink: 0;
  }
}
</style>
