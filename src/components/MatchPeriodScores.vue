<script setup lang="ts">
import { computed } from 'vue'
import type { MatchCardData } from '@/shared/types'

const props = defineProps<{ match: MatchCardData }>()
const periods = computed(() =>
  [...(props.match.score_by_periods ?? [])].sort((a, b) => a.number - b.number),
)
function heading(number: number) {
  return number <= 4 ? String(number) : `ОТ${number - 4}`
}
function description(number: number) {
  return number <= 4 ? `${number}-я четверть` : `${number - 4}-й овертайм`
}
</script>

<template>
  <div class="match-periods">
    <div
      class="match-periods__scroll"
      role="region"
      :aria-label="`Счёт по четвертям: ${match.home_team_name} — ${match.away_team_name}`"
      tabindex="0"
    >
      <table>
        <caption class="match-periods__visually-hidden">
          Счёт по четвертям
        </caption>
        <thead>
          <tr>
            <th scope="col"><span class="match-periods__visually-hidden">Команда</span></th>
            <th
              v-for="entry in periods"
              :key="entry.number"
              scope="col"
              :aria-label="description(entry.number)"
            >
              {{ heading(entry.number) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="side in ['home', 'away'] as const"
            :key="side"
            :data-side="side"
            :class="{ 'is-club': match.club_side === side }"
          >
            <th scope="row">
              <span :title="side === 'home' ? match.home_team_name : match.away_team_name">{{
                side === 'home' ? match.home_team_name : match.away_team_name
              }}</span>
            </th>
            <td v-for="entry in periods" :key="entry.number">
              {{ match.club_side === side ? entry.club_score : entry.opponent_score }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.match-periods {
  min-width: 0;
  border-top: 1px solid #e1e8ef;
  padding: 8px 24px 10px;
}
.match-periods__scroll {
  max-width: 600px;
  margin-inline: auto;
  overflow-x: auto;
  overscroll-behavior-x: contain;
}
.match-periods__scroll:focus-visible {
  outline: 2px solid #cb1914;
  outline-offset: 2px;
}
.match-periods table {
  width: 100%;
  border-collapse: collapse;
  font:
    400 0.75rem/1.4 'Roboto',
    sans-serif;
  color: #435b73;
  font-variant-numeric: tabular-nums;
}
.match-periods th,
.match-periods td {
  padding: 2px 8px;
  border: 0;
  text-align: center;
  white-space: nowrap;
}
.match-periods thead th {
  color: #607287;
  background: transparent;
  font:
    500 0.68rem/1.4 'Roboto',
    sans-serif;
  text-transform: none;
}
.match-periods th:first-child {
  text-align: left;
  width: 44%;
  padding-left: 0;
}
.match-periods tbody th {
  color: #435b73;
  background: transparent;
  font:
    400 0.75rem/1.4 'Roboto',
    sans-serif;
  text-transform: none;
}
.match-periods tbody th span {
  display: block;
  max-width: 210px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.match-periods .is-club th,
.match-periods .is-club td {
  font-weight: 700;
  color: #042a4e;
}
.match-periods__visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  clip-path: inset(50%);
  overflow: hidden;
  white-space: nowrap;
}
@media (max-width: 600px) {
  .match-periods {
    padding: 8px 16px 10px;
  }
  .match-periods th,
  .match-periods td {
    padding-inline: 6px;
  }
  .match-periods tbody th span {
    max-width: 112px;
  }
}
</style>
