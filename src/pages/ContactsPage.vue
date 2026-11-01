<script setup lang="ts">
import { computed } from 'vue'
import AsyncState from '@/components/AsyncState.vue'
import { useLoad } from '@/composables/useLoad'
import { allPages, apiRequest } from '@/shared/api'
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
const captains = computed(() => captainsData.value?.data?.items ?? [])

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
            <h2 id="captains-title">Наши капитаны</h2>
          </div>
          <AsyncState
            :pending="captainsPending"
            :error="captainsError"
            :empty="!captains.length"
            @retry="loadCaptains"
          >
            <div class="club-captains">
              <article v-for="captain in captains" :key="captain.id" class="club-captain">
                <span class="club-captain__initials" aria-hidden="true">{{
                  initials(captain.title)
                }}</span>
                <div>
                  <p class="prose-text">{{ captain.body }}</p>
                  <h3>{{ captain.title }}</h3>
                  <p v-if="captain.subtitle" class="club-captain__subtitle">
                    {{ captain.subtitle }}
                  </p>
                </div>
              </article>
            </div>
          </AsyncState>
        </section>

        <div class="contacts-heading">
          <h2 id="venues-title">Залы, где проходят матчи</h2>
          <p>Место конкретной игры смотрите в расписании матчей.</p>
        </div>
        <AsyncState :pending="pending" :error="error" :empty="!data?.length" @retry="load"
          ><div class="card-grid">
            <article v-for="venue in data" :key="venue.id" class="content-card">
              <h3>{{ venue.name }}</h3>
              <p>{{ venue.address }}</p>
              <p v-if="venue.description">{{ venue.description }}</p>
              <a
                class="text-link"
                :href="`https://yandex.ru/maps/?text=${encodeURIComponent(venue.address)}`"
                target="_blank"
                rel="noopener noreferrer"
                >Открыть на карте ↗</a
              >
            </article>
          </div></AsyncState
        >
      </div>
    </section>
  </div>
</template>

<style scoped>
.contacts-block {
  margin-bottom: 40px;
}
.contacts-heading {
  margin-bottom: 18px;
}
.contacts-heading h2 {
  margin: 0;
  font-size: clamp(1.65rem, 3vw, 2.3rem);
  line-height: 1.15;
}
.contacts-heading p {
  max-width: 680px;
  margin: 10px 0 0;
  color: #52677b;
  font-size: 0.9rem;
  line-height: 1.6;
}
.contact-channels {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.contact-channel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  padding: 22px;
  border: 1px solid #d8e0e9;
  border-radius: 14px;
  background: white;
}
.contact-channel__mark {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  margin-bottom: 14px;
  color: white;
  border-radius: 10px;
  background: var(--navy);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}
.contact-channel h3,
.club-captain h3 {
  margin: 0;
  font-family: 'Roboto', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
  text-transform: none;
}
.contact-channel p {
  margin: 10px 0 18px;
  color: #52677b;
  font-size: 0.9rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.contact-channel .text-link {
  min-height: 44px;
  margin-top: auto;
  font-size: 0.86rem;
}
.club-captains {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.club-captain {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border-left: 3px solid var(--red);
  background: rgba(255, 255, 255, 0.78);
}
.club-captain__initials {
  display: grid;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  place-items: center;
  color: #536f8a;
  border: 1px solid #d0dce7;
  border-radius: 50%;
  font-size: 0.9rem;
  font-weight: 700;
}
.club-captain p {
  margin: 0 0 3px;
  color: #52677b;
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}
.club-captain .club-captain__subtitle {
  margin: 6px 0 0;
  line-height: 1.5;
}
@media (max-width: 800px) {
  .contact-channels {
    grid-template-columns: 1fr;
  }
  .contact-channel {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr);
    gap: 4px 14px;
    padding: 18px;
  }
  .contact-channel__mark {
    grid-row: 1 / 4;
    margin: 0;
  }
  .contact-channel p {
    margin: 2px 0 8px;
  }
  .contact-channel .text-link {
    grid-column: 2;
    min-height: 44px;
  }
}
@media (max-width: 500px) {
  .contacts-block {
    margin-bottom: 30px;
  }
  .club-captains {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .club-captain {
    gap: 12px;
    padding: 14px;
  }
}
</style>
