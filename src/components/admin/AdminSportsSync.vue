<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiRequest } from '@/shared/api'
import { errorMessage } from '@/shared/admin'
import type { ApiResponse } from '@/shared/types'

interface SourceStatus {
  status: string
  interval_seconds?: number
  next_attempt_at?: string | null
  last_success_at?: string | null
  error?: string | null
  result?: unknown
}
interface SportsSyncStatus {
  enabled: boolean
  interval_seconds: number
  fiba_interval_seconds: number
  timeout_seconds: number
  state: string
  attempt_started_at: string | null
  attempt_finished_at: string | null
  next_attempt_at: string | null
  last_success_at: string | null
  last_error: string | null
  sources: Record<string, SourceStatus>
}

const sync = ref<SportsSyncStatus | null>(null)
const loading = ref(false)
const error = ref('')
const sourceLabels: Record<string, string> = {
  asb_games_men: 'АСБ · матчи мужчин',
  asb_match_statistics_men: 'АСБ · статистика матчей мужчин',
  asb_match_statistics_women: 'АСБ · статистика матчей девушек',
  asb_games_women: 'АСБ · матчи девушек',
  asb_standings_men: 'АСБ · таблица мужчин',
  asb_standings_women: 'АСБ · таблица девушек',
  asb_roster_men: 'АСБ · состав и статистика мужчин',
  asb_roster_women: 'АСБ · состав и статистика девушек',
  asb_portraits: 'АСБ · фотографии игроков',
  fiba3x3: 'FIBA 3×3 · матчи',
}
const labels: Record<string, string> = {
  idle: 'Ожидает проверки',
  pending: 'Ожидает проверки',
  running: 'Обновляется',
  success: 'Обновлено',
  succeeded: 'Обновлено',
  partial: 'Обновлено частично',
  error: 'Ошибка обновления',
  failed: 'Ошибка обновления',
  unavailable: 'Источник недоступен',
  invalid_watchlist: 'Проверьте список турниров FIBA',
  disabled: 'Выключено',
  skipped: 'Пропущено',
  not_configured: 'Источник не настроен',
  auth_required: 'Нужен доступ к API FIBA',
}
const sourceRows = computed(() =>
  Object.entries(sync.value?.sources ?? {}).map(([key, value]) => ({
    key,
    label: sourceLabels[key] ?? 'Другой источник',
    ...value,
  })),
)
const overallState = computed(() =>
  sync.value?.enabled ? statusLabel(sync.value.state) : 'Автообновление выключено',
)
const nextAsbAttempt = computed(() => nextAttempt('asb_'))
const nextFibaAttempt = computed(() => nextAttempt('fiba'))

function statusLabel(status: string) {
  return labels[status] ?? 'Нет данных о состоянии'
}
function intervalLabel(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return 'Не задан'
  if (seconds === 3600) return 'Раз в час'
  if (seconds === 86400) return 'Раз в сутки'
  return seconds % 60 === 0 ? `${seconds / 60} мин.` : `${seconds} сек.`
}
function nextAttempt(prefix: string) {
  if (!sync.value?.enabled) return null
  const dates = sourceRows.value
    .filter((source) => source.key.startsWith(prefix) && source.status !== 'disabled')
    .map((source) => source.next_attempt_at)
    .filter((value): value is string => !!value && Number.isFinite(Date.parse(value)))
  return dates.sort((first, second) => Date.parse(first) - Date.parse(second))[0] ?? null
}
function timestamp(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  }).format(date)
}
async function refresh() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    sync.value = (
      await apiRequest<ApiResponse<SportsSyncStatus>>('/api/v1/admin/imports/sports-sync')
    ).data
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    loading.value = false
  }
}
onMounted(refresh)
</script>

