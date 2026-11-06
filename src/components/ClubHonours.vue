<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AsyncState from '@/components/AsyncState.vue'
import { useLoad } from '@/composables/useLoad'
import { apiRequest } from '@/shared/api'
import type { ApiResponse } from '@/shared/types'

interface Honour {
  id: string
  team: 'men' | 'women'
  discipline: string
  year: number
  tournament: string
  location: string | null
  place: number
}
interface Honours {
  from_year?: number | null
  to_year?: number | null
  titles: number
  championships: number
  silver: number
  bronze: number
  podiums: number
  items: Honour[]
}
const team = ref('all')
const podiums = ref(false)
const { data, pending, error, load } = useLoad(
  () =>
    apiRequest<ApiResponse<Honours>>(
      `/api/v1/results-archive/honours${team.value === 'all' ? '' : `?team=${team.value}`}`,
    ),
  [team],
)
const honours = computed(() => data.value?.data)
const podiumLabel = computed(() => {
  const category = new Intl.PluralRules('ru').select(honours.value?.podiums ?? 0)
  return category === 'one'
    ? 'призовое место'
    : category === 'few'
      ? 'призовых места'
      : 'призовых мест'
})
const period = computed(() => {
  const years = (honours.value?.items ?? []).map((item) => item.year)
  const from = honours.value?.from_year ?? (years.length ? Math.min(...years) : null)
  const to = honours.value?.to_year ?? (years.length ? Math.max(...years) : null)
  return from && to ? (from === to ? String(from) : `${from}–${to}`) : ''
})
const items = computed(() =>
  (honours.value?.items ?? []).filter((item) => podiums.value || item.place === 1),
)
const visibleItems = computed(() => items.value.slice(0, 4))
const moreItems = computed(() => items.value.slice(4))
const medals = computed(() => [
  { kind: 'gold', label: 'Золото', value: honours.value?.titles ?? 0 },
  { kind: 'silver', label: 'Серебро', value: honours.value?.silver ?? 0 },
  { kind: 'bronze', label: 'Бронза', value: honours.value?.bronze ?? 0 },
])
const teamFilters = [
  { value: 'all', label: 'Весь клуб' },
  { value: 'men', label: 'Мужчины' },
  { value: 'women', label: 'Девушки' },
]
function discipline(value: string) {
  return value === '3x3' ? '3×3' : value === 'phygital' ? 'Фиджитал' : '5×5'
}
</script>

