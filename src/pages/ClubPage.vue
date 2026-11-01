<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import AsyncState from '@/components/AsyncState.vue'
import { useLoad } from '@/composables/useLoad'
import { apiRequest } from '@/shared/api'
import type { ApiResponse, ContentBlock } from '@/shared/types'
const { data, pending, error, load } = useLoad(() =>
  apiRequest<ApiResponse<{ items: ContentBlock[] }>>('/api/v1/content/history'),
)
const chapters = computed(() => data.value?.data?.items ?? [])
</script>
<template>
  <div>
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow">БК ВГУ</p>
        <h1>О клубе</h1>
        <p class="lead">
          «Хищные Бобры» — мужская и женская баскетбольные команды Воронежского государственного
          университета.
        </p>
      </div>
    </section>
    <section class="section section--light">
      <div class="container">
        <div class="section-heading"><h2>Наша история</h2></div>
        <AsyncState
          :pending="pending"
          :error="error"
          :empty="!chapters.length"
          empty-text="Новые главы истории клуба скоро появятся здесь."
          @retry="load"
        >
          <div class="history-layout">
            <aside
              class="history-aside"
              :class="{ 'history-aside--with-contents': chapters.length > 1 }"
            >
              <img
                src="/images/team-community.webp"
                alt="Игроки и болельщики Хищных Бобров вместе"
                loading="lazy"
                decoding="async"
              />
              <p>Наша сила — в команде.</p>
              <RouterLink class="text-link" to="/teams/men">Знакомьтесь с игроками →</RouterLink>
              <nav
                v-if="chapters.length > 1"
                class="history-contents"
                aria-label="Разделы истории клуба"
              >
                <a v-for="chapter in chapters" :key="chapter.id" :href="`#chapter-${chapter.id}`">
                  {{ chapter.title }} <span aria-hidden="true">↗</span>
                </a>
              </nav>
            </aside>
            <div class="history-chapters">
              <article
                v-for="(chapter, index) in chapters"
                :id="`chapter-${chapter.id}`"
                :key="chapter.id"
                class="history-chapter"
              >
                <span class="chapter-number">{{ String(index + 1).padStart(2, '0') }}</span>
                <div>
                  <h3>{{ chapter.title }}</h3>
                  <p class="prose-text">{{ chapter.body }}</p>
                </div>
              </article>
            </div>
          </div>
        </AsyncState>
      </div>
    </section>
  </div>
</template>

<style scoped>
.history-contents {
  display: grid;
  gap: 0;
  margin-top: 32px;
  border-top: 1px solid #042a4e26;
}
.history-contents a {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid #042a4e26;
  color: var(--navy);
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
}
.history-contents a:hover {
  color: var(--red);
}
.history-chapter {
  scroll-margin-top: 120px;
}
@media (max-width: 700px) {
  .history-aside--with-contents {
    display: block;
  }
  .history-aside--with-contents > img,
  .history-aside--with-contents > p,
  .history-aside--with-contents > .text-link {
    display: none;
  }
  .history-contents {
    margin-top: 0;
  }
}
</style>
