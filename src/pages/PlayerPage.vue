<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AsyncState from '@/components/AsyncState.vue'
import { useLoad } from '@/composables/useLoad'
import { apiRequest, mediaUrl } from '@/shared/api'
import type { ApiResponse, Player } from '@/shared/types'
const route = useRoute()
const { data, pending, error, load } = useLoad(() =>
  apiRequest<ApiResponse<Player>>(`/api/v1/players/${route.params.id}`),
)
const player = computed(() => data.value?.data)
</script>
<template>
  <section class="section">
    <div class="container">
      <AsyncState :pending="pending" :error="error" :empty="!player" @retry="load"
      ><article v-if="player" class="player-profile">
          <div class="player-profile__media">
            <img v-if="player.photo" :src="mediaUrl(player.photo.content_url)" :alt="player.photo.alt_text || player.full_name" />
            <span v-else aria-hidden="true">ХБ</span>
          </div>
          <div class="player-profile__content">
            <p class="eyebrow">{{ player.team.name }}</p><h1>{{ player.full_name }}</h1>
            <div class="player-profile__facts">
              <div><small>Амплуа</small><strong>{{ player.position || '—' }}</strong></div>
              <div><small>Возраст</small><strong>{{ player.age_text || '—' }}</strong></div>
              <div><small>Команда</small><strong>{{ player.team.category === 'men' ? 'Мужская' : 'Женская' }}</strong></div>
            </div>
            <p v-if="player.fact" class="player-profile__story">{{ player.fact }}</p>
            <RouterLink class="button" :to="`/teams/${player.team.category}`">Вернуться к составу</RouterLink>
          </div>
        </article></AsyncState
      >
    </div>
  </section>
</template>
