<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import IntroReveal from '@/components/IntroReveal.vue'
import { useRoute } from 'vue-router'
import { preferredTeamPath } from '@/composables/useTeamPreference'

const menuOpen = ref(false)
const headerCompact = ref(false)
const route = useRoute()
const teamsOpen = ref(false)
const mobileMenu = ref<HTMLDialogElement | null>(null)
const siteHeader = ref<HTMLElement | null>(null)
let mobileViewport: MediaQueryList | undefined
let headerObserver: ResizeObserver | undefined

function measureHeader() {
  if (siteHeader.value)
    document.documentElement.style.setProperty(
      '--header-edge',
      `${Math.ceil(siteHeader.value.getBoundingClientRect().bottom)}px`,
    )
}

watch(menuOpen, (open) => {
  if (open && mobileViewport?.matches) mobileMenu.value?.showModal()
  else mobileMenu.value?.close()
  document.documentElement.classList.toggle('navigation-open', open)
})
watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
    teamsOpen.value = false
  },
)
const closeMenus = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    menuOpen.value = false
    teamsOpen.value = false
  }
}
function leaveTeamMenu(event: FocusEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null))
    teamsOpen.value = false
}

const updateHeader = () => {
  headerCompact.value = window.scrollY > 36
}
const updateViewport = () => {
  if (!mobileViewport?.matches) menuOpen.value = false
}
function closeBackdrop(event: MouseEvent) {
  if (event.target !== mobileMenu.value) return
  const box = mobileMenu.value?.getBoundingClientRect()
  if (
    box &&
    (event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom)
  )
    menuOpen.value = false
}
function keepMenuFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !mobileMenu.value) return
  const controls = mobileMenu.value.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

onMounted(() => {
  headerObserver = new ResizeObserver(measureHeader)
  if (siteHeader.value) headerObserver.observe(siteHeader.value)
  measureHeader()
  mobileViewport = window.matchMedia('(max-width: 900px)')
  mobileViewport.addEventListener('change', updateViewport)
  updateHeader()
  window.addEventListener('scroll', updateHeader, { passive: true })
  window.addEventListener('keydown', closeMenus)
})

onBeforeUnmount(() => {
  headerObserver?.disconnect()
  document.documentElement.style.removeProperty('--header-edge')
  mobileViewport?.removeEventListener('change', updateViewport)
  document.documentElement.classList.remove('navigation-open')
  window.removeEventListener('scroll', updateHeader)
  window.removeEventListener('keydown', closeMenus)
})

