<script setup lang="ts">
import AsyncState from '@/components/AsyncState.vue'
import { useLoad } from '@/composables/useLoad'
import { apiRequest } from '@/shared/api'
import type { Page, Venue } from '@/shared/types'
const { data, pending, error, load } = useLoad(() =>
  apiRequest<Page<Venue>>('/api/v1/venues?page_size=50'),
)
</script>
<template>
  <div>
    <section class="page-hero page-hero--compact">
      <div class="container">
        <p class="eyebrow">Мы на связи</p>
        <h1>Контакты и залы</h1>
      </div>
    </section>
    <section class="section section--light">
      <div class="container">
        <AsyncState :pending="pending" :error="error" :empty="!data?.items.length" @retry="load"
          ><div class="card-grid">
            <article v-for="venue in data?.items" :key="venue.name" class="content-card">
              <h3>{{ venue.name }}</h3>
              <p>{{ venue.address }}</p>
              <p>{{ venue.description }}</p>
            </article>
          </div></AsyncState
        >
      </div>
    </section>
  </div>
</template>
