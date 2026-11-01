<script setup lang="ts">
import { computed, ref } from 'vue'
import { mediaUrl } from '@/shared/api'
import type { Media } from '@/shared/types'

const props = defineProps<{
  name: string
  logo?: Media | null
  remoteUrl?: string | null
  clubLogo?: Media | null
  club?: boolean
  eager?: boolean
}>()
const failedSources = ref(new Set<string>())
const loadedSource = ref('')
const source = computed(() => {
  const candidates = [
    props.logo?.content_url,
    props.remoteUrl,
    props.club ? props.clubLogo?.content_url : null,
    props.club ? '/images/brand/club-emblem.webp' : null,
  ]
  return candidates
    .map((value) => mediaUrl(value))
    .find((value) => value && !failedSources.value.has(value))
})
const initials = computed(
  () =>
    props.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((word) => (word.match(/\p{L}/u)?.[0] ?? '').toUpperCase())
      .join('') || '—',
)
function onImageError(event: Event) {
  const failed = (event.target as HTMLImageElement).getAttribute('src')
  if (failed) failedSources.value = new Set([...failedSources.value, failed])
}
function onImageLoad(event: Event) {
  loadedSource.value = (event.target as HTMLImageElement).getAttribute('src') ?? ''
}
</script>

<template>
  <div
    class="team-emblem"
    :class="{ 'team-emblem--fallback': !source || loadedSource !== source }"
    aria-hidden="true"
  >
    <span v-if="!source || loadedSource !== source">{{ initials }}</span>
    <img
      v-if="source"
      :key="source"
      :src="source"
      alt=""
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      referrerpolicy="no-referrer"
      :class="{ 'team-emblem__image--pending': loadedSource !== source }"
      @error="onImageError"
      @load="onImageLoad"
    />
  </div>
</template>

<style scoped>
.team-emblem {
  display: grid;
  place-items: center;
}
.team-emblem > img,
.team-emblem > span {
  grid-area: 1 / 1;
}
.team-emblem--fallback {
  color: #52677b;
  background: #eef3f8;
}
.team-emblem--fallback > span {
  color: #52677b;
}
.team-emblem__image--pending {
  opacity: 0;
}
</style>
