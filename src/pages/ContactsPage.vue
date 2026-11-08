<script setup lang="ts">
import { computed, ref } from 'vue'
import AsyncState from '@/components/AsyncState.vue'
import AppSelect from '@/components/AppSelect.vue'
import { useLoad } from '@/composables/useLoad'
import { allPages, apiRequest } from '@/shared/api'
import { clubCopy } from '@/shared/clubCopy'
import type { ApiResponse, ContentBlock, Venue } from '@/shared/types'

const { data, pending, error, load } = useLoad(() => allPages<Venue>('/api/v1/venues'))
const {
  data: channelsData,
  pending: channelsPending,
  error: channelsError,
  load: loadChannels,
} = useLoad(() =>
  apiRequest<ApiResponse<{ items: ContentBlock[] }>>('/api/v1/content/contact_channels'),
)
const {
  data: captainsData,
  pending: captainsPending,
  error: captainsError,
  load: loadCaptains,
} = useLoad(() => apiRequest<ApiResponse<{ items: ContentBlock[] }>>('/api/v1/content/captains'))
const channels = computed(() => channelsData.value?.data?.items ?? [])
const captains = computed(() =>
  (captainsData.value?.data?.items ?? []).map((captain) => ({
    ...captain,
    title: clubCopy(captain.title),
    body: clubCopy(captain.body),
    subtitle: captain.subtitle ? clubCopy(captain.subtitle) : captain.subtitle,
  })),
)
const selectedVenueId = ref<string | null>(null)
const mapInteractive = ref(false)
const selectedVenue = computed(
  () => data.value?.find((venue) => venue.id === selectedVenueId.value) ?? data.value?.[0],
)
const venueOptions = computed(() =>
  (data.value ?? []).map((venue) => ({
    value: venue.id,
    label: `${venue.name} — ${venue.address}`,
  })),
)

function selectVenueId(id: string) {
  selectedVenueId.value = id
  mapInteractive.value = false
}

function selectVenue(venue: Venue) {
  selectVenueId(venue.id)
}

function venuePoint(venue: Venue) {
  return venue.latitude != null && venue.longitude != null
    ? `${venue.longitude},${venue.latitude}`
    : null
}

function mapUrl(venue: Venue) {
  const point = venuePoint(venue)
  const params = new URLSearchParams({ lang: 'ru_RU', z: '16', l: 'map' })
  if (point) {
    params.set('ll', point)
    params.set('pt', `${point},pm2rdm`)
  } else params.set('text', `${venue.address} ${venue.name}`)
  return `https://yandex.ru/map-widget/v1/?${params}`
}

