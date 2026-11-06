<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AsyncState from '@/components/AsyncState.vue'
import AppSelect from '@/components/AppSelect.vue'
import PlayoffBracket from '@/components/PlayoffBracket.vue'
import TeamEmblem from '@/components/TeamEmblem.vue'
import { useLoad } from '@/composables/useLoad'
import { useTeamFilter } from '@/composables/useTeamPreference'
import { ApiError, apiRequest } from '@/shared/api'
import { clubCopy } from '@/shared/clubCopy'
import type { ApiResponse, Competition, StandingRow, Standings } from '@/shared/types'

const route = useRoute()
const router = useRouter()
const team = useTeamFilter('men')
const queryText = (value: unknown) => (typeof value === 'string' ? value : '')
const season = computed(() => queryText(route.query.season))
const competition = computed(() => queryText(route.query.competition))
const tournament = computed(() => queryText(route.query.tournament))
const teamOptions = [
  { value: 'men', label: 'Мужская команда' },
  { value: 'women', label: 'Команда девушек' },
] as const
const seasonLabel = (value: string) => value.replace(/^(\d{4})-\d{2}(\d{2})$/, '$1/$2')

interface StageOption extends Pick<Competition, 'id' | 'name' | 'season'> {
  tournament_id?: string | null
  tournament_name?: string | null
  stage_name?: string | null
  stage_kind?: string
}
interface StandingsOptions {
  seasons: string[]
  competitions: StageOption[]
  default_competition_id: string | null
}
const {
  data: catalogue,
  pending: cataloguePending,
  error: catalogueError,
  load: loadCatalogue,
} = useLoad(
  () => apiRequest<ApiResponse<StandingsOptions>>(`/api/v1/standings/options?team=${team.value}`),
  [team],
)
const { data, pending, error, load } = useLoad(async () => {
  const query = new URLSearchParams({ team: team.value })
  if (season.value) query.set('season', season.value)
  if (competition.value) query.set('competition_id', competition.value)
  if (tournament.value) query.set('tournament_id', tournament.value)
  try {
    return await apiRequest<ApiResponse<Standings>>(`/api/v1/standings?${query}`)
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404)
      return { data: null } as ApiResponse<Standings>
    throw cause
  }
}, [team, season, tournament, competition])

const snapshot = computed(() => (!pending.value && !error.value ? data.value?.data : null))
const availableCompetitions = computed(() => {
  const items = new Map(catalogue.value?.data?.competitions.map((item) => [item.id, item]))
  if (snapshot.value)
    items.set(snapshot.value.competition.id, {
      ...snapshot.value.competition,
      tournament_id: snapshot.value.tournament_id,
      tournament_name: snapshot.value.tournament_name,
      stage_name: snapshot.value.stage_name,
      stage_kind: snapshot.value.stage_kind,
    })
  return [...items.values()]
})
const effectiveSeason = computed(() => season.value || snapshot.value?.competition.season || '')
const seasonOptions = computed(() => [
  { value: '', label: 'Выберите сезон', disabled: true },
  ...[
    ...new Set([
      ...(catalogue.value?.data?.seasons ?? []),
      ...availableCompetitions.value.map((item) => item.season),
      season.value,
    ]),
  ]
    .filter(Boolean)
    .sort()
    .reverse()
    .map((value) => ({ value, label: seasonLabel(value) })),
])
const seasonStages = computed(() =>
  availableCompetitions.value.filter(
    (item) => !effectiveSeason.value || item.season === effectiveSeason.value,
  ),
)
const effectiveTournament = computed(() => tournament.value || snapshot.value?.tournament_id || '')
const tournamentOptions = computed(() => {
  const items = new Map<string, string>()
  for (const item of seasonStages.value)
    if (item.tournament_id)
      items.set(item.tournament_id, clubCopy(item.tournament_name || item.name))
  return [...items].map(([value, label]) => ({ value, label }))
})
const competitionOptions = computed(() => [
  { value: '', label: 'Выберите этап', disabled: true },
  ...seasonStages.value
    .filter(
      (item) => !effectiveTournament.value || item.tournament_id === effectiveTournament.value,
    )
    .map((item) => ({ value: item.id, label: clubCopy(item.stage_name || item.name) })),
])
const selectedTournament = computed({
  get: () => effectiveTournament.value,
  set: (value: string) => {
    void router.replace({
      query: {
        ...route.query,
        season: effectiveSeason.value || undefined,
        tournament: value || undefined,
        competition: undefined,
      },
    })
  },
})

