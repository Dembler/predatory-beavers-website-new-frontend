<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { sitePath } from '@/shared/sitePath'
import { SpriteMascotRenderer, type MascotState } from './SpriteMascotRenderer'

const props = defineProps<{ state: MascotState }>()
const target = ref<HTMLElement>()
const failed = ref(false)
let renderer: SpriteMascotRenderer | undefined
let motion: MediaQueryList | undefined
const visibility = () => renderer?.setVisible(!document.hidden)
const preference = () => renderer?.setReducedMotion(Boolean(motion?.matches))
watch(
  () => props.state,
  (state) => renderer?.setState(state),
)
onMounted(async () => {
  renderer = new SpriteMascotRenderer()
  motion = matchMedia('(prefers-reduced-motion: reduce)')
  motion.addEventListener('change', preference)
  document.addEventListener('visibilitychange', visibility)
  renderer.setState(props.state)
  preference()
  visibility()
  try {
    await renderer.mount(target.value!)
  } catch {
    failed.value = true
  }
})
onBeforeUnmount(() => {
  motion?.removeEventListener('change', preference)
  document.removeEventListener('visibilitychange', visibility)
  renderer?.dispose()
})
</script>

<template>
  <div aria-hidden="true" class="bobrik-sprite">
    <img
      v-if="failed"
      :src="sitePath('/mascot/bobrik/launcher.webp')"
      width="96"
      height="104"
      alt=""
    />
    <div v-else ref="target" class="bobrik-sprite-surface" />
  </div>
</template>

<style>
.bobrik-sprite-surface {
  width: 100%;
  height: 100%;
}
.bobrik-sprite > img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
