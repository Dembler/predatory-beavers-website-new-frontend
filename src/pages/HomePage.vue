<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import AsyncState from '@/components/AsyncState.vue'
import MatchCard from '@/components/MatchCard.vue'
import { useLoad } from '@/composables/useLoad'
import { apiRequest } from '@/shared/api'
import type { Achievement, ApiResponse, HomeData, Match, Page } from '@/shared/types'

const { data, pending, error, load } = useLoad(() =>
  apiRequest<ApiResponse<HomeData>>('/api/v1/home'),
)
const home = computed(() => data.value?.data)
const { data: achievementsData } = useLoad(() =>
  apiRequest<Page<Achievement>>('/api/v1/achievements?page_size=6'),
)
const achievements = computed(() => achievementsData.value?.items ?? [])
const matchTimeline = computed<Match[]>(() => {
  const matches = [...(home.value?.recent_results ?? [])]
  if (home.value?.next_match) matches.push(home.value.next_match)
  return matches.sort(
    (left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
  )
})
const shortDate = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' }).format(new Date(value))
</script>

<template>
  <div class="home-page">
    <section class="home-hero">
      <img
        class="home-hero__photo"
        src="/images/team-community.jpg"
        alt="Команда и болельщики Хищных Бобров"
      />
      <div class="home-hero__shade"></div>
      <div class="container home-hero__content">
        <p class="eyebrow">Баскетбольный клуб ВГУ</p>
        <h1>Баскетбол.<br />Команда.<br /><span>Университет.</span></h1>
        <p class="home-hero__lead">Одна команда на площадке и за её пределами.</p>
        <div class="hero-actions">
          <RouterLink class="button" to="/club">Узнать о клубе</RouterLink>
          <RouterLink class="text-link" to="/teams/men">Смотреть состав <span>→</span></RouterLink>
        </div>
      </div>
    </section>

    <section class="home-dashboard">
      <div class="container dashboard-grid">
        <div class="dashboard-main">
          <div class="section-heading section-heading--compact">
            <div>
              <p class="eyebrow">Будь в игре</p>
              <h2>Ближайший матч</h2>
            </div>
            <RouterLink class="text-link" to="/matches">Все матчи <span>→</span></RouterLink>
          </div>
          <AsyncState :pending="pending" :error="error" :empty="!home?.next_match" @retry="load">
            <MatchCard v-if="home?.next_match" :match="home.next_match" featured />
          </AsyncState>
        </div>

        <aside class="club-note">
          <span class="club-note__number">01</span>
          <p class="eyebrow">Хищные Бобры</p>
          <h2>Одна команда.<br />Один университет.</h2>
          <p>Мужская и женская команды ВГУ, объединённые игрой, характером и поддержкой трибун.</p>
          <RouterLink class="text-link" to="/club">История клуба <span>→</span></RouterLink>
        </aside>
      </div>
    </section>

    <section v-if="matchTimeline.length" class="season-pulse">
      <div class="container">
        <div class="season-pulse__heading">
          <div><p class="eyebrow">Календарь</p><h2>Пульс сезона</h2></div>
          <RouterLink class="text-link" to="/matches">Все матчи <span>→</span></RouterLink>
        </div>
        <div class="match-timeline" aria-label="Последние и ближайшие матчи">
          <article
            v-for="match in matchTimeline"
            :key="match.id"
            class="match-timeline__item"
            :class="{ 'match-timeline__item--next': match.id === home?.next_match?.id }"
          >
            <span class="match-timeline__dot"></span>
            <time :datetime="match.starts_at">{{ shortDate(match.starts_at) }}</time>
            <strong>{{ match.home_team_name }} — {{ match.away_team_name }}</strong>
            <b v-if="match.home_score !== null">{{ match.home_score }}:{{ match.away_score }}</b>
            <b v-else>Скоро</b>
          </article>
        </div>
      </div>
    </section>

    <section class="section teams-section">
      <div class="container">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Игроки</p>
            <h2>Наши команды</h2>
          </div>
          <p class="section-intro">Составы, игровые номера и информация о каждом игроке клуба.</p>
        </div>
        <div class="team-grid team-grid--feature">
          <RouterLink class="team-card" to="/teams/men">
            <img src="/images/team-men.jpg" alt="Мужская команда Хищных Бобров" />
            <span class="team-card__index">01</span>
            <div class="team-card__body">
              <small>БК ВГУ</small><strong>Мужская команда</strong><b>Смотреть состав →</b>
            </div>
          </RouterLink>
          <RouterLink class="team-card" to="/teams/women">
            <img src="/images/team-women.jpg" alt="Женская команда Хищных Бобров" />
            <span class="team-card__index">02</span>
            <div class="team-card__body">
              <small>БК ВГУ</small><strong>Женская команда</strong><b>Смотреть состав →</b>
            </div>
          </RouterLink>
        </div>
      </div>
    </section>

    <section v-if="achievements.length" class="section achievements-section">
      <div class="container">
        <div class="section-heading">
          <div><p class="eyebrow">История побед</p><h2>Достижения клуба</h2></div>
          <RouterLink class="text-link" to="/club">О клубе <span>→</span></RouterLink>
        </div>
        <div class="achievement-grid">
          <article v-for="achievement in achievements" :key="achievement.id" class="achievement-card">
            <span>{{ achievement.achieved_at?.slice(0, 4) || '—' }}</span>
            <div><small>{{ achievement.team.name }}</small><h3>{{ achievement.title }}</h3></div>
          </article>
        </div>
      </div>
    </section>

    <section class="section results-section">
      <div class="container">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Сезон</p>
            <h2>Последние результаты</h2>
          </div>
          <RouterLink class="button button--small" to="/matches">Все матчи</RouterLink>
        </div>
        <AsyncState
          :pending="pending"
          :error="error"
          :empty="!home?.recent_results.length"
          @retry="load"
        >
          <div class="match-grid">
            <MatchCard v-for="match in home?.recent_results" :key="match.id" :match="match" />
          </div>
        </AsyncState>
      </div>
    </section>
  </div>
</template>