<template>
  <section class="section club-honours" aria-labelledby="club-honours-title">
    <div class="container">
      <div class="honours-heading">
        <div>
          <h2 id="club-honours-title">Победы клуба</h2>
          <p v-if="period" class="honours-period">{{ period }}</p>
        </div>
        <RouterLink class="text-link" to="/club#club-tournaments"
          >Все выступления <span>→</span></RouterLink
        >
      </div>
      <div class="honours-team-filter" role="group" aria-label="Достижения команды">
        <button
          v-for="filter in teamFilters"
          :key="filter.value"
          type="button"
          :aria-pressed="team === filter.value"
          @click="team = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>
      <AsyncState :pending="pending" :error="error" @retry="load">
        <template v-if="honours">
          <div class="honours-scoreboard">
            <div
              v-for="medal in medals"
              :key="medal.kind"
              class="honours-medal"
              :class="`honours-medal--${medal.kind}`"
            >
              <svg class="honours-medal__icon" viewBox="0 0 72 84" aria-hidden="true">
                <path
                  class="honours-medal__ribbon"
                  d="M17 4h15l9 29-16 8L17 4Zm23 0h15l-8 37-16-8L40 4Z"
                />
                <circle class="honours-medal__disc" cx="36" cy="51" r="27" />
                <circle class="honours-medal__ring" cx="36" cy="51" r="20" />
                <path
                  class="honours-medal__star"
                  d="m36 39 3.7 7.5 8.3 1.2-6 5.8 1.4 8.3-7.4-3.9-7.4 3.9 1.4-8.3-6-5.8 8.3-1.2L36 39Z"
                />
              </svg>
              <div class="honours-medal__value">
                <strong>{{ medal.value }}</strong>
                <span>{{ medal.label }}</span>
              </div>
            </div>
          </div>
          <div class="honours-total">
            <span
              ><strong>{{ honours.podiums }}</strong> {{ podiumLabel }}</span
            >
            <span v-if="honours.championships" class="honours-championships">
              Чемпионства: {{ honours.championships }}
            </span>
          </div>
          <div class="honours-list-heading">
            <h3>{{ podiums ? 'Призовые места' : 'Первые места' }}</h3>
            <button type="button" :aria-pressed="podiums" @click="podiums = !podiums">
              {{ podiums ? 'Только победы' : 'Все призовые места' }}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          <div class="honours-list">
            <article v-for="item in visibleItems" :key="item.id" class="honour-row">
              <span
                class="honour-row__place"
                :class="`honour-row__place--${item.place}`"
                :aria-label="`${item.place} место`"
              >
                {{ item.place }}
              </span>
              <div class="honour-row__body">
                <p>
                  {{ item.team === 'men' ? 'Мужчины' : 'Девушки' }}
                  <span>· {{ discipline(item.discipline) }}</span>
                </p>
                <h4>{{ item.tournament }}</h4>
                <span v-if="item.location" class="honour-row__location">{{ item.location }}</span>
              </div>
              <span class="honour-row__year">{{ item.year }}</span>
            </article>
          </div>
          <details v-if="moreItems.length" class="honours-more">
            <summary>
              Ещё награды · {{ moreItems.length }} <span aria-hidden="true">+</span>
            </summary>
            <div class="honours-list">
              <article v-for="item in moreItems" :key="item.id" class="honour-row">
                <span
                  class="honour-row__place"
                  :class="`honour-row__place--${item.place}`"
                  :aria-label="`${item.place} место`"
                >
                  {{ item.place }}
                </span>
                <div class="honour-row__body">
                  <p>
                    {{ item.team === 'men' ? 'Мужчины' : 'Девушки' }} ·
                    {{ discipline(item.discipline) }}
                  </p>
                  <h4>{{ item.tournament }}</h4>
                  <span v-if="item.location" class="honour-row__location">{{ item.location }}</span>
                </div>
                <span class="honour-row__year">{{ item.year }}</span>
              </article>
            </div>
          </details>
          <p v-if="!items.length" class="honours-empty" role="status">
            {{ podiums ? 'Призовые места' : 'Первые места' }} этой команды ещё не добавлены.
          </p>
        </template>
      </AsyncState>
    </div>
  </section>
</template>

