<script setup lang="ts">
import { computed, ref } from 'vue'
import AsyncState from '@/components/AsyncState.vue'
import AppSelect from '@/components/AppSelect.vue'
import TeamEmblem from '@/components/TeamEmblem.vue'
import { useLoad } from '@/composables/useLoad'
import { useTeamFilter } from '@/composables/useTeamPreference'
import { allPages, ApiError, apiRequest } from '@/shared/api'
import type { ApiResponse, Competition, Standings } from '@/shared/types'
const team = useTeamFilter('men')
const season = ref('')
const showDraws = computed(() => data.value?.data?.rows.some((row) => row.draws > 0))
const signed = (value: number) =>
  value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0'
const teamOptions = [
  { value: 'men', label: 'Мужская команда' },
  { value: 'women', label: 'Женская команда' },
] as const
const { data: competitions } = useLoad(() => allPages<Competition>('/api/v1/competitions'))
const seasons = computed(() =>
  [...new Set(competitions.value?.map((item) => item.season) ?? [])].sort().reverse(),
)
const seasonOptions = computed(() => [
  { value: '', label: 'Последняя таблица' },
  ...seasons.value.map((value) => ({ value, label: value })),
])
const { data, pending, error, load } = useLoad(async () => {
  try {
    return await apiRequest<ApiResponse<Standings>>(
      `/api/v1/standings?team=${team.value}${season.value ? `&season=${encodeURIComponent(season.value)}` : ''}`,
    )
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404)
      return { data: null } as ApiResponse<Standings>
    throw cause
  }
}, [team, season])
</script>
<template>
  <div>
    <section class="page-hero page-hero--compact">
      <div class="container">
        <p class="eyebrow">Положение команд</p>
        <h1>Турнирная таблица</h1>
      </div>
    </section>
    <section class="section section--light">
      <div class="container">
        <div class="filters standings-filters">
          <AppSelect v-model="team" label="Команда" :options="teamOptions" />
          <AppSelect
            v-model="season"
            class="app-select--wide"
            label="Сезон"
            :options="seasonOptions"
          />
        </div>
        <AsyncState
          :pending="pending"
          :error="error"
          :empty="!data?.data?.rows.length"
          empty-text="Таблица для выбранной команды и сезона пока не опубликована."
          @retry="load"
        >
          <div class="standings-mobile">
            <p v-if="data?.data" class="standings-mobile__competition">
              <strong>{{ data.data.competition.name }}</strong>
              <span>Сезон {{ data.data.competition.season }}</span>
            </p>
            <ol class="standings-mobile__list" aria-label="Турнирная таблица по местам">
              <li v-for="row in data?.data?.rows" :key="row.position" class="standing-card">
                <div class="standing-card__heading">
                  <span class="standing-card__position" :aria-label="`Место: ${row.position}`">
                    {{ row.position }}
                  </span>
                  <TeamEmblem
                    class="standing-card__emblem"
                    :name="row.team_name"
                    :remote-url="row.team_logo_url"
                  />
                  <h2>{{ row.team_name }}</h2>
                  <div class="standing-card__points">
                    <strong>{{ row.table_points }}</strong>
                    <span>Очки</span>
                  </div>
                </div>
                <details class="standing-card__details">
                  <summary>
                    <span class="standing-card__overview">
                      <span
                        >Игры <strong>{{ row.played }}</strong></span
                      >
                      <span>
                        Разница
                        <strong :class="{ 'standing-card__negative': row.points_difference < 0 }">
                          {{ signed(row.points_difference) }}
                        </strong>
                      </span>
                    </span>
                    <span class="standing-card__toggle">Статистика</span>
                  </summary>
                  <dl class="standing-card__record">
                    <div>
                      <dt>Победы</dt>
                      <dd>{{ row.wins }}</dd>
                    </div>
                    <div>
                      <dt>Поражения</dt>
                      <dd>{{ row.losses }}</dd>
                    </div>
                    <div v-if="showDraws">
                      <dt>Ничьи</dt>
                      <dd>{{ row.draws }}</dd>
                    </div>
                  </dl>
                  <dl class="standing-card__scoring">
                    <div>
                      <dt>Набрано</dt>
                      <dd>{{ row.points_for }}</dd>
                    </div>
                    <div>
                      <dt>Пропущено</dt>
                      <dd>{{ row.points_against }}</dd>
                    </div>
                  </dl>
                </details>
              </li>
            </ol>
            <p class="standings-mobile__note">
              Очки — турнирные. Разница — набрано минус пропущено.
            </p>
          </div>
          <div class="table-wrap standings-table-wrap">
            <table class="standings-table">
              <caption v-if="data?.data">
                {{
                  data.data.competition.name
                }}
                ·
                {{
                  data.data.competition.season
                }}
              </caption>
              <colgroup>
                <col class="standings-table__place-column" />
                <col />
                <col class="standings-table__record-column" />
                <col class="standings-table__record-column" />
                <col class="standings-table__record-column" />
                <col v-if="showDraws" class="standings-table__record-column" />
                <col class="standings-table__scoring-column" />
                <col class="standings-table__difference-column" />
                <col class="standings-table__points-column" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Место</th>
                  <th scope="col">Команда</th>
                  <th scope="col"><abbr title="Сыграно матчей">И</abbr></th>
                  <th scope="col"><abbr title="Победы">В</abbr></th>
                  <th scope="col"><abbr title="Поражения">П</abbr></th>
                  <th v-if="showDraws" scope="col"><abbr title="Ничьи">Н</abbr></th>
                  <th scope="col">Набрано : пропущено</th>
                  <th scope="col">Разница</th>
                  <th scope="col">Очки</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in data?.data?.rows" :key="row.position">
                  <td class="standings-table__place">{{ row.position }}</td>
                  <th scope="row" class="standings-table__team">
                    <span class="standings-team">
                      <TeamEmblem
                        class="standings-team__emblem"
                        :name="row.team_name"
                        :remote-url="row.team_logo_url"
                      />
                      <span>{{ row.team_name }}</span>
                    </span>
                  </th>
                  <td>{{ row.played }}</td>
                  <td>{{ row.wins }}</td>
                  <td>{{ row.losses }}</td>
                  <td v-if="showDraws">{{ row.draws }}</td>
                  <td class="standings-table__scoring">
                    {{ row.points_for }} : {{ row.points_against }}
                  </td>
                  <td
                    class="standings-table__difference"
                    :class="{ 'standings-table__difference--negative': row.points_difference < 0 }"
                  >
                    {{ signed(row.points_difference) }}
                  </td>
                  <td class="standings-table__points">{{ row.table_points }}</td>
                </tr>
              </tbody>
            </table>
            <p class="standings-legend">
              И — игры · В — победы · П — поражения<template v-if="showDraws"> · Н — ничьи</template
              >. Очки — турнирные. Разница — набранные минус пропущенные.
            </p>
          </div>
        </AsyncState>
      </div>
    </section>
  </div>
