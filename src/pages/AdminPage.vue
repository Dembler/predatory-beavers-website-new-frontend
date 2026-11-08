<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminCollection from '@/components/admin/AdminCollection.vue'
import AdminMedia from '@/components/admin/AdminMedia.vue'
import { useAuth } from '@/composables/useAuth'
import { allPages, apiRequest } from '@/shared/api'
import { errorMessage, type AdminConfig, type AdminField, type AdminRecord } from '@/shared/admin'
import type {
  ApiResponse,
  Competition,
  ContentBlock,
  Media,
  Page,
  Team,
  Venue,
} from '@/shared/types'

const { user, canEdit, sessionExpired, restore, login, logout } = useAuth()
const route = useRoute()
const router = useRouter()
const checking = ref(true)
const workspaceMounted = ref(false)
let workspaceOwner = ''
const busy = ref(false)
const error = ref('')
const username = ref('')
const password = ref('')
const teams = ref<Team[]>([])
const competitions = ref<Competition[]>([])
const venues = ref<Venue[]>([])
const media = ref<Media[]>([])
const referenceError = ref('')
const navigationOpen = ref(false)
const navigationToggle = ref<HTMLButtonElement | null>(null)
const tabs = [
  { key: 'players', label: 'Игроки' },
  { key: 'teams', label: 'Команды' },
  { key: 'achievements', label: 'Достижения' },
  { key: 'matches', label: 'Матчи' },
  { key: 'media', label: 'Фотографии' },
  { key: 'history', label: 'История' },
  { key: 'rules', label: 'Правила' },
  { key: 'contact_channels', label: 'Контакты' },
  { key: 'captains', label: 'Капитаны' },
  { key: 'player_roles', label: 'Роли игроков' },
  { key: 'viewing_tips', label: 'Советы болельщикам' },
  { key: 'competitions', label: 'Турниры' },
  { key: 'venues', label: 'Залы' },
]
const tab = computed(() =>
  tabs.some((item) => item.key === route.query.tab) ? String(route.query.tab) : 'players',
)
const currentTabLabel = computed(
  () => tabs.find((item) => item.key === tab.value)?.label ?? 'Игроки',
)
const navigationGroups = [
  {
    title: 'Команда и игры',
    keys: ['players', 'teams', 'captains', 'matches', 'competitions', 'venues', 'achievements'],
  },
  {
    title: 'Страницы сайта',
    keys: ['history', 'rules', 'player_roles', 'viewing_tips', 'contact_channels'],
  },
  { title: 'Медиатека', keys: ['media'] },
].map((group) => ({
  ...group,
  items: group.keys.map((key) => tabs.find((item) => item.key === key)!),
}))

async function selectTab(key: string) {
  if (key === tab.value) {
    closeNavigation()
    return
  }
  const failure = await router.replace({ query: { tab: key } })
  if (!failure) closeNavigation()
}
function closeNavigation() {
  if (!navigationOpen.value) return
  navigationOpen.value = false
  navigationToggle.value?.focus()
}

async function loadMedia() {
  media.value = (await apiRequest<Page<Media>>('/api/v1/admin/media?page=1&page_size=12')).items
}
async function loadReferences() {
  referenceError.value = ''
  const results = await Promise.allSettled([
    allPages<Team>('/api/v1/admin/teams').then((items) => {
      teams.value = items
    }),
    allPages<Competition>('/api/v1/admin/competitions').then((items) => {
      competitions.value = items
    }),
    allPages<Venue>('/api/v1/admin/venues').then((items) => {
      venues.value = items
    }),
    loadMedia(),
  ])
  const labels = ['Команды', 'Турниры', 'Залы', 'Фотографии']
  referenceError.value = results
    .flatMap((result, index) =>
      result.status === 'rejected' ? [`${labels[index]}: ${errorMessage(result.reason)}`] : [],
    )
    .join(' ')
  if (sessionExpired.value) throw new Error('Сессия завершилась. Войдите снова: черновик сохранён.')
}
async function mountWorkspace() {
  if (!user.value || !canEdit.value) return
  if (workspaceOwner && workspaceOwner !== user.value.id) {
    workspaceMounted.value = false
    await nextTick()
  }
  workspaceOwner = user.value.id
  workspaceMounted.value = true
}
async function init() {
  checking.value = true
  error.value = ''
  try {
    await restore()
    if (canEdit.value) {
      await loadReferences()
      await mountWorkspace()
    }
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    checking.value = false
  }
}
async function signIn() {
  busy.value = true
  error.value = ''
  try {
    await login(username.value, password.value)
    password.value = ''
    if (canEdit.value) {
      await loadReferences()
      await mountWorkspace()
    }
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    busy.value = false
  }
}
async function signOut() {
  busy.value = true
  error.value = ''
  try {
    await logout()
    workspaceMounted.value = false
    workspaceOwner = ''
    password.value = ''
    media.value = []
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    busy.value = false
  }
}
async function refreshMedia() {
  try {
    await loadMedia()
  } catch (cause) {
    referenceError.value = errorMessage(cause)
  }
}
onMounted(init)

