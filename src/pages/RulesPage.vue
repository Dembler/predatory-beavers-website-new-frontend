<script setup lang="ts">
import { computed, ref } from 'vue'
import AsyncState from '@/components/AsyncState.vue'
import { useLoad } from '@/composables/useLoad'
import { apiRequest } from '@/shared/api'
import type { ApiResponse, ContentBlock } from '@/shared/types'

const { data, pending, error, load } = useLoad(() =>
  apiRequest<ApiResponse<{ items: ContentBlock[] }>>('/api/v1/content/rules'),
)
const chapters = computed(() => data.value?.data?.items ?? [])
const {
  data: rolesData,
  pending: rolesPending,
  error: rolesError,
  load: loadRoles,
} = useLoad(() =>
  apiRequest<ApiResponse<{ items: ContentBlock[] }>>('/api/v1/content/player_roles'),
)
const {
  data: tipsData,
  pending: tipsPending,
  error: tipsError,
  load: loadTips,
} = useLoad(() =>
  apiRequest<ApiResponse<{ items: ContentBlock[] }>>('/api/v1/content/viewing_tips'),
)
const playerRoles = computed(() => rolesData.value?.data?.items ?? [])
const viewingTips = computed(() => tipsData.value?.data?.items ?? [])
const zones = [
  { points: 1, title: 'Штрафной бросок', body: 'Каждый точный штрафной приносит одно очко.' },
  {
    points: 2,
    title: 'Внутри дуги',
    body: 'Попадание с игры из двухочковой зоны — два очка. Линия дуги относится к этой зоне.',
  },
  { points: 3, title: 'За дугой', body: 'Попадание с игры из-за трёхочковой линии — три очка.' },
]
const zone = ref(1)
const selectedZone = computed(() => zones[zone.value]!)
const questions = [
  {
    title: 'Игрок заступил на трёхочковую линию и попал. Сколько очков?',
    answers: ['Одно', 'Два', 'Три'],
    correct: 1,
    explanation: 'Линия дуги относится к двухочковой зоне.',
  },
  {
    title: 'Сколько игроков одной команды находятся на площадке?',
    answers: ['Четыре', 'Пять', 'Шесть'],
    correct: 1,
    explanation: 'В классическом баскетболе на площадке играют пять на пять.',
  },
  {
    title: 'После четвёртой четверти счёт равный. Что дальше?',
    answers: ['Ничья', 'Серия штрафных', 'Овертайм'],
    correct: 2,
    explanation: 'Назначается овертайм. Он длится пять минут; при равенстве игра продолжается.',
  },
  {
    title: 'Сколько очков даёт точный штрафной?',
    answers: ['Одно', 'Два', 'Три'],
    correct: 0,
    explanation: 'Каждый забитый штрафной — одно очко.',
  },
]
const questionIndex = ref(0)
const answer = ref<number | null>(null)
const score = ref(0)
const completed = ref(false)
const question = computed(() => questions[questionIndex.value]!)
function choose(index: number) {
  if (answer.value !== null) return
  answer.value = index
  if (index === question.value.correct) score.value++
}
function next() {
  if (answer.value === null) return
  if (questionIndex.value === questions.length - 1) completed.value = true
  else {
    questionIndex.value++
    answer.value = null
  }
}
function restart() {
  questionIndex.value = 0
  answer.value = null
  score.value = 0
  completed.value = false
}
</script>
<template>
  <div>
    <section class="page-hero page-hero--compact">
      <div class="container">
        <p class="eyebrow">Для болельщиков</p>
        <h1>Пойми игру.<br />Почувствуй баскетбол.</h1>
        <p class="lead">От первого броска до финальной сирены — всё, что нужно знать на трибуне.</p>
      </div>
    </section>
    <section class="section section--light">
      <div class="container">
        <nav class="page-jumps" aria-label="На странице правил">
          <a href="#shot-intro">Броски</a>
          <a href="#rules-chapters-title">Правила</a>
          <a href="#quiz-title">Тест</a>
          <a href="#player-roles-title">Роли</a>
          <a href="#viewing-tips-title">Советы</a>
        </nav>
        <div id="shot-intro" class="rules-intro">
          <div>
            <p class="eyebrow">01 / Бросок решает</p>
            <h2>Откуда бросаем?</h2>
            <p>Выберите тип броска — и узнайте, как меняется счёт.</p>
            <div class="shot-options" aria-label="Тип броска">
              <button
                v-for="(item, index) in zones"
                :key="item.points"
                type="button"
                :aria-pressed="zone === index"
                :class="{ 'is-active': zone === index }"
                @click="zone = index"
              >
                {{ item.title }}
              </button>
            </div>
            <div class="shot-description" aria-live="polite">
              <strong>+{{ selectedZone.points }}</strong>
              <div>
                <h3>{{ selectedZone.title }}</h3>
                <p>{{ selectedZone.body }}</p>
              </div>
            </div>
          </div>
          <div class="basketball-court">
            <svg
              viewBox="0 0 500 380"
              role="img"
              :aria-label="`Схема половины площадки: ${selectedZone.title}`"
            >
              <rect x="15" y="15" width="470" height="350" rx="3" fill="none" />
              <path
                d="M172 15V180H328V15M172 180A78 78 0 0 0 328 180M172 180A78 78 0 0 1 328 180"
                fill="none"
              />
              <path d="M45 15V75A205 205 0 0 0 455 75V15" fill="none" />
              <path d="M215 38H285M250 38V50" />
              <circle cx="250" cy="60" r="10" fill="none" />
              <circle
                cx="250"
                :cy="zone === 0 ? 180 : zone === 1 ? 110 : 310"
                r="19"
                class="court-ball"
              />
              <text x="250" :y="zone === 0 ? 186 : zone === 1 ? 116 : 316" text-anchor="middle">
                {{ selectedZone.points }}
              </text>
              <path d="M205 365A45 45 0 0 1 295 365" fill="none" /></svg
            ><span>Схема для знакомства с игрой</span>
          </div>
        </div>
        <div class="rules-facts">
          <div><strong>5 × 5</strong><span>игроков на площадке</span></div>
          <div><strong>4 × 10</strong><span>минут основного времени</span></div>
          <div><strong>24</strong><span>секунды на атаку</span></div>
        </div>
        <div class="section-heading">
          <div>
            <p class="eyebrow">02 / Читаем игру</p>
            <h2 id="rules-chapters-title">Правила без лишних слов</h2>
          </div>
        </div>
        <AsyncState :pending="pending" :error="error" :empty="!chapters.length" @retry="load"
          ><div class="rules-chapters">
            <details
              v-for="(chapter, index) in chapters"
              :key="chapter.id"
              class="rule-accordion"
              :open="index === 0"
            >
              <summary>
                <span>{{ String(index + 1).padStart(2, '0') }}</span
                >{{ chapter.title }}<b aria-hidden="true">+</b>
              </summary>
              <p class="prose-text">{{ chapter.body }}</p>
            </details>
          </div></AsyncState
        >
        <section class="rules-quiz" aria-labelledby="quiz-title">
          <div class="quiz-intro">
            <p class="eyebrow">03 / Проверь себя</p>
            <h2 id="quiz-title">Готовы к трибуне?</h2>
            <p>Четыре игровых ситуации. Проверьте, насколько хорошо вы читаете игру.</p>
          </div>
          <div class="quiz-card">
            <template v-if="completed"
              ><p class="quiz-progress">Игра окончена</p>
              <h3>Ваш результат: {{ score }} / {{ questions.length }}</h3>
              <p>
                {{
                  score === questions.length
                    ? 'Точное попадание! Вы отлично ориентируетесь в игре.'
                    : 'Хорошая разминка. Повторите правила и попробуйте ещё раз.'
                }}
              </p>
              <button type="button" class="button" @click="restart">
                Пройти ещё раз →
              </button></template
            >
            <template v-else
              ><p class="quiz-progress">Вопрос {{ questionIndex + 1 }} из {{ questions.length }}</p>
              <h3>{{ question.title }}</h3>
              <div class="quiz-answers">
                <button
                  v-for="(option, index) in question.answers"
                  :key="option"
                  type="button"
                  :disabled="answer !== null"
                  :aria-pressed="answer === index"
                  :class="{
                    'is-selected': answer === index,
                    'is-correct': answer !== null && index === question.correct,
                  }"
                  @click="choose(index)"
                >
                  {{ option
                  }}<span
                    v-if="answer !== null && index === question.correct"
                    aria-label="Правильный ответ"
                    >✓</span
                  >
                </button>
              </div>
              <div v-if="answer !== null" class="quiz-feedback" role="status">
                <strong>{{ answer === question.correct ? 'Верно!' : 'Почти!' }}</strong>
                <p>{{ question.explanation }}</p>
                <button type="button" class="button" @click="next">
                  {{
                    questionIndex === questions.length - 1 ? 'Узнать результат' : 'Следующий вопрос'
                  }}
                  →
                </button>
              </div></template
            >
          </div>
        </section>
        <section class="rules-reading" aria-labelledby="player-roles-title">
          <div class="rules-reading__heading">
            <p class="eyebrow">Амплуа</p>
            <h2 id="player-roles-title">Роли игроков</h2>
            <p>
              Пять классических позиций помогают понять, как устроена команда. В современной игре
              задачи пересекаются, а игроки могут менять роли в зависимости от ситуации.
            </p>
          </div>
          <AsyncState
            :pending="rolesPending"
            :error="rolesError"
            :empty="!playerRoles.length"
            @retry="loadRoles"
          >
            <ol class="player-roles">
              <li v-for="role in playerRoles" :key="role.id">
                <div>
                  <span v-if="role.subtitle">{{ role.subtitle }}</span>
                  <h3>{{ role.title }}</h3>
                </div>
                <p class="prose-text">{{ role.body }}</p>
              </li>
            </ol>
          </AsyncState>
        </section>

        <section class="rules-reading" aria-labelledby="viewing-tips-title">
          <div class="rules-reading__heading">
            <p class="eyebrow">С трибуны</p>
            <h2 id="viewing-tips-title">Как смотреть матч</h2>
            <p>Наблюдения, которые помогут читать игру от первой атаки до финальной сирены.</p>
          </div>
          <AsyncState
            :pending="tipsPending"
            :error="tipsError"
            :empty="!viewingTips.length"
            @retry="loadTips"
          >
            <ol class="viewing-tips">
              <li v-for="(tip, index) in viewingTips" :key="tip.id">
                <span class="viewing-tips__number" aria-hidden="true">
                  {{ String(index + 1).padStart(2, '0') }}
                </span>
                <div>
                  <h3>{{ tip.title }}</h3>
                  <p class="prose-text">{{ tip.body }}</p>
                </div>
              </li>
            </ol>
          </AsyncState>
        </section>

        <p class="rules-source">
          Основы классического баскетбола 5 × 5.
          <a
            href="https://assets.fiba.basketball/image/upload/documents-corporate-fiba-official-rules-2026-v1-1.pdf"
            target="_blank"
            rel="noopener noreferrer"
            >Полные правила FIBA 2026 (PDF, на английском) ↗</a
          >
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.rules-reading {
  margin-top: 48px;
}
.rules-reading__heading {
  max-width: 760px;
  margin-bottom: 22px;
}
.rules-reading__heading .eyebrow {
  margin: 0 0 8px;
  font-size: 0.72rem;
}
.rules-reading__heading h2 {
  margin: 0;
  font-size: clamp(1.9rem, 3vw, 2.6rem);
  line-height: 1.15;
}
.rules-reading__heading > p:last-child {
  margin: 12px 0 0;
  color: #52677b;
  font-size: 0.94rem;
  line-height: 1.7;
}
.player-roles,
.viewing-tips {
  margin: 0;
  padding: 0;
  list-style: none;
}
.player-roles {
  overflow: hidden;
  border: 1px solid #d5dfe8;
  border-radius: 14px;
  background: white;
}
.player-roles li {
  display: grid;
  grid-template-columns: minmax(170px, 0.28fr) minmax(0, 1fr);
  gap: 24px;
  padding: 22px 24px;
}
.player-roles li + li {
  border-top: 1px solid #e1e7ed;
}
.player-roles li > div > span {
  display: block;
  margin-bottom: 6px;
  color: #7b302b;
  font-size: 0.73rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.player-roles h3,
.viewing-tips h3 {
  margin: 0;
  font-family: 'Roboto', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.45;
  overflow-wrap: anywhere;
  text-transform: none;
}
.player-roles p,
.viewing-tips p {
  margin: 0;
  color: #42576c;
  font-size: 0.92rem;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.player-roles p {
  max-width: 80ch;
}
.viewing-tips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.viewing-tips li {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: start;
  gap: 12px;
  padding: 22px;
  border: 1px solid #d5dfe8;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.85);
}
.viewing-tips__number {
  color: #a4352e;
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1.7;
}
.viewing-tips p {
  margin-top: 8px;
}
@media (max-width: 700px) {
  .rules-reading {
    margin-top: 34px;
  }
  .rules-reading__heading {
    margin-bottom: 18px;
  }
  .player-roles li {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 18px;
  }
  .player-roles li > div > span {
    margin-bottom: 4px;
  }
  .viewing-tips {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .viewing-tips li {
    gap: 8px;
    padding: 18px 16px;
  }
  .player-roles p,
  .viewing-tips p {
    font-size: 0.9rem;
    line-height: 1.65;
  }
}
</style>
