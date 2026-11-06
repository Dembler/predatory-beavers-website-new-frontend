<script setup lang="ts">
import { computed, ref } from 'vue'
import AsyncState from '@/components/AsyncState.vue'
import RulesRoleCourt from '@/components/RulesRoleCourt.vue'
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
  <div class="rules-page">
    <section class="page-hero page-hero--compact">
      <div class="container">
        <p class="eyebrow">Для болельщиков</p>
        <h1>Пойми игру.<br />Почувствуй баскетбол.</h1>
        <p class="lead">Выберите бросок. Найдите свою позицию. Почувствуйте ритм игры.</p>
      </div>
    </section>
    <section class="section section--light">
      <div class="container">
        <nav class="page-jumps rules-jumps" aria-label="На странице правил">
          <a href="#shot-intro">Броски</a>
          <a href="#player-roles-title">Позиции</a>
          <a href="#rules-chapters-title">Правила</a>
          <a href="#quiz-title">Тест</a>
          <a href="#viewing-tips-title">С трибуны</a>
        </nav>
        <div id="shot-intro" class="rules-intro">
          <div>
            <p class="eyebrow">01 / Бросок решает</p>
            <h2>Откуда бросаем?</h2>
            <p>Три варианта. Одно кольцо. Сколько очков на табло?</p>
            <div class="shot-options" aria-label="Тип броска">
              <button
                v-for="(item, index) in zones"
                :key="item.points"
                type="button"
                :aria-pressed="zone === index"
                :class="{ 'is-active': zone === index }"
                @click="zone = index"
              >
                <span aria-hidden="true">+{{ item.points }}</span
                >{{ item.title }}
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
              <g
                class="shot-marker"
                :style="{ transform: `translateY(${zone === 0 ? 180 : zone === 1 ? 110 : 310}px)` }"
              >
                <circle cx="250" cy="0" r="22" class="court-ball" />
                <text x="250" y="6" text-anchor="middle">{{ selectedZone.points }}</text>
              </g>
              <path d="M205 365A45 45 0 0 1 295 365" fill="none" /></svg
            ><span>Схема для знакомства с игрой</span>
          </div>
        </div>
        <div class="rules-facts">
          <div><strong>5 × 5</strong><span>игроков на площадке</span></div>
          <div><strong>4 × 10</strong><span>минут основного времени</span></div>
          <div><strong>24</strong><span>секунды на атаку</span></div>
        </div>
        <section class="rules-role-section" aria-labelledby="player-roles-title">
          <div class="rules-reading__heading">
            <p class="eyebrow">02 / Команда в движении</p>
            <h2 id="player-roles-title">Пять позиций. Одна игра.</h2>
            <p>Нажмите на игрока и узнайте, что он делает на площадке.</p>
          </div>
          <AsyncState
            :pending="rolesPending"
            :error="rolesError"
            :empty="!playerRoles.length"
            @retry="loadRoles"
          >
            <RulesRoleCourt :roles="playerRoles" />
          </AsyncState>
        </section>
        <div class="section-heading rules-library-heading">
          <div>
            <p class="eyebrow">03 / Читаем игру</p>
            <h2 id="rules-chapters-title">Правила без лишних слов</h2>
          </div>
        </div>
        <AsyncState :pending="pending" :error="error" :empty="!chapters.length" @retry="load"
          ><details class="rules-library">
            <summary>
              <span
                >Открыть справочник <small>{{ chapters.length }} коротких разделов</small></span
              ><b aria-hidden="true">+</b>
            </summary>
            <div class="rules-chapters">
              <details
                v-for="(chapter, index) in chapters"
                :key="chapter.id"
                class="rule-accordion"
              >
                <summary>
                  <span>{{ String(index + 1).padStart(2, '0') }}</span
                  >{{ chapter.title }}<b aria-hidden="true">+</b>
                </summary>
                <p class="prose-text">{{ chapter.body }}</p>
              </details>
            </div>
          </details></AsyncState
        >
        <section class="rules-quiz" aria-labelledby="quiz-title">
          <div class="quiz-intro">
            <p class="eyebrow">04 / Проверь себя</p>
            <h2 id="quiz-title">Готовы к трибуне?</h2>
            <p>Четыре ситуации с площадки. Сможете прочитать каждую?</p>
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
        <section class="rules-reading" aria-labelledby="viewing-tips-title">
          <div class="rules-reading__heading">
            <p class="eyebrow">05 / С трибуны</p>
            <h2 id="viewing-tips-title">Как смотреть матч</h2>
            <p>Выберите, за чем следить в следующей атаке.</p>
          </div>
          <AsyncState
            :pending="tipsPending"
            :error="tipsError"
            :empty="!viewingTips.length"
            @retry="loadTips"
          >
            <ol class="viewing-tips">
              <li v-for="(tip, index) in viewingTips" :key="tip.id">
                <details>
                  <summary>
                    <span class="viewing-tips__number" aria-hidden="true">{{
                      String(index + 1).padStart(2, '0')
                    }}</span
                    ><span>{{ tip.title }}</span
                    ><b aria-hidden="true">+</b>
                  </summary>
                  <p class="prose-text">{{ tip.body }}</p>
                </details>
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
.rules-page .page-hero h1 {
  font-size: clamp(2.6rem, 5vw, 4.4rem);
}
.rules-page > .section {
  padding-top: 28px;
}
.rules-jumps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 44px;
}
.rules-jumps a {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  padding: 10px 18px;
  border: 1px solid #bdcddc;
  border-radius: 4px;
  background: white;
  color: #28465f;
  text-decoration: none;
  font-size: 0.8rem;
  font-weight: 600;
}
.rules-jumps a:hover {
  color: white;
  background: #103550;
  border-color: #103550;
}
.rules-jumps a:focus-visible,
.rules-page summary:focus-visible,
.shot-options button:focus-visible {
  outline: 3px solid #5089b9;
  outline-offset: 4px;
}
.rules-intro {
  padding-block: 0 36px;
}
.rules-intro h2 {
  margin: 12px 0 20px;
  line-height: 1.08;
}
.rules-intro .eyebrow {
  font-size: 0.78rem;
}
.shot-options {
  gap: 10px;
}
.shot-options button {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  min-height: 48px;
  border-radius: 4px;
}
.shot-options button > span {
  font:
    500 1.35rem/1 'Oswald',
    sans-serif;
  color: #a1322c;
}
.shot-options button.is-active > span {
  color: #ffb5b1;
}
.shot-description {
  min-height: 120px;
  border-radius: 0;
  padding: 24px;
}
.shot-description > strong {
  flex-shrink: 0;
}
.shot-marker {
  transition: transform 0.5s cubic-bezier(0.2, 0.7, 0.3, 1);
}
.basketball-court {
  padding: 24px;
  border-radius: 0;
  background: #0b304f;
}
.basketball-court > span {
  margin-top: 10px;
}
.rules-facts {
  margin-bottom: 64px;
  padding-block: 32px;
}
.rules-facts strong {
  font-size: clamp(2.5rem, 4vw, 3.5rem);
}
.rules-facts span {
  font-size: 0.8rem;
}
.rules-reading__heading {
  max-width: 700px;
  margin-bottom: 28px;
}
.rules-reading__heading .eyebrow,
.rules-library-heading .eyebrow {
  margin: 0 0 12px;
  font-size: 0.75rem;
}
.rules-reading__heading h2,
.rules-library-heading h2 {
  margin: 0;
  font-size: clamp(2rem, 3.5vw, 3.2rem);
  line-height: 1.12;
}
.rules-reading__heading > p:last-child {
  margin: 18px 0 0;
  color: #52677b;
  font-size: 0.95rem;
  line-height: 1.7;
}
.rules-library-heading {
  margin-top: 64px;
}
.rules-library {
  border-block: 1px solid #a8bbc9;
}
.rules-library > summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  min-height: 96px;
  padding: 24px 0;
  list-style: none;
  cursor: pointer;
  font:
    500 1.55rem/1.3 'Oswald',
    sans-serif;
  text-transform: uppercase;
}
.rules-library > summary::-webkit-details-marker {
  display: none;
}
.rules-library small {
  display: block;
  margin-top: 8px;
  color: #52677b;
  font:
    400 0.8rem/1.5 'Roboto',
    sans-serif;
  text-transform: none;
}
.rules-library > summary > b {
  font:
    300 2rem/1 'Roboto',
    sans-serif;
}
.rules-library[open] > summary > b {
  transform: rotate(45deg);
}
.rules-library .rules-chapters {
  border-color: #cbd7e2;
}
.rule-accordion summary {
  min-height: 76px;
  gap: 20px;
  font-size: 1.25rem;
  line-height: 1.4;
}
.rule-accordion .prose-text {
  max-width: 900px;
  padding: 0 40px 28px;
  font-size: 0.9rem;
  line-height: 1.8;
}
.rules-quiz {
  border-radius: 0;
  gap: 40px;
}
.rules-quiz .quiz-intro .eyebrow {
  color: #ffb5b1;
}
.quiz-intro h2 {
  font-size: clamp(2rem, 3.4vw, 3rem);
}
.quiz-card {
  border-radius: 4px;
}
.quiz-card .button {
  min-height: 48px;
}
.rules-reading {
  margin-top: 64px;
}
.viewing-tips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.viewing-tips li {
  min-width: 0;
  border: 1px solid #c8d5e0;
  background: white;
}
.viewing-tips details > summary {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 24px;
  align-items: center;
  gap: 12px;
  min-height: 84px;
  padding: 20px;
  list-style: none;
  cursor: pointer;
  font:
    600 0.9rem/1.5 'Roboto',
    sans-serif;
}
.viewing-tips summary::-webkit-details-marker {
  display: none;
}
.viewing-tips__number {
  color: #a4352e;
  font-size: 0.75rem;
  font-weight: 700;
}
.viewing-tips summary > b {
  text-align: center;
  font:
    300 1.6rem/1 'Roboto',
    sans-serif;
}
.viewing-tips details[open] summary > b {
  transform: rotate(45deg);
}
.viewing-tips p {
  margin: 0;
  padding: 0 20px 24px 56px;
  color: #42576c;
  font-size: 0.88rem;
  line-height: 1.75;
}
.rules-source {
  margin-top: 32px;
}
#shot-intro,
#rules-chapters-title,
#quiz-title,
#player-roles-title,
#viewing-tips-title {
  scroll-margin-top: 0;
}
@media (max-width: 800px) {
  .rules-intro {
    grid-template-columns: 1fr;
    gap: 28px;
  }
  .basketball-court {
    max-width: 620px;
    width: 100%;
    justify-self: center;
  }
}
@media (max-width: 700px) {
  .rules-page > .section {
    padding-top: 12px;
  }
  .rules-jumps {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-bottom: 36px;
    gap: 8px;
  }
  .rules-jumps a {
    justify-content: center;
    min-width: 0;
    min-height: 44px;
    padding: 10px 8px;
    font-size: 0.75rem;
  }
  .rules-intro h2 {
    font-size: 2.2rem;
  }
  .rules-intro > div > p:not(.eyebrow) {
    font-size: 0.9rem;
  }
  .shot-options {
    display: grid;
    grid-template-columns: 1fr;
    margin-block: 24px;
  }
  .shot-options button {
    justify-content: flex-start;
    padding: 14px 18px;
  }
  .shot-options button > span {
    min-width: 28px;
  }
  .shot-description {
    gap: 20px;
    padding: 20px;
    min-height: 132px;
  }
  .shot-description p {
    font-size: 0.85rem;
  }
  .basketball-court {
    padding: 18px;
  }
  .rules-facts {
    gap: 8px;
    margin-block: 0 40px;
    padding-block: 24px;
  }
  .rules-facts strong {
    font-size: 2.1rem;
  }
  .rules-facts span {
    font-size: 0.67rem;
    line-height: 1.5;
  }
  .rules-reading__heading {
    margin-bottom: 24px;
  }
  .rules-reading__heading > p:last-child {
    font-size: 0.9rem;
    margin-top: 16px;
  }
  .rules-reading__heading .eyebrow,
  .rules-library-heading .eyebrow {
    font-size: 0.7rem;
  }
  .rules-library-heading,
  .rules-reading {
    margin-top: 40px;
  }
  .rules-library > summary {
    min-height: 88px;
    font-size: 1.3rem;
  }
  .rule-accordion summary {
    gap: 12px;
    padding-inline: 0;
    font-size: 1.1rem;
  }
  .rule-accordion .prose-text {
    padding-inline: 0;
  }
  .rules-quiz {
    gap: 24px;
    margin-top: 40px;
    padding: 28px 20px;
  }
  .quiz-intro h2 {
    margin-block: 12px 16px;
  }
  .quiz-intro > p:last-child {
    font-size: 0.9rem;
  }
  .quiz-card {
    padding: 24px 18px;
  }
  .quiz-card h3 {
    font-size: 1.05rem;
  }
  .quiz-feedback .button {
    width: 100%;
    padding-inline: 12px;
  }
  .viewing-tips {
    grid-template-columns: 1fr;
  }
  .viewing-tips details > summary {
    min-height: 76px;
    padding: 18px 16px;
    font-size: 0.85rem;
  }
  .viewing-tips p {
    padding: 0 20px 22px 52px;
    font-size: 0.85rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .shot-marker {
    transition: none;
  }
}
</style>
