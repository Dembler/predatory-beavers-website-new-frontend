<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import TeamEmblem from '@/components/TeamEmblem.vue'
import { clubCopy } from '@/shared/clubCopy'
import { buildPlayoffBrackets } from '@/shared/playoffBracket'
import type { StandingsGame } from '@/shared/types'

const props = defineProps<{ games: StandingsGame[]; clubTeamId: string; title?: string }>()
const id = useId()
const layouts = computed(() =>
  buildPlayoffBrackets(props.games).map((layout) => {
    // Keep official pair positions and connections, while trimming empty space
    // outside the published part of a tree (common in older ASB archives).
    const firstRow = Math.max(0, Math.min(...layout.nodes.map((node) => node.row)) - 0.5)
    const lastRow = Math.max(...layout.nodes.map((node) => node.row)) + 0.5
    return {
      ...layout,
      rowCount: lastRow - firstRow,
      nodes: layout.nodes.map((node) => ({ ...node, row: node.row - firstRow })),
    }
  }),
)
const root = ref<HTMLElement>()
const scrollPosition = ref<Record<string, number>>({})
const visibleWidth = ref<Record<string, number>>({})
const canvasWidth = ref<Record<string, number>>({})
let observer: ResizeObserver | undefined

function measure() {
  for (const element of root.value?.querySelectorAll<HTMLElement>('.bracket-scroll') ?? []) {
    const key = element.dataset.bracketId!
    scrollPosition.value[key] = element.scrollLeft
    visibleWidth.value[key] = element.clientWidth
    canvasWidth.value[key] = element.scrollWidth
  }
}
function onScroll(event: Event) {
  const element = event.currentTarget as HTMLElement
  scrollPosition.value[element.dataset.bracketId!] = element.scrollLeft
}
function overflow(key: string) {
  return (canvasWidth.value[key] ?? 0) > (visibleWidth.value[key] ?? 0) + 2
}
function step(key: string, direction: number) {
  const element = [...(root.value?.querySelectorAll<HTMLElement>('.bracket-scroll') ?? [])].find(
    (item) => item.dataset.bracketId === key,
  )
  const column = element?.querySelector<HTMLElement>('.bracket-round')
  if (!element || !column) return
  const distance = column.getBoundingClientRect().width * 1.2
  element.scrollBy({
    left: direction * distance,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  })
}
function onKeydown(event: KeyboardEvent, key: string) {
  if (event.target !== event.currentTarget) return
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    step(key, event.key === 'ArrowRight' ? 1 : -1)
  }
}
function observe() {
  observer?.disconnect()
  for (const element of root.value?.querySelectorAll('.bracket-scroll') ?? [])
    observer?.observe(element)
  measure()
}
onMounted(() => {
  observer = new ResizeObserver(measure)
  observe()
})
watch(layouts, async () => {
  await nextTick()
  for (const element of root.value?.querySelectorAll('.bracket-scroll') ?? [])
    element.scrollLeft = 0
  observe()
})
onBeforeUnmount(() => observer?.disconnect())

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Moscow',
})
const date = (value: string | null) =>
  value ? dateFormatter.format(new Date(value)) : 'Дата не указана'
const isClub = (game: StandingsGame) =>
  game.home_team_id === props.clubTeamId || game.away_team_id === props.clubTeamId
const winner = (game: StandingsGame, side: 'home' | 'away') =>
  game.status === 'finished' &&
  (game[`${side}_score`] ?? -1) > (game[side === 'home' ? 'away_score' : 'home_score'] ?? -1)

function connector(layout: (typeof layouts.value)[number], from: string, to: string) {
  const start = layout.nodes.find((node) => node.id === from)
  const end = layout.nodes.find((node) => node.id === to)
  if (!start || !end) return ''
  const x = start.column * 120 + 100
  const y = start.row * 100
  const nextX = end.column * 120
  const nextY = end.row * 100
  return `M ${x} ${y} H ${x + 10} V ${nextY} H ${nextX}`
}
</script>

