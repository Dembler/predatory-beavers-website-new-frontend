<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ContentBlock } from '@/shared/types'

const props = defineProps<{ roles: ContentBlock[] }>()
const selectedIndex = ref(0)
const activeRole = computed(() => props.roles[selectedIndex.value] ?? props.roles[0])
const activeKey = computed(() => activeRole.value?.subtitle?.split(/\s/u)[0] ?? '')
const positions: Record<string, { x: number; y: number; short: string }> = {
  PG: { x: 50, y: 82, short: 'Организует атаку и находит свободного партнёра.' },
  SG: { x: 18, y: 60, short: 'Открывается под передачу и атакует кольцо с дистанции.' },
  SF: { x: 82, y: 58, short: 'Соединяет игру на периметре и проходы к кольцу.' },
  PF: { x: 28, y: 30, short: 'Ставит заслоны, борется за подбор и помогает под кольцом.' },
  C: { x: 60, y: 23, short: 'Защищает кольцо и борется за мяч рядом с корзиной.' },
}
function roleKey(role: ContentBlock) {
  return role.subtitle?.split(/\s/u)[0] ?? ''
}
function position(role: ContentBlock, index: number) {
  return (
    positions[roleKey(role)] ?? {
      x: 18 + (index % 3) * 32,
      y: 40 + Math.floor(index / 3) * 35,
      short: role.body.split(/(?<=[.!?])\s/u)[0] ?? '',
    }
  )
}
</script>

<template>
  <div class="role-explorer">
    <div class="role-court" role="group" aria-label="Выберите позицию игрока на площадке">
      <div class="role-court__surface">
        <svg viewBox="0 0 500 420" aria-hidden="true">
          <defs>
            <pattern id="role-court-lines" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0V32" fill="none" stroke="#ffffff06" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="500" height="420" fill="url(#role-court-lines)" stroke="none" />
          <rect x="20" y="20" width="460" height="380" rx="2" fill="none" />
          <path
            d="M175 20V175H325V20M175 175A75 75 0 0 0 325 175M175 175A75 75 0 0 1 325 175M48 20V70A202 202 0 0 0 452 70V20M215 43H285M250 43V55M205 400A45 45 0 0 1 295 400"
            fill="none"
          />
          <circle cx="250" cy="65" r="10" fill="none" />
        </svg>
        <button
          v-for="(role, index) in roles"
          :key="role.id"
          type="button"
          class="role-marker"
          :style="{ left: `${position(role, index).x}%`, top: `${position(role, index).y}%` }"
          :aria-label="`${roleKey(role)} — ${role.title}`"
          :aria-pressed="selectedIndex === index"
          aria-controls="selected-player-role"
          @click="selectedIndex = index"
        >
          <span>{{ roleKey(role) || index + 1 }}</span>
        </button>
      </div>
    </div>
    <div class="role-explanation">
      <div class="role-tabs" role="group" aria-label="Позиции игроков">
        <button
          v-for="(role, index) in roles"
          :key="role.id"
          type="button"
          :aria-label="role.title"
          :aria-pressed="selectedIndex === index"
          aria-controls="selected-player-role"
          @click="selectedIndex = index"
        >
          {{ roleKey(role) || index + 1 }}
        </button>
      </div>
      <div
        v-if="activeRole"
        id="selected-player-role"
        :key="activeRole.id"
        class="role-copy"
        aria-live="polite"
        aria-atomic="true"
      >
        <p class="role-code">{{ activeRole.subtitle }}</p>
        <h3>{{ activeRole.title }}</h3>
        <p class="role-short">
          {{ positions[activeKey]?.short ?? activeRole.body.split(/(?<=[.!?])\s/u)[0] }}
        </p>
        <details class="role-detail">
          <summary>Подробнее о роли <span aria-hidden="true">+</span></summary>
          <p>{{ activeRole.body }}</p>
        </details>
      </div>
      <p class="role-note">
        Позиции показаны условно. Во время игры задачи и расположение игроков меняются.
      </p>
    </div>
  </div>
