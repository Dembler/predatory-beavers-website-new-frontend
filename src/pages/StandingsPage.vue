<script setup lang="ts">
import { ref } from 'vue'
import AsyncState from '@/components/AsyncState.vue'
import { useLoad } from '@/composables/useLoad'
import { apiRequest } from '@/shared/api'
import type { ApiResponse, Standings } from '@/shared/types'
const team = ref('men')
const season = ref('2024-2025')
const { data, pending, error, load } = useLoad(() =>
  apiRequest<ApiResponse<Standings>>(`/api/v1/standings?team=${team.value}&season=${season.value}`),
)
</script>
<template>
  <div>
    <section class="page-hero page-hero--compact">
      <div class="container">
        <p class="eyebrow">Положение команд</p>
        <h1>Турнирная таблица</h1>
      </div>
    </section>
    <section class="section section--light">
      <div class="container">
        <div class="filters">
          <select v-model="team" @change="load">
            <option value="men">Мужская команда</option>
            <option value="women">Женская команда</option></select
          ><input v-model="season" aria-label="Сезон" @change="load" />
        </div>
        <AsyncState
          :pending="pending"
          :error="error"
          :empty="!data?.data?.rows.length"
          @retry="load"
          ><div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Место</th>
                  <th>Команда</th>
                  <th>И</th>
                  <th>В</th>
                  <th>П</th>
                  <th>Н</th>
                  <th>Очки</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in data?.data?.rows" :key="row.position">
                  <td>{{ row.position }}</td>
                  <td>{{ row.team_name }}</td>
                  <td>{{ row.played }}</td>
                  <td>{{ row.wins }}</td>
                  <td>{{ row.losses }}</td>
                  <td>{{ row.draws }}</td>
                  <td>{{ row.table_points }}</td>
                </tr>
              </tbody>
            </table>
          </div></AsyncState
        >
      </div>
    </section>
  </div>
</template>