<template>
  <section ref="root" class="playoff-bracket" :aria-labelledby="`${id}-title`">
    <h3 :id="`${id}-title`">{{ title || 'Плей-офф' }}</h3>
    <section
      v-for="layout in layouts"
      :key="layout.id"
      class="bracket-section"
      :class="{ 'bracket-section--placement': layout.kind === 'placement' }"
      :data-bracket-kind="layout.kind"
      :aria-labelledby="`${id}-${layout.id}-title`"
    >
      <div class="bracket-toolbar">
        <h4 :id="`${id}-${layout.id}-title`">{{ layout.title }}</h4>
        <div v-if="overflow(layout.id)" class="bracket-navigation">
          <span>Листайте сетку</span>
          <button
            type="button"
            :disabled="(scrollPosition[layout.id] ?? 0) < 2"
            aria-label="Предыдущий раунд"
            :aria-controls="`${id}-${layout.id}-scroll`"
            @click="step(layout.id, -1)"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
          </button>
          <button
            type="button"
            :disabled="
              (scrollPosition[layout.id] ?? 0) + (visibleWidth[layout.id] ?? 0) >=
              (canvasWidth[layout.id] ?? 0) - 2
            "
            aria-label="Следующий раунд"
            :aria-controls="`${id}-${layout.id}-scroll`"
            @click="step(layout.id, 1)"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>
      <div
        :id="`${id}-${layout.id}-scroll`"
        class="bracket-scroll"
        :data-bracket-id="layout.id"
        role="region"
        :aria-label="layout.kind === 'main' ? 'Сетка плей-офф' : `${layout.title}: турнирная сетка`"
        tabindex="0"
        @scroll.passive="onScroll"
        @keydown="onKeydown($event, layout.id)"
      >
        <div
          class="bracket-canvas"
          :style="{
            '--rounds': layout.rounds.length,
            '--rows': layout.rowCount,
            '--node-games': Math.max(1, ...layout.nodes.map((node) => node.games.length)),
            '--bracket-round-heading':
              layout.kind === 'placement' && layout.rounds.length === 1 ? '0px' : '44px',
          }"
        >
          <svg
            class="bracket-connectors"
            :viewBox="`0 0 ${layout.rounds.length * 120 - 20} ${layout.rowCount * 100}`"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              v-for="link in layout.links"
              :key="link.id"
              :d="connector(layout, link.from, link.to)"
              :data-from="link.from"
              :data-to="link.to"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <section
            v-for="round in layout.rounds"
            :key="round.id"
            class="bracket-round"
            :aria-labelledby="
              layout.kind === 'placement' && layout.rounds.length === 1
                ? `${id}-${layout.id}-title`
                : `${id}-${layout.id}-${round.id}`
            "
          >
            <h5
              v-if="layout.kind === 'main' || layout.rounds.length > 1"
              :id="`${id}-${layout.id}-${round.id}`"
              class="bracket-round__title"
            >
              <span aria-hidden="true">{{ String(round.column + 1).padStart(2, '0') }}</span>
              {{ round.title }}
            </h5>
            <ol class="bracket-round__matches">
              <li
                v-for="node in layout.nodes.filter((item) => item.roundId === round.id)"
                :key="node.id"
                class="bracket-node"
                :data-node-id="node.id"
                :style="{ '--row': node.row }"
              >
                <article
                  v-for="game in node.games"
                  :key="game.external_id"
                  class="bracket-game league-game"
                  :class="{
                    'bracket-game--club': isClub(game),
                    'bracket-game--final': layout.kind === 'main' && round.round === 1,
                  }"
                  :data-game-id="game.external_id"
                  :aria-label="`${game.home_team_name} — ${game.away_team_name}`"
                >
                  <p class="bracket-game__date">
                    <time :datetime="game.starts_at || undefined">{{ date(game.starts_at) }}</time>
                  </p>
                  <div
                    v-for="side in ['home', 'away'] as const"
                    :key="side"
                    class="bracket-team"
                    :class="{
                      'bracket-team--winner': winner(game, side),
                      'bracket-team--club': game[`${side}_team_id`] === clubTeamId,
                    }"
                  >
                    <TeamEmblem
                      class="bracket-team__emblem"
                      :name="game[`${side}_team_name`]"
                      :remote-url="game[`${side}_team_logo_url`]"
                      :club="game[`${side}_team_id`] === clubTeamId"
                    />
                    <span class="bracket-team__name" :title="clubCopy(game[`${side}_team_name`])">{{
                      clubCopy(game[`${side}_team_name`])
                    }}</span>
                    <strong>{{ game[`${side}_score`] ?? '—' }}</strong>
                  </div>
                  <div class="bracket-game__footer">
                    <span v-if="game.status === 'unpublished'" class="bracket-game__notice"
                      >Результат не опубликован</span
                    >
                    <span v-else-if="game.status === 'scheduled'" class="bracket-game__notice"
                      >Предстоящий матч</span
                    >
                    <span v-else class="bracket-game__status">Завершён</span>
                    <a
                      :href="game.source_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      :aria-label="`Источник АСБ: ${game.home_team_name} — ${game.away_team_name}`"
                      >АСБ ↗</a
                    >
                  </div>
                </article>
              </li>
            </ol>
          </section>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.playoff-bracket {
  --bracket-card-width: 320px;
  --bracket-card-height: 196px;
  --bracket-round-heading: 44px;
  margin-top: 32px;
  min-width: 0;
  color: var(--navy);
}
.playoff-bracket h3 {
  margin: 0 0 24px;
  font-size: 1.5rem;
}
.bracket-section + .bracket-section {
  margin-top: 28px;
}
.bracket-section--placement {
  padding-top: 24px;
  border-top: 1px solid #d8e0e9;
}
.bracket-toolbar {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.bracket-toolbar h4 {
  margin: 0;
  font-family: 'Roboto', sans-serif;
  font-size: 0.9375rem;
  font-weight: 700;
}
.bracket-navigation {
  display: flex;
  align-items: center;
  gap: 6px;
}
.bracket-navigation > span {
  margin-right: 8px;
  color: #526477;
  font-size: 0.75rem;
}
.bracket-navigation button {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 1px solid #cbd8e5;
  border-radius: 12px;
  background: #fff;
  color: var(--navy);
  cursor: pointer;
}
.bracket-navigation button:disabled {
  opacity: 0.35;
  cursor: default;
}
.bracket-navigation button:not(:disabled):hover {
  border-color: #7896b2;
  background: #eaf1f7;
}
.bracket-navigation svg {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.bracket-scroll {
  max-width: 100%;
  overflow-x: auto;
  padding: 4px 2px 14px;
  overscroll-behavior-x: contain;
  scrollbar-color: #8ba0b5 #e1e8f0;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}
.bracket-scroll:focus-visible,
.bracket-navigation button:focus-visible {
  outline: 3px solid #4d82b2;
  outline-offset: 3px;
}
.bracket-canvas {
  --row-step: calc(var(--node-games) * (var(--bracket-card-height) + 12px) + 24px);
  display: grid;
  position: relative;
  width: max-content;
  grid-template-columns: repeat(var(--rounds), var(--bracket-card-width));
  column-gap: calc(var(--bracket-card-width) / 5);
}
.bracket-connectors {
  position: absolute;
  top: var(--bracket-round-heading);
  left: 0;
  width: 100%;
  height: calc(var(--rows) * var(--row-step));
  overflow: visible;
  pointer-events: none;
}
.bracket-connectors path {
  fill: none;
  stroke: #8ba3ba;
  stroke-width: 1.5;
}
.bracket-round {
  position: relative;
  z-index: 1;
  min-width: 0;
}
.bracket-round__title {
  display: flex;
  height: var(--bracket-round-heading);
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  font-family: 'Roboto', sans-serif;
  font-size: 0.875rem;
  font-weight: 700;
}
.bracket-round__title > span {
  color: #526477;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 20px;
}
.bracket-round__matches {
  position: relative;
  height: calc(var(--rows) * var(--row-step));
  margin: 0;
  padding: 0;
  list-style: none;
}
.bracket-node {
  display: grid;
  position: absolute;
  top: calc(var(--row) * var(--row-step));
  width: 100%;
  gap: 12px;
  transform: translateY(-50%);
}
.bracket-game {
  display: flex;
  height: var(--bracket-card-height);
  box-sizing: border-box;
  flex-direction: column;
  padding: 14px 16px 8px;
  border: 1px solid #d0dce7;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 3px 10px #0b284b05;
}
.bracket-game--club {
  border-color: #87a2ba;
  box-shadow: inset 3px 0 #345f82;
}
.bracket-game--final {
  border-top: 3px solid var(--red);
  background: linear-gradient(125deg, #fff, #fff8f6);
}
.bracket-game__date {
  margin: 0 0 9px;
  color: #526477;
  font-size: 0.75rem;
  line-height: 17px;
}
.bracket-team {
  display: grid;
  min-height: 42px;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  color: #526477;
}
.bracket-team + .bracket-team {
  border-top: 1px solid #eef2f6;
}
.bracket-team--winner {
  color: var(--navy);
  font-weight: 700;
}
.bracket-team--club .bracket-team__name {
  text-decoration: underline;
  text-decoration-color: var(--red);
  text-underline-offset: 4px;
}
.bracket-team__emblem {
  width: 28px;
  height: 28px;
  overflow: hidden;
  border-radius: 4px;
  font-size: 0.5rem;
}
.bracket-team__emblem :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.bracket-team__name {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
  font-size: 0.875rem;
  line-height: 1.3;
}
.bracket-team strong {
  font-size: 1.5rem;
  font-variant-numeric: tabular-nums;
}
.bracket-game__footer {
  display: flex;
  min-height: 36px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
}
.bracket-game__notice,
.bracket-game__status {
  max-width: 170px;
  color: #526477;
  font-size: 0.6875rem;
  line-height: 1.4;
}
.bracket-game__footer > a {
  display: inline-flex;
  min-width: 44px;
  min-height: 36px;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
  color: #315d83;
  font-size: 0.75rem;
}
@media (max-width: 600px) {
  .playoff-bracket {
    --bracket-card-width: 260px;
  }
  .bracket-toolbar {
    align-items: center;
    flex-wrap: wrap;
  }
  .bracket-navigation > span {
    margin-right: 2px;
    font-size: 0.6875rem;
  }
  .bracket-scroll {
    scroll-snap-type: x proximity;
    scroll-padding-left: 2px;
  }
  .bracket-round {
    scroll-snap-align: start;
  }
}
</style>
