<script setup lang="ts">
import { computed } from 'vue'
import TeamEmblem from '@/components/TeamEmblem.vue'
import { publicSourceUrl, resultDate, type PublicResult } from '@/shared/results'

const props = defineProps<{ result: PublicResult }>()
const outcome = computed(() => {
  const result = props.result
  if (result.status !== 'finished' || result.club_score === null || result.opponent_score === null)
    return null
  if (result.club_score === result.opponent_score) return { label: 'Ничья', kind: 'draw' }
  return result.club_score > result.opponent_score
    ? { label: 'Победа', kind: 'win' }
    : { label: 'Поражение', kind: 'loss' }
})
const discipline = computed(() =>
  props.result.discipline === 'phygital'
    ? 'Фиджитал'
    : props.result.discipline === '3x3'
      ? '3×3'
      : '5×5',
)
</script>

<template>
  <article class="tournament-result">
    <div class="tournament-result__meta">
      <span
        >{{ result.team === 'men' ? 'Мужская команда' : 'Команда девушек' }} ·
        {{ discipline }}</span
      >
      <time v-if="result.event_date" :datetime="result.event_date">{{ resultDate(result) }}</time>
      <span v-else>{{ resultDate(result) }}</span>
    </div>
    <h3>{{ result.tournament }}</h3>
    <p v-if="result.location" class="tournament-result__location">{{ result.location }}</p>
    <div v-if="result.opponent_name" class="tournament-game">
      <div class="tournament-game__team">
        <TeamEmblem :name="result.team_name" :remote-url="result.emblem_url" club />
        <strong>{{ result.team_name }}</strong>
        <b>{{ result.status === 'finished' ? (result.club_score ?? '—') : '—' }}</b>
      </div>
      <div class="tournament-game__team">
        <TeamEmblem :name="result.opponent_name" :remote-url="result.opponent_emblem_url" />
        <strong>{{ result.opponent_name }}</strong>
        <b>{{ result.status === 'finished' ? (result.opponent_score ?? '—') : '—' }}</b>
      </div>
    </div>
    <div v-else class="tournament-placement">
      <TeamEmblem :name="result.team_name" :remote-url="result.emblem_url" club />
      <strong>{{ result.team_name }}</strong>
      <span :class="{ 'tournament-placement__podium': result.place && result.place <= 3 }">{{
        result.place ? `${result.place} место` : 'Участие'
      }}</span>
    </div>
    <div class="tournament-result__footer">
      <span
        v-if="outcome"
        class="tournament-outcome"
        :class="`tournament-outcome--${outcome.kind}`"
        >{{ outcome.label }}</span
      >
      <span v-else-if="result.opponent_name">Результат не опубликован</span>
      <a
        v-if="publicSourceUrl(result.source_url)"
        :href="publicSourceUrl(result.source_url)"
        target="_blank"
        rel="noopener noreferrer"
        >{{ result.source_label || result.source }} <span aria-hidden="true">↗</span></a
      >
      <span v-else>{{ result.source_label || result.source }}</span>
    </div>
    <details v-if="result.notes" class="tournament-result__notes">
      <summary>Подробности</summary>
      <p>{{ result.notes }}</p>
    </details>
  </article>
</template>

<style scoped>
.tournament-result {
  min-width: 0;
  padding: 28px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: white;
}
.tournament-result__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 24px;
  color: #52677b;
  font-size: 0.8rem;
  line-height: 1.6;
}
.tournament-result__meta > span:first-child {
  color: var(--red);
  font-weight: 700;
}
.tournament-result h3 {
  margin: 16px 0 8px;
  font-size: 1.05rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.tournament-result__location {
  color: #52677b;
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.6;
}
.tournament-game {
  display: grid;
  gap: 12px;
  padding: 24px 0;
}
.tournament-game__team {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
}
.tournament-game__team strong {
  font-size: 1rem;
  overflow-wrap: anywhere;
}
.tournament-game__team b {
  font-size: 1.6rem;
  font-variant-numeric: tabular-nums;
}
.tournament-result :deep(.team-emblem) {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
}
.tournament-result :deep(.team-emblem img) {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.tournament-placement {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-block: 24px;
}
.tournament-placement strong {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
}
.tournament-placement > span {
  flex-shrink: 0;
  font-size: 1.1rem;
  font-weight: 800;
}
.tournament-placement__podium {
  color: #976d12;
}
.tournament-result__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
  font-size: 0.8rem;
  line-height: 1.6;
  color: #52677b;
}
.tournament-result__footer a {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--navy);
  text-underline-offset: 4px;
  overflow-wrap: anywhere;
  margin-left: auto;
}
.tournament-outcome {
  padding: 4px 10px;
  border-radius: 6px;
  font-weight: 700;
}
.tournament-outcome--win {
  color: #1b6a4b;
  background: #e8f4ec;
}
.tournament-outcome--loss {
  color: #9c333c;
  background: #fcecee;
}
.tournament-outcome--draw {
  color: #52677b;
  background: #eef3f8;
}
.tournament-result__notes {
  margin-top: 16px;
  color: #52677b;
  font-size: 0.85rem;
  line-height: 1.7;
}
.tournament-result__notes summary {
  cursor: pointer;
  min-height: 44px;
  align-content: center;
  color: var(--navy);
}
.tournament-result__notes p {
  margin: 12px 0 0;
  overflow-wrap: anywhere;
  white-space: pre-line;
}
@media (max-width: 600px) {
  .tournament-result {
    padding: 20px;
  }
  .tournament-placement {
    gap: 12px;
    flex-wrap: wrap;
  }
  .tournament-placement > span {
    margin-left: auto;
  }
}
</style>
