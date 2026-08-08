<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

const menuOpen = ref(false)

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
    <img class="screen-claw screen-claw--right" src="/images/kogti.png" alt="" aria-hidden="true" />
    <img
      class="screen-claw screen-claw--left"
      src="/images/kogtiniz.png"
      alt=""
      aria-hidden="true"
    />

    <header class="site-header">
      <div class="nav-shell">
        <RouterLink class="wordmark" to="/" aria-label="Хищные Бобры — главная">
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
          <span class="sr-only">Открыть меню</span>
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

        <RouterLink class="nav-cta" to="/matches">Матчи <span>→</span></RouterLink>
      </div>
    </header>

    <main><RouterView /></main>
    <footer class="site-footer">
      <div class="container footer-inner">
        <div class="footer-brand">Хищные Бобры</div>
        <span>Баскетбольный клуб ВГУ</span>
        <span>© {{ new Date().getFullYear() }}</span>
      </div>
    </footer>
  </div>
</template>