</template>

<style scoped>
.standings-table {
  width: 100%;
  table-layout: fixed;
}

.standings-table__place-column {
  width: 80px;
}

.standings-table__record-column {
  width: 52px;
}

.standings-table__scoring-column {
  width: 152px;
}

.standings-table__difference-column {
  width: 88px;
}

.standings-table__points-column {
  width: 68px;
}

.standings-table th,
.standings-table td {
  padding-inline: 10px;
  white-space: normal;
  overflow-wrap: anywhere;
}

.standings-table thead th:first-child {
  white-space: nowrap;
}

.standings-table caption {
  overflow-wrap: anywhere;
}

.standings-table .standings-table__team {
  min-width: 0;
}

.standings-team {
  min-width: 0;
}

.standings-team > span:last-child {
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}

.standings-team__emblem {
  border-radius: 6px;
  font-size: 0.625rem;
}

.standings-mobile {
  display: none;
}

@media (max-width: 900px) {
  .standings-filters {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }

  .standings-filters > :deep(.app-select) {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }

  .standings-table-wrap {
    display: none;
  }

  .standings-mobile {
    display: block;
    color: var(--navy);
  }

  .standings-mobile__competition {
    display: grid;
    gap: 4px;
    margin: 0 0 14px;
    overflow-wrap: anywhere;
    font-size: 0.85rem;
    line-height: 1.5;
  }

  .standings-mobile__competition span,
  .standings-mobile__note {
    color: #526477;
    font-size: 0.75rem;
  }

  .standings-mobile__list {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .standing-card {
    min-width: 0;
    padding: 14px;
    border: 1px solid #d8e0e9;
    border-radius: 12px;
    background: #fff;
    font-variant-numeric: tabular-nums;
  }

  .standing-card__heading {
    display: grid;
    grid-template-columns: 20px 32px minmax(0, 1fr) auto;
    align-items: center;
    gap: 9px;
  }

  .standing-card__position {
    color: #65758a;
    font-size: 0.85rem;
    font-weight: 700;
    text-align: center;
  }

  .standing-card__emblem {
    display: grid;
    width: 32px;
    height: 32px;
    place-items: center;
    overflow: hidden;
    color: #65758a;
    font-size: 0.6rem;
  }

  .standing-card__emblem :deep(img) {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .standing-card__heading h2 {
    margin: 0;
    overflow-wrap: anywhere;
    font:
      700 0.83rem/1.4 'Roboto',
      sans-serif;
    text-transform: none;
  }

  .standing-card__points {
    display: grid;
    min-width: 36px;
    justify-items: center;
    gap: 2px;
    padding: 6px 8px;
    border-radius: 8px;
    background: #edf2f7;
  }

  .standing-card__points strong {
    font-size: 1.05rem;
    line-height: 1;
  }

  .standing-card__points span {
    font-size: 0.75rem;
  }

  .standing-card__details {
    margin-top: 10px;
    border-top: 1px solid #e7ecf2;
  }

  .standing-card__details summary {
    display: flex;
    min-height: 44px;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-top: 8px;
    cursor: pointer;
    list-style: none;
    font-size: 0.75rem;
    line-height: 1.5;
  }

  .standing-card__details summary::-webkit-details-marker {
    display: none;
  }

  .standing-card__details summary:focus-visible {
    outline: 3px solid #4d82b2;
    outline-offset: 3px;
    border-radius: 4px;
  }

  .standing-card__overview {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    gap: 4px 16px;
    color: #526477;
  }

  .standing-card__overview > span {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .standing-card__overview strong {
    color: var(--navy);
  }

  .standing-card__toggle {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }

  .standing-card__toggle::after {
    width: 6px;
    height: 6px;
    margin-top: -3px;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(45deg);
    content: '';
  }

  .standing-card__details[open] .standing-card__toggle::after {
    margin-top: 3px;
    transform: rotate(225deg);
  }

  .standing-card__record,
  .standing-card__scoring {
    display: flex;
    gap: 8px;
    margin: 12px 0 0;
  }

  .standing-card__record > div,
  .standing-card__scoring > div {
    flex: 1 1 0;
    min-width: 0;
  }

  .standing-card dt {
    color: #526477;
    font-size: 0.75rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .standing-card dd {
    margin: 3px 0 0;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .standing-card__scoring {
    padding-top: 10px;
    border-top: 1px solid #e7ecf2;
  }

  .standing-card .standing-card__negative {
    color: #b32520;
  }

  .standings-mobile__note {
    margin: 12px 0 0;
    line-height: 1.6;
  }
}

@media (min-width: 650px) and (max-width: 900px) {
  .standings-mobile__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

@media (max-width: 430px) {
  .standings-filters {
    grid-template-columns: minmax(0, 1fr);
  }

  .standing-card {
    padding: 12px;
  }

  .standing-card__heading {
    gap: 7px;
  }
}
</style>
