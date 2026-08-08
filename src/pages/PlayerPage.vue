<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
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
        ><div v-if="player" class="content-card">
          <img
            v-if="player.photo"
            :src="mediaUrl(player.photo.content_url)"
            :alt="player.full_name"
            style="width: min(420px, 100%); border-radius: 10px"
          />
          <p class="eyebrow">{{ player.team.name }}</p>
          <h1>{{ player.full_name }}</h1>
          <p class="lead" style="margin-left: 0">{{ player.position }} · {{ player.age_text }}</p>
          <p>{{ player.fact }}</p>
        </div></AsyncState
      >
    </div>
  </section>
</template>
