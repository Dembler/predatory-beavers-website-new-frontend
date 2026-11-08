<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import AsyncState from '@/components/AsyncState.vue'
import PlayerAverages from '@/components/PlayerAverages.vue'
import { useLoad } from '@/composables/useLoad'
import { rememberTeam } from '@/composables/useTeamPreference'
import { apiRequest, mediaUrl } from '@/shared/api'
import type { ApiResponse, Page, Player } from '@/shared/types'
import { initials, seasonLabel, type AsbRoster } from '@/shared/roster'
const route = useRoute()
const category = computed(() => (route.params.category === 'women' ? 'women' : 'men'))
watch(category, rememberTeam, { immediate: true })
const title = computed(() => (category.value === 'men' ? 'Мужская команда' : 'Команда девушек'))
const { data, pending, error, load } = useLoad(
  () => apiRequest<ApiResponse<AsbRoster>>(`/api/v1/asb-roster/${category.value}`),
  [category],
)
const roster = computed(() => data.value?.data)
const localPage = ref(1)
watch(category, () => {
  localPage.value = 1
})
const {
  data: localData,
  pending: localPending,
  error: localError,
  load: loadLocal,
} = useLoad(
  () =>
    apiRequest<Page<Player>>(
      `/api/v1/players?category=${category.value}&page=${localPage.value}&page_size=24`,
    ),
  [category, localPage],
)
const localPlayers = computed(() => localData.value?.items ?? [])
const localTotalPages = computed(() => localData.value?.total_pages ?? 1)
const brokenPhotos = ref(new Set<string>())
function photoFailed(id: string) {
  brokenPhotos.value = new Set([...brokenPhotos.value, id])
}
</script>
<template>
  <div class="team-page">
    <section class="page-hero page-hero--compact">
      <div class="container">
        <p class="eyebrow">На площадке — характер</p>
        <h1>{{ title }}</h1>
        <div class="team-switch" aria-label="Выбор команды">
          <RouterLink to="/teams/men">Мужская команда</RouterLink
          ><RouterLink to="/teams/women">Команда девушек</RouterLink>
        </div>
        <nav class="team-links" aria-label="Матчи и таблица команды">
          <RouterLink :to="{ path: '/matches', query: { team: category } }"
            >Матчи команды →</RouterLink
          ><RouterLink :to="{ path: '/standings', query: { team: category } }"
            >Место в таблице →</RouterLink
          >
        </nav>
      </div>
    </section>
    <section class="section section--light">
      <div class="container">
        <AsyncState :pending="pending" :error="error" @retry="load"
          ><template v-if="roster">
            <div class="roster-heading">
              <div>
                <p class="eyebrow">Официальная заявка АСБ</p>
                <h2>Состав {{ seasonLabel(roster.current_season) }}</h2>
              </div>
              <a
                v-if="roster.source_url"
                :href="roster.source_url"
                target="_blank"
                rel="noopener noreferrer"
                >На сайте АСБ ↗</a
              >
            </div>
            <template v-if="roster.is_current_season && roster.players.length">
              <div class="roster-grid">
                <RouterLink
                  v-for="player in roster.players"
                  :key="player.id"
                  class="roster-player"
                  :to="`/teams/${category}/players/${player.id}`"
                >
                  <div class="roster-player__photo">
                    <img
                      v-if="player.photo_url && !brokenPhotos.has(player.id)"
                      :src="player.photo_url"
                      :alt="player.full_name"
                      loading="lazy"
                      decoding="async"
                      @error="photoFailed(player.id)"
                    /><span v-else aria-hidden="true">{{ initials(player.full_name) }}</span>
                  </div>
                  <div class="roster-player__body">
                    <h3>{{ player.full_name }}</h3>
                    <span class="roster-player__stats-season">{{
                      player.statistics_season
                        ? `Статистика ${seasonLabel(player.statistics_season)}`
                        : 'Статистика пока не опубликована'
                    }}</span>
                    <span v-if="player.games_played != null" class="roster-player__games"
                      >Игр в статистике: {{ player.games_played }}</span
                    ><PlayerAverages :player="player" /><b
                      >Профиль игрока <span aria-hidden="true">↗</span></b
                    >
                  </div>
                </RouterLink>
              </div>
            </template>
            <div v-else class="roster-waiting" role="status">
              <img
                :src="category === 'men' ? '/images/team-men.webp' : '/images/team-women.webp'"
                alt=""
                loading="lazy"
              />
              <div>
                <span class="roster-waiting__season">{{ seasonLabel(roster.current_season) }}</span>
                <h3>Новый сезон.<br />Новый вызов.</h3>
                <p>
                  {{
                    roster.notice ||
                    'Заявка нового сезона ещё не опубликована на АСБ. Здесь появятся игроки, официальные фотографии и средние показатели после публикации состава.'
                  }}
                </p>
                <a
                  v-if="roster.source_url"
                  class="button"
                  :href="roster.source_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  >Проверить заявку на АСБ ↗</a
                >
              </div>
            </div>
          </template></AsyncState
        >
      </div>
    </section>
    <section
      v-if="localError || localPlayers.length"
      class="section section--light club-profiles"
      aria-labelledby="club-profiles-title"
    >
      <div class="container">
        <div class="club-profiles__heading">
          <div>
            <p class="eyebrow">От команды клуба</p>
            <h2 id="club-profiles-title">Клубные профили</h2>
          </div>
        </div>
        <p class="club-profiles__explanation">
          Истории и фотографии игроков, опубликованные клубом. Участие в официальной заявке АСБ
          указано в отдельном составе выше.
        </p>
        <AsyncState :pending="localPending" :error="localError" @retry="loadLocal">
          <div class="roster-grid">
            <RouterLink
              v-for="player in localPlayers"
              :key="player.id"
              class="club-profile"
              :to="`/players/local/${player.id}`"
            >
              <div class="roster-player__photo">
                <img
                  v-if="player.photo && !brokenPhotos.has(`local-${player.id}`)"
                  :src="mediaUrl(player.photo.content_url)"
                  :alt="player.photo.alt_text || player.full_name"
                  loading="lazy"
                  decoding="async"
                  @error="photoFailed(`local-${player.id}`)"
                />
                <span v-else aria-hidden="true">{{ initials(player.full_name) }}</span>
              </div>
              <div class="roster-player__body">
                <h3>{{ player.full_name }}</h3>
                <p v-if="player.position">{{ player.position }}</p>
                <b>Клубный профиль <span aria-hidden="true">→</span></b>
              </div>
            </RouterLink>
          </div>
          <nav
            v-if="localTotalPages > 1"
            class="club-profiles__pagination"
            aria-label="Страницы клубных профилей"
          >
            <button type="button" :disabled="localPage <= 1" @click="localPage--">← Назад</button>
            <span aria-live="polite">{{ localPage }} / {{ localTotalPages }}</span>
            <button type="button" :disabled="localPage >= localTotalPages" @click="localPage++">
              Дальше →
            </button>
          </nav>
        </AsyncState>
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
.roster-heading,
.club-profiles__heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}
.roster-heading .eyebrow,
.club-profiles__heading .eyebrow {
  margin: 0 0 12px;
}
.roster-heading h2,
.club-profiles__heading h2 {
  margin: 0;
  font-size: clamp(1.75rem, 3vw, 2.6rem);
}
.roster-heading > a {
  color: var(--navy);
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  font-size: 0.85rem;
  text-underline-offset: 5px;
}
.roster-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px;
}
.roster-player,
.club-profile {
  display: flex;
  min-width: 0;
  flex-direction: column;
  color: var(--navy);
  text-decoration: none;
  overflow: hidden;
  border: 1px solid #d5e0e9;
  border-radius: 16px;
  background: white;
  transition:
    box-shadow 0.2s,
    border-color 0.2s;
}
.roster-player:hover,
.club-profile:hover {
  border-color: #a8bdcf;
  box-shadow: 0 12px 36px #082d4d12;
}
.roster-player__photo {
  height: 300px;
  flex-shrink: 0;
  position: relative;
  background: linear-gradient(140deg, #e7edf2, #f9fbfc);
  display: grid;
  place-items: center;
  overflow: hidden;
}
.roster-player__photo > img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.roster-player__photo > span:first-child {
  font:
    5rem 'Oswald',
    sans-serif;
  color: #7d96aa;
}
.roster-player__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 24px;
}
.roster-player__body > h3 {
  font-size: 1.6rem;
  line-height: 1.25;
  margin: 0 0 12px;
  overflow-wrap: anywhere;
}
.roster-player__games {
  display: block;
  font-size: 0.75rem;
  line-height: 1.6;
  color: #52677b;
  margin-bottom: 20px;
}
.roster-player__stats-season {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.6;
  color: #304f68;
  margin-bottom: 12px;
}
.roster-player__body > .player-averages {
  margin-top: auto;
}
.roster-player__body > b {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 44px;
  font-size: 0.8rem;
  margin-top: 12px;
}
.club-profiles {
  border-top: 1px solid #d5e0e9;
}
.club-profiles__explanation {
  max-width: 65ch;
  margin: 0 0 28px;
  color: #52677b;
  line-height: 1.7;
}
.club-profiles__pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-top: 32px;
}
.club-profiles__pagination button {
  min-height: 44px;
  padding: 8px 16px;
  border: 1px solid #a8bdcf;
  border-radius: 8px;
  background: white;
  color: var(--navy);
  font: inherit;
  cursor: pointer;
}
.club-profiles__pagination button:disabled {
  opacity: 0.5;
  cursor: default;
}
.roster-waiting {
  position: relative;
  min-height: 480px;
  overflow: hidden;
  border-radius: 20px;
  color: #fff;
  background: #082d4c;
}
.roster-waiting > img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.35;
}
.roster-waiting::after {
  position: absolute;
  content: '';
  inset: 0;
  background: linear-gradient(90deg, #062946f0, #06294695 65%, #06294610);
}
.roster-waiting > div {
  position: relative;
  z-index: 1;
  padding: 56px;
  max-width: 700px;
}
.roster-waiting__season {
  color: #f2b3a9;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.roster-waiting h3 {
  margin: 20px 0;
  font-size: clamp(2.5rem, 5vw, 4.5rem);
  line-height: 1.1;
}
.roster-waiting p {
  max-width: 520px;
  font-size: 0.95rem;
  line-height: 1.8;
  margin: 0 0 28px;
}
@media (max-width: 1000px) {
  .roster-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px;
  }
}
@media (max-width: 600px) {
  .roster-heading,
  .club-profiles__heading {
    align-items: start;
    flex-direction: column;
    gap: 12px;
  }
  .roster-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .roster-player__photo {
    height: 330px;
  }
  .roster-player__body {
    padding: 24px;
  }
  .roster-waiting {
    min-height: 500px;
  }
  .roster-waiting > div {
    padding: 32px 24px;
  }
  .roster-waiting > img {
    opacity: 0.24;
  }
}
@media (prefers-reduced-motion: reduce) {
  .roster-player {
    transition: none;
  }
}
</style>
