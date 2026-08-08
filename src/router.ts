import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./pages/HomePage.vue'), meta: { title: 'Главная' } },
    { path: '/club', component: () => import('./pages/ClubPage.vue'), meta: { title: 'О клубе' } },
    {
      path: '/teams/:category',
      component: () => import('./pages/TeamPage.vue'),
      meta: { title: 'Команда' },
    },
    {
      path: '/players/:id',
      component: () => import('./pages/PlayerPage.vue'),
      meta: { title: 'Игрок' },
    },
    {
      path: '/matches',
      component: () => import('./pages/MatchesPage.vue'),
      meta: { title: 'Расписание' },
    },
    {
      path: '/standings',
      component: () => import('./pages/StandingsPage.vue'),
      meta: { title: 'Таблица' },
    },
    {
      path: '/rules',
      component: () => import('./pages/RulesPage.vue'),
      meta: { title: 'Правила' },
    },
    {
      path: '/contacts',
      component: () => import('./pages/ContactsPage.vue'),
      meta: { title: 'Контакты' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((route) => {
  document.title = `${String(route.meta.title || 'Хищные Бобры')} — БК ВГУ «Хищные Бобры»`
})