// The newest season in the match calendar may have no published standings.
const selectedSeason = computed({
  get: () => effectiveSeason.value,
  set: (value: string) => {
    void router.replace({
      query: {
        ...route.query,
        season: value || undefined,
        tournament: undefined,
        competition: undefined,
      },
    })
  },
})
const selectedCompetition = computed({
  get: () => competition.value || snapshot.value?.competition.id || '',
  set: (value: string) => {
    const selected = availableCompetitions.value.find((item) => item.id === value)
    void router.replace({
      query: {
        ...route.query,
        season: selected?.season || effectiveSeason.value || undefined,
        competition: value || undefined,
        tournament: selected?.tournament_id || undefined,
      },
    })
  },
})
watch(
  team,
  (value) => {
    if (competition.value || tournament.value)
      void router.replace({
        query: { ...route.query, team: value, tournament: undefined, competition: undefined },
      })
  },
  { flush: 'post' },
)
function retry() {
  void load()
  void loadCatalogue()
}

const showDraws = computed(() => snapshot.value?.rows.some((row) => row.draws > 0))
const number = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : '—'
const signed = (value: unknown) => {
  const result = number(value)
  return typeof result === 'number'
    ? result > 0
      ? `+${result}`
      : result < 0
        ? `−${Math.abs(result)}`
        : '0'
    : result
}
const isClub = (row: StandingRow) => {
  if (row.external_team_id)
    return row.external_team_id === (team.value === 'women' ? '7695' : '7433')
  return /^ВГУ(?:$|[\s(—-])/iu.test(row.team_name) || /хищные бобры/iu.test(row.team_name)
}
</script>

<template>
  <div>
    <section class="page-hero page-hero--compact">
      <div class="container">
        <h1>Турнирная таблица</h1>
      </div>
    </section>
    <section class="section section--light">
      <div class="container">
        <div class="league-filters" role="group" aria-label="Выбор турнирной таблицы">
          <AppSelect v-model="team" label="Команда" :options="teamOptions" />
          <AppSelect
            v-model="selectedSeason"
            label="Сезон"
            :options="seasonOptions"
            :disabled="cataloguePending"
          />
          <AppSelect
            v-if="tournamentOptions.length"
            v-model="selectedTournament"
            label="Чемпионат"
            :options="tournamentOptions"
            :disabled="cataloguePending"
          />
          <AppSelect
            v-model="selectedCompetition"
            class="league-filters__competition"
            label="Этап"
            :options="competitionOptions"
            :disabled="cataloguePending"
          />
        </div>
        <AsyncState
          :pending="pending || cataloguePending"
          :error="error || catalogueError"
          :empty="!snapshot || (!snapshot.rows.length && !snapshot.games?.length)"
          empty-text="Таблица для выбранной команды, сезона и соревнования пока не опубликована."
          @retry="retry"
        >
          <div v-if="snapshot" class="league-standings">
            <div class="league-heading">
              <div>
                <h2 id="league-title">
                  {{ clubCopy(snapshot.tournament_name || snapshot.competition.name) }}
                </h2>
                <p
                  v-if="
                    snapshot.stage_name &&
                    !(snapshot.games?.length && /^плей-офф$/iu.test(snapshot.stage_name.trim()))
                  "
                  class="league-heading__stage"
                >
                  {{ clubCopy(snapshot.stage_name) }}
                </p>
              </div>
            </div>
            <p v-if="snapshot.rows.length" id="league-scroll-hint" class="league-scroll-hint">
              Прокрутите таблицу, чтобы увидеть все показатели →
            </p>
            <div
              v-if="snapshot.rows.length"
              class="league-scroll"
              role="region"
              tabindex="0"
              aria-labelledby="league-title"
              aria-describedby="league-scroll-hint"
            >
              <table class="league-table" :class="{ 'league-table--draws': showDraws }">
                <caption class="league-visually-hidden">
                  {{
                    clubCopy(snapshot.competition.name)
                  }}
                  ·
                  {{
                    seasonLabel(snapshot.competition.season)
                  }}
                  ·
                  {{
                    team === 'women' ? 'Команда девушек' : 'Мужская команда'
                  }}
                </caption>
                <colgroup>
                  <col class="league-table__rank-column" />
                  <col />
                  <col class="league-table__record-column" />
                  <col class="league-table__record-column" />
                  <col class="league-table__record-column" />
                  <col v-if="showDraws" class="league-table__record-column" />
                  <col class="league-table__score-column" />
                  <col class="league-table__score-column" />
                  <col class="league-table__difference-column" />
                  <col class="league-table__points-column" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col"><abbr title="Место">№</abbr></th>
                    <th scope="col" class="league-table__team">Команда</th>
                    <th scope="col"><abbr title="Сыграно матчей">И</abbr></th>
                    <th scope="col"><abbr title="Победы">В</abbr></th>
                    <th scope="col"><abbr title="Поражения">П</abbr></th>
                    <th v-if="showDraws" scope="col"><abbr title="Ничьи">Н</abbr></th>
                    <th scope="col">Набрано</th>
                    <th scope="col">Пропущено</th>
                    <th scope="col">
                      <abbr title="Разница набранных и пропущенных очков">+/−</abbr>
                    </th>
                    <th scope="col"><abbr title="Турнирные очки">Очки</abbr></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, index) in snapshot.rows"
                    :key="row.external_team_id || `${row.team_name}-${index}`"
                    :class="{ 'league-table__club': isClub(row) }"
                  >
                    <td class="league-table__rank">{{ number(row.position) }}</td>
                    <th scope="row" class="league-table__team">
                      <span class="league-team">
                        <TeamEmblem
                          class="league-team__emblem"
                          :name="row.team_name"
                          :remote-url="row.team_logo_url"
                          :club="isClub(row)"
                        />
                        <span>{{ clubCopy(row.team_name) }}</span>
                        <span v-if="isClub(row)" class="league-visually-hidden"> — наш клуб</span>
                      </span>
                    </th>
                    <td>{{ number(row.played) }}</td>
                    <td>{{ number(row.wins) }}</td>
                    <td>{{ number(row.losses) }}</td>
                    <td v-if="showDraws">{{ number(row.draws) }}</td>
                    <td>{{ number(row.points_for) }}</td>
                    <td>{{ number(row.points_against) }}</td>
                    <td class="league-table__difference">{{ signed(row.points_difference) }}</td>
                    <td class="league-table__points">{{ number(row.table_points) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="snapshot.rows.length" class="league-legend">
              И — игры · В — победы · П — поражения<template v-if="showDraws"> · Н — ничьи</template
              >. Очки — турнирные. +/− — разница набранных и пропущенных очков.
            </p>
            <PlayoffBracket
              v-if="snapshot.games?.length"
              :key="snapshot.competition.id"
              :games="snapshot.games"
              :club-team-id="team === 'women' ? '7695' : '7433'"
              :title="snapshot.stage_kind === 'playoff' ? 'Плей-офф' : 'Матчи этапа'"
            />
            <a
              v-if="snapshot.source_url"
              class="league-source"
              :href="snapshot.source_url"
              target="_blank"
              rel="noopener noreferrer"
              >Источник: АСБ ↗</a
            >
          </div>
        </AsyncState>
      </div>
    </section>
  </div>
</template>

<style scoped>
.league-heading__stage {
  margin: 12px 0 0;
  color: #526477;
  font-size: 1rem;
  line-height: 1.5;
}
.league-source {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  margin-top: 24px;
  color: #315d83;
  font-size: 0.875rem;
}
.league-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: end;
  gap: 20px;
  margin-bottom: 40px;
}
.league-filters > :deep(.app-select) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}
.league-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
  color: var(--navy);
}
.league-heading h2 {
  margin: 0;
  font-size: clamp(1.375rem, 2.4vw, 2rem);
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.league-scroll {
  width: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  border: 1px solid #d8e0e9;
  border-radius: 10px;
  background: #fff;
  scrollbar-color: #8495a8 #edf2f7;
  scrollbar-width: auto;
}
.league-scroll:focus-visible {
  outline: 3px solid #4d82b2;
  outline-offset: 4px;
}
.league-table {
  width: 100%;
  min-width: 720px;
  border-spacing: 0;
  border-collapse: separate;
  table-layout: fixed;
  font-variant-numeric: tabular-nums;
}
.league-table--draws {
  min-width: 776px;
}
.league-table__rank-column {
  width: 44px;
}
.league-table__record-column {
  width: 56px;
}
.league-table__score-column {
  width: 92px;
}
.league-table__difference-column {
  width: 92px;
}
.league-table__points-column {
  width: 88px;
}
.league-table th,
.league-table td {
  height: 72px;
  padding: 14px 8px;
  border: 0;
  border-bottom: 1px solid #e1e7ee;
  color: var(--navy);
  background: #fff;
  text-align: center;
  white-space: normal;
  overflow-wrap: anywhere;
  font:
    500 0.9375rem/1.4 'Roboto',
    sans-serif;
  text-transform: none;
}
.league-table thead th {
  height: 54px;
  border-color: var(--navy);
  color: #fff;
  background: var(--navy);
  font-size: 0.8125rem;
  font-weight: 600;
}
.league-table abbr {
  text-decoration: none;
}
.league-table tbody tr:last-child > * {
  border-bottom: 0;
}
.league-table .league-table__rank {
  color: #526477;
  font-size: 0.875rem;
}
.league-table .league-table__team {
  position: sticky;
  left: 0;
  z-index: 1;
  text-align: left;
  box-shadow: 1px 0 #e1e7ee;
}
.league-team {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  font-weight: 600;
}
.league-team__emblem {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  place-items: center;
  color: #526477;
  font-size: 0.625rem;
}
.league-team__emblem :deep(img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.league-table tbody tr:hover > * {
  background: #f4f7fa;
}
.league-table tbody tr.league-table__club > * {
  background: #eaf1f7;
  font-weight: 700;
}
.league-table__club .league-table__team {
  box-shadow:
    inset 4px 0 var(--red),
    1px 0 #c5d3e0;
}
.league-table .league-table__points {
  font-weight: 800;
}
.league-table .league-table__difference {
  font-weight: 600;
}
.league-legend {
  margin: 18px 0 0;
  color: #526477;
  font-size: 0.8125rem;
  line-height: 1.7;
}
.league-scroll-hint {
  display: none;
  margin: 0 0 12px;
  color: #526477;
  font-size: 0.75rem;
  line-height: 1.5;
}
.league-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@media (min-width: 1000px) {
  .league-table__rank-column {
    width: 4%;
  }
  .league-table__record-column {
    width: 7%;
  }
  .league-table__score-column {
    width: 12%;
  }
  .league-table__difference-column,
  .league-table__points-column {
    width: 10%;
  }
}
@media (max-width: 900px) {
  .league-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }
  .league-filters__competition {
    grid-column: auto;
  }
  .league-scroll-hint {
    display: block;
  }
  .league-heading {
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 20px;
  }
  .league-team {
    gap: 8px;
    font-size: 0.8125rem;
  }
  .league-team__emblem {
    width: 28px;
    height: 28px;
    flex-basis: 28px;
  }
}
@media (max-width: 430px) {
  .league-filters {
    grid-template-columns: minmax(0, 1fr);
  }
  .league-heading {
    flex-direction: column;
  }
}
</style>