const text = (value: unknown) =>
  value === null || value === undefined || value === '' ? '—' : String(value)
const publication = (row: AdminRecord) => (row.active ? 'На сайте' : 'Скрыто')
function competitionLabel(item: Pick<Competition, 'name' | 'season'>) {
  const normalized = (value: string) => value.replace(/[–—−]/g, '-').replace(/\s/g, '')
  return !item.season || normalized(item.name).includes(normalized(item.season))
    ? item.name
    : `${item.name} · ${item.season}`
}
const teamOptions = computed(() =>
  teams.value.map((item) => ({
    value: item.id,
    label: item.category === 'men' ? 'Мужская команда' : 'Команда девушек',
  })),
)
interface ContentSectionConfig {
  title: string
  singular: string
  titleLabel: string
  bodyLabel: string
  subtitleLabel?: string
  subtitleHint?: string
  links?: boolean
}
const contentSections: Record<ContentBlock['section'], ContentSectionConfig> = {
  history: {
    title: 'История клуба',
    singular: 'Добавить раздел',
    titleLabel: 'Заголовок',
    bodyLabel: 'Текст',
  },
  rules: {
    title: 'Правила баскетбола',
    singular: 'Добавить раздел',
    titleLabel: 'Заголовок',
    bodyLabel: 'Текст',
  },
  contact_channels: {
    title: 'Контакты',
    singular: 'Добавить контакт',
    titleLabel: 'Название канала связи',
    bodyLabel: 'Описание',
    subtitleLabel: 'Обозначение на карточке',
    subtitleHint: 'Например: TG, BOT или VK. Без обозначения появятся инициалы названия.',
    links: true,
  },
  captains: {
    title: 'Капитаны',
    singular: 'Добавить капитана',
    titleLabel: 'Имя и фамилия',
    bodyLabel: 'Команда',
    subtitleLabel: 'Дополнительная подпись',
    links: true,
  },
  player_roles: {
    title: 'Роли игроков',
    singular: 'Добавить роль',
    titleLabel: 'Название позиции',
    bodyLabel: 'Функции игрока',
    subtitleLabel: 'Обозначение позиции',
    subtitleHint: 'Например: PG · Point Guard.',
  },
  viewing_tips: {
    title: 'Советы болельщикам',
    singular: 'Добавить совет',
    titleLabel: 'Заголовок совета',
    bodyLabel: 'Текст совета',
  },
}
const config = computed((): AdminConfig => {
  if (tab.value === 'teams')
    return {
      title: 'Команды',
      singular: 'Добавить команду',
      endpoint: '/api/v1/admin/teams',
      allowCreate: false,
      allowDelete: false,
      description:
        'Названия и эмблемы клубных команд. Мужская команда и команда девушек созданы в системе заранее.',
      defaults: { name: '', logo_asset_id: null, active: true },
      fields: [
        { key: 'name', label: 'Название', required: true, maxLength: 200 },
        {
          key: 'logo_asset_id',
          label: 'Эмблема команды',
          type: 'image',
          hint: 'Без выбранного изображения используется стандартная эмблема клуба.',
        },
        {
          key: 'active',
          label: 'Показывать команду на сайте',
          type: 'checkbox',
          hint: 'Скрытие команды также скрывает связанные с ней публичные записи.',
        },
      ],
      columns: [
        { label: 'Название', value: (row) => text(row.name) },
        { label: 'Команда', value: (row) => (row.category === 'women' ? 'Девушки' : 'Мужская') },
        { label: 'Публикация', value: publication },
      ],
      publicPath: (row) => `/teams/${row.category}`,
    }
  if (tab.value === 'achievements')
    return {
      title: 'Достижения',
      singular: 'Добавить достижение',
      endpoint: '/api/v1/admin/achievements',
      description:
        'Редакторские записи и фотографии достижений. Официальные результаты турниров и медали на витрине клуба берутся из отдельного архива соревнований.',
      defaults: {
        team_id: teams.value[0]?.id ?? '',
        title: '',
        media_asset_id: null,
        achieved_at: null,
        sort_order: 0,
        active: true,
      },
      fields: [
        { key: 'title', label: 'Название', required: true, maxLength: 300 },
        {
          key: 'team_id',
          label: 'Команда',
          type: 'select',
          required: true,
          options: teamOptions.value,
        },
        { key: 'media_asset_id', label: 'Фотография достижения', type: 'image', required: true },
        { key: 'achieved_at', label: 'Дата достижения', type: 'date' },
        { key: 'sort_order', label: 'Порядок', type: 'number', required: true, min: 0 },
        { key: 'active', label: 'Опубликовать', type: 'checkbox' },
      ],
      columns: [
        { label: 'Достижение', value: (row) => text(row.title) },
        {
          label: 'Команда',
          value: (row) => ((row.team as Team)?.category === 'women' ? 'Девушки' : 'Мужская'),
        },
        { label: 'Дата', value: (row) => text(row.achieved_at) },
        { label: 'Публикация', value: publication },
      ],
      filters: [
        {
          key: 'active',
          label: 'Публикация',
          options: [
            { value: 'true', label: 'На сайте' },
            { value: 'false', label: 'Скрыто' },
          ],
        },
      ],
    }
  if (tab.value === 'players')
    return {
      title: 'Игроки',
      singular: 'Добавить игрока',
      endpoint: '/api/v1/admin/players',
      publicPath: (row) => `/players/local/${row.id}`,
      description:
        'Клубные профили: фотографии, биографии и порядок в отдельном блоке страницы команды. Официальная заявка и статистика АСБ обновляются отдельно.',
      filters: [
        {
          key: 'category',
          label: 'Команда',
          options: [
            { value: 'men', label: 'Мужская команда' },
            { value: 'women', label: 'Команда девушек' },
          ],
        },
        {
          key: 'active',
          label: 'Публикация',
          options: [
            { value: 'true', label: 'На сайте' },
            { value: 'false', label: 'Скрыто' },
          ],
        },
      ],
      defaults: {
        team_id: teams.value[0]?.id ?? '',
        full_name: '',
        birth_date: null,
        age_text: '',
        position: '',
        fact: '',
        photo_asset_id: null,
        sort_order: 0,
        active: true,
      },
      columns: [
        { label: 'Игрок', value: (row) => text(row.full_name) },
        {
          label: 'Команда',
          value: (row) => text((row.team as Team)?.category === 'women' ? 'Девушки' : 'Мужская'),
        },
        { label: 'Амплуа', value: (row) => text(row.position) },
        { label: 'Публикация', value: publication },
      ],
      fields: [
        { key: 'full_name', label: 'Имя и фамилия', required: true, maxLength: 200 },
        {
          key: 'team_id',
          label: 'Команда',
          type: 'select',
          required: true,
          options: teamOptions.value,
        },
        { key: 'position', label: 'Амплуа', maxLength: 100 },
        {
          key: 'birth_date',
          label: 'Дата рождения',
          type: 'date',
          max: new Date().toLocaleDateString('en-CA'),
          hint: 'Для внутреннего учёта. Точная дата не публикуется.',
        },
        {
          key: 'age_text',
          label: 'Возраст / подпись',
          maxLength: 64,
          hint: 'Например: 21 год. Это поле отображается в профиле.',
        },
        {
          key: 'sort_order',
          label: 'Порядок в составе',
          type: 'number',
          min: 0,
          max: 2147483647,
          required: true,
        },
        { key: 'photo_asset_id', label: 'Фотография', type: 'image' },
        { key: 'fact', label: 'Об игроке', type: 'textarea', maxLength: 5000 },
        { key: 'active', label: 'Показывать на сайте', type: 'checkbox' },
      ],
    }
  if (tab.value === 'matches')
    return {
      title: 'Матчи',
      singular: 'Добавить матч',
      endpoint: '/api/v1/admin/matches',
      publicPath: '/matches',
      publicLabel: 'Открыть расписание на сайте',
      description:
        'Расписание, результаты и место проведения. Время вводится в часовом поясе вашего устройства.',
      filters: [
        {
          key: 'team',
          label: 'Команда',
          options: teams.value.map((item) => ({
            value: item.slug,
            label: item.category === 'women' ? 'Команда девушек' : 'Мужская команда',
          })),
        },
        {
          key: 'competition_id',
          label: 'Турнир',
          options: competitions.value.map((item) => ({
            value: item.id,
            label: competitionLabel(item),
          })),
        },
        {
          key: 'status',
          label: 'Статус',
          options: [
            { value: 'scheduled', label: 'Запланирован' },
            { value: 'live', label: 'В игре' },
            { value: 'finished', label: 'Завершён' },
            { value: 'postponed', label: 'Перенесён' },
            { value: 'cancelled', label: 'Отменён' },
          ],
        },
      ],
      onChange: (key, value, form, previous) => {
        if (key !== 'club_side' || value === previous) return
        for (const [home, away] of [
          ['home_team_name', 'away_team_name'],
          ['home_score', 'away_score'],
          ['home_logo_asset_id', 'away_logo_asset_id'],
        ]) {
          const oldHome = form[home!]
          form[home!] = form[away!] ?? null
          form[away!] = oldHome ?? null
        }
      },
      defaults: {
        team_id: teams.value[0]?.id ?? '',
        competition_id: '',
        venue_id: null,
        starts_at: '',
        club_side: 'home',
        home_team_name: 'Хищные Бобры',
        away_team_name: '',
        home_score: null,
        away_score: null,
        status: 'scheduled',
        notes: '',
        home_logo_asset_id: null,
        away_logo_asset_id: null,
        featured: false,
        active: true,
      },
      columns: [
        {
          label: 'Матч',
          value: (row) => `${text(row.home_team_name)} — ${text(row.away_team_name)}`,
        },
        {
          label: 'Начало',
          value: (row) =>
            new Date(String(row.starts_at)).toLocaleString('ru-RU', {
              dateStyle: 'short',
              timeStyle: 'short',
            }),
        },
        {
          label: 'Команда',
          value: (row) => ((row.team as Team)?.category === 'women' ? 'Девушки' : 'Мужская'),
        },
        {
          label: 'Турнир',
          value: (row) => {
            const competition = row.competition as Competition | undefined
            return competition ? competitionLabel(competition) : '—'
          },
        },
        {
          label: 'Статус',
          value: (row) =>
            ({
              scheduled: 'Запланирован',
              live: 'В игре',
              finished: 'Завершён',
              postponed: 'Перенесён',
              cancelled: 'Отменён',
            })[String(row.status)] ?? text(row.status),
        },
        { label: 'Счёт', value: (row) => `${text(row.home_score)} : ${text(row.away_score)}` },
        { label: 'Публикация', value: publication },
      ],
      fields: [
        {
          key: 'team_id',
          label: 'Команда клуба',
          type: 'select',
          required: true,
          options: teamOptions.value,
        },
        {
          key: 'competition_id',
          label: 'Турнир',
          type: 'select',
          required: true,
          options: competitions.value.map((item) => ({
            value: item.id,
            label: competitionLabel(item),
          })),
          hint: 'Новый турнир можно создать во вкладке «Турниры».',
        },
        { key: 'home_team_name', label: 'Хозяева', required: true, maxLength: 200 },
        { key: 'away_team_name', label: 'Гости', required: true, maxLength: 200 },
        {
          key: 'club_side',
          label: 'Клуб играет',
          type: 'select',
          required: true,
          options: [
            { value: 'home', label: 'Дома (хозяева)' },
            { value: 'away', label: 'В гостях' },
          ],
          hint: 'При смене стороны названия, очки и эмблемы команд поменяются местами.',
        },
        { key: 'starts_at', label: 'Дата и время', type: 'datetime-local', required: true },
        {
          key: 'venue_id',
          label: 'Зал',
          type: 'select',
          options: venues.value.map((item) => ({ value: item.id, label: item.name })),
        },
        {
          key: 'status',
          label: 'Статус',
          type: 'select',
          required: true,
          options: [
            { value: 'scheduled', label: 'Запланирован' },
            { value: 'live', label: 'В игре' },
            { value: 'finished', label: 'Завершён' },
            { value: 'postponed', label: 'Перенесён' },
            { value: 'cancelled', label: 'Отменён' },
          ],
        },
        { key: 'home_score', label: 'Очки хозяев', type: 'number', min: 0 },
        { key: 'away_score', label: 'Очки гостей', type: 'number', min: 0 },
        { key: 'home_logo_asset_id', label: 'Эмблема хозяев', type: 'image' },
        { key: 'away_logo_asset_id', label: 'Эмблема гостей', type: 'image' },
        { key: 'notes', label: 'Примечание', type: 'textarea', maxLength: 5000 },
        { key: 'featured', label: 'Выделить матч на главной', type: 'checkbox' },
        {
          key: 'active',
          label: 'Опубликовать матч на сайте',
          type: 'checkbox',
          hint: 'После восстановления из корзины матч скрыт. Проверьте турнир, дату и счёт перед публикацией.',
        },
      ],
      prepare: (form) => {
        if (form.status === 'finished' && (form.home_score === null || form.away_score === null))
          throw new Error('Для завершённого матча укажите очки обеих команд.')
        if ((form.home_score === null) !== (form.away_score === null))
          throw new Error('Укажите очки обеих команд или оставьте оба поля пустыми.')
        if (
          ['scheduled', 'postponed', 'cancelled'].includes(String(form.status)) &&
          form.home_score !== null
        )
          throw new Error('Счёт можно указать только для матча в игре или завершённого матча.')
        if (form.status === 'finished' && form.home_score === form.away_score)
          throw new Error(
            'Баскетбольный матч не заканчивается вничью. Укажите результат после овертайма.',
          )
        return { ...form, starts_at: new Date(String(form.starts_at)).toISOString() }
      },
    }
  if (tab.value === 'competitions')
    return {
      title: 'Турниры',
      singular: 'Добавить турнир',
      endpoint: '/api/v1/admin/competitions',
      description: 'Соревнования и сезоны для календаря матчей.',
      filters: [
        {
          key: 'active',
          label: 'Публикация',
          options: [
            { value: 'true', label: 'На сайте' },
            { value: 'false', label: 'Скрыто' },
          ],
        },
      ],
      deleteImpact: async (row) => {
        const result = await apiRequest<
          ApiResponse<{ matches_count: number; published_matches_count: number }>
        >(`/api/v1/admin/competitions/${row.id}/impact`)
        if (!result.data)
          throw new Error('Не удалось проверить связанные матчи. Повторите попытку.')
        return `Связанных матчей: ${result.data.matches_count}. Сейчас доступны на сайте: ${result.data.published_matches_count}. После удаления турнира они перестанут отображаться. Турнир можно вернуть из корзины, затем проверить и опубликовать связанные матчи отдельно.`
      },
      defaults: { name: '', season: '', active: true },
      fields: [
        { key: 'name', label: 'Название', required: true, maxLength: 200 },
        {
          key: 'season',
          label: 'Сезон',
          required: true,
          maxLength: 32,
          hint: 'Например: 2026-2027',
        },
        { key: 'active', label: 'Показывать на сайте', type: 'checkbox' },
      ],
      columns: [
        { label: 'Турнир', value: (row) => text(row.name) },
        { label: 'Сезон', value: (row) => text(row.season) },
        { label: 'Публикация', value: publication },
      ],
    }
  if (tab.value === 'venues')
    return {
      title: 'Залы',
      singular: 'Добавить зал',
      endpoint: '/api/v1/admin/venues',
      publicPath: '/contacts',
      publicLabel: 'Открыть раздел залов на сайте',
      description: 'Места проведения матчей и адреса для болельщиков.',
      deleteWarning: async () =>
        'Зал и его адрес исчезнут с публичных страниц. Связанные матчи останутся на сайте без зала. Связь сохранится в админке; зал можно вернуть из корзины и опубликовать отдельно.',
      defaults: {
        name: '',
        address: '',
        latitude: null,
        longitude: null,
        description: '',
        active: true,
      },
      fields: [
        { key: 'name', label: 'Название', required: true, maxLength: 200 },
        { key: 'address', label: 'Адрес', required: true, maxLength: 500 },
        {
          key: 'latitude',
          label: 'Широта',
          type: 'number',
          min: -90,
          max: 90,
          step: 'any',
          hint: 'Необязательно. Укажите обе координаты либо оставьте обе пустыми.',
        },
        { key: 'longitude', label: 'Долгота', type: 'number', min: -180, max: 180, step: 'any' },
        {
          key: 'description',
          label: 'Как добраться / описание',
          type: 'textarea',
          maxLength: 2000,
        },
        {
          key: 'active',
          label: 'Показывать на сайте',
          type: 'checkbox',
          hint: 'Если скрыть зал, связанные матчи останутся на сайте без его названия и адреса.',
        },
      ],
      columns: [
        { label: 'Зал', value: (row) => text(row.name) },
        { label: 'Адрес', value: (row) => text(row.address) },
        { label: 'Публикация', value: publication },
      ],
      onChange: (key, value, form, previous) => {
        if (key === 'address' && value !== previous) {
          form.latitude = null
          form.longitude = null
        }
      },
      prepare: (form) => {
        if ((form.latitude === null) !== (form.longitude === null))
          throw new Error('Укажите обе координаты или оставьте обе пустыми.')
        return form
      },
    }
  const section = Object.prototype.hasOwnProperty.call(contentSections, tab.value)
    ? (tab.value as ContentBlock['section'])
    : 'rules'
  const content = contentSections[section]
  const fields: AdminField[] = [
    { key: 'title', label: content.titleLabel, required: true, maxLength: 200 },
    {
      key: 'sort_order',
      label: 'Порядок на странице',
      type: 'number',
      min: 0,
      max: 2147483647,
      required: true,
    },
    {
      key: 'body',
      label: content.bodyLabel,
      type: 'textarea',
      required: true,
      maxLength: 30000,
      hint: 'Обычный текст. HTML и скрипты не выполняются.',
    },
  ]
  if (content.subtitleLabel) {
    fields.splice(2, 0, {
      key: 'subtitle',
      label: content.subtitleLabel,
      maxLength: 200,
      hint: content.subtitleHint,
    })
  }
  if (content.links) {
    fields.push(
      {
        key: 'link_url',
        label: 'Ссылка',
        maxLength: 2048,
        hint: 'Полный адрес с https:// или http://. Пустое поле скрывает ссылку на карточке.',
      },
      {
        key: 'link_label',
        label: 'Текст ссылки',
        maxLength: 100,
        hint: 'Например: Открыть канал. Если оставить пустым, появится «Открыть».',
      },
    )
  }
  fields.push({ key: 'active', label: 'Опубликовать на сайте', type: 'checkbox' })
  return {
    title: content.title,
    singular: content.singular,
    endpoint: '/api/v1/admin/content',
    publicPath:
      section === 'history'
        ? '/club'
        : ['contact_channels', 'captains'].includes(section)
          ? '/contacts'
          : '/rules',
    publicLabel:
      section === 'history'
        ? 'Открыть страницу клуба'
        : ['contact_channels', 'captains'].includes(section)
          ? 'Открыть страницу контактов'
          : 'Открыть страницу правил',
    query: `section=${section}`,
    description:
      section === 'history'
        ? 'Главы истории на странице клуба и на её шкале событий. Абзацы разделяйте пустой строкой.'
        : 'Тексты появятся на публичной странице после сохранения. Абзацы разделяйте пустой строкой.',
    filters: [
      {
        key: 'active',
        label: 'Публикация',
        options: [
          { value: 'true', label: 'На сайте' },
          { value: 'false', label: 'Скрыто' },
        ],
      },
    ],
    defaults: {
      section,
      title: '',
      body: '',
      sort_order: 0,
      active: true,
      ...(content.subtitleLabel ? { subtitle: null } : {}),
      ...(content.links ? { link_url: null, link_label: null } : {}),
    },
    fields,
    columns: [
      { label: 'Раздел', value: (row) => text(row.title) },
      { label: 'Порядок', value: (row) => text(row.sort_order) },
      { label: 'Публикация', value: publication },
    ],
    prepare: (form) => {
      if (content.links && form.link_url) {
        try {
          const url = new URL(String(form.link_url))
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
        } catch {
          throw new Error('Укажите корректную ссылку с https:// или http://.')
        }
      }
      return form
    },
  }
})
</script>
<template>
  <div class="admin-page">
    <section class="page-hero page-hero--compact">
      <div class="container">
        <p class="eyebrow">За кулисами клуба</p>
        <h1>Управление сайтом</h1>
      </div>
    </section>
    <section class="section section--light admin-section">
      <div class="container">
        <div v-if="checking" class="state-panel" role="status">Проверяем сессию…</div>
        <form v-if="!checking && !user" class="login-card admin-form" @submit.prevent="signIn">
          <img src="/images/brand/club-emblem.webp" alt="" width="64" height="64" />
          <h2>Вход для команды</h2>
          <p>Управляйте составом, матчами и историей клуба.</p>
          <p v-if="sessionExpired" class="form-success" role="status">
            Сессия завершилась. Войдите снова — открытый черновик сохранён в этой вкладке.
          </p>
          <div class="form-field">
            <label for="admin-username">Логин</label
            ><input
              id="admin-username"
              v-model="username"
              name="username"
              autocomplete="username"
              required
              maxlength="254"
              :disabled="busy"
            />
          </div>
          <div class="form-field">
            <label for="admin-password">Пароль</label
            ><input
              id="admin-password"
              v-model="password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
              maxlength="1024"
              :disabled="busy"
            />
          </div>
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          <button type="submit" class="button" :disabled="busy">
            {{ busy ? 'Входим…' : 'Войти' }} <span aria-hidden="true">→</span>
          </button>
        </form>
        <div v-if="workspaceMounted" v-show="!!user" class="admin-workspace">
          <div class="admin-session">
            <span
              >Вы вошли как <strong>{{ user?.username }}</strong
              ><small>{{
                user?.role === 'ADMIN'
                  ? 'Администратор'
                  : user?.role === 'EDITOR'
                    ? 'Редактор'
                    : 'Пользователь'
              }}</small></span
            ><button type="button" class="quiet-button" :disabled="busy" @click="signOut">
              Выйти
            </button>
          </div>
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          <div v-show="canEdit">
            <nav
              class="admin-tabs"
              :class="{ 'admin-tabs--open': navigationOpen }"
              aria-label="Разделы управления"
              @keydown.esc="closeNavigation"
            >
              <button
                ref="navigationToggle"
                class="admin-tabs__toggle"
                type="button"
                :aria-expanded="navigationOpen"
                aria-controls="admin-navigation-sections"
                @click="navigationOpen = !navigationOpen"
              >
                <span
                  ><small>Раздел управления</small><strong>{{ currentTabLabel }}</strong></span
                >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
                  <path
                    d="m6 9 6 6 6-6"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <div id="admin-navigation-sections" class="admin-tabs__sections">
                <div v-for="group in navigationGroups" :key="group.title" class="admin-tabs__group">
                  <p>{{ group.title }}</p>
                  <div>
                    <button
                      v-for="item in group.items"
                      :key="item.key"
                      type="button"
                      :class="{ 'is-active': tab === item.key }"
                      :aria-current="tab === item.key ? 'page' : undefined"
                      @click="selectTab(item.key)"
                    >
                      {{ item.label
                      }}<span v-if="tab === item.key" class="admin-tabs__check" aria-hidden="true"
                        >✓</span
                      >
                    </button>
                  </div>
                </div>
              </div>
            </nav>
            <div v-if="referenceError" class="form-error" role="alert">
              {{ referenceError }}
              <button class="quiet-button" type="button" @click="loadReferences">
                Повторить загрузку
              </button>
            </div>
            <AdminMedia v-if="tab === 'media'" @changed="refreshMedia" />
            <AdminCollection
              v-else
              :key="tab"
              :config="{ ...config, refreshReferences: loadReferences }"
              :media="media"
              @changed="loadReferences"
              @media-changed="refreshMedia"
            />
          </div>
        </div>
        <div v-if="user && !canEdit" class="state-panel">
          У вашей учётной записи нет доступа к управлению сайтом. Обратитесь к администратору клуба.
          <button type="button" class="quiet-button" :disabled="busy" @click="signOut">
            Выйти
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.admin-page {
  min-width: 0;
}
.admin-page .page-hero {
  padding-block: 36px 20px;
}
.admin-page .page-hero h1 {
  font-size: clamp(1.8rem, 3vw, 2.5rem);
}
.admin-page .page-hero .eyebrow {
  margin-bottom: 8px;
}
.admin-page .admin-section {
  padding-top: 20px;
}
.admin-tabs__toggle,
.admin-tabs__group > p,
.admin-tabs__check {
  display: none;
}
.admin-tabs__sections,
.admin-tabs__group,
.admin-tabs__group > div {
  display: contents;
}
.admin-session > span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.admin-session > button {
  flex-shrink: 0;
}
.admin-page :deep(.editor-dialog) {
  max-width: calc(100% - 24px);
  overflow: hidden;
  scrollbar-gutter: stable;
}
.admin-page :deep(.editor-dialog > .admin-form) {
  display: flex;
  max-height: calc(100dvh - 114px);
  flex-direction: column;
  overflow: hidden;
}
.admin-page :deep(.dialog-heading),
.admin-page :deep(.dialog-actions) {
  flex-shrink: 0;
}
.admin-page :deep(.admin-editor__body) {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-padding-block: 8px;
}
.admin-page :deep(.admin-confirm-dialog) {
  overflow-y: auto;
}
.admin-page :deep(.editor-dialog .admin-form),
.admin-page :deep(.admin-collection),
.admin-page :deep(.form-field),
.admin-page :deep(.form-grid) {
  min-width: 0;
}
.admin-page :deep(.form-field small),
.admin-page :deep(.form-error),
.admin-page :deep(.form-success) {
  overflow-wrap: anywhere;
}
.admin-page :deep(.admin-editor__hint) {
  display: none;
}
@media (max-width: 900px) {
  .admin-page .page-hero {
    padding-block: var(--page-air) 32px;
  }
  .admin-page .page-hero h1 {
    font-size: clamp(2rem, 8vw, 3rem);
    line-height: 1.08;
    overflow-wrap: anywhere;
  }
  .admin-page .admin-section {
    padding-block: 20px 40px;
  }
  .admin-session {
    gap: 12px;
    padding: 0 0 20px;
    font-size: 0.8rem;
    line-height: 1.5;
  }
  .admin-session small {
    margin-top: 3px;
    font-size: 0.75rem;
  }
  .admin-session > button {
    min-height: 44px;
    border-radius: 12px;
  }
  .admin-tabs {
    display: block;
    padding: 0;
    margin-bottom: 24px;
    border: 1px solid #cfdce6;
    border-radius: 16px;
    background: white;
    box-shadow: 0 5px 20px #042a4e05;
  }
  .admin-tabs .admin-tabs__toggle {
    display: flex;
    width: 100%;
    min-height: 68px;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 16px;
    border: 0;
    border-radius: 16px;
    background: white;
    text-align: left;
  }
  .admin-tabs__toggle > span {
    min-width: 0;
  }
  .admin-tabs__toggle small,
  .admin-tabs__toggle strong {
    display: block;
  }
  .admin-tabs__toggle small {
    margin-bottom: 4px;
    color: #52677b;
    font-size: 0.7rem;
    font-weight: 400;
  }
  .admin-tabs__toggle strong {
    font-size: 1rem;
    line-height: 1.4;
  }
  .admin-tabs__toggle svg {
    flex-shrink: 0;
    transition: transform 160ms ease;
  }
  .admin-tabs--open .admin-tabs__toggle svg {
    transform: rotate(180deg);
  }
  .admin-tabs__sections {
    display: none;
    max-height: min(65dvh, 520px);
    padding: 0 12px 14px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .admin-tabs--open .admin-tabs__sections {
    display: grid;
    gap: 16px;
  }
  .admin-tabs__group {
    display: block;
    min-width: 0;
  }
  .admin-tabs__group > p {
    display: block;
    margin: 0 4px 8px;
    color: #52677b;
    font-size: 0.7rem;
    font-weight: 700;
  }
  .admin-tabs__group > div {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
  .admin-tabs__group button {
    display: flex;
    min-width: 0;
    min-height: 48px;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #f1f5f9;
    font-size: 0.78rem;
    line-height: 1.4;
    text-align: left;
    overflow-wrap: anywhere;
  }
  .admin-tabs__group button.is-active {
    color: white;
    background: var(--navy);
  }
  .admin-tabs__check {
    display: inline;
    flex-shrink: 0;
    font-size: 0.9rem;
  }
  .admin-page :deep(.admin-section-heading) {
    flex-direction: column;
    gap: 18px;
    margin-bottom: 20px;
  }
  .admin-page :deep(.admin-section-heading h2) {
    margin-bottom: 8px;
    font-size: 1.8rem;
  }
  .admin-page :deep(.admin-section-heading p) {
    font-size: 0.85rem;
    line-height: 1.6;
  }
  .admin-page :deep(.admin-section-heading > .button) {
    width: 100%;
    min-height: 48px;
    justify-content: center;
    border-radius: 12px;
    font-size: 0.9rem;
  }
  .admin-page :deep(.admin-form input:not([type='checkbox']):not([type='file'])),
  .admin-page :deep(.admin-form select),
  .admin-page :deep(.admin-form textarea) {
    min-width: 0;
    max-width: 100%;
    min-height: 48px;
    border-radius: 10px;
    font-size: 16px;
    line-height: 1.4;
  }
  .admin-page :deep(.admin-form textarea) {
    resize: vertical;
  }
  .admin-page :deep(.checkbox-label) {
    min-height: 52px;
    gap: 12px;
    padding: 12px;
    border: 1px solid #d6e1e9;
    border-radius: 10px;
    background: #f2f6fa;
  }
  .admin-page :deep(.admin-form input[type='checkbox']) {
    flex-shrink: 0;
  }
  .admin-page :deep(.editor-dialog) {
    inset: auto 0 0;
    width: 100%;
    max-width: 100%;
    max-height: calc(100dvh - 12px);
    margin: 0;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: 20px 20px 0 0;
    scrollbar-gutter: auto;
  }
  .admin-page :deep(.editor-dialog > .admin-form) {
    display: flex;
    max-height: calc(100dvh - 12px);
    flex-direction: column;
    overflow: hidden;
  }
  .admin-page :deep(.dialog-heading) {
    flex-shrink: 0;
    align-items: center;
    gap: 14px;
    padding: 20px;
    margin: 0;
    border-bottom: 1px solid #e3e9ef;
  }
  .admin-page :deep(.dialog-heading > div) {
    min-width: 0;
  }
  .admin-page :deep(.dialog-heading .eyebrow) {
    margin-bottom: 5px;
    font-size: 0.65rem;
  }
  .admin-page :deep(.editor-dialog h2) {
    margin: 0;
    font-size: 1.5rem;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }
  .admin-page :deep(.icon-button) {
    width: 44px;
    height: 44px;
  }
  .admin-page :deep(.admin-editor__body) {
    min-height: 0;
    padding: 18px 20px 24px;
    overflow-y: auto;
    overscroll-behavior: contain;
    scroll-padding-block: 18px;
  }
  .admin-page :deep(.admin-editor__hint) {
    display: block;
    margin: 0 0 18px;
    color: #526477;
    font-size: 0.75rem;
  }
  .admin-page :deep(.form-grid) {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
  }
  .admin-page :deep(.form-field) {
    gap: 8px;
    scroll-margin-block: 18px;
  }
  .admin-page :deep(.form-field > label) {
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .admin-page :deep(.dialog-actions) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
    flex-shrink: 0;
    gap: 10px;
    padding: 14px 20px max(14px, env(safe-area-inset-bottom));
    margin: 0;
    border-top: 1px solid #dbe4ed;
    background: white;
    box-shadow: 0 -6px 24px #042a4e06;
  }
  .admin-page :deep(.dialog-actions > button) {
    min-width: 0;
    min-height: 48px;
    justify-content: center;
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 0.85rem;
  }
  .admin-page :deep(.dialog-actions .form-hint) {
    display: none;
  }
  .admin-page :deep(.admin-confirm-dialog) {
    padding: 24px 20px 0;
  }
  .admin-page :deep(.admin-confirm-dialog .dialog-actions) {
    margin: 20px -20px 0;
  }
  .admin-page :deep(.admin-confirm-dialog > p) {
    font-size: 0.9rem;
    line-height: 1.65;
  }
  .login-card {
    padding: 24px 20px;
    border-radius: 18px;
  }
  .login-card h2 {
    font-size: 1.8rem;
  }
  .login-card > p:not(.eyebrow) {
    font-size: 0.9rem;
  }
  .login-card .button {
    min-height: 48px;
    border-radius: 10px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .admin-tabs__toggle svg {
    transition: none;
  }
}
</style>
