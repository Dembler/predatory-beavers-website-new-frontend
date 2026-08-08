<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import AsyncState from '@/components/AsyncState.vue'
import { useLoad } from '@/composables/useLoad'
import { apiRequest, mediaUrl } from '@/shared/api'
import type { Page, Player } from '@/shared/types'

const route = useRoute()
const category = computed(() => (route.params.category === 'women' ? 'women' : 'men'))
const title = computed(() => (category.value === 'men' ? 'Мужская команда' : 'Женская команда'))
const { data, pending, error, load } = useLoad(() =>
  apiRequest<Page<Player>>(`/api/v1/players?category=${category.value}&page_size=50`),
)
</script>

<template>
  <div>
    <section class="page-hero page-hero--compact">
      <div class="container">
        <p class="eyebrow">Состав клуба</p>
        <h1>{{ title }}</h1>
      </div>
    </section>
    <section class="section section--light">
      <div class="container">
        <AsyncState :pending="pending" :error="error" :empty="!data?.items.length" @retry="load"
          ><div class="card-grid">
            <RouterLink
              v-for="player in data?.items"
              :key="player.id"
              class="content-card"
              :to="`/players/${player.id}`"
              ><img
                v-if="player.photo"
                :src="mediaUrl(player.photo.content_url)"
                :alt="player.full_name"
                style="width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 8px"
              />
              <h3>{{ player.full_name }}</h3>
              <p>{{ player.position || player.age_text }}</p></RouterLink
            >
          </div></AsyncState
        >
      </div>
    </section>
  </div>
</template>
