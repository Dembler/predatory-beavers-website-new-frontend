import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./pages/HomePage.vue'), meta: { title: 'Главная' } },
    { path: '/club', component: () => import('./pages/ClubPage.vue'), meta: { title: 'О клубе' } },
    {
      path: '/teams/:category(men|women)',
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
    {
      path: '/admin',
      component: () => import('./pages/AdminPage.vue'),
      meta: { title: 'Управление клубом' },
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('./pages/NotFoundPage.vue'),
      meta: { title: 'Страница не найдена' },
    },
  ],
  scrollBehavior: (to, from, savedPosition) => {
    if (savedPosition) return savedPosition
    if (to.path === from.path && to.path !== '/admin') return false
    return { top: 0 }
  },
})

router.afterEach((route) => {
  document.title = `${String(route.meta.title || 'Хищные Бобры')} — БК ВГУ «Хищные Бобры»`
})
