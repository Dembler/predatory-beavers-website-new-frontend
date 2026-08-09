<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import IntroReveal from '@/components/IntroReveal.vue'

const menuOpen = ref(false)
const headerCompact = ref(false)

const updateHeader = () => {
  headerCompact.value = window.scrollY > 36
}

onMounted(() => {
  updateHeader()
  window.addEventListener('scroll', updateHeader, { passive: true })
})

onBeforeUnmount(() => window.removeEventListener('scroll', updateHeader))

const links = [
  { label: 'Главная', to: '/' },
  { label: 'Матчи', to: '/matches' },
  { label: 'Таблица', to: '/standings' },
  { label: 'Клуб', to: '/club' },
  { label: 'Правила', to: '/rules' },
  { label: 'Контакты', to: '/contacts' },
]
</script>

<template>
  <div class="site-shell">
    <IntroReveal />
    <img class="screen-claw screen-claw--right" src="/images/kogti.png" alt="" aria-hidden="true" />
    <img
      class="screen-claw screen-claw--left"
      src="/images/kogtiniz.png"
      alt=""
      aria-hidden="true"
    />

    <header class="site-header" :class="{ 'site-header--compact': headerCompact }">
      <div class="nav-shell">
        <span class="nav-shell__glow" aria-hidden="true"></span>
        <RouterLink class="wordmark" to="/" aria-label="Хищные Бобры — главная">
          <span class="wordmark__mark" aria-hidden="true">
            <img src="/images/brand/club-emblem.png" alt="" />
          </span>
          <span>Хищные Бобры</span>
        </RouterLink>

        <button
          class="menu-toggle"
          type="button"
          :aria-expanded="menuOpen"
          aria-controls="main-navigation"
          @click="menuOpen = !menuOpen"
        >
          <span></span><span></span><span></span>
          <span class="sr-only">{{ menuOpen ? 'Закрыть меню' : 'Открыть меню' }}</span>
        </button>

        <nav
          id="main-navigation"
          class="main-nav"
          :class="{ 'main-nav--open': menuOpen }"
          aria-label="Основная навигация"
        >
          <RouterLink class="nav-link" to="/" @click="menuOpen = false">Главная</RouterLink>
          <div class="nav-dropdown">
            <button class="nav-link nav-dropdown__trigger" type="button">
              Команды <span aria-hidden="true">⌄</span>
            </button>
            <div class="nav-dropdown__menu">
              <RouterLink to="/teams/men" @click="menuOpen = false"> Мужская команда </RouterLink>
              <RouterLink to="/teams/women" @click="menuOpen = false"> Женская команда </RouterLink>
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

    <main><RouterView /></main>
    <footer class="site-footer">
      <div class="container footer-inner">
        <div class="footer-brand">
          <img src="/images/brand/club-emblem.png" alt="" aria-hidden="true" />
          <span>Хищные Бобры</span>
        </div>
        <span>Баскетбольный клуб ВГУ</span>
        <span>© {{ new Date().getFullYear() }}</span>
      </div>
    </footer>
  </div>
</template>
