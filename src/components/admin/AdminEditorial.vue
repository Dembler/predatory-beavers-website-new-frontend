<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { ApiError, apiRequest } from '@/shared/api'
import { errorMessage } from '@/shared/admin'
import type { ApiResponse } from '@/shared/types'
import {
  copyColumnDraft,
  currentMoscowMonday,
  editorialArticlePath,
  editorialJobActive,
  editorialJobLabel,
  isEditorialMonday,
  safeEditorialSource,
  type ArticleRevision,
  type ColumnBrief,
  type ColumnDraft,
  type EditorialArticle,
  type EditorialJob,
} from '@/shared/editorial'

const { user, canEdit, mutate } = useAuth()
const brief = reactive<ColumnBrief>({
  week_start: currentMoscowMonday(),
  team_scope: 'both',
  discipline: 'all',
  brief: '',
})
const articles = ref<EditorialArticle[]>([])
const jobs = ref<EditorialJob[]>([])
const selectedJob = ref<EditorialJob | null>(null)
const article = ref<EditorialArticle | null>(null)
const revisionId = ref('')
const draft = ref<ColumnDraft | null>(null)
const savedDraft = ref('')
const busy = ref(false)
const loading = ref(false)
const error = ref('')
const notice = ref('')
const pollFailed = ref(false)
const pendingAttempt = ref<{ key: string; body: ColumnBrief } | null>(null)
let pollTimer: ReturnType<typeof setTimeout> | undefined
let disposed = false
let selectionEpoch = 0
const revision = computed(() =>
  article.value?.revisions.find((item) => item.id === revisionId.value),
)
const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== savedDraft.value)
const checks = computed(() => revision.value?.checks)
const working = computed(() => editorialJobActive(selectedJob.value))
const approved = computed(
  () => !!revisionId.value && article.value?.approved_revision_id === revisionId.value,
)
const published = computed(
  () => !!revisionId.value && article.value?.published_revision_id === revisionId.value,
)
const orderedRevisions = computed(() => [...(article.value?.revisions ?? [])].reverse())
const factsById = computed(
  () => new Map(revision.value?.fact_sheet.facts.map((fact) => [fact.id, fact]) ?? []),
)

