<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AsyncState from '@/components/AsyncState.vue'
import AppSelect from '@/components/AppSelect.vue'
import MatchCard from '@/components/MatchCard.vue'
import { useLoad } from '@/composables/useLoad'
import { useTeamFilter } from '@/composables/useTeamPreference'
import { allPages } from '@/shared/api'
import type { Match } from '@/shared/types'

type StatusFilter = 'all' | 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'

const team = useTeamFilter('all')
const status = ref<StatusFilter>('all')
const now = ref(Date.now())
let clockTimer: number | undefined
onMounted(() => {
  clockTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 30_000)
})
onUnmounted(() => window.clearInterval(clockTimer))
const hasFilters = computed(() => team.value !== 'all' || status.value !== 'all')
function resetFilters() {
  team.value = 'all'
  status.value = 'all'
}
const teamOptions = [
  { value: 'all', label: 'Все команды' },
  { value: 'men', label: 'Мужская команда' },
  { value: 'women', label: 'Женская команда' },
] as const
const statusOptions = [
  { value: 'all', label: 'Все статусы' },
  { value: 'scheduled', label: 'Запланирован' },
  { value: 'live', label: 'Идёт' },
  { value: 'finished', label: 'Завершён' },
  { value: 'postponed', label: 'Перенесён' },
  { value: 'cancelled', label: 'Отменён' },
] as const

const { data, pending, error, load } = useLoad(() => allPages<Match>('/api/v1/matches'))
const matches = computed(() => data.value ?? [])

const filtered = computed(() =>
  matches.value.filter((match) => {
    const teamMatches = team.value === 'all' || match.team?.category === team.value
    const statusMatches = status.value === 'all' || match.status === status.value
    return teamMatches && statusMatches
  }),
)

const startTime = (match: Match) => new Date(match.starts_at).getTime()
const statusRank = (match: Match) => {
  if (match.status === 'live') return 0
  if (match.status === 'scheduled') return 1
  return 2
}

const upcoming = computed(() =>
  filtered.value
    .filter(
      (match) =>
        match.status === 'live' || (match.status === 'scheduled' && startTime(match) >= now.value),
    )
    .slice()
    .sort(
      (left, right) => statusRank(left) - statusRank(right) || startTime(left) - startTime(right),
    ),
)

const results = computed(() =>
  filtered.value
    .filter((match) => match.status === 'finished')
    .slice()
    .sort((left, right) => startTime(right) - startTime(left)),
)

const awaitingResult = computed(() =>
  filtered.value
    .filter((match) => match.status === 'scheduled' && startTime(match) < now.value)
    .slice()
    .sort((left, right) => startTime(right) - startTime(left)),
)

const changed = computed(() =>
  filtered.value
    .filter((match) => !['live', 'scheduled', 'finished'].includes(match.status))
    .slice()
    .sort((left, right) => startTime(right) - startTime(left)),
)

const showUpcoming = computed(() => status.value !== 'finished')
const showResults = computed(() => status.value === 'all' || status.value === 'finished')
const hasVisibleMatches = computed(
  () =>
    (showUpcoming.value && upcoming.value.length > 0) ||
    (showUpcoming.value && changed.value.length > 0) ||
    (showUpcoming.value && awaitingResult.value.length > 0) ||
    (showResults.value && results.value.length > 0),
)
</script>

<template>
  <div>
    <section class="page-hero page-hero--compact">
      <div class="container">
        <p class="eyebrow">Календарь клуба</p>
        <h1>Расписание и результаты</h1>
      </div>
    </section>
    <section class="section section--light">
      <div class="container">
        <div class="filters match-filters">
          <AppSelect v-model="team" label="Команда" :options="teamOptions" />
          <AppSelect v-model="status" label="Статус" :options="statusOptions" />
          <p class="match-filters__summary" aria-live="polite">
            Найдено: {{ pending ? '…' : filtered.length }}
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

        <AsyncState
          :pending="pending"
          :error="error"
          :empty="!hasVisibleMatches"
          empty-text="По выбранным фильтрам матчей нет."
          @retry="load"
        >
          <section v-if="showUpcoming && upcoming.length" class="match-group">
            <div class="match-group__heading">
              <h2>Ближайшие</h2>
              <span>{{ upcoming.length }}</span>
            </div>
            <div class="match-list">
              <MatchCard v-for="match in upcoming" :key="match.id" :match="match" variant="row" />
            </div>
          </section>

          <section v-if="showUpcoming && changed.length" class="match-group">
            <div class="match-group__heading">
              <h2>Изменения в расписании</h2>
              <span>{{ changed.length }}</span>
            </div>
            <div class="match-list">
              <MatchCard v-for="match in changed" :key="match.id" :match="match" variant="row" />
            </div>
          </section>

          <section v-if="showResults && results.length" class="match-group">
            <div class="match-group__heading">
              <h2>Результаты</h2>
              <span>{{ results.length }}</span>
            </div>
            <div class="match-list">
              <MatchCard v-for="match in results" :key="match.id" :match="match" variant="row" />
            </div>
          </section>

          <section
            v-if="showUpcoming && awaitingResult.length"
            class="match-group match-group--awaiting-result"
          >
            <div class="match-group__heading">
              <h2>Результат уточняется</h2>
              <span>{{ awaitingResult.length }}</span>
            </div>
            <p class="match-group__explanation">
              Время начала этих матчей уже прошло. Официальный результат пока не опубликован.
            </p>
            <div class="match-list">
              <MatchCard
                v-for="match in awaitingResult"
                :key="match.id"
                :match="match"
                variant="row"
              />
            </div>
          </section>
        </AsyncState>
      </div>
    </section>
  </div>
</template>

<style scoped>
.match-group__explanation {
  margin: -4px 0 16px;
  color: #526477;
  font-size: 0.85rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.match-filters__reset {
  min-height: 44px;
  padding: 8px 12px;
  color: var(--navy);
  border: 1px solid #cbd6e2;
  border-radius: 8px;
  background: #fff;
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

@media (max-width: 700px) {
  .match-filters {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .match-filters > :deep(.app-select) {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }

  .match-filters__summary {
    margin: 0;
    font-size: 0.8rem;
  }

  .match-filters__reset {
    justify-self: end;
  }

  .match-group__heading {
    align-items: start;
    gap: 10px;
  }

  .match-group__heading h2 {
    min-width: 0;
    flex: 1;
    font-size: 1.4rem;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .match-group__heading > span {
    flex-shrink: 0;
    margin-top: 2px;
  }
}

@media (max-width: 430px) {
  .match-filters > :deep(.app-select) {
    grid-column: 1 / -1;
  }
}
</style>
