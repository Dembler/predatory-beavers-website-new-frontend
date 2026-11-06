<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppSelect from '@/components/AppSelect.vue'
import AsyncState from '@/components/AsyncState.vue'
import { useLoad } from '@/composables/useLoad'
import { apiRequest } from '@/shared/api'
import { clubCopy } from '@/shared/clubCopy'
import type { ApiResponse } from '@/shared/types'
import type { PublicResult } from '@/shared/results'

interface Tournament {
  key: string
  name: string
  description: string
  organizer: string
  logo_url: string | null
  logo_alt: string
  logo_scope: string
  results: PublicResult[]
}
const { data, pending, error, load } = useLoad(() =>
  apiRequest<ApiResponse<{ items: Tournament[]; result_count: number }>>(
    '/api/v1/results-archive/tournaments',
  ),
)
const route = useRoute()
const router = useRouter()
const team = computed({
  get: () =>
    ['men', 'women'].includes(String(route.query.team)) ? String(route.query.team) : 'all',
  set: (value: string) => {
    void router.replace({
      query: { ...route.query, team: value === 'all' ? undefined : value },
      hash: route.hash,
    })
  },
})
const discipline = computed({
  get: () =>
    ['5x5', '3x3', 'phygital'].includes(String(route.query.discipline))
      ? String(route.query.discipline)
      : 'all',
  set: (value: string) => {
    void router.replace({
      query: { ...route.query, discipline: value === 'all' ? undefined : value },
      hash: route.hash,
    })
  },
})
const expanded = ref(false)
const tournaments = computed(() =>
  (data.value?.data?.items ?? [])
    .map((item) => ({
      ...item,
      name: clubCopy(item.name),
      description: clubCopy(item.description),
      organizer: clubCopy(item.organizer),
      results: item.results
        .filter((result) => team.value === 'all' || result.team === team.value)
        .filter((result) => discipline.value === 'all' || result.discipline === discipline.value)
        .map((result) => ({ ...result, tournament: clubCopy(result.tournament) })),
    }))
    .filter((item) => item.results.length),
)
const visible = computed(() => tournaments.value.slice(0, expanded.value ? undefined : 6))
const count = computed(() =>
  tournaments.value.reduce((total, item) => total + item.results.length, 0),
)
function format(value: string) {
  return value === '3x3' ? '3×3' : value === 'phygital' ? 'Фиджитал' : '5×5'
}
function plural(value: number, one: string, few: string, many: string) {
  const category = new Intl.PluralRules('ru').select(value)
  return category === 'one' ? one : category === 'few' ? few : many
}
</script>

<template>
  <section
    id="club-tournaments"
    class="section section--light club-tournaments"
    aria-labelledby="club-tournaments-title"
  >
    <div class="container">
      <div class="tournaments-heading">
        <div>
          <h2 id="club-tournaments-title">Турниры клуба</h2>
        </div>
        <RouterLink to="/matches" class="text-link"
          >К матчам <span aria-hidden="true">↗</span></RouterLink
        >
      </div>
      <div class="tournaments-tools">
        <div class="tournaments-filters" role="group" aria-label="Участие команд в турнирах">
          <button
            v-for="filter in [
              { value: 'all', label: 'Весь клуб' },
              { value: 'men', label: 'Мужчины' },
              { value: 'women', label: 'Девушки' },
            ]"
            :key="filter.value"
            type="button"
            :aria-pressed="team === filter.value"
            @click="team = filter.value"
          >
            {{ filter.label }}
          </button>
        </div>
        <AppSelect
          v-model="discipline"
          label="Формат турнира"
          :options="[
            { value: 'all', label: 'Все форматы' },
            { value: '5x5', label: 'Баскетбол 5×5' },
            { value: '3x3', label: 'Баскетбол 3×3' },
            { value: 'phygital', label: 'Фиджитал' },
          ]"
        />
      </div>
      <AsyncState :pending="pending" :error="error" @retry="load">
        <template v-if="data">
          <p class="tournaments-count">
            {{ tournaments.length }}
            {{ plural(tournaments.length, 'турнир', 'турнира', 'турниров') }} · {{ count }}
            {{ plural(count, 'выступление', 'выступления', 'выступлений') }}
          </p>
          <p v-if="!tournaments.length" class="tournaments-empty" role="status">
            В этом формате у команды пока нет выступлений.
          </p>
          <div v-else class="tournaments-grid">
            <article v-for="item in visible" :key="item.key" class="tournament-story">
              <div class="tournament-story__header">
                <div
                  class="tournament-story__logo"
                  :class="{ 'tournament-story__logo--dark': item.key === 'assk-championship' }"
                >
                  <img
                    v-if="item.logo_url"
                    :src="item.logo_url"
                    :alt="item.logo_alt"
                    loading="lazy"
                  />
                  <span v-else aria-hidden="true">{{ item.name.slice(0, 2) }}</span>
                </div>
                <div>
                  <p v-if="item.organizer" class="tournament-story__organizer">
                    {{ item.organizer }}
                  </p>
                  <h3>{{ item.name }}</h3>
                </div>
              </div>
              <p class="tournament-story__description">{{ item.description }}</p>
              <details class="tournament-story__results">
                <summary>
                  Выступления клуба <span>{{ item.results.length }}</span>
                  <b aria-hidden="true">+</b>
                </summary>
                <ol>
                  <li v-for="result in item.results" :key="result.id">
                    <span
                      class="tournament-story__place"
                      :class="{
                        'tournament-story__place--podium': result.place && result.place <= 3,
                      }"
                      :aria-label="result.place ? `${result.place} место` : 'Участие'"
                      >{{ result.place ?? '—'
                      }}<small>{{ result.place ? 'место' : 'участие' }}</small></span
                    >
                    <div>
                      <p class="tournament-story__meta">
                        {{ result.year }} · {{ result.team === 'men' ? 'Мужчины' : 'Девушки' }} ·
                        {{ format(result.discipline) }}
                      </p>
                      <h4>{{ result.tournament }}</h4>
                      <p v-if="result.location" class="tournament-story__location">
                        {{ result.location }}
                      </p>
                    </div>
                  </li>
                </ol>
              </details>
            </article>
          </div>
          <button
            v-if="tournaments.length > 6"
            type="button"
            class="tournaments-more"
            :aria-expanded="expanded"
            @click="expanded = !expanded"
          >
            {{ expanded ? 'Свернуть коллекцию' : `Все турниры · ${tournaments.length}` }}
            <span aria-hidden="true">{{ expanded ? '−' : '+' }}</span>
          </button>
        </template>
      </AsyncState>
    </div>
  </section>