function dateLabel(value?: string) {
  if (!value) return '—'
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Moscow',
      }).format(date)
    : '—'
}
function articleTitle(item: EditorialArticle) {
  return (
    item.revisions.find((entry) => entry.id === item.draft_head_revision_id)?.content.title ||
    item.revisions[0]?.content.title ||
    'Колонка готовится'
  )
}
function issueMessage(value: string) {
  // The server may supply an already localized explanation; never interpret it as HTML.
  const labels: Record<string, string> = {
    unknown_fact_reference: 'Один из выбранных фактов не найден в материалах этой версии.',
    duplicate_fact_reference:
      'Один и тот же факт выбран несколько раз. Оставьте его в одной части.',
    missing_fact_references: 'Добавьте подтверждённые факты к подходящим частям колонки.',
    omitted_week_fact:
      'В колонке пропущены факты выбранной недели. Добавьте их к подходящим частям.',
    'fact_in_author_prose:numbers':
      'Числа, даты и счёт должны оставаться в подтверждённых фактах. Уберите их из авторского текста.',
    unsafe_author_prose:
      'Проверьте авторский текст: в нём есть недопустимые выражения, личные данные или ссылки.',
    unverified_action_or_result_in_author_prose:
      'В авторском тексте есть неподтверждённый результат или обещание действия. Оставьте результаты в блоках фактов.',
    named_opponent_in_author_prose:
      'Названия соперников должны оставаться в подтверждённых фактах. Уберите их из авторского текста.',
    history_must_be_labelled:
      'Назовите часть с исторической справкой так, чтобы в заголовке было слово «История».',
    word_count_out_of_range:
      'Колонка отличается от рекомендуемого объёма 700–1000 слов. Проверьте, достаточно ли раскрыта тема и нет ли повторов.',
    word_count_too_short:
      'В колонке меньше 350 слов вместе с фактами. Дополните текст перед выпуском.',
    word_count_too_long:
      'В колонке больше 1200 слов вместе с фактами. Сократите текст перед выпуском.',
    technical_process_in_author_prose:
      'Уберите из колонки описание подготовки ответа, устройства модели и технических проверок. Оставьте клубную историю.',
    unverified_personal_memory:
      'В тексте есть неподтверждённые личные воспоминания или наблюдения. Замените их мнением Бобрика или подтверждённым фактом.',
    unsupported_reader_channel:
      'Приглашение к общению ведёт в неподтверждённый канал. Предложите читателю чат с Бобриком или контакты клуба.',
    absence_of_evidence_is_not_no_events:
      'Отсутствие записей в материалах не означает, что событий не было. Укажите ограниченность сведений и уберите уверенный вывод.',
    expected_russian: 'Подготовьте авторский текст на русском языке.',
    repeated_sentences: 'В тексте повторяются длинные предложения. Уберите повторы перед выпуском.',
    human_semantic_review_required:
      'Редактору нужно проверить смысл, тон и точность связи текста с фактами.',
    stale_sources: 'Материалы изменились. Подготовьте колонку по свежим данным.',
  }
  return labels[value] || 'Нужна проверка редактора.'
}
function workflowError(cause: unknown) {
  if (cause instanceof ApiError) {
    if (cause.status === 409 && cause.code !== 'idempotency_conflict')
      return 'Материал или его источники изменились. Ваши правки остались в форме. Откройте актуальную версию в другой вкладке и сравните её перед сохранением.'
    if (cause.status === 422)
      return 'Проверьте поля и результаты проверки. Правки остались в форме.'
  }
  return errorMessage(cause)
}
function stopPolling() {
  clearTimeout(pollTimer)
  pollTimer = undefined
}
function rememberJob(job: EditorialJob) {
  selectedJob.value = job
  jobs.value = [job, ...jobs.value.filter((item) => item.id !== job.id)]
}
function schedulePoll() {
  stopPolling()
  if (!disposed && canEdit.value && working.value && !pollFailed.value)
    pollTimer = setTimeout(() => void pollJob(), 1500)
}
async function pollJob() {
  stopPolling()
  const id = selectedJob.value?.id
  if (!id || !canEdit.value || disposed) return
  if (pollFailed.value) error.value = ''
  try {
    const result = (
      await apiRequest<ApiResponse<EditorialJob>>(`/api/v1/admin/editorial/jobs/${id}`)
    ).data
    if (!result) throw new Error('Сервер не подтвердил состояние подготовки. Обновите его ещё раз.')
    if (disposed || selectedJob.value?.id !== id) return
    rememberJob(result)
    pollFailed.value = false
    if (result.result_revision_id) {
      await refreshLists()
      if (!dirty.value && !busy.value)
        await openArticle(result.article_id, result.result_revision_id)
      else
        notice.value =
          'Новая версия готова. Сначала сохраните открытые правки, затем выберите её в списке материалов.'
    }
  } catch (cause) {
    pollFailed.value = true
    error.value = workflowError(cause)
  }
  schedulePoll()
}
async function refreshLists() {
  const [articleResult, jobResult] = await Promise.all([
    apiRequest<ApiResponse<{ items: EditorialArticle[] }>>('/api/v1/admin/articles'),
    apiRequest<ApiResponse<{ items: EditorialJob[] }>>('/api/v1/admin/editorial/jobs'),
  ])
  if (disposed) return
  if (!articleResult.data || !jobResult.data)
    throw new Error('Не удалось получить список колонок. Обновите список ещё раз.')
  articles.value = articleResult.data.items
  jobs.value = jobResult.data.items
}
async function refresh() {
  if (loading.value || !canEdit.value) return
  loading.value = true
  error.value = ''
  try {
    await refreshLists()
    if (!selectedJob.value) {
      const activeJob = jobs.value.find((item) => editorialJobActive(item)) || jobs.value[0]
      if (activeJob) rememberJob(activeJob)
    }
    pollFailed.value = false
    schedulePoll()
  } catch (cause) {
    error.value = workflowError(cause)
  } finally {
    loading.value = false
  }
}
async function generate(retry = false) {
  if (busy.value || working.value || !canEdit.value) return
  if (!retry && pendingAttempt.value) return
  if (!retry && !isEditorialMonday(brief.week_start)) {
    error.value = 'Выберите понедельник — начало недели для колонки.'
    return
  }
  const attempt = retry ? pendingAttempt.value : { key: crypto.randomUUID(), body: { ...brief } }
  if (!attempt) return
  pendingAttempt.value = attempt
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const result = (
      await mutate<ApiResponse<EditorialJob>>('/api/v1/admin/editorial/generate', {
        method: 'POST',
        headers: { 'Idempotency-Key': attempt.key },
        body: JSON.stringify(attempt.body),
      })
    ).data
    if (!result) throw new Error('Сервер не подтвердил отправку пожеланий.')
    pendingAttempt.value = null
    rememberJob(result)
    pollFailed.value = false
    schedulePoll()
    await refreshLists()
  } catch (cause) {
    // A lost response is not permission to purchase a second generation. Confirmation uses
    // the original key and exact payload even if the editor has since changed the brief.
    if (cause instanceof ApiError && [400, 403, 404, 422, 429].includes(cause.status))
      pendingAttempt.value = null
    error.value = workflowError(cause)
  } finally {
    busy.value = false
  }
}
async function cancelJob() {
  if (!selectedJob.value || busy.value || !working.value) return
  busy.value = true
  error.value = ''
  try {
    const result = (
      await mutate<ApiResponse<EditorialJob>>(
        `/api/v1/admin/editorial/jobs/${selectedJob.value.id}/cancel`,
        { method: 'POST', body: '{}' },
      )
    ).data
    if (!result) throw new Error('Сервер не подтвердил остановку. Обновите состояние подготовки.')
    rememberJob(result)
    pollFailed.value = false
    schedulePoll()
  } catch (cause) {
    error.value = workflowError(cause)
  } finally {
    busy.value = false
  }
}
function chooseRevision(next: ArticleRevision) {
  revisionId.value = next.id
  draft.value = copyColumnDraft(next.content)
  savedDraft.value = JSON.stringify(draft.value)
}
async function openArticle(id: string, preferredRevision?: string) {
  if (busy.value) return
  if (dirty.value) {
    error.value = 'Сначала сохраните открытые правки. Они остаются в форме.'
    return
  }
  const epoch = ++selectionEpoch
  loading.value = true
  error.value = ''
  try {
    const result = (await apiRequest<ApiResponse<EditorialArticle>>(`/api/v1/admin/articles/${id}`))
      .data
    if (!result) throw new Error('Не удалось получить материал. Откройте его ещё раз.')
    if (disposed || epoch !== selectionEpoch || dirty.value) return
    article.value = result
    const selected =
      result.revisions.find(
        (item) => item.id === (preferredRevision || result.draft_head_revision_id),
      ) || result.revisions[result.revisions.length - 1]
    if (selected) chooseRevision(selected)
    else {
      revisionId.value = ''
      draft.value = null
      savedDraft.value = ''
    }
  } catch (cause) {
    if (epoch === selectionEpoch) error.value = workflowError(cause)
  } finally {
    if (epoch === selectionEpoch) loading.value = false
  }
}
function selectRevision(event: Event) {
  const select = event.target as HTMLSelectElement
  if (dirty.value) {
    select.value = revisionId.value
    error.value = 'Сначала сохраните открытые правки. Они остаются в форме.'
    return
  }
  const next = article.value?.revisions.find((item) => item.id === select.value)
  if (next) chooseRevision(next)
}
async function act(action: 'save' | 'check' | 'approve' | 'publish' | 'unpublish') {
  if (!article.value || !revision.value || !draft.value || busy.value || !canEdit.value) return
  if (action !== 'save' && dirty.value) {
    error.value = 'Сохраните правки новой версией перед проверкой или публикацией.'
    return
  }
  if (
    action === 'save' &&
    (!draft.value.title.trim() ||
      !draft.value.lead.trim() ||
      draft.value.sections.some((section) => !section.heading.trim() || !section.body.trim()))
  ) {
    error.value = 'Заполните заголовок, вступление и текст каждой части.'
    return
  }
  const currentArticle = article.value
  const currentRevision = revision.value.id
  const actionRevision =
    action === 'unpublish' ? currentArticle.published_revision_id : currentRevision
  const submittedContent = copyColumnDraft(draft.value)
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const result = (
      await mutate<ApiResponse<EditorialArticle>>(
        `/api/v1/admin/articles/${currentArticle.id}${action === 'save' ? '' : `/${action}`}`,
        {
          method: action === 'save' ? 'PATCH' : 'POST',
          body: JSON.stringify({
            expected_version: currentArticle.version,
            revision_id: actionRevision,
            ...(action === 'save' ? { content: submittedContent } : {}),
          }),
        },
      )
    ).data
    if (!result)
      throw new Error(
        'Сервер не подтвердил действие. Правки остались в форме; обновите список перед новой попыткой.',
      )
    article.value = result
    const selected = result.revisions.find(
      (item) => item.id === (action === 'save' ? result.draft_head_revision_id : currentRevision),
    )
    if (selected) {
      // Inputs stay editable while the server is saving. Do not erase newer typing.
      if (JSON.stringify(draft.value) === JSON.stringify(submittedContent)) chooseRevision(selected)
      else {
        revisionId.value = selected.id
        savedDraft.value = JSON.stringify(selected.content)
      }
    }
    const messages = {
      save: 'Правки сохранены новой версией.',
      check: 'Проверка завершена. Посмотрите результат ниже.',
      approve: 'Эта версия одобрена редактором.',
      publish: 'Одобренная версия опубликована.',
      unpublish: 'Колонка снята с публикации.',
    }
    notice.value = messages[action]
    await refreshLists()
  } catch (cause) {
    error.value = workflowError(cause)
  } finally {
    busy.value = false
  }
}
function leavePage(event: BeforeUnloadEvent) {
  if (!dirty.value && !pendingAttempt.value) return
  event.preventDefault()
  event.returnValue = ''
}
function canLeave() {
  if (busy.value) return false
  return (
    (!dirty.value && !pendingAttempt.value) ||
    window.confirm('Закрыть редактор колонки? Несохранённые правки будут потеряны.')
  )
}
onBeforeRouteLeave(canLeave)
onBeforeRouteUpdate(canLeave)
watch(user, (value) => {
  if (!value) stopPolling()
  else void refresh()
})
onMounted(() => {
  window.addEventListener('beforeunload', leavePage)
  void refresh()
})
onBeforeUnmount(() => {
  disposed = true
  selectionEpoch++
  stopPolling()
  window.removeEventListener('beforeunload', leavePage)
})
</script>