<template>
  <section class="sports-sync" aria-labelledby="sports-sync-title" :aria-busy="loading">
    <div class="sports-sync__heading">
      <div>
        <h2 id="sports-sync-title">Автоматическое обновление</h2>
        <p>Матчи, турнирные таблицы и статистика игроков из официальных источников.</p>
      </div>
      <button type="button" class="quiet-button" :disabled="loading" @click="refresh">
        {{ loading ? 'Проверяем…' : 'Обновить статус' }}
      </button>
    </div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="loading && !sync" role="status">Загружаем состояние обновления…</p>
    <template v-if="sync">
      <p class="sports-sync__state" role="status">{{ overallState }}</p>
      <dl class="sports-sync__summary">
        <div>
          <dt>Проверка АСБ</dt>
          <dd>{{ intervalLabel(sync.interval_seconds) }}</dd>
        </div>
        <div>
          <dt>Проверка FIBA 3×3</dt>
          <dd>{{ intervalLabel(sync.fiba_interval_seconds) }}</dd>
        </div>
        <div>
          <dt>Последняя попытка</dt>
          <dd>{{ timestamp(sync.attempt_started_at) }}</dd>
        </div>
        <div>
          <dt>Последнее успешное обновление</dt>
          <dd>{{ timestamp(sync.last_success_at) }}</dd>
        </div>
        <div>
          <dt>Следующая проверка АСБ</dt>
          <dd>{{ timestamp(nextAsbAttempt) }}</dd>
        </div>
        <div>
          <dt>Следующая проверка FIBA 3×3</dt>
          <dd>{{ timestamp(nextFibaAttempt) }}</dd>
        </div>
      </dl>
      <p class="sports-sync__timezone">
        Время московское. Кнопка обновляет только состояние проверки.
      </p>
      <p v-if="sync.last_error" class="form-error">{{ sync.last_error }}</p>
      <ul v-if="sourceRows.length" class="sports-sync__sources" aria-label="Источники обновления">
        <li v-for="source in sourceRows" :key="source.key">
          <div class="sports-sync__source-heading">
            <strong>{{ source.label }}</strong>
            <span>{{ statusLabel(source.status) }}</span>
          </div>
          <p v-if="source.last_success_at">
            Последнее обновление: {{ timestamp(source.last_success_at) }}
          </p>
          <p v-if="source.interval_seconds">
            Проверка: {{ intervalLabel(source.interval_seconds).toLocaleLowerCase('ru-RU') }}.
            Следующая:
            {{
              sync.enabled && source.status !== 'disabled' ? timestamp(source.next_attempt_at) : '—'
            }}
          </p>
          <p v-if="source.key === 'fiba3x3' && source.status === 'auth_required'">
            Доступ к API запрашивается у FIBA:
            <a href="mailto:3x3digital@fiba.basketball">3x3digital@fiba.basketball</a>.
            <a
              href="https://help.fiba3x3.com/en/support/solutions/articles/35000118581"
              target="_blank"
              rel="noopener noreferrer"
              >Справка FIBA о доступе к API</a
            >.
          </p>
          <p v-if="source.error && source.status !== 'auth_required'" class="form-error">
            {{ source.error }}
          </p>
        </li>
      </ul>
      <p v-else>Источники ещё не проверялись.</p>
    </template>
  </section>
</template>

<style scoped>
.sports-sync {
  min-width: 0;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: white;
  overflow-wrap: anywhere;
}
.sports-sync__heading,
.sports-sync__source-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.sports-sync__heading h2 {
  margin: 0 0 8px;
}
.sports-sync__heading p {
  margin: 0;
}
.sports-sync__heading button {
  flex-shrink: 0;
}
.sports-sync__state {
  font-weight: 700;
  margin: 24px 0 16px;
}
.sports-sync__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 24px;
  margin: 0;
}
.sports-sync__summary dt,
.sports-sync__timezone {
  color: #52647a;
  font-size: 0.875rem;
}
.sports-sync__summary dd {
  margin: 4px 0 0;
}
.sports-sync__sources {
  list-style: none;
  margin: 24px 0 0;
  padding: 0;
}
.sports-sync__sources li {
  padding: 16px 0;
  border-top: 1px solid var(--line);
}
.sports-sync__sources li:last-child {
  padding-bottom: 0;
}
.sports-sync__sources p {
  margin: 8px 0 0;
}
.sports-sync__source-heading span {
  flex-shrink: 0;
}
@media (max-width: 700px) {
  .sports-sync {
    padding: 20px;
  }
  .sports-sync__heading,
  .sports-sync__source-heading {
    flex-direction: column;
    gap: 8px;
  }
  .sports-sync__heading button {
    margin-top: 8px;
  }
  .sports-sync__summary {
    grid-template-columns: 1fr;
  }
}
</style>
