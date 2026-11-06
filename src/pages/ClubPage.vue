<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AsyncState from '@/components/AsyncState.vue'
import ClubHonours from '@/components/ClubHonours.vue'
import ClubTournamentHistory from '@/components/ClubTournamentHistory.vue'
import { useLoad } from '@/composables/useLoad'
import { apiRequest } from '@/shared/api'
import { clubCopy } from '@/shared/clubCopy'
import type { ApiResponse, ContentBlock } from '@/shared/types'

const { data, pending, error, load } = useLoad(() =>
  apiRequest<ApiResponse<{ items: ContentBlock[] }>>('/api/v1/content/history'),
)
const chapters = computed(() =>
  (data.value?.data?.items ?? []).map((chapter) => ({
    ...chapter,
    title: clubCopy(chapter.title),
    body: clubCopy(chapter.body),
    subtitle: chapter.subtitle ? clubCopy(chapter.subtitle) : chapter.subtitle,
    link_label: chapter.link_label ? clubCopy(chapter.link_label) : chapter.link_label,
  })),
)
const activeEra = ref(0)
function chapterYear(chapter: ContentBlock) {
  const match = /^(20\d{2})/u.exec(chapter.title)
  return match ? Number(match[1]) : null
}
const datedChapters = computed(() =>
  chapters.value
    .filter((chapter) => chapterYear(chapter) !== null)
    .sort((a, b) => chapterYear(a)! - chapterYear(b)! || a.sort_order - b.sort_order),
)
const historyGroups = computed(() =>
  [
    {
      label: '2007–2022',
      title: 'Начало и новое имя',
      chapters: datedChapters.value.filter((chapter) => chapterYear(chapter)! <= 2022),
    },
    {
      label: '2023–2025',
      title: 'Новые города и победы',
      chapters: datedChapters.value.filter(
        (chapter) => chapterYear(chapter)! >= 2023 && chapterYear(chapter)! <= 2025,
      ),
    },
    {
      label: '2026',
      title: 'Игра продолжается',
      chapters: datedChapters.value.filter((chapter) => chapterYear(chapter)! >= 2026),
    },
    {
      label: 'Вне времени',
      title: 'Люди и традиции',
      chapters: chapters.value.filter((chapter) => chapterYear(chapter) === null),
    },
  ].filter((group) => group.chapters.length),
)
const eras = [
  {
    year: '2007',
    label: 'Начало',
    title: 'Всё начинается с команды.',
    text: 'В Воронежском государственном университете появляется баскетбольный клуб. Первые турниры, первые соперники и своя игра.',
    chapter: '2007:',
  },
  {
    year: '2022',
    label: 'Новое имя',
    title: 'Характер получает имя.',
    text: 'БК ВГУ становится частью студенческого спортивного клуба «Хищные Бобры». Игроков и болельщиков объединяет одна эмблема.',
    chapter: '2022:',
  },
  {
    year: '2024',
    label: 'Большая площадка',
    title: 'Воронеж. Краснодар. Вся страна.',
    text: 'Мужская сборная выигрывает турнир Кубка регионов АСБ в Краснодаре. В клубной истории появляются новые города и победы в формате 3×3.',
    chapter: '2024: золото',
  },
  {
    year: '2026',
    label: 'Игра продолжается',
    title: 'Новые форматы. Тот же азарт.',
    text: 'Баскетбол 5×5, 3×3 и фиджитал. Мужская сборная и сборная девушек продолжают представлять ВГУ на студенческих турнирах.',
    chapter: '2026:',
  },
]
const currentEra = computed(() => eras[activeEra.value]!)

async function readChapter(prefix: string) {
  const chapter = chapters.value.find((item) => item.title.startsWith(prefix))
  if (!chapter) return
  const target = document.getElementById(`chapter-${chapter.id}`) as HTMLDetailsElement | null
  if (!target) return
  const group = target.closest('.club-archive') as HTMLDetailsElement | null
  if (group) group.open = true
  target.open = true
  await nextTick()
  target.scrollIntoView({
    block: 'start',
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  })
  target.querySelector('summary')?.focus({ preventScroll: true })
}
</script>

