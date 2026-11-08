<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AsyncState from '@/components/AsyncState.vue'
import AppSelect from '@/components/AppSelect.vue'
import MatchCard from '@/components/MatchCard.vue'
import HistoricalMatchCard from '@/components/HistoricalMatchCard.vue'
import { useLoad } from '@/composables/useLoad'
import { useLiveRefresh } from '@/composables/useLiveRefresh'
import { useTeamFilter } from '@/composables/useTeamPreference'
import { apiRequest } from '@/shared/api'
import { explicitSeason } from '@/shared/results'
import type { CalendarEntry, CalendarPage, CalendarSection } from '@/shared/calendar'

const route = useRoute()
const router = useRouter()
const rememberedTeam = useTeamFilter('all')
function updateQuery(values: Record<string, string | undefined>) {
  void router.push({ query: { ...route.query, page: undefined, at: undefined, ...values } })
}
const team = computed({
  get: () => rememberedTeam.value,
  set: (value: 'all' | 'men' | 'women') => updateQuery({ team: value }),
})
function queryFilter(name: string, allowed: string[]) {
  return computed({
    get: () => {
      const value = route.query[name]
      return typeof value === 'string' && allowed.includes(value) ? value : 'all'
    },
    set: (value: string) => updateQuery({ [name]: value === 'all' ? undefined : value }),
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
watch(
  () => [route.query.season, route.query.year],
  () => {
    if (
      route.query.year !== undefined ||
      (route.query.season !== undefined && route.query.season !== querySeason.value)
    )
      void router.replace({
        query: {
          ...route.query,
          season: querySeason.value,
          year: undefined,
          page: undefined,
          at: undefined,
        },
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
const requestedPage = computed(() => {
  const value = route.query.page
  return typeof value === 'string' && /^[1-9]\d{0,6}$/u.test(value) ? Number(value) : 1
})
const snapshotTime = computed(() => {
  const value = route.query.at
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : undefined
})
const requestPath = computed(() => {
  const query = new URLSearchParams({ page: String(requestedPage.value), page_size: '24' })
  if (team.value !== 'all') query.set('team', team.value)
  if (discipline.value !== 'all') query.set('discipline', discipline.value)
  if (status.value !== 'all') query.set('status', status.value)
  if (querySeason.value) query.set('season', querySeason.value)
  if (snapshotTime.value) query.set('at', snapshotTime.value)
  return `/api/v1/calendar?${query}`
})
const calendar = useLoad(() => apiRequest<CalendarPage>(requestPath.value), [requestPath])
watch(calendar.data, (result) => {
  if (result && result.page !== requestedPage.value)
    void router.replace({
      query: { ...route.query, page: result.page === 1 ? undefined : String(result.page) },
      hash: route.hash,
    })
})
async function refreshCalendar() {
  // A pagination timestamp keeps date boundaries stable. A live refresh starts a fresh snapshot.
  if (snapshotTime.value) {
    await router.replace({ query: { ...route.query, at: undefined } })
    await nextTick()
  }
  await calendar.refresh()
}
useLiveRefresh(refreshCalendar)
const defaultSeason = computed(() => calendar.data.value?.default_season ?? 'all')
const season = computed({
  get: () => querySeason.value ?? calendar.data.value?.selected_season ?? defaultSeason.value,
  set: (value: string) => updateQuery({ season: value, year: undefined }),
})
const seasonLabel = (value: string) =>
  value === 'unknown' ? 'Сезон не уточнён' : value.replace('-', ' / ')
const seasonOptions = computed(() => {
  const values = new Set(calendar.data.value?.seasons ?? [])
  if (season.value !== 'all') values.add(season.value)
  return [
    { value: 'all', label: 'Все сезоны' },
    ...Array.from(values)
      .sort()
      .reverse()
      .map((value) => ({ value, label: seasonLabel(value) })),
  ]
})
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
const total = computed(() => calendar.data.value?.total ?? 0)
const totalPages = computed(() => calendar.data.value?.total_pages || 1)
const page = computed(() => calendar.data.value?.page ?? requestedPage.value)
const groups = computed(() => {
  const labels: Record<CalendarSection, string> = {
    upcoming: 'Ближайшие',
    changed: 'Изменения в расписании',
    results: 'Сыгранные матчи',
    awaiting: 'Счёт уточняется',
  }
  return (Object.keys(labels) as CalendarSection[])
    .map((section) => {
      const entries = (calendar.data.value?.items ?? []).filter((item) => item.section === section)
      const seasons = new Map<string, CalendarEntry[]>()
      for (const entry of entries) {
        const name = section === 'results' ? entry.season : ''
        if (!seasons.has(name)) seasons.set(name, [])
        seasons.get(name)!.push(entry)
      }
      return {
        section,
        label: labels[section],
        entries,
        count: calendar.data.value?.counts[section] ?? 0,
        seasons: Array.from(seasons, ([name, items]) => ({ name, items })),
      }
    })
    .filter((group) => group.entries.length)
})
const shownFrom = computed(() => (page.value - 1) * 24 + 1)
const shownTo = computed(() => Math.min(total.value, page.value * 24))
function changePage(value: number) {
  if (value < 1 || value > totalPages.value || calendar.pending.value) return
  void router.push({
    query: {
      ...route.query,
      season: season.value,
      at: calendar.data.value?.at,
      page: value === 1 ? undefined : String(value),
    },
  })
  document
    .getElementById('calendar-results')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="matches-page">
    <section class="page-hero page-hero--compact">
      <div class="container"><h1>Матчи</h1></div>
    </section>
    <section class="section section--light">
      <div class="container">
        <div class="filters match-filters">
          <AppSelect v-model="team" label="Команда" :options="teamOptions" />
          <AppSelect v-model="season" label="Сезон" :options="seasonOptions" />
          <AppSelect v-model="discipline" label="Формат игры" :options="disciplineOptions" />
          <AppSelect v-model="status" label="Статус" :options="statusOptions" />
          <p class="match-filters__summary" aria-live="polite">
            Найдено: {{ calendar.pending.value ? '…' : total }}
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
        <p v-if="calendar.refreshError.value" class="live-refresh-note" role="status">
          Не удалось обновить расписание. Показана последняя загруженная версия.
          <button type="button" :disabled="calendar.refreshing.value" @click="refreshCalendar">
            {{ calendar.refreshing.value ? 'Обновляем…' : 'Обновить' }}
          </button>
        </p>
        <div id="calendar-results">
          <AsyncState
            :pending="calendar.pending.value"
            :error="calendar.error.value"
            :empty="!total"
            empty-text="По выбранным фильтрам матчей нет."
            @retry="calendar.load"
          >
            <p v-if="totalPages > 1" class="calendar-range" aria-live="polite">
              Показаны {{ shownFrom }}–{{ shownTo }} из {{ total }}. Разделы продолжаются на
              следующих страницах.
            </p>
            <section
              v-for="group in groups"
              :key="group.section"
              class="match-group"
              :class="{ 'match-group--awaiting-result': group.section === 'awaiting' }"
            >
              <div class="match-group__heading">
                <h2>{{ group.label }}</h2>
                <span>{{ group.count }}</span>
              </div>
              <p v-if="group.section === 'awaiting'" class="match-group__explanation">
                Официальный результат пока не опубликован.
              </p>
              <div class="match-seasons">
                <section v-for="part in group.seasons" :key="part.name" class="match-season">
                  <h3
                    v-if="group.section === 'results' && season === 'all'"
                    class="match-season__heading"
                  >
                    {{ seasonLabel(part.name) }}
                  </h3>
                  <div class="match-list">
                    <template
                      v-for="entry in part.items"
                      :key="`${entry.kind}-${entry.match?.id ?? entry.result?.id}`"
                    >
                      <MatchCard v-if="entry.match" :match="entry.match" variant="row" />
                      <HistoricalMatchCard v-else-if="entry.result" :result="entry.result" />
                    </template>
                  </div>
                </section>
              </div>
            </section>
            <nav v-if="totalPages > 1" class="match-pagination" aria-label="Страницы матчей">
              <button type="button" :disabled="page === 1" @click="changePage(page - 1)">
                ← Назад
              </button>
              <span aria-live="polite">{{ page }} / {{ totalPages }}</span>
              <button type="button" :disabled="page >= totalPages" @click="changePage(page + 1)">
                Дальше →
              </button>
            </nav>
          </AsyncState>
        </div>
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
.calendar-range {
  margin: 0 0 28px;
  color: #52677b;
  font-size: 0.85rem;
  line-height: 1.6;
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
#calendar-results {
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
