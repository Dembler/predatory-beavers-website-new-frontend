<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import AsyncState from '@/components/AsyncState.vue'
import MatchCard from '@/components/MatchCard.vue'
import { useLoad } from '@/composables/useLoad'
import { apiRequest } from '@/shared/api'
import type { ApiResponse, HomeData } from '@/shared/types'

const { data, pending, error, load } = useLoad(() =>
  apiRequest<ApiResponse<HomeData>>('/api/v1/home'),
)
const home = computed(() => data.value?.data)
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
