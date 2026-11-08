<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AsyncState from '@/components/AsyncState.vue'
import { useLoad } from '@/composables/useLoad'
import { preferredTeamPath, rememberTeam } from '@/composables/useTeamPreference'
import { ApiError, apiRequest, mediaUrl } from '@/shared/api'
import { setMetadata, setPageIdentity } from '@/shared/pageMetadata'
import type { ApiResponse, Player } from '@/shared/types'

const route = useRoute()
const brokenPhoto = ref(false)
watch(
  () => route.params.id,
  () => {
    brokenPhoto.value = false
  },
)
const { data, pending, error, load } = useLoad(async () => {
  try {
    return await apiRequest<ApiResponse<Player>>(`/api/v1/players/${route.params.id}`)
  } catch (cause) {
    if (cause instanceof ApiError && [404, 422].includes(cause.status))
      return { data: null } as ApiResponse<Player>
    throw cause
  }
}, [() => route.params.id])
const player = computed(() => data.value?.data)
watch(
  [player, pending, error, () => route.fullPath],
  ([current, loading, failed]) => {
    const published = current && current.id === route.params.id && current.active !== false
    setMetadata(
      'name',
      'robots',
      published && !loading && !failed ? 'index, follow' : 'noindex, follow',
    )
    if (!published || loading || failed) return
    setPageIdentity(
      `${current.full_name} — БК ВГУ «Хищные Бобры»`,
      `${current.full_name}: клубный профиль игрока, фотография и история от команды БК ВГУ «Хищные Бобры».`,
    )
  },
  // The router installs generic metadata after each navigation, including query
  // changes. Apply the loaded profile identity after that navigation completes.
  { immediate: true, flush: 'post' },
)
watch(() => player.value?.team.category, rememberTeam)
</script>

<template>
  <div class="local-player-page">
    <section class="page-hero page-hero--compact">
      <div class="container">
        <p class="eyebrow">Клубный профиль</p>
        <h1>{{ player?.full_name || 'Игрок команды' }}</h1>
        <RouterLink
          class="profile-back"
          :to="player ? `/teams/${player.team.category}` : preferredTeamPath"
          >← К составу команды</RouterLink
        >
      </div>
    </section>
    <section class="section section--light">
      <div class="container">
        <div v-if="!pending && !error && !player" class="state-panel" role="status">
          <p>Игрок не найден. Возможно, профиль больше не опубликован.</p>
          <RouterLink :to="preferredTeamPath" class="state-panel__retry">К составу →</RouterLink>
        </div>
        <AsyncState v-else :pending="pending" :error="error" @retry="load">
          <article v-if="player" class="local-player-profile">
            <div class="local-player-profile__photo">
              <img
                v-if="player.photo && !brokenPhoto"
                :src="mediaUrl(player.photo.content_url)"
                :alt="player.photo.alt_text || player.full_name"
                @error="brokenPhoto = true"
              />
              <span v-else aria-hidden="true">ХБ</span>
            </div>
            <div class="local-player-profile__body">
              <p class="eyebrow">
                {{ player.team.category === 'men' ? 'Мужская команда' : 'Команда девушек' }}
              </p>
              <dl v-if="player.position || player.age_text" class="local-player-profile__facts">
                <div v-if="player.position">
                  <dt>Амплуа</dt>
                  <dd>{{ player.position }}</dd>
                </div>
                <div v-if="player.age_text">
                  <dt>Возраст</dt>
                  <dd>{{ player.age_text }}</dd>
                </div>
              </dl>
              <p v-if="player.fact" class="local-player-profile__story">{{ player.fact }}</p>
            </div>
          </article>
        </AsyncState>
      </div>
    </section>
  </div>
</template>

<style scoped>
.local-player-page h1 {
  overflow-wrap: anywhere;
}
.profile-back {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  margin-top: 20px;
  color: #e1e9f2;
  text-underline-offset: 5px;
}
.local-player-profile {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 48px;
  align-items: start;
}
.local-player-profile__photo {
  display: grid;
  min-width: 0;
  aspect-ratio: 4 / 5;
  place-items: center;
  overflow: hidden;
  border-radius: 20px;
  background: white;
  color: #53677b;
  font: 700 4rem var(--font-display);
}
.local-player-profile__photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.local-player-profile__body {
  min-width: 0;
  overflow-wrap: anywhere;
}
.local-player-profile__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 24px 40px;
  margin: 24px 0;
}
.local-player-profile__facts dt {
  color: #52677b;
  font-size: 0.875rem;
}
.local-player-profile__facts dd {
  margin: 6px 0 0;
  font-weight: 700;
}
.local-player-profile__story {
  white-space: pre-wrap;
  line-height: 1.8;
}
@media (max-width: 700px) {
  .local-player-profile {
    grid-template-columns: minmax(0, 1fr);
    gap: 28px;
  }
}
</style>
