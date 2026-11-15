<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useRoute } from 'vue-router'
import { preferredTeamPath } from '@/composables/useTeamPreference'
import { VGlass } from '@daisigu/vue-liquid-glass'
import {
  BookOpen,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  House,
  MapPin,
  Menu,
  Settings2,
  Shield,
  UsersRound,
  X,
} from '@lucide/vue'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'

const menuOpen = ref(false)
const headerCompact = ref(false)
const route = useRoute()
const teamsOpen = ref(false)
const siteHeader = ref<HTMLElement | null>(null)
const reducedMotion = ref(false)
let mobileViewport: MediaQueryList | undefined
let motionPreference: MediaQueryList | undefined
let headerObserver: ResizeObserver | undefined

function measureHeader() {
  if (siteHeader.value)
    document.documentElement.style.setProperty(
      '--header-edge',
      `${Math.ceil(siteHeader.value.getBoundingClientRect().bottom)}px`,
    )
}

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
    teamsOpen.value = false
  },
)
const closeMenus = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
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
function updateMotionPreference() {
  reducedMotion.value = Boolean(motionPreference?.matches)
}

onMounted(() => {
  headerObserver = new ResizeObserver(measureHeader)
  if (siteHeader.value) headerObserver.observe(siteHeader.value)
  measureHeader()
  mobileViewport = window.matchMedia('(max-width: 900px)')
  mobileViewport.addEventListener('change', updateViewport)
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionPreference.addEventListener('change', updateMotionPreference)
  updateMotionPreference()
  updateHeader()
  window.addEventListener('scroll', updateHeader, { passive: true })
  window.addEventListener('keydown', closeMenus)
})

onBeforeUnmount(() => {
  headerObserver?.disconnect()
  document.documentElement.style.removeProperty('--header-edge')
  mobileViewport?.removeEventListener('change', updateViewport)
  motionPreference?.removeEventListener('change', updateMotionPreference)
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
const mobileLinks = [
  { label: 'Главная', to: '/', icon: House },
  { label: 'Матчи', to: '/matches', icon: CalendarDays },
  { label: 'Таблица', to: '/standings', icon: ChartNoAxesColumnIncreasing },
  { label: 'Мужская команда', to: '/teams/men', icon: UsersRound },
  { label: 'Команда девушек', to: '/teams/women', icon: UsersRound },
  { label: 'Клуб', to: '/club', icon: Shield },
  { label: 'Правила', to: '/rules', icon: BookOpen },
  { label: 'Контакты', to: '/contacts', icon: MapPin },
]
const bottomLinks = computed(() => [
  {
    label: 'Матчи',
    to: '/matches',
    icon: CalendarDays,
  },
  {
    label: 'Команды',
    to: preferredTeamPath.value,
    icon: UsersRound,
  },
  { label: 'Таблица', to: '/standings', icon: ChartNoAxesColumnIncreasing },
])
function bottomActive(to: string) {
  if (to.startsWith('/teams/')) return /^\/(teams|players)\//u.test(route.path)
  return route.path === to
}
</script>

<template>
  <DialogRoot v-model:open="menuOpen">
    <div class="site-shell" :class="{ 'site-shell--admin': route.path === '/admin' }">
      <a class="skip-link" href="#main-content">Перейти к содержимому</a>
      <header
        ref="siteHeader"
        class="site-header"
        :class="{ 'site-header--compact': headerCompact }"
      >
        <div class="nav-shell">
          <RouterLink class="wordmark" to="/" aria-label="Хищные Бобры — главная">
            <span class="wordmark__mark" aria-hidden="true">
              <img src="/images/brand/club-emblem.webp" alt="" />
            </span>
            <span>Хищные Бобры</span>
          </RouterLink>

          <DialogTrigger v-if="route.path === '/admin'" as-child>
            <button class="menu-toggle" type="button" aria-label="Открыть меню">
              <Menu aria-hidden="true" />
              <span class="menu-toggle__label">Меню</span>
            </button>
          </DialogTrigger>

          <nav id="main-navigation" class="main-nav" aria-label="Основная навигация">
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
                <RouterLink to="/teams/women" @click="menuOpen = false">
                  Команда девушек
                </RouterLink>
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
        </div>
      </header>

      <DialogPortal>
        <DialogOverlay class="mobile-menu-overlay" />
        <DialogContent class="mobile-menu" :aria-describedby="undefined">
          <div class="mobile-menu__heading">
            <div class="mobile-menu__brand">
              <img src="/images/brand/club-emblem.webp" alt="" aria-hidden="true" />
              <div>
                <span class="mobile-menu__eyebrow">Хищные Бобры</span>
                <DialogTitle>Меню клуба</DialogTitle>
              </div>
            </div>
            <DialogClose class="mobile-menu__close" aria-label="Закрыть меню">
              <X aria-hidden="true" />
            </DialogClose>
          </div>
          <nav class="mobile-menu__links" aria-label="Все разделы">
            <RouterLink
              v-for="link in mobileLinks"
              :key="link.to"
              :to="link.to"
              @click="menuOpen = false"
            >
              <component :is="link.icon" aria-hidden="true" />
              <span>{{ link.label }}</span>
            </RouterLink>
          </nav>
          <RouterLink class="mobile-menu__admin" to="/admin" @click="menuOpen = false">
            <Settings2 aria-hidden="true" />
            <span>Управление сайтом</span>
          </RouterLink>
        </DialogContent>
      </DialogPortal>

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
      <VGlass
        v-if="route.path !== '/admin'"
        class="mobile-bottom-nav"
        as="nav"
        aria-label="Быстрый переход"
        :blur="20"
        :scale="reducedMotion ? 0 : 8"
        :num-octaves="1"
      >
        <RouterLink
          v-for="link in bottomLinks"
          :key="link.to"
          :to="link.to"
          :class="{ 'is-active': bottomActive(link.to) }"
          :aria-current="bottomActive(link.to) ? 'page' : undefined"
        >
          <component :is="link.icon" aria-hidden="true" />
          <span>{{ link.label }}</span>
        </RouterLink>
        <DialogTrigger as-child>
          <button
            type="button"
            :class="{
              'is-active':
                menuOpen || ['/club', '/rules', '/contacts', '/admin'].includes(route.path),
            }"
            aria-label="Открыть меню"
          >
            <Menu aria-hidden="true" /><span>Меню</span>
          </button>
        </DialogTrigger>
      </VGlass>
    </div>
  </DialogRoot>
</template>
