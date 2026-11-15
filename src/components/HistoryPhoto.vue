<script setup lang="ts">
import { ref } from 'vue'
import { mediaUrl } from '@/shared/api'
import type { ContentBlock } from '@/shared/types'

defineProps<{ chapter: ContentBlock }>()
const failedUrl = ref<string | null>(null)
</script>

<template>
  <figure v-if="chapter.photo && failedUrl !== chapter.photo.content_url" class="history-photo">
    <img
      :src="mediaUrl(chapter.photo.content_url)"
      :alt="chapter.photo.alt_text || chapter.title"
      :width="chapter.photo.width || undefined"
      :height="chapter.photo.height || undefined"
      loading="lazy"
      decoding="async"
      @error="failedUrl = chapter.photo.content_url"
    />
    <figcaption v-if="chapter.photo.alt_text">{{ chapter.photo.alt_text }}</figcaption>
  </figure>
</template>

<style scoped>
.history-photo {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  border-radius: 12px;
  background: #e4ebf1;
}
.history-photo img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 540px;
  object-fit: contain;
}
.history-photo figcaption {
  padding: 14px 20px;
  color: #3f586d;
  background: #eaf0f5;
  font-size: 0.78rem;
  line-height: 1.6;
}
</style>