<style scoped>
.club-honours {
  background: #062b4b;
  color: #fff;
}
.honours-heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 24px;
  margin-bottom: 28px;
}
.honours-heading h2 {
  margin: 0;
  font-size: clamp(2.25rem, 4.5vw, 4.5rem);
  line-height: 1.05;
}
.honours-period {
  margin: 12px 0 0;
  color: #b9cddd;
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
}
.honours-heading a {
  color: #fff;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 16px;
}
.honours-team-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 36px;
}
.honours-team-filter button {
  min-height: 44px;
  padding: 10px 20px;
  border: 1px solid #7390a8;
  border-radius: 99px;
  background: transparent;
  color: #e4edf5;
  font: inherit;
  cursor: pointer;
}
.honours-team-filter button[aria-pressed='true'] {
  background: #fff;
  color: #092d4c;
  border-color: #fff;
}
.honours-scoreboard {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding-block: 32px;
  border-block: 1px solid #65839a;
}
.honours-medal {
  display: flex;
  gap: 24px;
  align-items: center;
  justify-content: center;
  padding-inline: 24px;
  --medal: #f1cc83;
  --medal-shadow: #a77c34;
}
.honours-medal + .honours-medal {
  border-left: 1px solid #65839a;
}
.honours-medal--silver {
  --medal: #d8e5f0;
  --medal-shadow: #8aadc7;
}
.honours-medal--bronze {
  --medal: #e9b38d;
  --medal-shadow: #ab7552;
}
.honours-medal__icon {
  width: 72px;
  height: 84px;
  flex-shrink: 0;
}
.honours-medal__ribbon {
  fill: #e15d53;
}
.honours-medal__disc {
  fill: var(--medal);
}
.honours-medal__ring {
  fill: none;
  stroke: var(--medal-shadow);
  stroke-width: 1.5;
}
.honours-medal__star {
  fill: var(--medal-shadow);
}
.honours-medal strong {
  display: block;
  font:
    500 clamp(3rem, 5.5vw, 5.5rem)/1 'Oswald',
    sans-serif;
  font-variant-numeric: tabular-nums;
}
.honours-medal__value span {
  display: block;
  margin-top: 12px;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--medal);
}
.honours-total {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 24px;
  padding-top: 20px;
  margin-bottom: 48px;
  color: #b9cede;
  font-size: 0.85rem;
  line-height: 1.6;
}
.honours-total strong {
  color: #fff;
}
.honours-championships {
  padding-left: 24px;
  border-left: 1px solid #65839a;
}
.honours-list-heading {
  display: flex;
  gap: 24px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.honours-list-heading h3 {
  font-size: 1.7rem;
  margin: 0;
}
.honours-list-heading button {
  border: 0;
  background: none;
  font: inherit;
  color: #fff;
  min-height: 44px;
  padding: 4px 0;
  text-decoration: underline;
  text-underline-offset: 5px;
  cursor: pointer;
}
.honour-row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) 72px;
  gap: 28px;
  align-items: center;
  padding-block: 28px;
  border-top: 1px solid #4e6f88;
}
.honour-row__year {
  justify-self: end;
  font:
    1.6rem 'Oswald',
    sans-serif;
  color: #b9cede;
}
.honour-row__place {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border: 1px solid #adc5d8;
  border-radius: 50%;
  box-shadow:
    inset 0 0 0 5px #062b4b,
    inset 0 0 0 6px #adc5d8;
  font:
    500 1.4rem 'Oswald',
    sans-serif;
  color: #dce8f0;
}
.honour-row__place--1 {
  color: #f6d591;
  border-color: #d6ad63;
  box-shadow:
    inset 0 0 0 5px #062b4b,
    inset 0 0 0 6px #d6ad63;
}
.honour-row__place--3 {
  color: #f2bd9c;
  border-color: #b88968;
  box-shadow:
    inset 0 0 0 5px #062b4b,
    inset 0 0 0 6px #b88968;
}
.honour-row__body p {
  margin: 0 0 8px;
  color: #f1aca4;
  font-size: 0.75rem;
  font-weight: 700;
}
.honour-row__body h4 {
  margin: 0;
  font:
    500 clamp(1.1rem, 1.7vw, 1.5rem)/1.35 'Oswald',
    sans-serif;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}
.honour-row__location {
  display: block;
  margin-top: 8px;
  color: #b9cede;
  font-size: 0.8rem;
  line-height: 1.5;
}
.honours-more {
  border-bottom: 1px solid #4e6f88;
}
.honours-more summary {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  min-height: 60px;
  cursor: pointer;
  color: #fff;
  font-weight: 700;
}
.honours-more summary span {
  font-size: 1.5rem;
}
.honours-empty {
  line-height: 1.7;
}
button:focus-visible,
summary:focus-visible,
a:focus-visible {
  outline: 3px solid #f1bc68;
  outline-offset: 4px;
}
@media (max-width: 900px) {
  .honours-medal {
    gap: 16px;
    padding-inline: 16px;
  }
  .honours-medal__icon {
    width: 56px;
    height: 66px;
  }
}
@media (max-width: 600px) {
  .honours-heading {
    align-items: start;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 20px;
  }
  .honours-team-filter {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-bottom: 28px;
  }
  .honours-team-filter button {
    padding-inline: 8px;
    font-size: 0.85rem;
  }
  .honours-scoreboard {
    padding-block: 24px;
  }
  .honours-medal {
    flex-direction: column;
    gap: 16px;
    padding-inline: 8px;
    text-align: center;
  }
  .honours-medal__icon {
    width: 48px;
    height: 56px;
  }
  .honours-medal strong {
    font-size: 3rem;
  }
  .honours-medal__value span {
    font-size: 0.75rem;
    margin-top: 10px;
  }
  .honours-total {
    gap: 8px 16px;
    margin-bottom: 36px;
    font-size: 0.78rem;
  }
  .honours-championships {
    padding-left: 16px;
  }
  .honours-list-heading {
    flex-direction: column;
    align-items: start;
    gap: 8px;
  }
  .honour-row {
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 12px 20px;
    align-items: start;
    padding-block: 24px;
  }
  .honour-row__place {
    width: 44px;
    height: 44px;
    grid-row: 1 / 3;
    font-size: 1.2rem;
  }
  .honour-row__body {
    grid-column: 2;
  }
  .honour-row__year {
    grid-column: 2;
    justify-self: start;
    font-size: 1.15rem;
  }
}
</style>