</template>

<style scoped>
.club-tournaments {
  background: #edf1f4;
  color: #092d4c;
}
.tournaments-heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 32px;
  margin-bottom: 32px;
}
.tournaments-heading h2 {
  margin: 0;
  font-size: clamp(2rem, 4.3vw, 4rem);
  line-height: 1.08;
}
.tournaments-heading > a {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 20px;
}
.tournaments-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.tournaments-tools {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}
.tournaments-tools :deep(.app-select) {
  flex-basis: 280px;
  width: min(100%, 280px);
}
.tournaments-filters button {
  min-height: 44px;
  padding: 10px 20px;
  border: 1px solid #8fa4b5;
  border-radius: 100px;
  background: transparent;
  color: #143852;
  font: inherit;
  cursor: pointer;
}
.tournaments-filters button[aria-pressed='true'] {
  color: #fff;
  background: #0b304e;
  border-color: #0b304e;
}
.tournaments-count {
  color: #52677b;
  margin: 20px 0 28px;
  font-size: 0.8rem;
}
.tournaments-empty {
  margin: 0;
  padding: 28px;
  border: 1px solid #c6d3de;
  border-radius: 12px;
  color: #415b70;
  line-height: 1.7;
}
.tournaments-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 24px;
}
.tournament-story {
  padding: 32px;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.tournament-story__header {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 24px;
  align-items: center;
  margin-bottom: 24px;
}
.tournament-story__logo {
  height: 88px;
  width: 88px;
  display: grid;
  place-items: center;
  background: #f4f6f8;
  padding: 12px;
  border-radius: 8px;
}
.tournament-story__logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.tournament-story__logo--dark {
  background: #092d4c;
}
.tournament-story__organizer {
  font-size: 0.7rem;
  line-height: 1.5;
  color: #627588;
  margin: 0 0 8px;
}
.tournament-story h3 {
  font-size: clamp(1.4rem, 2.3vw, 2rem);
  line-height: 1.2;
  margin: 0;
  overflow-wrap: anywhere;
}
.tournament-story__description {
  margin: 0 0 28px;
  font-size: 0.9rem;
  line-height: 1.8;
  color: #415b70;
}
.tournament-story__results {
  margin-top: auto;
  border-top: 1px solid #d8e1e8;
}
.tournament-story__results summary {
  min-height: 56px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
}
.tournament-story__results summary > span {
  color: #627588;
  font-weight: 400;
}
.tournament-story__results summary > b {
  margin-left: auto;
  font-size: 1.5rem;
  font-weight: 400;
}
.tournament-story__results[open] summary > b {
  transform: rotate(45deg);
}
.tournament-story__results ol {
  padding: 0;
  margin: 0;
  list-style: none;
}
.tournament-story__results li {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 16px;
  border-top: 1px solid #e1e7ec;
  padding-block: 20px;
}
.tournament-story__place {
  font:
    500 1.7rem/1.15 'Oswald',
    sans-serif;
  color: #52677b;
}
.tournament-story__place--podium {
  color: #905c12;
}
.tournament-story__place small {
  display: block;
  font:
    0.6rem/1.6 'Roboto',
    sans-serif;
  margin-top: 4px;
}
.tournament-story__meta,
.tournament-story__location {
  color: #52677b;
  font-size: 0.72rem;
  line-height: 1.7;
  margin: 0;
}
.tournament-story h4 {
  font:
    500 1rem/1.4 'Oswald',
    sans-serif;
  margin: 8px 0;
}
.tournaments-more {
  margin-top: 32px;
  padding: 16px 24px;
  min-height: 56px;
  width: 100%;
  border: 1px solid #8fa4b5;
  border-radius: 8px;
  background: transparent;
  color: #143852;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.tournaments-more span {
  font-size: 1.4rem;
  font-weight: 400;
}
button:focus-visible,
summary:focus-visible,
a:focus-visible {
  outline: 3px solid #a62c24;
  outline-offset: 4px;
}
@media (max-width: 900px) {
  .tournaments-tools :deep(.app-select) {
    flex-basis: 240px;
    width: 240px;
  }
  .tournament-story {
    padding: 24px;
  }
  .tournament-story__header {
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 16px;
  }
  .tournament-story__logo {
    width: 64px;
    height: 64px;
    padding: 8px;
  }
}
@media (max-width: 700px) {
  .tournaments-heading {
    align-items: start;
    flex-direction: column;
    gap: 20px;
  }
  .tournaments-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  .tournament-story {
    padding: 24px 20px;
  }
  .tournaments-filters button {
    font-size: 0.8rem;
    padding-inline: 8px;
  }
  .tournaments-filters {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
  }
  .tournaments-tools {
    align-items: stretch;
    gap: 20px;
  }
  .tournaments-tools :deep(.app-select) {
    flex-basis: 100%;
    width: 100%;
  }
}
</style>
