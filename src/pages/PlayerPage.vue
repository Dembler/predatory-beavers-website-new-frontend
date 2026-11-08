<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AsyncState from '@/components/AsyncState.vue'
import PlayerAverages from '@/components/PlayerAverages.vue'
import { useLoad } from '@/composables/useLoad'
import { rememberTeam } from '@/composables/useTeamPreference'
import { ApiError, apiRequest } from '@/shared/api'
import { setMetadata, setPageIdentity } from '@/shared/pageMetadata'
import type { ApiResponse } from '@/shared/types'
import { initials, seasonLabel, type AsbPlayerProfile } from '@/shared/roster'
const route = useRoute()
const category = computed(() => (route.params.category === 'women' ? 'women' : 'men'))
const brokenPhoto = ref(false)
watch(
  () => route.params.id,
  () => {
    brokenPhoto.value = false
  },
)
const { data, pending, error, load } = useLoad(async () => {
  try {
    return await apiRequest<ApiResponse<AsbPlayerProfile>>(
      `/api/v1/asb-roster/${category.value}/players/${route.params.id}`,
    )
  } catch (cause) {
    if (cause instanceof ApiError && [404, 422].includes(cause.status))
      return { data: null } as ApiResponse<AsbPlayerProfile>
    throw cause
  }
}, [() => route.params.id, category])
const profile = computed(() => data.value?.data)
const player = computed(() =>
  profile.value?.is_current_season && profile.value.status === 'published'
    ? profile.value.player
    : null,
)
watch(
  [player, pending, error, () => route.fullPath],
  ([current, loading, failed]) => {
    const published =
      current && current.id === route.params.id && profile.value?.team === category.value
    setMetadata(
      'name',
      'robots',
      published && !loading && !failed ? 'index, follow' : 'noindex, follow',
    )
    if (!published || loading || failed) return
    setPageIdentity(
      `${current.full_name} — БК ВГУ «Хищные Бобры»`,
      `${current.full_name}: профиль игрока в опубликованной заявке АСБ, статистика и официальные источники. БК ВГУ «Хищные Бобры».`,
    )
  },
  { immediate: true, flush: 'post' },
)
watch(category, rememberTeam, { immediate: true })
</script>
<template>
  <div class="asb-player-page">
    <section class="page-hero page-hero--compact">
      <div class="container">
        <p class="eyebrow">Хищные Бобры · АСБ</p>
        <h1>{{ player?.full_name || 'Игрок команды' }}</h1>
        <RouterLink class="profile-back" :to="`/teams/${category}`">← К составу команды</RouterLink>
      </div>
    </section>
    <section class="section section--light">
      <div class="container">
        <div v-if="!pending && !error && !player" class="state-panel" role="status">
          <p>Игрок не найден в опубликованной заявке текущего сезона.</p>
          <RouterLink :to="`/teams/${category}`" class="state-panel__retry">К составу →</RouterLink>
        </div>
        <AsyncState v-else :pending="pending" :error="error" @retry="load"
          ><article v-if="player && profile" class="asb-player-profile">
            <div class="asb-player-profile__photo">
              <img
                v-if="player.photo_url && !brokenPhoto"
                :src="player.photo_url"
                :alt="player.full_name"
                @error="brokenPhoto = true"
              /><span v-else aria-hidden="true">{{ initials(player.full_name) }}</span>
            </div>
            <div class="asb-player-profile__body">
              <p class="eyebrow">
                {{ category === 'men' ? 'Мужская команда' : 'Команда девушек' }}
              </p>
              <h2>Средние за матч</h2>
              <p class="asb-player-profile__season">В заявке {{ seasonLabel(profile.season) }}</p>
              <p class="asb-player-profile__statistics-season">
                {{
                  player.statistics_season
                    ? `Статистика ${seasonLabel(player.statistics_season)}`
                    : 'Статистика пока не опубликована'
                }}
                <span v-if="player.games_played != null">
                  · Игр в статистике: {{ player.games_played }}</span
                >
              </p>
              <PlayerAverages :player="player" />
              <a
                v-if="player.statistics_source_url"
                :href="player.statistics_source_url"
                target="_blank"
                rel="noopener noreferrer"
                class="asb-player-profile__source asb-player-profile__statistics-source"
                >Источник статистики АСБ · {{ seasonLabel(player.statistics_season) }} ↗</a
              >
              <a
                v-if="profile.source_url"
                :href="profile.source_url"
                target="_blank"
                rel="noopener noreferrer"
                class="asb-player-profile__source asb-player-profile__roster-source"
                >Текущая заявка на АСБ ↗</a
              >
            </div>
          </article></AsyncState
        >
      </div>
    </section>
  </div>
</template>
<style scoped>
.profile-back {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  margin-top: 20px;
  color: #e1e9f2;
  font-size: 0.85rem;
  text-underline-offset: 5px;
}
.asb-player-profile {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 64px;
  align-items: center;
}
.asb-player-profile__photo {
  aspect-ratio: 4/5;
  border-radius: 16px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #e4ebf1, #fff);
}
.asb-player-profile__photo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.asb-player-profile__photo > span {
  font:
    6rem 'Oswald',
    sans-serif;
  color: #7d96aa;
}
.asb-player-profile__body .eyebrow {
  margin: 0 0 16px;
}
.asb-player-profile__body h2 {
  font-size: clamp(2rem, 4vw, 3.5rem);
  line-height: 1.15;
  margin: 0 0 24px;
}
.asb-player-profile__body {
  min-width: 0;
}
.asb-player-page .page-hero h1 {
  overflow-wrap: anywhere;
}
.asb-player-profile__season {
  color: #52677b;
  margin: 0 0 12px;
  font-size: 0.85rem;
  line-height: 1.7;
}
.asb-player-profile__statistics-season {
  color: #304f68;
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1.7;
  margin: 0 0 28px;
}
.asb-player-profile__source {
  color: #0b3556;
  min-height: 44px;
  display: flex;
  align-items: center;
  text-underline-offset: 5px;
  font-size: 0.85rem;
}
@media (max-width: 900px) {
  .asb-player-profile {
    gap: 32px;
  }
}
@media (max-width: 600px) {
  .asb-player-profile {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  .asb-player-profile__photo {
    max-height: 460px;
  }
}
</style>
