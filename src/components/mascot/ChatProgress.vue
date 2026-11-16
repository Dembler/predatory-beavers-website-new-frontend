<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Check, ChevronDown, Circle, Waves } from '@lucide/vue'
import type { ChatProgressStep } from '@/composables/useMascotChat'

const props = defineProps<{
  steps: ChatProgressStep[]
  active: boolean
  durationMs: number | null
}>()
const expanded = ref(props.active)
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
const stopped = computed(() =>
  props.steps.some((step) => ['failed', 'stopped'].includes(step.state)),
)
const total = computed(() => {
  if (props.durationMs !== null) return props.durationMs
  return props.steps.reduce((sum, step) => sum + stepDuration(step), 0)
})
const currentTitle = computed(
  () => props.steps[props.steps.length - 1]?.title || 'Подбираю веточки для ответа',
)

function elapsed(milliseconds: number) {
  if (!Number.isFinite(milliseconds)) return ''
  return `${(Math.max(0, milliseconds) / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} с`
}
function stepDuration(step: ChatProgressStep) {
  // Live estimates use one client clock; settled durations come from server events.
  return step.durationMs ?? Math.max(0, now.value - step.observedAt)
}
watch(
  () => props.active,
  (active) => {
    expanded.value = active
    clearInterval(timer)
    now.value = Date.now()
    if (active)
      timer = setInterval(() => {
        now.value = Date.now()
      }, 250)
  },
  { immediate: true },
)
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <details
    v-if="steps.length"
    class="bobrik-thinking"
    :open="expanded"
    @toggle="expanded = ($event.target as HTMLDetailsElement).open"
  >
    <summary>
      <svg
        v-if="active"
        class="bobrik-thinking-pond"
        viewBox="0 0 64 36"
        width="48"
        height="28"
        fill="none"
        stroke-linecap="round"
        aria-hidden="true"
        focusable="false"
      >
        <g class="bobrik-pond-water" stroke="#5e91a8" stroke-width="1.6">
          <path d="M3 25q4-3 8 0t8 0t8 0M7 31q4-3 8 0t8 0" />
          <path d="M44 31q4-3 8 0t8 0" />
        </g>
        <g stroke="#91633d" stroke-width="4">
          <path d="m32 29 20-14m-17-2 19 15m-23-7 24 2" />
        </g>
        <g stroke="#c69b68" stroke-width="1">
          <path d="m33 29 18-13m-14-2 16 13m-20-6 20 2" />
        </g>
        <g class="bobrik-pond-twig" stroke="#91633d" stroke-width="2.6">
          <path d="m13 12 13-5m-5 7-2-4m2-1 1-4" />
        </g>
      </svg>
      <Waves v-else :size="15" aria-hidden="true" />
      <span>{{
        active ? currentTitle : stopped ? 'Где я остановился' : 'Как я собрал ответ'
      }}</span>
      <small v-if="total >= 0">{{ elapsed(total) }}</small>
      <ChevronDown class="bobrik-thinking-chevron" :size="15" aria-hidden="true" />
    </summary>
    <ol aria-label="Этапы подготовки ответа">
      <li v-for="step in steps" :key="step.id" :data-state="step.state">
        <span class="bobrik-step-icon" aria-hidden="true">
          <svg
            v-if="active && step.state === 'active'"
            class="bobrik-step-twig"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          >
            <path d="m3 13 9-10M8 8l-4-1m5 0 1-4" />
          </svg>
          <Check v-else-if="step.state === 'completed'" :size="14" />
          <Circle v-else :size="12" />
        </span>
        <div>
          <div class="bobrik-step-heading">
            <strong>{{ step.title }}</strong>
            <small>{{ elapsed(stepDuration(step)) }}</small>
          </div>
          <p>{{ step.detail }}</p>
          <ul
            v-if="step.sourceTitles.length"
            class="bobrik-thinking-sources"
            aria-label="Найденные материалы"
          >
            <li v-for="title in step.sourceTitles" :key="title">{{ title }}</li>
          </ul>
          <p v-else-if="step.sourceCount === 0">
            Нужной веточки в клубных запасах пока не нашлось.
          </p>
          <small v-if="step.state === 'stopped'">Остановлено</small>
          <small v-if="step.state === 'failed'">Не удалось завершить</small>
        </div>
      </li>
    </ol>
  </details>
</template>

<style>
.bobrik-thinking {
  margin: 0 0 14px;
  padding: 10px 12px;
  border: 1px solid #dce4ec;
  border-radius: 12px;
  background: #f0f4f8;
  color: #526b80;
  font-size: 0.75rem;
  line-height: 1.5;
}
.bobrik-thinking > summary {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  list-style: none;
  cursor: pointer;
}
.bobrik-thinking > summary::-webkit-details-marker {
  display: none;
}
.bobrik-thinking > summary > span {
  flex: 1;
  min-width: 0;
  font-weight: 600;
}
.bobrik-thinking-pond {
  flex: 0 0 48px;
  overflow: visible;
}
.bobrik-thinking small {
  white-space: nowrap;
  font-size: 0.68rem;
  color: #627b90;
}
.bobrik-thinking-chevron {
  flex-shrink: 0;
}
.bobrik-thinking[open] .bobrik-thinking-chevron {
  transform: rotate(180deg);
}
.bobrik-thinking > ol {
  list-style: none;
  padding: 14px 0 0;
  margin: 0;
}
.bobrik-thinking > ol > li {
  position: relative;
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 7px;
  padding-bottom: 14px;
}
.bobrik-thinking > ol > li:last-child {
  padding-bottom: 0;
}
.bobrik-thinking > ol > li:not(:last-child)::before {
  position: absolute;
  top: 20px;
  left: 9px;
  bottom: 3px;
  width: 1px;
  content: '';
  background: #c9d7e3;
}
.bobrik-step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1px solid #c9d7e3;
  border-radius: 50%;
  color: #526b80;
}
[data-state='active'] > .bobrik-step-icon {
  color: #9e241f;
  border-color: #cda8a5;
}
[data-state='completed'] > .bobrik-step-icon {
  color: #327353;
  border-color: #b7d2c2;
}
.bobrik-step-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.bobrik-step-heading strong {
  color: #26475f;
  font-weight: 600;
}
.bobrik-thinking p {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
}
.bobrik-thinking-sources {
  margin: 6px 0 0;
  padding-left: 15px;
  font-size: 0.7rem;
  overflow-wrap: anywhere;
}
.bobrik-pond-twig {
  transform-origin: 20px 10px;
  animation: bobrik-carry-twig 2.8s ease-in-out infinite;
}
.bobrik-pond-water {
  animation: bobrik-water-ripple 2.8s ease-in-out infinite;
}
.bobrik-step-twig {
  animation: bobrik-twig-tilt 2.8s ease-in-out infinite;
}
@keyframes bobrik-carry-twig {
  0%,
  100% {
    transform: translate(0, 0) rotate(-5deg);
  }
  50% {
    transform: translate(7px, 2px) rotate(5deg);
  }
}
@keyframes bobrik-water-ripple {
  0%,
  100% {
    opacity: 0.6;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-1px);
  }
}
@keyframes bobrik-twig-tilt {
  0%,
  100% {
    transform: rotate(-8deg);
  }
  50% {
    transform: rotate(8deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .bobrik-pond-twig,
  .bobrik-pond-water,
  .bobrik-step-twig {
    animation: none;
  }
}
</style>