<template>
  <div class="club-page">
    <section class="page-hero club-hero">
      <div class="container club-hero__heading">
        <div>
          <p class="eyebrow">БК ВГУ · Воронеж · с 2007 года</p>
          <h1>О клубе</h1>
          <p class="club-hero__statement">Одна команда.<br /><span>Общий характер.</span></p>
        </div>
        <div class="club-hero__intro">
          <p class="lead">«Хищные Бобры» — люди, которых объединяет баскетбол.</p>
        </div>
      </div>
      <nav class="container club-section-nav" aria-label="Разделы страницы клуба">
        <ul>
          <li><a href="#club-timeline">История клуба</a></li>
          <li><a href="#club-honours-title">Достижения</a></li>
          <li><a href="#club-tournaments">Турниры</a></li>
        </ul>
      </nav>
      <figure class="club-hero__photo">
        <img
          src="/images/history/sponsor-team.jpeg"
          alt="Игроки и болельщики Хищных Бобров вместе в университетском спортивном зале"
          width="1321"
          height="631"
          fetchpriority="high"
          decoding="async"
        />
        <figcaption>На площадке и рядом с ней.</figcaption>
      </figure>
    </section>
    <section class="club-identity" aria-label="Клуб в трёх фактах">
      <div class="container club-identity__grid">
        <div><strong>2007</strong><span>год основания БК ВГУ</span></div>
        <div><strong>М + Ж</strong><span>две сборные · один клуб</span></div>
        <div><strong>ВГУ</strong><span>университет, который мы представляем</span></div>
      </div>
    </section>
    <section
      id="club-timeline"
      class="section section--light club-timeline"
      aria-labelledby="club-timeline-title"
    >
      <div class="container">
        <div class="club-section-heading">
          <p class="eyebrow">Наш путь</p>
          <h2 id="club-timeline-title">Годы идут.<br />Команда остаётся.</h2>
        </div>
        <div class="club-years" role="group" aria-label="Этапы истории клуба">
          <button
            v-for="(era, index) in eras"
            :key="era.year"
            type="button"
            :aria-pressed="activeEra === index"
            aria-controls="club-era-panel"
            @click="activeEra = index"
          >
            <span class="club-years__dot" aria-hidden="true"></span><strong>{{ era.year }}</strong
            ><span>{{ era.label }}</span>
          </button>
        </div>
        <div id="club-era-panel" class="club-era" aria-live="polite" aria-atomic="true">
          <span class="club-era__year" aria-hidden="true">{{ currentEra.year }}</span>
          <div :key="currentEra.year" class="club-era__copy">
            <h3>{{ currentEra.title }}</h3>
            <p>{{ currentEra.text }}</p>
            <button
              v-if="chapters.length"
              class="club-link"
              type="button"
              @click="readChapter(currentEra.chapter)"
            >
              Читать эту главу <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
      </div>
    </section>
    <section class="section club-people" aria-labelledby="club-people-title">
      <div class="container">
        <div class="club-people__intro">
          <p class="eyebrow">Больше, чем игра</p>
          <h2 id="club-people-title">Наш главный состав —<br /><span>люди.</span></h2>
          <p>Игроки, болельщики, SMM-команда. Каждый делает клуб собой.</p>
        </div>
        <div class="club-team-grid">
          <RouterLink to="/teams/men" class="club-team-link">
            <img
              src="/images/team-men.webp"
              alt="Мужская баскетбольная команда ВГУ"
              width="2560"
              height="1707"
              loading="lazy"
              decoding="async"
            />
            <span><strong>Мужская команда</strong><span aria-hidden="true">↗</span></span>
          </RouterLink>
          <RouterLink to="/teams/women" class="club-team-link">
            <img
              src="/images/team-women.webp"
              alt="Баскетбольная команда девушек ВГУ"
              width="2560"
              height="1707"
              loading="lazy"
              decoding="async"
            />
            <span><strong>Команда девушек</strong><span aria-hidden="true">↗</span></span>
          </RouterLink>
        </div>
        <RouterLink class="club-link club-community-link" to="/contacts"
          >Стать ближе к команде <span aria-hidden="true">↗</span></RouterLink
        >
      </div>
    </section>
    <ClubHonours />
    <ClubTournamentHistory />
    <section class="section section--light club-full-history" aria-labelledby="club-history-title">
      <div class="container">
        <div class="club-section-heading">
          <h2 id="club-history-title">Архив истории</h2>
          <p>Сезоны, поездки, соперники и люди, которые создали эту команду.</p>
        </div>
        <AsyncState
          :pending="pending"
          :error="error"
          :empty="!chapters.length"
          empty-text="Новые главы истории скоро появятся здесь."
          @retry="load"
        >
          <div class="club-history-groups">
            <details v-for="group in historyGroups" :key="group.label" class="club-archive">
              <summary>
                <span
                  ><small>{{ group.label }}</small
                  >{{ group.title }}
                  <small
                    >{{ group.chapters.length }}
                    {{
                      group.chapters.length === 1
                        ? 'глава'
                        : group.chapters.length < 5
                          ? 'главы'
                          : 'глав'
                    }}</small
                  ></span
                ><span class="club-disclosure-mark" aria-hidden="true">+</span>
              </summary>
              <div class="club-chapters">
                <details
                  v-for="(chapter, index) in group.chapters"
                  :id="`chapter-${chapter.id}`"
                  :key="chapter.id"
                  class="club-chapter"
                >
                  <summary>
                    <span class="club-chapter__number" aria-hidden="true">{{
                      String(index + 1).padStart(2, '0')
                    }}</span
                    ><span>{{ chapter.title }}</span
                    ><span class="club-disclosure-mark" aria-hidden="true">+</span>
                  </summary>
                  <div class="club-chapter__body">
                    <p v-if="chapter.subtitle" class="club-chapter__era">{{ chapter.subtitle }}</p>
                    <p
                      v-for="(paragraph, paragraphIndex) in chapter.body.split(/\n\s*\n/u)"
                      :key="paragraphIndex"
                      class="prose-text"
                    >
                      {{ paragraph }}
                    </p>
                    <a
                      v-if="chapter.link_url"
                      class="club-source"
                      :href="chapter.link_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      >{{ chapter.link_label || 'Источник' }} <span aria-hidden="true">↗</span></a
                    >
                  </div>
                </details>
              </div>
            </details>
          </div>
        </AsyncState>
        <RouterLink class="club-link club-results-link" to="/matches"
          >Все матчи клуба <span aria-hidden="true">↗</span></RouterLink
        >
      </div>
    </section>
  </div>
