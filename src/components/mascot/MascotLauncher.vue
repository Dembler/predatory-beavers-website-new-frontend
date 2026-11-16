<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { sitePath } from '@/shared/sitePath'
import SpriteMascot from './SpriteMascot.vue'
import type { MascotState } from './SpriteMascotRenderer'

const props = defineProps<{ open: boolean }>()
const moving = ref(false)
const animated = ref(false)
const direction = ref<'up' | 'down'>('down')
const invitation = ref(false)
const reducedMotion = ref(false)
const state = computed<MascotState>(() =>
  moving.value ? (direction.value === 'up' ? 'scroll-up' : 'scroll-down') : 'launcher-idle',
)
let previousY = 0
let settleTimer: ReturnType<typeof setTimeout> | undefined
let invitationTimer: ReturnType<typeof setTimeout> | undefined
let motion: MediaQueryList | undefined
let introduced = false

function stopMoving() {
  clearTimeout(settleTimer)
  moving.value = false
}
function scroll() {
  const nextY = window.scrollY
  const delta = nextY - previousY
  previousY = nextY
  if (props.open || document.hidden || reducedMotion.value || Math.abs(delta) < 1) return
  direction.value = delta < 0 ? 'up' : 'down'
  animated.value = true
  moving.value = true
  clearTimeout(settleTimer)
  settleTimer = setTimeout(stopMoving, 180)
}
function dismissInvitation() {
  clearTimeout(invitationTimer)
  invitation.value = false
}
function introduce() {
  if (introduced || document.hidden) return
  introduced = true
  invitation.value = true
  try {
    sessionStorage.setItem('bobrik-invitation-seen', 'true')
  } catch {
    /* Storage is optional. */
  }
  invitationTimer = setTimeout(dismissInvitation, 5000)
}
function visibility() {
  if (document.hidden) stopMoving()
  else introduce()
}
function preference() {
  reducedMotion.value = Boolean(motion?.matches)
  if (reducedMotion.value) stopMoving()
}
watch(
  () => props.open,
  (open) => {
    if (open) {
      stopMoving()
      dismissInvitation()
    }
  },
)
onMounted(() => {
  previousY = window.scrollY
  motion = matchMedia('(prefers-reduced-motion: reduce)')
  preference()
  motion.addEventListener('change', preference)
  window.addEventListener('scroll', scroll, { passive: true })
  document.addEventListener('visibilitychange', visibility)
  try {
    introduced = sessionStorage.getItem('bobrik-invitation-seen') === 'true'
  } catch {
    /* Continue without storage. */
  }
  introduce()
})
onBeforeUnmount(() => {
  stopMoving()
  dismissInvitation()
  motion?.removeEventListener('change', preference)
  window.removeEventListener('scroll', scroll)
  document.removeEventListener('visibilitychange', visibility)
})
</script>

<template>
  <button
    class="bobrik-launcher"
    :class="{ 'bobrik-launcher--moving': moving, 'bobrik-launcher--up': direction === 'up' }"
    :data-motion="moving ? direction : 'still'"
    aria-label="Открыть чат с Бобриком"
    type="button"
    @click="dismissInvitation"
  >
    <span v-if="invitation && !open" class="bobrik-invitation" aria-hidden="true">
      Привет! Пообщаемся?
    </span>
    <SpriteMascot v-if="animated" class="bobrik-launcher-sprite" :state="state" />
    <img
      v-else
      class="bobrik-launcher-image"
      :src="sitePath('/mascot/bobrik/launcher.webp')"
      width="104"
      height="113"
      alt=""
      aria-hidden="true"
    />
  </button>
</template>

<style>
.bobrik-launcher {
  position: fixed;
  z-index: 45;
  right: max(22px, env(safe-area-inset-right));
  bottom: calc(var(--mobile-nav-height, 0px) + var(--mobile-nav-offset, 0px) + 14px);
  display: block;
  width: 104px;
  height: 113px;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #102e46;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 120ms ease-out;
  filter: drop-shadow(0 4px 3px #02132625);
}
.bobrik-launcher-image,
.bobrik-launcher .bobrik-launcher-sprite {
  display: block;
  width: 104px;
  height: 113px;
  object-fit: contain;
}
.bobrik-launcher--moving {
  transform: translateY(4px) rotate(3deg);
}
.bobrik-launcher--moving.bobrik-launcher--up {
  transform: translateY(-4px) rotate(-3deg);
}
.bobrik-launcher:focus-visible {
  outline: 3px solid #b71c17;
  outline-offset: 3px;
}
.bobrik-invitation {
  position: absolute;
  right: 12px;
  bottom: calc(100% + 10px);
  width: max-content;
  max-width: min(230px, calc(100vw - 40px));
  padding: 12px 16px;
  border: 1px solid #d8e2ec;
  border-radius: 16px 16px 4px 16px;
  background: #fff;
  color: #102e46;
  box-shadow: 0 6px 24px #02132612;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  text-align: left;
  pointer-events: none;
}
.bobrik-invitation::after {
  position: absolute;
  right: 19px;
  bottom: -6px;
  width: 10px;
  height: 10px;
  border-right: 1px solid #d8e2ec;
  border-bottom: 1px solid #d8e2ec;
  background: white;
  content: '';
  transform: rotate(45deg);
}
@media (max-width: 900px) {
  .bobrik-launcher {
    right: max(12px, env(safe-area-inset-right));
  }
}
@media (prefers-reduced-motion: reduce) {
  .bobrik-launcher {
    transition: none;
    transform: none;
  }
}
</style>
