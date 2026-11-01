<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>
<template>
  <section class="page-hero not-found container">
    <p class="eyebrow">404 · Страница вне игры</p>
    <h1>Здесь ничего нет</h1>
    <p class="lead">
      Возможно, адрес изменился. Вернитесь на главную и продолжайте знакомство с клубом.
    </p>
    <RouterLink class="button" to="/">На главную →</RouterLink>
  </section>
</template>
