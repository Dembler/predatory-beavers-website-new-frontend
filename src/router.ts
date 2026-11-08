import { createRouter, createWebHistory } from 'vue-router'
import { publicPageUrl, setMetadata, setPageIdentity } from './shared/pageMetadata'

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
      path: '/players/local/:id',
      component: () => import('./pages/LocalPlayerPage.vue'),
      meta: { title: 'Игрок', requiresPublishedProfile: true },
    },
    {
      path: '/teams/:category(men|women)/players/:id',
      component: () => import('./pages/PlayerPage.vue'),
      meta: { title: 'Игрок', requiresPublishedProfile: true },
    },
    {
      path: '/players/:id',
      // Both sources use UUIDs. The old ASB links identify their source with
      // `team`; local profiles historically had no query string.
      redirect: (to) => ({
        path:
          to.query.team === 'men' || to.query.team === 'women'
            ? `/teams/${to.query.team}/players/${String(to.params.id)}`
            : `/players/local/${String(to.params.id)}`,
        query: {},
        hash: to.hash,
      }),
    },
    {
      path: '/matches',
      component: () => import('./pages/MatchesPage.vue'),
      meta: { title: 'Матчи' },
    },
    {
      path: '/standings',
      component: () => import('./pages/StandingsPage.vue'),
      meta: { title: 'Таблица' },
    },
    {
      path: '/results',
      redirect: (to) => ({ path: '/club', query: to.query, hash: '#club-tournaments' }),
    },
    {
      path: '/3x3',
      redirect: (to) => ({
        path: '/club',
        query: { ...to.query, discipline: '3x3' },
        hash: '#club-tournaments',
      }),
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
      name: 'not-found',
      component: () => import('./pages/NotFoundPage.vue'),
      meta: { title: 'Страница не найдена' },
    },
  ],
  scrollBehavior: (to, from, savedPosition) => {
    if (savedPosition) return savedPosition
    if (to.hash) {
      const headerEdge = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0
      return { el: to.hash, top: headerEdge + 24 }
    }
    if (to.path === from.path && to.path !== '/admin') return false
    return { top: 0 }
  },
})

router.afterEach((route) => {
  const pageTitle =
    route.path.startsWith('/teams/') && !route.params.id
      ? route.params.category === 'women'
        ? 'Команда девушек'
        : 'Мужская команда'
      : String(route.meta.title || 'Хищные Бобры')
  const title = `${pageTitle} — БК ВГУ «Хищные Бобры»`
  const descriptions: Record<string, string> = {
    '/': 'Баскетбольный клуб ВГУ «Хищные Бобры»: команды, расписание, результаты и история клуба.',
    '/club':
      'История баскетбольного клуба ВГУ «Хищные Бобры», достижения, турниры и клубный фотоархив.',
    '/matches':
      'Расписание и результаты матчей мужской команды и команды девушек БК ВГУ «Хищные Бобры».',
    '/standings': 'Положение команд БК ВГУ «Хищные Бобры» в турнирных таблицах и сетках плей-офф.',
    '/rules': 'Правила баскетбола: очки, позиции игроков, схема площадки и короткая викторина.',
    '/contacts': 'Контакты БК ВГУ «Хищные Бобры», спортивные залы, адреса и маршруты.',
    '/admin': 'Управление материалами сайта БК ВГУ «Хищные Бобры».',
  }
  const description = route.path.startsWith('/teams/')
    ? `${route.params.category === 'women' ? 'Команда девушек' : 'Мужская команда'} БК ВГУ «Хищные Бобры»: официальная заявка АСБ и клубные профили игроков.`
    : route.path.startsWith('/players/local/')
      ? 'Профиль игрока БК ВГУ «Хищные Бобры»: фотография и история от команды клуба.'
      : descriptions[route.path] || 'Баскетбольный клуб ВГУ «Хищные Бобры».'
  setPageIdentity(title, description)
  const url = publicPageUrl(route.path)
  setMetadata(
    'name',
    'robots',
    route.matched.some((record) => record.path === '/admin') || route.name === 'not-found'
      ? 'noindex, nofollow'
      : route.meta.requiresPublishedProfile
        ? 'noindex, follow'
        : 'index, follow',
  )
  setMetadata('property', 'og:type', 'website')
  setMetadata('property', 'og:locale', 'ru_RU')
  setMetadata('property', 'og:site_name', 'БК ВГУ «Хищные Бобры»')
  setMetadata('name', 'twitter:card', 'summary')
  setMetadata('property', 'og:url', url)
  setMetadata('property', 'og:image', publicPageUrl('/images/brand/club-emblem.webp'))
  setMetadata('name', 'twitter:image', publicPageUrl('/images/brand/club-emblem.webp'))
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.append(canonical)
  }
  canonical.href = url
})
