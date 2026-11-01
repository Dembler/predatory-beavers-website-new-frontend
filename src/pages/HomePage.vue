<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import AsyncState from '@/components/AsyncState.vue'
import MatchCard from '@/components/MatchCard.vue'
import RecentResults from '@/components/RecentResults.vue'
import { useLoad } from '@/composables/useLoad'
import { preferredTeamPath } from '@/composables/useTeamPreference'
import { apiRequest } from '@/shared/api'
import type { Achievement, ApiResponse, HomeData, Page } from '@/shared/types'

const { data, pending, error, load } = useLoad(() =>
  apiRequest<ApiResponse<HomeData>>('/api/v1/home'),
)
const home = computed(() => data.value?.data)
const featuredMatch = computed(() => home.value?.next_match ?? home.value?.recent_results[0])
const {
  data: achievementsData,
  pending: achievementsPending,
  error: achievementsError,
  load: loadAchievements,
} = useLoad(() => apiRequest<Page<Achievement>>('/api/v1/achievements?page_size=6'))
const achievements = computed(() => achievementsData.value?.items ?? [])
</script>

<template>
  <div class="home-page">
    <section class="home-hero">
      <img
        class="home-hero__photo"
        src="/images/team-community.webp"
        alt="Команда и болельщики Хищных Бобров"
      />
      <div class="home-hero__shade"></div>
      <div class="container home-hero__content">
        <h1><span>Мы —</span><br />Хищные<br />Бобры.</h1>
        <p class="home-hero__lead">
          <strong>Баскетбольный клуб ВГУ.</strong><br />
          Играем вместе. Бьёмся за каждый мяч.
        </p>
        <div class="hero-actions">
          <RouterLink class="button" to="/club">О клубе</RouterLink>
          <RouterLink class="text-link" :to="preferredTeamPath"
            >Наша команда <span>→</span></RouterLink
          >
        </div>
      </div>
    </section>

    <section class="home-dashboard">
      <div class="container dashboard-grid">
        <div class="dashboard-main">
          <div class="section-heading section-heading--compact">
            <div>
              <p class="eyebrow">Будь в игре</p>
              <h2>
                {{
                  home?.next_match?.status === 'live'
                    ? 'Сейчас на площадке'
                    : home?.next_match
                      ? 'Ближайший матч'
                      : featuredMatch
                        ? 'Последний матч'
                        : 'Ближайший матч'
                }}
              </h2>
            </div>
            <RouterLink class="text-link" to="/matches">Все матчи <span>→</span></RouterLink>
          </div>
          <AsyncState
            :pending="pending"
            :error="error"
            :empty="!featuredMatch"
            empty-text="Ближайший матч пока не назначен."
            @retry="load"
          >
            <p v-if="!home?.next_match" class="dashboard-main__schedule-note">
              Новая игра пока не назначена. Вот результат последней встречи.
            </p>
            <MatchCard v-if="featuredMatch" :match="featuredMatch" featured />
          </AsyncState>
        </div>

        <aside class="club-note">
          <span class="club-note__number">01</span>
          <p class="eyebrow">Хищные Бобры</p>
          <h2>Одна команда.<br />Один характер.</h2>
          <p>Мужская и женская команды ВГУ, объединённые игрой, характером и поддержкой трибун.</p>
          <RouterLink class="text-link" to="/club">История клуба <span>→</span></RouterLink>
        </aside>
      </div>
    </section>

    <section class="section teams-section">
      <div class="container">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Игроки</p>
            <h2>Наши команды</h2>
          </div>
          <p class="section-intro">Составы, амплуа и информация о каждом игроке клуба.</p>
        </div>
        <div class="team-grid team-grid--feature">
          <RouterLink class="team-card" to="/teams/men">
            <img
              src="/images/team-men.webp"
              alt="Мужская команда Хищных Бобров"
              loading="lazy"
              decoding="async"
            />
            <span class="team-card__index">01</span>
            <div class="team-card__body">
              <small>БК ВГУ</small><strong>Мужская команда</strong><b>Смотреть состав →</b>
            </div>
          </RouterLink>
          <RouterLink class="team-card" to="/teams/women">
            <img
              src="/images/team-women.webp"
              alt="Женская команда Хищных Бобров"
              loading="lazy"
              decoding="async"
            />
            <span class="team-card__index">02</span>
            <div class="team-card__body">
              <small>БК ВГУ</small><strong>Женская команда</strong><b>Смотреть состав →</b>
            </div>
          </RouterLink>
        </div>
      </div>
    </section>

    <section
      v-if="achievementsPending || achievementsError || achievements.length"
      class="section achievements-section"
    >
      <div class="container">
        <div class="section-heading">
          <div>
            <p class="eyebrow">История побед</p>
            <h2>Достижения клуба</h2>
          </div>
          <RouterLink class="text-link" to="/club">О клубе <span>→</span></RouterLink>
        </div>
        <AsyncState
          :pending="achievementsPending"
          :error="achievementsError"
          @retry="loadAchievements"
        >
          <div class="achievement-grid">
            <article
              v-for="achievement in achievements"
              :key="achievement.id"
              class="achievement-card"
            >
              <span>{{ achievement.achieved_at?.slice(0, 4) || '—' }}</span>
              <div>
                <small>{{ achievement.team.name }}</small>
                <h3>{{ achievement.title }}</h3>
              </div>
            </article>
          </div>
        </AsyncState>
      </div>
    </section>

    <section class="section results-section" aria-labelledby="recent-results-title">
      <div class="container">
        <div class="section-heading results-section__heading">
          <div class="results-section__title">
            <h2 id="recent-results-title">Последние результаты</h2>
          </div>
          <RouterLink class="results-section__link" to="/matches"
            >Все матчи <span>→</span></RouterLink
          >
        </div>
        <AsyncState
          :pending="pending"
          :error="error"
          :empty="!home?.recent_results.length"
          empty-text="Результатов пока нет."
          @retry="load"
        >
          <RecentResults :matches="home?.recent_results ?? []" />
        </AsyncState>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard-main__schedule-note {
  margin: 0 0 14px;
  color: #d3dfeb;
  font-size: 0.875rem;
  line-height: 1.6;
}
@media (max-width: 700px) {
  .dashboard-main__schedule-note {
    color: #435a70;
  }
}
</style>