function routeUrl(venue: Venue) {
  const destination =
    venue.latitude != null && venue.longitude != null
      ? `${venue.latitude},${venue.longitude}`
      : venue.address
  return `https://yandex.ru/maps/?${new URLSearchParams({ rtext: `~${destination}`, rtt: 'auto' })}`
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? '')
    .join('')
    .toLocaleUpperCase('ru-RU')
}
</script>
<template>
  <div>
    <section class="page-hero page-hero--compact">
      <div class="container">
        <p class="eyebrow">Мы на связи</p>
        <h1>Контакты и залы</h1>
        <p class="lead">Будьте рядом с командой — в сообществе клуба и на трибунах.</p>
      </div>
    </section>
    <section class="section section--light">
      <div class="container">
        <nav class="page-jumps" aria-label="На странице контактов">
          <a href="#contact-channels-title">Связаться</a>
          <a href="#captains-title">Капитаны</a>
          <a href="#venues-title">Залы и адреса</a>
        </nav>
        <section class="contacts-block" aria-labelledby="contact-channels-title">
          <div class="contacts-heading">
            <p class="eyebrow">Сообщество клуба</p>
            <h2 id="contact-channels-title">Как с нами связаться</h2>
          </div>
          <AsyncState
            :pending="channelsPending"
            :error="channelsError"
            :empty="!channels.length"
            @retry="loadChannels"
          >
            <div class="contact-channels">
              <article v-for="channel in channels" :key="channel.id" class="contact-channel">
                <span class="contact-channel__mark" aria-hidden="true">{{
                  channel.subtitle || initials(channel.title)
                }}</span>
                <h3>{{ channel.title }}</h3>
                <p class="prose-text">{{ channel.body }}</p>
                <a
                  v-if="channel.link_url"
                  class="text-link"
                  :href="channel.link_url"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ channel.link_label || 'Открыть' }} <span aria-hidden="true">↗</span>
                </a>
              </article>
            </div>
          </AsyncState>
        </section>

        <section class="contacts-block" aria-labelledby="captains-title">
          <div class="contacts-heading">
            <p class="eyebrow">На площадке</p>
            <h2 id="captains-title">Наши капитаны</h2>
          </div>
          <AsyncState
            :pending="captainsPending"
            :error="captainsError"
            :empty="!captains.length"
            @retry="loadCaptains"
          >
            <div class="club-captains">
              <article v-for="(captain, index) in captains" :key="captain.id" class="club-captain">
                <div class="club-captain__identity">
                  <span class="club-captain__index" aria-hidden="true">{{
                    String(index + 1).padStart(2, '0')
                  }}</span>
                  <h3>{{ captain.title }}</h3>
                </div>
                <p class="club-captain__team">{{ captain.body }}</p>
                <p v-if="captain.subtitle" class="club-captain__subtitle">{{ captain.subtitle }}</p>
                <a
                  v-if="captain.link_url"
                  class="text-link"
                  :href="captain.link_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  >{{ captain.link_label || 'Подробнее' }} <span aria-hidden="true">↗</span></a
                >
              </article>
            </div>
          </AsyncState>
        </section>

        <section class="contacts-block contacts-block--venues" aria-labelledby="venues-title">
          <div class="contacts-heading">
            <p class="eyebrow">Увидимся на игре</p>
            <h2 id="venues-title">Залы, где проходят матчи</h2>
            <p>Выберите площадку на карте. Зал конкретной игры указан в расписании матчей.</p>
          </div>
          <AsyncState :pending="pending" :error="error" :empty="!data?.length" @retry="load">
            <div v-if="selectedVenue" class="venue-mobile-select">
              <AppSelect
                :model-value="selectedVenue.id"
                label="Выберите зал"
                :options="venueOptions"
                @update:model-value="selectVenueId"
              />
            </div>
            <div v-if="selectedVenue" class="venues-explorer">
              <div class="venue-list" role="group" aria-label="Выбрать зал на карте">
                <button
                  v-for="(venue, index) in data"
                  :key="venue.id"
                  type="button"
                  class="venue-option"
                  :class="{ 'venue-option--selected': selectedVenue.id === venue.id }"
                  :aria-pressed="selectedVenue.id === venue.id"
                  aria-controls="venue-map"
                  @click="selectVenue(venue)"
                >
                  <span class="venue-option__index" aria-hidden="true">{{
                    String(index + 1).padStart(2, '0')
                  }}</span>
                  <span class="venue-option__text"
                    ><strong>{{ venue.name }}</strong
                    ><span>{{ venue.address }}</span></span
                  >
                  <span class="venue-option__arrow" aria-hidden="true">↗</span>
                </button>
              </div>
              <div id="venue-map" class="venue-map">
                <div
                  class="venue-map__canvas"
                  :class="{ 'venue-map__canvas--interactive': mapInteractive }"
                >
                  <button
                    class="venue-map__interaction"
                    type="button"
                    :aria-pressed="mapInteractive"
                    aria-controls="venue-map-frame"
                    @click="mapInteractive = !mapInteractive"
                  >
                    {{ mapInteractive ? 'Выключить управление картой' : 'Управлять картой' }}
                  </button>
                  <iframe
                    id="venue-map-frame"
                    :key="selectedVenue.id"
                    :src="mapUrl(selectedVenue)"
                    :title="`Яндекс Карта: ${selectedVenue.name}, ${selectedVenue.address}`"
                    loading="lazy"
                    referrerpolicy="no-referrer-when-downgrade"
                    allowfullscreen
                    :tabindex="mapInteractive ? 0 : -1"
                    :inert="!mapInteractive"
                    :aria-hidden="!mapInteractive"
                  ></iframe>
                </div>
                <div class="venue-map__details">
                  <div aria-live="polite">
                    <h3>{{ selectedVenue.name }}</h3>
                    <p class="venue-map__address">{{ selectedVenue.address }}</p>
                    <p v-if="selectedVenue.description" class="venue-map__description">
                      {{ selectedVenue.description }}
                    </p>
                  </div>
                  <a
                    class="button"
                    :href="routeUrl(selectedVenue)"
                    target="_blank"
                    rel="noopener noreferrer"
                    >Проложить маршрут <span aria-hidden="true">↗</span></a
                  >
                </div>
              </div>
            </div>
          </AsyncState>
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped>
.contacts-block + .contacts-block {
  margin-top: calc(var(--section-space) / 2);
  padding-top: calc(var(--section-space) / 2);
  border-top: 1px solid #d6dfe8;
}
.contacts-heading {
  margin-bottom: 28px;
}
.contacts-heading .eyebrow {
  margin: 0 0 12px;
  color: #a82823;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
}
.contacts-heading h2 {
  margin: 0;
  font-size: clamp(1.85rem, 3vw, 2.65rem);
  line-height: 1.15;
}
.contacts-heading > p:not(.eyebrow) {
  max-width: 680px;
  margin: 16px 0 0;
  color: #52677b;
  font-size: 0.95rem;
  line-height: 1.7;
}
.contact-channels {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}
.contact-channel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  padding: 28px;
  border: 1px solid #d8e0e9;
  border-radius: 16px;
  background: white;
}
.contact-channel__mark {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  margin-bottom: 24px;
  color: white;
  border-radius: 12px;
  background: var(--navy);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}