const links = [
  { label: 'Главная', to: '/' },
  { label: 'Матчи', to: '/matches' },
  { label: 'Таблица', to: '/standings' },
  { label: 'Клуб', to: '/club' },
  { label: 'Правила', to: '/rules' },
  { label: 'Контакты', to: '/contacts' },
]
const quickLinks = [
  { label: 'Матчи', caption: 'Расписание и результаты', to: '/matches' },
  { label: 'Таблица', caption: 'Положение команд', to: '/standings' },
  { label: 'Мужская команда', to: '/teams/men' },
  { label: 'Команда девушек', to: '/teams/women' },
]
const bottomLinks = computed(() => [
  { label: 'Главная', to: '/', icon: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z' },
  {
    label: 'Матчи',
    to: '/matches',
    icon: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM7 14h3m4 0h3m-10 4h3',
  },
  {
    label: 'Команды',
    to: preferredTeamPath.value,
    icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  },
  { label: 'Таблица', to: '/standings', icon: 'M4 21V11h5v10m1 0V3h5v18m1 0v-7h5v7M2 21h20' },
])
function bottomActive(to: string) {
  if (to.startsWith('/teams/')) return /^\/(teams|players)\//u.test(route.path)
  return route.path === to
}
</script>

<template>
  <div class="site-shell" :class="{ 'site-shell--admin': route.path === '/admin' }">
    <a class="skip-link" href="#main-content">Перейти к содержимому</a>
    <IntroReveal />
    <img class="screen-claw screen-claw--right" src="/images/kogti.png" alt="" aria-hidden="true" />
    <img
      class="screen-claw screen-claw--left"
      src="/images/kogtiniz.png"
      alt=""
      aria-hidden="true"
    />

    <header ref="siteHeader" class="site-header" :class="{ 'site-header--compact': headerCompact }">
      <div class="nav-shell">
        <span class="nav-shell__glow" aria-hidden="true"></span>
        <RouterLink class="wordmark" to="/" aria-label="Хищные Бобры — главная">
          <span class="wordmark__mark" aria-hidden="true">
            <img src="/images/brand/club-emblem.webp" alt="" />
          </span>
          <span>Хищные Бобры</span>
        </RouterLink>

        <button
          class="menu-toggle"
          type="button"
          :aria-expanded="menuOpen"
          :aria-label="menuOpen ? 'Закрыть меню' : 'Открыть меню'"
          aria-controls="mobile-navigation"
          @click="menuOpen = !menuOpen"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span class="menu-toggle__label">Меню</span>
        </button>

        <nav
          id="main-navigation"
          class="main-nav"
          :class="{ 'main-nav--open': menuOpen }"
          aria-label="Основная навигация"
        >
          <RouterLink class="nav-link" to="/" @click="menuOpen = false">Главная</RouterLink>
          <div
            class="nav-dropdown"
            :class="{ 'nav-dropdown--open': teamsOpen }"
            @focusout="leaveTeamMenu"
          >
            <button
              class="nav-link nav-dropdown__trigger"
              type="button"
              :aria-expanded="teamsOpen"
              aria-controls="team-navigation"
              @click="teamsOpen = !teamsOpen"
            >
              Команды <span aria-hidden="true">⌄</span>
            </button>
            <div id="team-navigation" class="nav-dropdown__menu">
              <RouterLink to="/teams/men" @click="menuOpen = false"> Мужская команда </RouterLink>
              <RouterLink to="/teams/women" @click="menuOpen = false"> Команда девушек </RouterLink>
            </div>
          </div>
          <RouterLink
            v-for="link in links.slice(1)"
            :key="link.to"
            class="nav-link"
            :to="link.to"
            @click="menuOpen = false"
          >
            {{ link.label }}
          </RouterLink>
        </nav>

        <RouterLink class="nav-cta" to="/matches">
          <span class="nav-cta__label">Матчи</span><span aria-hidden="true">→</span>
        </RouterLink>
      </div>
    </header>

    <dialog
      id="mobile-navigation"
      ref="mobileMenu"
      class="mobile-menu"
      aria-labelledby="mobile-menu-title"
      @close="menuOpen = false"
      @cancel="menuOpen = false"
      @click="closeBackdrop"
      @keydown="keepMenuFocus"
    >
      <div class="mobile-menu__heading">
        <div>
          <h2 id="mobile-menu-title">Всё о клубе</h2>
        </div>
        <button
          class="mobile-menu__close"
          type="button"
          aria-label="Закрыть меню"
          @click="menuOpen = false"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </button>
      </div>
      <nav aria-label="Все разделы">
        <div class="mobile-menu__quick">
          <RouterLink
            v-for="link in quickLinks"
            :key="link.to"
            :to="link.to"
            @click="menuOpen = false"
            ><strong>{{ link.label }}</strong
            ><span v-if="link.caption">{{ link.caption }}</span
            ><b aria-hidden="true">↗</b></RouterLink
          >
        </div>
        <div class="mobile-menu__links">
          <RouterLink
            v-for="link in links.filter((item) => !['/matches', '/standings'].includes(item.to))"
            :key="link.to"
            :to="link.to"
            @click="menuOpen = false"
            >{{ link.label }}<span aria-hidden="true">→</span></RouterLink
          >
          <RouterLink to="/admin" @click="menuOpen = false"
            >Управление сайтом<span aria-hidden="true">→</span></RouterLink
          >
        </div>
      </nav>
    </dialog>

    <main id="main-content" tabindex="-1"><RouterView /></main>
    <footer class="site-footer">
      <div class="container footer-inner">
        <div class="footer-brand">
          <img src="/images/brand/club-emblem.webp" alt="" aria-hidden="true" />
          <span>Хищные Бобры</span>
        </div>
        <span>Баскетбольный клуб ВГУ</span>
        <RouterLink class="footer-admin" to="/admin">Управление сайтом</RouterLink>
        <span>© {{ new Date().getFullYear() }}</span>
      </div>
    </footer>
    <nav v-if="route.path !== '/admin'" class="mobile-bottom-nav" aria-label="Быстрый переход">
      <RouterLink
        v-for="link in bottomLinks"
        :key="link.to"
        :to="link.to"
        :class="{ 'is-active': bottomActive(link.to) }"
        :aria-current="bottomActive(link.to) ? 'page' : undefined"
        ><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path :d="link.icon" /></svg
        ><span>{{ link.label }}</span></RouterLink
      >
      <button
        type="button"
        :class="{
          'is-active': menuOpen || ['/club', '/rules', '/contacts', '/admin'].includes(route.path),
        }"
        aria-label="Меню — все разделы"
        aria-controls="mobile-navigation"
        :aria-expanded="menuOpen"
        @click="menuOpen = !menuOpen"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" /></svg
        ><span>Меню</span>
      </button>
    </nav>
  </div>
</template>