</template>

<style scoped>
.club-page {
  --club-accent: #ffb5b1;
}
.club-hero {
  overflow: hidden;
  padding-bottom: 0;
}
.club-hero__heading {
  display: grid;
  grid-template-columns: 1.3fr 0.7fr;
  align-items: end;
  gap: 48px;
  padding-bottom: 40px;
}
.club-hero h1 {
  font-size: clamp(3.5rem, 7vw, 6.25rem);
}
.club-hero__statement {
  margin: 22px 0 0;
  font:
    500 clamp(1.7rem, 3.2vw, 2.9rem)/1.15 'Oswald',
    sans-serif;
  text-transform: uppercase;
}
.club-hero__statement span {
  color: var(--club-accent);
}
.club-hero__intro {
  max-width: 400px;
  padding-bottom: 4px;
}
.club-hero__intro .lead {
  margin: 0;
  font-size: clamp(1.1rem, 2vw, 1.5rem);
  line-height: 1.5;
}
.club-section-nav ul {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  margin: 0;
  padding: 0 0 24px;
  list-style: none;
}
.club-section-nav a {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  padding: 10px 0;
  color: #fff;
  border-bottom: 1px solid #ffffff70;
  font:
    500 1rem/1.4 'Roboto',
    sans-serif;
  text-decoration: none;
}
.club-section-nav a:hover {
  border-bottom-color: #ffb5b1;
  color: #ffb5b1;
}
.club-section-nav a:focus-visible {
  outline: 3px solid #f5ad68;
  outline-offset: 4px;
}
.club-link {
  display: inline-flex;
  min-height: 48px;
  align-items: center;
  gap: 24px;
  border: 0;
  background: transparent;
  padding: 8px 0;
  color: inherit;
  font:
    600 0.9rem/1.4 'Roboto',
    sans-serif;
  text-decoration: none;
  cursor: pointer;
}
.club-link > span {
  font-size: 1.4rem;
  transition: transform 0.2s;
}
.club-link:hover > span {
  transform: translate(3px, -3px);
}
.club-link:focus-visible,
summary:focus-visible,
.club-years button:focus-visible,
.club-team-link:focus-visible {
  outline: 3px solid #5089b9;
  outline-offset: 6px;
}
.club-hero__photo {
  position: relative;
  margin: 0;
  background: #123751;
  overflow: hidden;
}
.club-hero__photo img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 540px;
  object-fit: cover;
  object-position: center 58%;
  animation: photo-arrive 1.1s ease-out both;
}
.club-hero__photo figcaption {
  position: relative;
  padding: 16px var(--page-gutter);
  border-top: 3px solid #cf3e38;
  color: #fff;
  background: #082944;
  font-size: 0.75rem;
  line-height: 1.6;
  font-weight: 600;
}
.club-identity {
  background: #0c304e;
  color: white;
}
.club-identity__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding-block: 36px;
}
.club-identity__grid > div {
  display: grid;
  gap: 8px;
  padding-inline: 36px;
  border-left: 1px solid #ffffff24;
}
.club-identity__grid > div:first-child {
  padding-left: 0;
  border: 0;
}
.club-identity strong {
  font:
    500 clamp(2.2rem, 4vw, 3.5rem)/1.1 'Oswald',
    sans-serif;
}
.club-identity span {
  color: #cedbe7;
  font-size: 0.85rem;
  line-height: 1.5;
}
.club-section-heading {
  margin-bottom: 40px;
}
.club-section-heading .eyebrow,
.club-people__intro .eyebrow {
  margin: 0 0 16px;
  font-size: 0.8rem;
}
.club-section-heading h2,
.club-people__intro h2 {
  margin: 0;
  font-size: clamp(2.35rem, 4.5vw, 4.25rem);
  line-height: 1.07;
}
.club-section-heading > p:last-child {
  margin: 20px 0 0;
  color: #52677b;
  line-height: 1.6;
}
.club-years {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0 0 32px;
}
.club-years button {
  position: relative;
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 24px 24px 20px 0;
  border: 0;
  border-top: 2px solid #c5d1dd;
  background: transparent;
  color: #52677b;
  text-align: left;
  cursor: pointer;
}
.club-years__dot {
  position: absolute;
  top: -6px;
  left: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #8396a8;
}
.club-years strong {
  color: #233f59;
  font:
    500 clamp(1.8rem, 3.2vw, 3rem)/1.1 'Oswald',
    sans-serif;
}
.club-years button > span:last-child {
  font-size: 0.8rem;
  line-height: 1.5;
}
.club-years button[aria-pressed='true'] {
  border-color: #b13731;
}
.club-years button[aria-pressed='true'] strong {
  color: #a52f29;
}
.club-years button[aria-pressed='true'] .club-years__dot {
  background: #b13731;
  box-shadow: 0 0 0 5px #b1373114;
}
.club-era {
  position: relative;
  display: grid;
  grid-template-columns: 0.75fr 1.25fr;
  align-items: center;
  gap: 40px;
  min-height: 320px;
  padding: clamp(28px, 4vw, 56px);
  border: 1px solid #d3dfe9;
  background: white;
}
.club-era__year {
  color: #7890a7;
  font:
    600 clamp(5rem, 13vw, 12rem)/1 'Oswald',
    sans-serif;
  letter-spacing: -0.04em;
}
.club-era h3 {
  max-width: 620px;
  margin: 0 0 18px;
  font-size: clamp(1.8rem, 3vw, 2.8rem);
  line-height: 1.1;
}
.club-era__copy > p:not(.eyebrow) {
  max-width: 56ch;
  margin: 0;
  color: #42576c;
  line-height: 1.7;
  font-size: 0.95rem;
}
.club-era .club-link {
  margin-top: 12px;
  color: #953029;
}
.club-people {
  background: #102f4a;
}
.club-people__intro {
  max-width: 780px;
  margin-bottom: 36px;
}
.club-people__intro h2 span {
  color: var(--club-accent);
}
.club-people__intro > p:last-child {
  max-width: 540px;
  margin: 24px 0 0;
  color: #d2deea;
  line-height: 1.7;
}
.club-team-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 28px;
}
.club-team-link {
  display: block;
  color: white;
  text-decoration: none;
  overflow: hidden;
  background: #193d5b;
}
.club-team-link img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1.6;
  object-fit: cover;
  transition: transform 0.5s;
}
.club-team-link:hover img {
  transform: scale(1.035);
}
.club-team-link > span {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 24px;
  background: #0b2841;
}
.club-team-link strong {
  font:
    500 clamp(1.2rem, 2.5vw, 1.9rem)/1.2 'Oswald',
    sans-serif;
  text-transform: uppercase;
}
.club-team-link > span > span {
  color: var(--club-accent);
  font-size: 1.8rem;
}
.club-community-link {
  margin-top: 24px;
  color: white;
}
.club-history-groups {
  border-top: 1px solid #a6b7c8;
}
.club-archive {
  border-bottom: 1px solid #a6b7c8;
}
.club-archive > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 104px;
  padding: 24px 0;
  font:
    500 clamp(1.55rem, 3vw, 2.5rem)/1.2 'Oswald',
    sans-serif;
  text-transform: uppercase;
}
.club-archive summary {
  list-style: none;
  cursor: pointer;
}
.club-archive summary::-webkit-details-marker {
  display: none;
}
.club-archive small {
  display: block;
  margin-top: 8px;
  color: #52677b;
  font:
    400 0.8rem/1.5 'Roboto',
    sans-serif;
  text-transform: none;
}
.club-archive small:first-child {
  margin: 0 0 10px;
  color: #9c312b;
  font-size: 0.7rem;
  font-weight: 700;
}
.club-disclosure-mark {
  flex-shrink: 0;
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  font:
    300 2rem/1 'Roboto',
    sans-serif;
  transition: transform 0.2s;
}
details[open] > summary > .club-disclosure-mark {
  transform: rotate(45deg);
}
.club-chapters {
  padding-block: 0 28px;
}
.club-chapter {
  border-top: 1px solid #d0dce7;
  scroll-margin-top: 0;
}
.club-chapter > summary {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 40px;
  align-items: center;
  gap: 20px;
  min-height: 80px;
  padding: 18px 0;
  font:
    500 clamp(1.1rem, 2vw, 1.45rem)/1.4 'Oswald',
    sans-serif;
}
.club-chapter__number {
  color: #a1322c;
  font-size: 0.85rem;
}
.club-chapter__body {
  display: grid;
  max-width: 860px;
  gap: 20px;
  padding: 0 0 32px 52px;
}
.club-chapter__body .prose-text {
  font-size: 0.95rem;
  line-height: 1.8;
}
.club-chapter__era {
  margin: 0;
  color: #a1322c;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.6;
}
.club-source {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  width: fit-content;
  color: #953029;
  font-size: 0.8rem;
  text-underline-offset: 4px;
}
.club-results-link {
  margin-top: 24px;
}
.club-era__copy {
  animation: era-copy-in 0.24s ease-out;
}
@keyframes era-copy-in {
  from {
    opacity: 0.4;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes photo-arrive {
  from {
    transform: scale(1.035);
    filter: brightness(0.85);
  }
  to {
    transform: scale(1);
    filter: brightness(1);
  }
}
@media (max-width: 900px) {
  .club-hero__heading {
    grid-template-columns: 1fr 0.85fr;
    gap: 32px;
  }
  .club-hero h1 {
    font-size: clamp(3.25rem, 8vw, 5rem);
  }
  .club-era {
    grid-template-columns: 0.6fr 1.4fr;
    gap: 28px;
    padding: 32px;
  }
  .club-era__year {
    font-size: 7rem;
  }
  .club-identity__grid > div {
    padding-inline: 24px;
  }
}
@media (max-width: 700px) {
  .club-hero__heading {
    grid-template-columns: 1fr;
    gap: 28px;
    padding-bottom: 32px;
  }
  .club-hero h1 {
    font-size: clamp(3.6rem, 16vw, 5rem);
  }
  .club-hero__statement {
    margin-top: 18px;
    font-size: 2rem;
  }
  .club-hero__intro {
    max-width: 330px;
  }
  .club-hero__intro .lead {
    font-size: 1.05rem;
  }
  .club-hero__photo img {
    max-height: none;
    min-height: 230px;
    object-fit: cover;
    object-position: 54% center;
  }
  .club-hero__photo figcaption {
    padding-block: 14px;
    font-size: 0.65rem;
  }
  .club-identity__grid {
    grid-template-columns: 1fr;
    padding-block: 8px;
  }
  .club-identity__grid > div,
  .club-identity__grid > div:first-child {
    grid-template-columns: 110px 1fr;
    align-items: center;
    gap: 20px;
    padding: 20px 0;
    border: 0;
  }
  .club-identity__grid > div + div {
    border-top: 1px solid #ffffff24;
  }
  .club-identity strong {
    font-size: 2.4rem;
  }
  .club-identity span {
    font-size: 0.8rem;
  }
  .club-section-heading {
    margin-bottom: 36px;
  }
  .club-section-heading .eyebrow,
  .club-people__intro .eyebrow {
    font-size: 0.7rem;
    margin-bottom: 12px;
  }
  .club-section-heading h2,
  .club-people__intro h2 {
    font-size: clamp(2.1rem, 9vw, 3rem);
  }
  .club-section-heading > p:last-child {
    font-size: 0.9rem;
    margin-top: 16px;
  }
  .club-years {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 12px;
    margin-bottom: 20px;
  }
  .club-years button {
    padding: 20px 12px 16px 0;
  }
  .club-years strong {
    font-size: 2rem;
  }
  .club-years button > span:last-child {
    font-size: 0.73rem;
  }
  .club-era {
    display: block;
    min-height: 360px;
    padding: 24px;
    overflow: hidden;
  }
  .club-era__year {
    display: block;
    margin-bottom: 24px;
    font-size: 5rem;
  }
  .club-era h3 {
    font-size: 1.85rem;
  }
  .club-era__copy > p:not(.eyebrow) {
    font-size: 0.9rem;
  }
  .club-team-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .club-team-link > span {
    padding: 18px;
  }
  .club-team-link strong {
    font-size: 1.5rem;
  }
  .club-team-link img {
    aspect-ratio: 1.45;
  }
  .club-people__intro > p:last-child {
    margin-top: 20px;
    font-size: 0.9rem;
  }
  .club-archive > summary {
    min-height: 96px;
  }
  .club-chapter > summary {
    grid-template-columns: 24px minmax(0, 1fr) 32px;
    gap: 10px;
    padding-block: 18px;
  }
  .club-disclosure-mark {
    width: 32px;
  }
  .club-chapter__body {
    padding: 0 0 28px;
    gap: 16px;
  }
  .club-chapter__body .prose-text {
    font-size: 0.9rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .club-hero__photo img {
    animation: none;
  }
  .club-team-link img,
  .club-disclosure-mark,
  .club-link > span {
    transition: none;
  }
  .club-era__copy {
    animation: none;
  }
}
</style>
