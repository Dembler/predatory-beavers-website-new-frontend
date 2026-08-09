<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const visible = ref(false)
const phase = ref<'ready' | 'claws' | 'tearing' | 'settling' | 'marked'>('ready')
const timers: number[] = []
const introLeadMs = 1900
const impactMs = 250
const tearTravelMs = 450
const settleMs = 200
const finalHoldMs = 300

const clearTimers = () => {
  timers.splice(0).forEach(window.clearTimeout)
}

const finish = () => {
  if (!visible.value) return
  clearTimers()
  if (!import.meta.env.DEV) sessionStorage.setItem('pb-intro-seen', '1')
  visible.value = false
}

const skip = () => {
  clearTimers()
  phase.value = 'marked'
  timers.push(window.setTimeout(finish, 420))
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') skip()
}

onMounted(() => {
  if (
    !import.meta.env.DEV &&
    (sessionStorage.getItem('pb-intro-seen') || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  ) {
    return
  }

  visible.value = true
  document.documentElement.classList.add('intro-active')
  window.addEventListener('keydown', onKeydown)
  const clawsAt = introLeadMs
  const tearingAt = clawsAt + impactMs
  const settlingAt = tearingAt + tearTravelMs
  const markedAt = settlingAt + settleMs

  timers.push(window.setTimeout(() => (phase.value = 'claws'), clawsAt))
  timers.push(window.setTimeout(() => (phase.value = 'tearing'), tearingAt))
  timers.push(window.setTimeout(() => (phase.value = 'settling'), settlingAt))
  timers.push(window.setTimeout(() => (phase.value = 'marked'), markedAt))
  timers.push(window.setTimeout(finish, markedAt + finalHoldMs))
})

onBeforeUnmount(() => {
  clearTimers()
  window.removeEventListener('keydown', onKeydown)
  document.documentElement.classList.remove('intro-active')
})

const cleanupAfterLeave = () => {
  document.documentElement.classList.remove('intro-active')
  window.removeEventListener('keydown', onKeydown)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="intro-fade" @after-leave="cleanupAfterLeave">
      <div
        v-if="visible"
        class="intro-reveal"
        :class="`intro-reveal--${phase}`"
        role="dialog"
        aria-label="Приветственная заставка Хищных Бобров"
        @click="skip"
      >
        <div class="intro-reveal__panel"></div>

        <div class="intro-reveal__trace-stage" aria-hidden="true">
          <img
            class="intro-reveal__trace intro-reveal__trace--left"
            src="/images/brand/intro-scratch-clean.png"
            alt=""
          />
          <img
            class="intro-reveal__trace intro-reveal__trace--right"
            src="/images/brand/intro-scratch-clean.png"
            alt=""
          />
          <span class="intro-reveal__impact"></span>
          <span class="intro-reveal__splinter intro-reveal__splinter--left"></span>
          <span class="intro-reveal__splinter intro-reveal__splinter--right"></span>
        </div>

        <div class="intro-reveal__brand">
          <img src="/images/brand/club-emblem.png" alt="Хищные Бобры" />
          <p>Баскетбольный клуб ВГУ</p>
          <strong>Хищные Бобры</strong>
        </div>

        <div class="intro-reveal__claw-stage" aria-hidden="true">
          <img class="intro-reveal__claw intro-reveal__claw--left" src="/images/brand/intro-claw-single.png" alt="" />
          <img class="intro-reveal__claw intro-reveal__claw--right" src="/images/brand/intro-claw-single.png" alt="" />
        </div>

        <button class="intro-reveal__skip" type="button" @click.stop="skip">
          Пропустить
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
