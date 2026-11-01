<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    outcome: 'win' | 'loss' | 'draw'
    difference?: number | null
    tone?: 'light' | 'dark'
  }>(),
  { difference: null, tone: 'light' },
)

const label = computed(() =>
  props.outcome === 'win' ? 'Победа' : props.outcome === 'loss' ? 'Поражение' : 'Ничья',
)
const differenceLabel = computed(() => {
  if (props.difference === null) return ''
  const sign = props.difference > 0 ? '+' : props.difference < 0 ? '−' : ''
  return `${sign}${Math.abs(props.difference)} очк.`
})
</script>

<template>
  <span
    class="match-outcome"
    :class="[`match-outcome--${outcome}`, `match-outcome--${tone}`]"
    :data-outcome="outcome"
    title="Результат команды клуба"
  >
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path v-if="outcome === 'win'" d="m4.5 10 3.5 3.5 7.5-7.5" />
      <path v-else-if="outcome === 'loss'" d="m6 6 8 8M14 6l-8 8" />
      <path v-else d="M5 7.5h10M5 12.5h10" />
    </svg>
    <span class="match-outcome__label">{{ label }}</span>
    <span v-if="differenceLabel" class="match-outcome__difference">{{ differenceLabel }}</span>
  </span>
</template>

<style scoped>
.match-outcome {
  --outcome-ink: #fff;
  --outcome-surface: #008047;
  --outcome-border: #006d3c;
  --outcome-divider: #ffffff59;
  display: inline-flex;
  flex-shrink: 0;
  max-width: 100%;
  align-items: center;
  gap: 8px;
  padding: 8px 11px;
  border: 1px solid var(--outcome-border);
  border-radius: 10px;
  color: var(--outcome-ink);
  background: var(--outcome-surface);
  font:
    600 0.81rem/1.35 'Roboto',
    sans-serif;
  letter-spacing: 0;
  text-transform: none;
  white-space: nowrap;
}
.match-outcome--loss {
  --outcome-surface: #da1830;
  --outcome-border: #bf1429;
}
.match-outcome--draw {
  --outcome-ink: #435b73;
  --outcome-surface: #edf2f7;
  --outcome-border: #d0dce7;
  --outcome-divider: #bccbd9;
}
.match-outcome > svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.match-outcome__difference {
  padding-left: 8px;
  border-left: 1px solid var(--outcome-divider);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.match-outcome--dark {
  --outcome-border: #23a56a;
}
.match-outcome--dark.match-outcome--loss {
  --outcome-border: #f25c6d;
}
.match-outcome--dark.match-outcome--draw {
  --outcome-ink: #d4e0ed;
  --outcome-surface: #203b54;
  --outcome-border: #4b6279;
  --outcome-divider: #ffffff59;
}
@media (max-width: 700px) {
  .match-outcome {
    gap: 6px;
    padding: 7px 9px;
    font-size: 0.75rem;
  }
  .match-outcome > svg {
    width: 16px;
    height: 16px;
  }
  .match-outcome__difference {
    padding-left: 6px;
  }
}
</style>