.contact-channel h3 {
  margin: 0;
  font-family: 'Roboto', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
  text-transform: none;
}
.contact-channel p {
  margin: 14px 0 24px;
  color: #52677b;
  font-size: 0.95rem;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.contact-channel .text-link {
  min-height: 44px;
  margin-top: auto;
  color: #a82823;
  font-size: 0.9rem;
}
.club-captains {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 32px;
}
.club-captain {
  min-width: 0;
  padding: 28px 0 0;
  border-top: 3px solid var(--navy);
}
.club-captain__identity {
  display: flex;
  align-items: baseline;
  gap: 18px;
}
.club-captain__index {
  flex-shrink: 0;
  color: #a82823;
  font:
    500 1rem 'Oswald',
    sans-serif;
}
.club-captain h3 {
  margin: 0;
  font-size: clamp(1.75rem, 3vw, 2.8rem);
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.club-captain__team,
.club-captain__subtitle {
  margin: 16px 0 0 36px;
  color: #52677b;
  font-size: 0.95rem;
  line-height: 1.7;
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.club-captain__subtitle {
  margin-top: 10px;
}
.club-captain .text-link {
  min-height: 44px;
  margin: 12px 0 0 36px;
  color: #a82823;
  font-size: 0.9rem;
}
.venues-explorer {
  display: grid;
  grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.6fr);
  overflow: hidden;
  border: 1px solid #d4dfe9;
  border-radius: 20px;
  background: white;
}
.venue-mobile-select {
  display: none;
}
.venue-list {
  padding: 12px;
  border-right: 1px solid #d4dfe9;
}
.venue-option {
  display: flex;
  width: 100%;
  min-height: 86px;
  align-items: flex-start;
  gap: 14px;
  padding: 18px 14px;
  color: var(--navy);
  border: 1px solid transparent;
  border-bottom-color: #e5ebf0;
  border-radius: 10px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.venue-option:hover {
  background: #f3f6f9;
}
.venue-option--selected,
.venue-option--selected:hover {
  border-color: #dec5c0;
  background: #fff3ef;
}
.venue-option:focus-visible {
  position: relative;
  outline: 3px solid #537ba3;
  outline-offset: -3px;
}
.venue-option__index {
  padding-top: 2px;
  color: #52677b;
  font:
    500 0.8rem 'Oswald',
    sans-serif;
}
.venue-option--selected .venue-option__index,
.venue-option--selected .venue-option__arrow {
  color: #a82823;
}
.venue-option__text {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 7px;
}
.venue-option__text strong {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.venue-option__text > span {
  color: #52677b;
  font-size: 0.8rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.venue-option__arrow {
  padding-top: 1px;
  color: #718497;
  font-size: 1.2rem;
}
.venue-map {
  min-width: 0;
  align-self: start;
}
.venue-map iframe {
  display: block;
  width: 100%;
  height: 480px;
  border: 0;
  background: #e8edf2;
  pointer-events: none;
}
.venue-map__canvas {
  position: relative;
}
.venue-map__canvas--interactive iframe {
  pointer-events: auto;
}
.venue-map__interaction {
  position: absolute;
  z-index: 1;
  top: 16px;
  left: 16px;
  min-height: 44px;
  max-width: calc(100% - 32px);
  padding: 10px 16px;
  color: var(--navy);
  border: 1px solid #b8c8d7;
  border-radius: 10px;
  background: white;
  box-shadow: 0 2px 12px #042a4e14;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.5;
  cursor: pointer;
}
.venue-map__interaction:focus-visible {
  outline: 3px solid #537ba3;
  outline-offset: 3px;
}
.venue-map__details {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 28px;
  border-top: 1px solid #d4dfe9;
}
.venue-map__details > div {
  min-width: 0;
}
.venue-map__details h3 {
  margin: 0;
  font-size: 1.65rem;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.venue-map__address,
.venue-map__description {
  margin: 12px 0 0;
  color: #52677b;
  font-size: 0.9rem;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.venue-map__details .button {
  flex-shrink: 0;
  gap: 16px;
  padding: 12px 16px;
  font-size: 0.85rem;
  white-space: nowrap;
}
@media (max-width: 1100px) {
  .venue-map__details {
    flex-direction: column;
  }
  .venue-map iframe {
    height: 420px;
  }
}
@media (max-width: 800px) {
  .contact-channels {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .contact-channel {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 4px 20px;
    padding: 24px;
  }
  .contact-channel__mark {
    grid-row: 1 / 4;
    margin: 0;
  }
  .contact-channel p {
    margin: 6px 0 12px;
  }
  .contact-channel .text-link {
    grid-column: 2;
  }
  .venues-explorer {
    grid-template-columns: minmax(0, 1fr);
    border-radius: 16px;
  }
  .venue-list {
    display: none;
  }
  .venue-mobile-select {
    display: block;
    margin-bottom: 20px;
  }
  .venue-mobile-select .app-select {
    width: 100%;
  }
  .venue-option {
    gap: 10px;
    padding: 14px 10px;
  }
  .venue-option__arrow {
    display: none;
  }
  .venue-map iframe {
    height: 360px;
  }
}
@media (max-width: 500px) {
  .contacts-heading {
    margin-bottom: 24px;
  }
  .contacts-heading > p:not(.eyebrow) {
    margin-top: 14px;
    font-size: 0.9rem;
  }
  .club-captains {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  .club-captain {
    padding-top: 20px;
  }
  .club-captain__team {
    margin-top: 12px;
  }
  .contact-channel {
    grid-template-columns: 38px minmax(0, 1fr);
    gap: 4px 14px;
    padding: 20px;
  }
  .contact-channel__mark {
    width: 38px;
    height: 38px;
    grid-row: 1;
    align-self: center;
  }
  .contact-channel h3 {
    align-self: center;
    font-size: 1rem;
  }
  .contact-channel p {
    grid-column: 1 / -1;
    margin-top: 14px;
    font-size: 0.9rem;
  }
  .contact-channel .text-link {
    grid-column: 1 / -1;
  }
  .venue-list {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .venue-option {
    min-height: 78px;
    padding: 14px 12px;
  }
  .venue-option__arrow {
    display: block;
  }
  .venue-map iframe {
    height: 320px;
  }
  .venue-map__details {
    gap: 24px;
    padding: 24px 20px;
  }
  .venue-map__details .button {
    width: 100%;
  }
}
</style>
