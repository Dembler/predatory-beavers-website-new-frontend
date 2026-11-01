<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import AsyncState from '@/components/AsyncState.vue'
import { useLoad } from '@/composables/useLoad'
import { rememberTeam } from '@/composables/useTeamPreference'
import { allPages, mediaUrl } from '@/shared/api'
import type { Player } from '@/shared/types'

const route = useRoute()
const category = computed(() => (route.params.category === 'women' ? 'women' : 'men'))
watch(category, rememberTeam, { immediate: true })
const title = computed(() => (category.value === 'men' ? 'Мужская команда' : 'Женская команда'))
const { data, pending, error, load } = useLoad(
  () => allPages<Player>(`/api/v1/players?category=${category.value}`),
  [category],
)
</script>

<template>
  <div>
    <section class="page-hero page-hero--compact">
      <div class="container">
        <p class="eyebrow">Состав клуба</p>
        <h1>{{ title }}</h1>
        <div class="team-switch" aria-label="Выбор команды">
          <RouterLink to="/teams/men">Мужская команда</RouterLink>
          <RouterLink to="/teams/women">Женская команда</RouterLink>
        </div>
        <nav class="team-links" aria-label="Матчи и таблица команды">
          <RouterLink :to="{ path: '/matches', query: { team: category } }"
            >Матчи команды →</RouterLink
          >
          <RouterLink :to="{ path: '/standings', query: { team: category } }"
            >Место в таблице →</RouterLink
          >
        </nav>
      </div>
    </section>
    <section class="section section--light">
      <div class="container">
        <AsyncState
          :pending="pending"
          :error="error"
          :empty="!data?.length"
          empty-text="Состав команды скоро появится. Следите за обновлениями клуба."
          @retry="load"
          ><div class="card-grid">
            <RouterLink
              v-for="player in data"
              :key="player.id"
              class="content-card player-card"
              :to="`/players/${player.id}`"
              ><div class="player-card__photo">
                <img
                  v-if="player.photo"
                  loading="lazy"
                  decoding="async"
                  :src="mediaUrl(player.photo.content_url)"
                  :alt="player.photo.alt_text || player.full_name"
                /><span v-else aria-hidden="true">ХБ</span>
              </div>
              <div class="player-card__body">
                <small>{{ player.position || 'Игрок команды' }}</small>
                <h2>{{ player.full_name }}</h2>
                <p v-if="player.age_text">{{ player.age_text }}</p>
                <b>Профиль игрока →</b>
              </div></RouterLink
            >
          </div></AsyncState
        >
      </div>
    </section>
  </div>
</template>

<style scoped>
.team-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 24px;
  margin-top: 12px;
}
.team-links a {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  color: #e1e9f2;
  font-size: 0.875rem;
  text-underline-offset: 5px;
}
.team-links a:hover {
  color: white;
}
</style>