<template>
  <section class="editorial" aria-labelledby="editorial-title">
    <div class="editorial-heading">
      <div>
        <p class="eyebrow">Бобровая неделя</p>
        <h2 id="editorial-title">Колонка Бобрика</h2>
        <p>Бобрик собирает истории, редактор проверяет и выпускает колонку.</p>
      </div>
      <a class="quiet-button" href="/news" target="_blank" rel="noopener"
        >Открыть колонки на сайте ↗</a
      >
    </div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="form-success" role="status">{{ notice }}</p>
    <div class="editorial-grid">
      <div class="editorial-sidebar">
        <form class="editorial-card editorial-brief" @submit.prevent="generate()">
          <h3>Новая колонка</h3>
          <div class="form-field">
            <label for="column-week">Начало недели · понедельник</label
            ><input id="column-week" v-model="brief.week_start" type="date" required />
          </div>
          <div class="form-field">
            <label for="column-team">Команда</label
            ><select id="column-team" v-model="brief.team_scope">
              <option value="both">Обе команды</option>
              <option value="men">Мужская команда</option>
              <option value="women">Команда девушек</option>
            </select>
          </div>
          <div class="form-field">
            <label for="column-discipline">Баскетбол</label
            ><select id="column-discipline" v-model="brief.discipline">
              <option value="all">Все дисциплины</option>
              <option value="5x5">5 × 5</option>
              <option value="3x3">3 × 3</option>
              <option value="phygital">Фиджитал</option>
            </select>
          </div>
          <div class="form-field">
            <label for="column-brief">Пожелания редактора</label
            ><textarea
              id="column-brief"
              v-model="brief.brief"
              rows="5"
              maxlength="1500"
              placeholder="Какой теме уделить внимание?"
            /><small>{{ brief.brief.length }} / 1500</small>
          </div>
          <p class="editorial-note">
            700–1000 слов по опубликованным материалам клуба. Новая генерация готовит отдельную
            версию и сохраняет редакторские правки.
          </p>
          <button type="submit" class="button" :disabled="busy || working || !!pendingAttempt">
            {{ busy && pendingAttempt ? 'Передаём пожелания…' : 'Подготовить черновик' }}
          </button>
          <div v-if="pendingAttempt && !busy" class="editorial-pending" role="status">
            <p>
              Ответ на отправку не подтверждён. Пожелания сохранены. Подтвердите исходную попытку,
              чтобы не запускать вторую генерацию.
            </p>
            <button type="button" class="quiet-button" @click="generate(true)">
              Подтвердить исходную попытку
            </button>
          </div>
        </form>
        <section v-if="selectedJob" class="editorial-card" aria-label="Подготовка колонки">
          <p class="editorial-job-state" role="status">{{ editorialJobLabel(selectedJob) }}</p>
          <p v-if="selectedJob.week_start">Неделя с {{ dateLabel(selectedJob.week_start) }}</p>
          <p v-if="selectedJob.error_code" class="editorial-note">
            {{
              selectedJob.error_code === 'checks_failed'
                ? 'Черновик готов, но проверка нашла замечания. Откройте версию и исправьте их перед выпуском.'
                : selectedJob.error_code === 'provider_outcome_unknown'
                  ? 'Связь с моделью прервалась. Повторный платный запуск не выполнялся.'
                  : 'Черновик не получен. Пожелания остались в форме; автоматического повторного запуска нет.'
            }}
          </p>
          <button
            v-if="working"
            type="button"
            class="quiet-button"
            :disabled="busy"
            @click="cancelJob"
          >
            Остановить подготовку
          </button>
          <button
            v-if="pollFailed"
            type="button"
            class="quiet-button"
            :disabled="busy"
            @click="pollJob"
          >
            Обновить состояние подготовки
          </button>
          <button
            v-if="selectedJob.result_revision_id"
            type="button"
            class="quiet-button"
            :disabled="busy || dirty"
            @click="openArticle(selectedJob.article_id, selectedJob.result_revision_id!)"
          >
            Открыть готовую версию
          </button>
        </section>
        <section class="editorial-card" aria-labelledby="editorial-materials-title">
          <div class="editorial-list-heading">
            <h3 id="editorial-materials-title">Материалы</h3>
            <button type="button" class="quiet-button" :disabled="loading || busy" @click="refresh">
              Обновить список
            </button>
          </div>
          <p v-if="loading && !articles.length" role="status">Загружаем колонки…</p>
          <p v-else-if="!articles.length" class="editorial-note">
            Пока нет колонок. Начните с пожеланий к первой неделе.
          </p>
          <ul class="editorial-articles">
            <li v-for="item in articles" :key="item.id">
              <button
                type="button"
                :aria-pressed="article?.id === item.id"
                :disabled="busy"
                @click="openArticle(item.id)"
              >
                <strong>{{ articleTitle(item) }}</strong
                ><small
                  >{{ item.published_revision_id ? 'На сайте' : 'Черновик' }} · версия записи
                  {{ item.version }}</small
                >
              </button>
            </li>
          </ul>
        </section>
      </div>
      <div class="editorial-main">
        <div v-if="!article || !draft || !revision" class="editorial-card editorial-empty">
          <h3>Сначала история, затем выпуск</h3>
          <p>
            Подготовьте колонку или откройте материал слева. Здесь появятся текст, подтверждённые
            факты и результаты проверки.
          </p>
        </div>
        <template v-else>
          <section class="editorial-card" aria-labelledby="column-editor-title">
            <div class="editorial-list-heading">
              <h3 id="column-editor-title">Редактор колонки</h3>
              <a
                v-if="article.published_revision_id"
                :href="editorialArticlePath(article.slug)"
                target="_blank"
                rel="noopener"
                >На сайте ↗</a
              >
            </div>
            <div class="form-field">
              <label for="column-revision">Версия текста</label
              ><select
                id="column-revision"
                :value="revisionId"
                :disabled="busy"
                @change="selectRevision"
              >
                <option v-for="(item, index) in orderedRevisions" :key="item.id" :value="item.id">
                  {{ orderedRevisions.length - index }} ·
                  {{ item.origin === 'human' ? 'Правки редактора' : 'Черновик Бобрика' }} ·
                  {{ dateLabel(item.created_at)
                  }}{{ item.id === article.published_revision_id ? ' · на сайте' : '' }}
                </option>
              </select>
            </div>
            <p class="editorial-version">
              Версия записи: {{ article.version }} · Текст: {{ revisionId.slice(0, 8)
              }}<span v-if="dirty"> · Есть несохранённые правки</span
              ><span v-else-if="published"> · Опубликован</span
              ><span v-else-if="approved"> · Одобрен</span>
            </p>
            <div class="form-field">
              <label for="column-title">Заголовок колонки</label
              ><input id="column-title" v-model="draft.title" maxlength="180" />
            </div>
            <div class="form-field">
              <label for="column-lead">Вступление</label
              ><textarea id="column-lead" v-model="draft.lead" rows="5" maxlength="1200" />
            </div>
            <fieldset
              v-for="(section, index) in draft.sections"
              :key="`${revisionId}-${index}`"
              class="editorial-section"
            >
              <legend>Часть {{ index + 1 }}</legend>
              <div class="form-field">
                <label :for="`column-heading-${index}`">Название части {{ index + 1 }}</label
                ><input :id="`column-heading-${index}`" v-model="section.heading" maxlength="180" />
              </div>
              <div class="form-field">
                <label :for="`column-body-${index}`">Текст части {{ index + 1 }}</label
                ><textarea
                  :id="`column-body-${index}`"
                  v-model="section.body"
                  rows="8"
                  maxlength="9000"
                />
              </div>
              <details class="editorial-facts">
                <summary>Факты этой части · {{ section.fact_ids.length }}</summary>
                <p class="editorial-note">
                  Выбранные факты появятся в колонке дословно. Редакторский текст дополняет их.
                </p>
                <label
                  v-for="fact in revision.fact_sheet.facts"
                  :key="fact.id"
                  class="editorial-fact-choice"
                  ><input v-model="section.fact_ids" type="checkbox" :value="fact.id" /><span>{{
                    fact.text
                  }}</span></label
                >
              </details>
              <div
                v-if="section.fact_ids.length"
                class="editorial-fact-preview"
                aria-label="Подтверждённые факты"
              >
                <p v-for="id in section.fact_ids" :key="id">
                  {{
                    factsById.get(id)?.text || 'Факт недоступен — проверьте выбранные материалы.'
                  }}
                </p>
              </div>
              <button
                type="button"
                class="quiet-button"
                :disabled="busy || draft.sections.length <= 1"
                @click="draft.sections.splice(index, 1)"
              >
                Удалить часть {{ index + 1 }}
              </button>
            </fieldset>
            <button
              type="button"
              class="quiet-button"
              :disabled="busy || draft.sections.length >= 10"
              @click="draft.sections.push({ heading: '', body: '', fact_ids: [] })"
            >
              Добавить часть
            </button>
            <div class="editorial-actions">
              <button type="button" class="button" :disabled="busy || !dirty" @click="act('save')">
                Сохранить правки</button
              ><button
                type="button"
                class="quiet-button"
                :disabled="busy || dirty"
                @click="act('check')"
              >
                Проверить версию
              </button>
            </div>
          </section>
          <section class="editorial-card" aria-labelledby="column-checks-title">
            <h3 id="column-checks-title">Перед выпуском</h3>
            <p v-if="dirty" class="editorial-note">
              Сначала сохраните правки. Проверка и одобрение относятся к сохранённой версии текста.
            </p>
            <template v-else-if="checks"
              ><p :class="checks.passed ? 'editorial-checks-pass' : 'form-error'">
                {{ checks.passed ? 'Проверка пройдена' : 'Нужны правки перед выпуском' }} ·
                {{ checks.word_count }} слов
              </p>
              <ul v-if="checks.issues.length">
                <li v-for="issue in checks.issues" :key="issue">{{ issueMessage(issue) }}</li>
              </ul>
              <ul v-if="checks.warnings.length" class="editorial-note">
                <li v-for="warning in checks.warnings" :key="warning">
                  {{ issueMessage(warning) }}
                </li>
              </ul></template
            >
            <p v-else class="editorial-note">
              Эта версия ещё не проверена. Нажмите «Проверить версию».
            </p>
            <p class="editorial-note">
              Проверьте формулировки и материалы ниже. Автоматическая проверка помогает редактору,
              окончательное решение о выпуске остаётся за вами.
            </p>
            <div class="editorial-actions">
              <button
                type="button"
                class="quiet-button"
                :disabled="busy || dirty || !checks?.passed || approved"
                @click="act('approve')"
              >
                {{ approved ? 'Версия одобрена' : 'Одобрить версию' }}</button
              ><button
                type="button"
                class="button"
                :disabled="busy || dirty || !approved || !checks?.passed || published"
                @click="act('publish')"
              >
                {{ published ? 'Версия на сайте' : 'Опубликовать' }}</button
              ><button
                v-if="article.published_revision_id"
                type="button"
                class="quiet-button"
                :disabled="busy || dirty"
                @click="act('unpublish')"
              >
                Снять с публикации
              </button>
            </div>
          </section>
          <section class="editorial-card editorial-sources" aria-labelledby="column-sources-title">
            <h3 id="column-sources-title">Материалы для проверки</h3>
            <p>
              Неделя: {{ dateLabel(revision.fact_sheet.week_start) }} —
              {{ dateLabel(revision.fact_sheet.week_end) }} · Срез данных:
              {{ dateLabel(revision.fact_sheet.as_of) }}
            </p>
            <ul v-if="revision.fact_sheet.caveats.length" class="editorial-caveats">
              <li v-for="caveat in revision.fact_sheet.caveats" :key="caveat">{{ caveat }}</li>
            </ul>
            <details v-for="source in revision.fact_sheet.sources" :key="source.ref">
              <summary>{{ source.title }}</summary>
              <p>{{ source.excerpt }}</p>
              <a
                v-if="safeEditorialSource(source.url)"
                :href="source.url"
                target="_blank"
                rel="noopener"
                >Открыть материал ↗</a
              >
            </details>
          </section>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.editorial {
  min-width: 0;
}
.editorial-heading,
.editorial-list-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.editorial-heading {
  margin: 24px 0;
}
.editorial-heading h2 {
  margin: 6px 0;
  font-size: clamp(1.5rem, 3vw, 2rem);
}
.editorial-heading p {
  max-width: 640px;
  margin: 4px 0;
}
.editorial-grid {
  display: grid;
  grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.editorial-sidebar,
.editorial-main {
  display: grid;
  gap: 20px;
  min-width: 0;
}
.editorial-card {
  min-width: 0;
  padding: 24px;
  border: 1px solid #dce4ec;
  border-radius: 16px;
  background: white;
  overflow-wrap: anywhere;
}
.editorial-card h3 {
  margin: 0 0 18px;
  font-size: 1.2rem;
}
.editorial-card .form-field {
  margin-bottom: 16px;
}
.editorial-card input:not([type='checkbox']),
.editorial-card select,
.editorial-card textarea {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  padding: 11px 12px;
  min-height: 44px;
  border: 1px solid #bac9d5;
  border-radius: 8px;
  background: #fff;
  color: #102e46;
  font: inherit;
}
.editorial-card textarea {
  resize: vertical;
  line-height: 1.6;
}
.editorial-card label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  font-size: 0.9rem;
}
.editorial-note,
.editorial-version {
  color: #526b80;
  font-size: 0.85rem;
  line-height: 1.65;
}
.editorial-version span {
  font-weight: 600;
  color: #8a3c22;
}
.editorial-note {
  margin: 12px 0;
}
.editorial-brief .button {
  width: 100%;
}
.editorial-pending {
  padding: 12px;
  margin-top: 14px;
  background: #fff5df;
  border-radius: 10px;
  font-size: 0.85rem;
}
.editorial-job-state {
  font-weight: 600;
  color: #26475f;
}
.editorial-articles {
  padding: 0;
  margin: 0;
  list-style: none;
}
.editorial-articles li + li {
  margin-top: 8px;
}
.editorial-articles button {
  display: grid;
  gap: 6px;
  width: 100%;
  padding: 12px;
  border: 1px solid #dce4ec;
  border-radius: 8px;
  text-align: left;
  background: #f8fafc;
  color: #193b55;
  font: inherit;
  cursor: pointer;
}
.editorial-articles button[aria-pressed='true'] {
  border-color: #b12c25;
  background: #fff4f0;
}
.editorial-articles small {
  color: #526b80;
  font-weight: 400;
}
.editorial-section {
  min-width: 0;
  margin: 22px 0;
  padding: 18px;
  border: 1px solid #dce4ec;
  border-radius: 10px;
}
.editorial-section legend {
  padding: 0 6px;
  font-weight: 600;
}
.editorial-facts {
  margin: 16px 0;
}
.editorial-facts summary,
.editorial-sources summary {
  cursor: pointer;
  font-weight: 600;
  line-height: 1.5;
}
.editorial-card .editorial-fact-choice {
  display: flex;
  align-items: start;
  gap: 10px;
  padding: 10px 0;
  font-weight: 400;
  line-height: 1.6;
}
.editorial-fact-choice input {
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  margin-top: 3px;
}
.editorial-fact-preview {
  margin: 12px 0;
  padding: 12px 16px;
  border-left: 3px solid #7ca48b;
  background: #f2f8f4;
  color: #264b38;
  font-size: 0.9rem;
  line-height: 1.65;
}
.editorial-fact-preview p {
  margin: 5px 0;
  white-space: pre-wrap;
}
.editorial-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}
.editorial-checks-pass {
  color: #21603b;
  font-weight: 600;
}
.editorial-caveats {
  padding: 14px 14px 14px 32px;
  border-radius: 10px;
  background: #fff5df;
  line-height: 1.6;
}
.editorial-sources details {
  padding: 16px 0;
  border-top: 1px solid #e1e8ee;
}
.editorial-sources details p {
  white-space: pre-wrap;
  line-height: 1.65;
  font-size: 0.9rem;
}
.editorial-empty {
  padding: 40px;
  color: #526b80;
  line-height: 1.7;
}
.editorial button:disabled {
  cursor: default;
  opacity: 0.55;
}
.editorial :focus-visible {
  outline: 3px solid #b94a38;
  outline-offset: 3px;
}
@media (max-width: 1000px) {
  .editorial-grid {
    grid-template-columns: 1fr;
  }
  .editorial-heading {
    flex-direction: column;
  }
  .editorial-sidebar {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 600px) {
  .editorial-card {
    padding: 18px;
  }
  .editorial-section {
    padding: 12px;
  }
  .editorial-heading p {
    font-size: 0.9rem;
  }
  .editorial-actions {
    align-items: stretch;
    flex-direction: column;
  }
  .editorial-actions button {
    width: 100%;
  }
  .editorial-list-heading {
    flex-wrap: wrap;
  }
}
</style>
