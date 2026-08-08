<script setup lang="ts">
import AsyncState from '@/components/AsyncState.vue'
import MatchCard from '@/components/MatchCard.vue'
import { useLoad } from '@/composables/useLoad'
import { apiRequest } from '@/shared/api'
import type { Match, Page } from '@/shared/types'
const { data, pending, error, load } = useLoad(() =>
  apiRequest<Page<Match>>('/api/v1/matches?page_size=50'),
)
</script>
<template>
  <div>
    <section class="page-hero page-hero--compact">
      <div class="container">
        <p class="eyebrow">Сезон 2026–2027</p>
        <h1>Расписание и результаты</h1>
      </div>
    </section>
    <section class="section section--light">
      <div class="container">
        <AsyncState :pending="pending" :error="error" :empty="!data?.items.length" @retry="load"
          ><div class="match-grid">
            <MatchCard v-for="match in data?.items" :key="match.id" :match="match" /></div
        ></AsyncState>
      </div>
    </section>
  </div>
</template>
