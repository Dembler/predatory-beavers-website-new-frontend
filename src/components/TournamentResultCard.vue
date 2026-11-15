<script setup lang="ts">
import { computed } from 'vue'
import TeamEmblem from '@/components/TeamEmblem.vue'
import { resultDate, type PublicResult } from '@/shared/results'

const props = defineProps<{ result: PublicResult }>()
const format = computed(() =>
  props.result.discipline === '3x3'
    ? '3×3'
    : props.result.discipline === 'phygital'
      ? 'Фиджитал'
      : '5×5',
)
const outcome = computed(() => {
  if (['finished', 'participated'].includes(props.result.status)) {
    return props.result.place ? `${props.result.place} место` : 'Участие'
  }
  return (
    {
      scheduled: 'Запланирован',
      cancelled: 'Отменён',
      postponed: 'Перенесён',
    }[props.result.status] ?? 'Итог уточняется'
  )
})
const sourceUrl = computed(() => {
  try {
    const url = new URL(props.result.source_url ?? '')
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
})
</script>

<template>
  <article class="tournament-result">
    <TeamEmblem :name="result.team_name" :remote-url="result.emblem_url" club />
    <div class="tournament-result__body">
      <p class="tournament-result__meta">
        <span>{{ resultDate(result) }}</span>
        <span>{{ result.team === 'men' ? 'Мужчины' : 'Девушки' }}</span>
        <span>{{ format }}</span>
      </p>
      <h3>{{ result.tournament }}</h3>
      <p v-if="result.location" class="tournament-result__location">{{ result.location }}</p>
      <a v-if="sourceUrl" :href="sourceUrl" target="_blank" rel="noopener noreferrer">
        {{ result.source_label || 'Источник' }} <span aria-hidden="true">↗</span>
      </a>
    </div>
    <div class="tournament-result__outcome">
      <span>Итог турнира</span>
      <strong>{{ outcome }}</strong>
    </div>
  </article>
</template>

<style scoped>
.tournament-result {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  align-items: center;
  gap: 24px;
  padding: 24px 28px;
  background: #fff;
  border: 1px solid #c9d5df;
  border-radius: 12px;
  color: #092d4c;
}
.tournament-result :deep(.team-emblem) {
  width: 56px;
  height: 56px;
  overflow: hidden;
}
.tournament-result :deep(.team-emblem img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.tournament-result__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin: 0 0 8px;
  color: #4c6780;
  font-size: 0.78rem;
}
.tournament-result h3 {
  margin: 0;
  font-size: clamp(1.15rem, 2vw, 1.5rem);
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.tournament-result__location {
  margin: 8px 0 0;
  color: #4c6780;
  font-size: 0.85rem;
  line-height: 1.5;
}
.tournament-result a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  gap: 8px;
  color: #345c7b;
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}
.tournament-result a:focus-visible {
  outline: 3px solid #b32f24;
  outline-offset: 3px;
}
.tournament-result__outcome {
  display: grid;
  gap: 8px;
  text-align: right;
}
.tournament-result__outcome span {
  font-size: 0.72rem;
  color: #4c6780;
}
.tournament-result__outcome strong {
  font-size: 1.4rem;
}
@media (max-width: 700px) {
  .tournament-result {
    grid-template-columns: 40px minmax(0, 1fr);
    gap: 16px;
    padding: 20px 16px;
    align-items: start;
  }
  .tournament-result :deep(.team-emblem) {
    width: 40px;
    height: 40px;
  }
  .tournament-result__outcome {
    grid-column: 2;
    text-align: left;
  }
}
</style>
