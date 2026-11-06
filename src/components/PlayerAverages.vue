<script setup lang="ts">
import { average, playingTime, type RosterPlayer } from '@/shared/roster'
defineProps<{ player: RosterPlayer }>()
</script>
<template>
  <dl class="player-averages" aria-label="Средние показатели за матч">
    <div>
      <dt>Очки</dt>
      <dd>{{ average(player.points_per_game) }}</dd>
    </div>
    <div>
      <dt>Передачи</dt>
      <dd>{{ average(player.assists_per_game) }}</dd>
    </div>
    <div>
      <dt>Подборы</dt>
      <dd>{{ average(player.rebounds_per_game) }}</dd>
    </div>
    <div>
      <dt>Время</dt>
      <dd>{{ playingTime(player.minutes_per_game) }}</dd>
    </div>
  </dl>
</template>
<style scoped>
.player-averages {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 20px;
}
.player-averages > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 0;
  border-top: 1px solid #d6e0e9;
}
.player-averages dt {
  font-size: 0.75rem;
  color: #52677b;
}
.player-averages dd {
  margin: 0;
  font:
    500 1.4rem/1.1 'Oswald',
    sans-serif;
  font-variant-numeric: tabular-nums;
  color: #092d4c;
}
</style>