</template>

<style scoped>
.role-explorer {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  background: white;
  border: 1px solid #d1dce7;
}
.role-court {
  min-width: 0;
  align-self: start;
  background: #0b304f;
  color: white;
}
.role-court__surface {
  position: relative;
  aspect-ratio: 500 / 420;
}
.role-court svg {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 500 / 420;
  stroke: #a9bed0;
  stroke-width: 1.5;
}
.role-marker {
  position: absolute;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 1px solid #ccd8e4;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  color: #123853;
  background: #f2f6fa;
  font:
    700 0.8rem/1 'Roboto',
    sans-serif;
  cursor: pointer;
  transition:
    background 0.2s,
    box-shadow 0.2s,
    transform 0.2s;
}
.role-marker[aria-pressed='true'] {
  color: white;
  border-color: white;
  background: #ae332d;
  box-shadow: 0 0 0 8px #ffffff18;
  transform: translate(-50%, -50%) scale(1.08);
}
.role-marker:hover {
  box-shadow: 0 0 0 6px #ffffff18;
}
.role-marker:focus-visible,
.role-tabs button:focus-visible,
.role-detail summary:focus-visible {
  outline: 3px solid #e89855;
  outline-offset: 5px;
}
.role-explanation {
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: clamp(24px, 3vw, 44px);
}
.role-tabs {
  display: grid;
  width: 100%;
  max-width: 280px;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 32px;
}
.role-tabs button {
  width: 100%;
  min-width: 0;
  height: 44px;
  border: 1px solid #aebdcb;
  border-radius: 4px;
  background: white;
  color: #24465f;
  font:
    700 0.75rem 'Roboto',
    sans-serif;
  cursor: pointer;
}
.role-tabs button[aria-pressed='true'] {
  color: white;
  background: #0b304f;
  border-color: #0b304f;
}
.role-copy {
  animation: role-arrive 0.25s ease-out;
}
.role-code {
  margin: 0 0 12px;
  color: #9c312c;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.role-copy h3 {
  margin: 0;
  font:
    500 clamp(1.7rem, 3vw, 2.6rem)/1.1 'Oswald',
    sans-serif;
  text-transform: uppercase;
}
.role-short {
  max-width: 34ch;
  margin: 20px 0;
  color: #42576c;
  font-size: 1rem;
  line-height: 1.7;
}
.role-detail {
  border-top: 1px solid #d7e1e9;
}
.role-detail summary {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: #27485f;
  font-size: 0.8rem;
  font-weight: 600;
  list-style: none;
  cursor: pointer;
}
.role-detail summary::-webkit-details-marker {
  display: none;
}
.role-detail summary span {
  font:
    300 1.5rem 'Roboto',
    sans-serif;
}
.role-detail[open] summary span {
  transform: rotate(45deg);
}
.role-detail p {
  margin: 4px 0 20px;
  color: #42576c;
  font-size: 0.85rem;
  line-height: 1.75;
}
.role-note {
  margin: auto 0 0;
  padding-top: 28px;
  color: #52677b;
  font-size: 0.7rem;
  line-height: 1.65;
}
@keyframes role-arrive {
  from {
    opacity: 0.4;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (max-width: 800px) {
  .role-explorer {
    grid-template-columns: 1fr;
  }
  .role-explanation {
    padding: 28px;
  }
  .role-tabs {
    margin-bottom: 24px;
  }
}
@media (max-width: 400px) {
  .role-explanation {
    padding: 24px 20px;
  }
  .role-marker {
    width: 44px;
    height: 44px;
    font-size: 0.7rem;
  }
  .role-tabs {
    gap: 6px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .role-copy {
    animation: none;
  }
  .role-marker {
    transition: none;
  }
}
</style>
