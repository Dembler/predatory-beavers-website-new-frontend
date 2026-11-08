<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import AsyncState from '@/components/AsyncState.vue'
import AdminTrash from './AdminTrash.vue'
import { useLoad } from '@/composables/useLoad'
import { useAuth } from '@/composables/useAuth'
import { ApiError, apiRequest, mediaUrl } from '@/shared/api'
import { errorMessage } from '@/shared/admin'
import type { ApiResponse, Media, Page } from '@/shared/types'

const emit = defineEmits<{ changed: [] }>()
interface AdminAsset extends Media {
  reused?: boolean
}
interface MediaUsage {
  entity_type: string
  entity_id: string
  title: string
  field: string
  admin_url: string | null
  public_url: string | null
}
const { mutate, user, sessionExpired } = useAuth()
const ownerId = user.value?.id
const route = useRoute()
const showingTrash = ref(false)
async function editRestored(id: string) {
  showingTrash.value = false
  await load()
  try {
    const result = await apiRequest<ApiResponse<AdminAsset>>(`/api/v1/admin/media/${id}`)
    if (result.data) await open(result.data)
  } catch (cause) {
    failure.value = errorMessage(cause)
  }
}
async function restored() {
  await load()
  emit('changed')
}
const page = ref(1)
const search = ref('')
const query = ref('')
const { data, pending, error, load } = useLoad(
  () =>
    apiRequest<Page<AdminAsset>>(
      `/api/v1/admin/media?page=${page.value}&page_size=18&q=${encodeURIComponent(query.value)}`,
    ),
  [page, query],
)
const busy = ref(false)
const message = ref('')
const failure = ref('')
const uploadAlt = ref('')
const editor = ref<HTMLDialogElement | null>(null)
const selected = ref<AdminAsset | null>(null)
const usage = ref<MediaUsage[]>([])
const checkingUsage = ref(false)
const usageFailed = ref(false)
const conflict = ref(false)
const reusedAsset = ref<AdminAsset | null>(null)
const requestId = ref<string | null>(null)
const alt = ref('')
const deleting = ref(false)
const initialAlt = ref('')
const dirty = computed(() => alt.value !== initialAlt.value)
const focusAfterClose = ref<HTMLElement | null>(null)
const noticeElement = ref<HTMLElement | null>(null)
watch(data, (result) => {
  if (result && page.value > Math.max(1, result.total_pages))
    page.value = Math.max(1, result.total_pages)
})
let suspended = false
watch(user, async (current, previous) => {
  if (current && current.id !== ownerId) {
    editor.value?.close()
    suspended = false
    return
  }
  if (!current && sessionExpired.value) {
    suspended = Boolean(editor.value?.open)
    editor.value?.close()
  } else if (current && !previous && suspended) {
    await nextTick()
    editor.value?.showModal()
    suspended = false
  }
})
function applySearch() {
  page.value = 1
  query.value = search.value.trim()
}
function clearSearch() {
  search.value = ''
  query.value = ''
  page.value = 1
}
watch(
  () => route.query.edit,
  async (id) => {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return
    await nextTick()
    try {
      const response = await apiRequest<ApiResponse<AdminAsset>>(
        `/api/v1/admin/media/${encodeURIComponent(id)}`,
      )
      if (response.data) await open(response.data)
    } catch (cause) {
      failure.value = errorMessage(cause)
    }
  },
  { immediate: true },
)
async function reloadCurrent() {
  if (
    !selected.value ||
    busy.value ||
    !window.confirm(
      'Загрузить актуальную версию? Несохранённое описание в этой форме будет потеряно.',
    )
  )
    return
  try {
    const response = await apiRequest<ApiResponse<AdminAsset>>(
      `/api/v1/admin/media/${selected.value.id}`,
    )
    if (response.data) await open(response.data, deleting.value)
  } catch (cause) {
    failure.value = errorMessage(cause)
  }
}
async function editReused() {
  if (!reusedAsset.value) return
  await open(reusedAsset.value)
  if (uploadAlt.value.trim()) alt.value = uploadAlt.value.trim()
}

function returnFocus() {
  if (focusAfterClose.value?.isConnected) {
    focusAfterClose.value.focus({ preventScroll: true })
  } else {
    noticeElement.value?.focus({ preventScroll: true })
  }
}

function hasUnsavedChanges() {
  return (
    Boolean(uploadAlt.value.trim()) ||
    Boolean((editor.value?.open || suspended) && !deleting.value && dirty.value)
  )
}
function canLeave() {
  if (busy.value) return false
  return (
    !hasUnsavedChanges() ||
    window.confirm('Закрыть редактор? Несохранённые изменения будут потеряны.')
  )
}
function guardUnload(event: BeforeUnloadEvent) {
  if (busy.value || hasUnsavedChanges()) {
    event.preventDefault()
    event.returnValue = ''
  }
}
window.addEventListener('beforeunload', guardUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', guardUnload))
onBeforeRouteLeave(canLeave)
onBeforeRouteUpdate(canLeave)

function close(event?: Event) {
  event?.preventDefault()
  if (busy.value) return
  if (
    !deleting.value &&
    dirty.value &&
    !window.confirm('Закрыть редактор? Несохранённые изменения будут потеряны.')
  )
    return
  editor.value?.close()
}

async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || busy.value) return
  failure.value = ''
  message.value = ''
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  ) {
    failure.value = 'Выберите JPEG, PNG или WebP размером до 8 МБ.'
    input.value = ''
    return
  }
  busy.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    body.append(
      'alt_text',
      uploadAlt.value.trim() || file.name.replace(/\.[^.]+$/, '').slice(0, 200),
    )
    const result = await mutate<ApiResponse<AdminAsset>>('/api/v1/admin/media', {
      method: 'POST',
      body,
    })
    reusedAsset.value = result.data?.reused ? result.data : null
    message.value = result.data?.reused
      ? 'Эта фотография уже есть в медиатеке. Сохранено её прежнее описание. Для изменения описания откройте фотографию.'
      : 'Фотография загружена. Её можно выбрать в редакторе игрока или матча.'
    if (!result.data?.reused) uploadAlt.value = ''
    if (page.value !== 1) page.value = 1
    else await load()
    emit('changed')
  } catch (cause) {
    failure.value = errorMessage(cause)
  } finally {
    busy.value = false
    input.value = ''
  }
}
async function open(item: AdminAsset, remove = false) {
  if (busy.value) return
  focusAfterClose.value =
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  selected.value = item
  alt.value = item.alt_text || ''
  initialAlt.value = alt.value
  deleting.value = remove
  failure.value = ''
  requestId.value = null
  conflict.value = false
  usageFailed.value = false
  usage.value = []
  editor.value?.showModal()
  await nextTick()
  if (!remove) editor.value?.querySelector<HTMLTextAreaElement>('textarea')?.focus()
  if (remove) {
    checkingUsage.value = true
    try {
      const result = await apiRequest<ApiResponse<MediaUsage[]>>(
        `/api/v1/admin/media/${item.id}/usage`,
      )
      usage.value = result.data ?? []
    } catch (cause) {
      failure.value = errorMessage(cause)
      usageFailed.value = true
    } finally {
      checkingUsage.value = false
    }
  }
}
async function submit() {
  if (
    !selected.value ||
    busy.value ||
    checkingUsage.value ||
    (deleting.value && (usage.value.length || usageFailed.value))
  )
    return
  busy.value = true
  failure.value = ''
  try {
    const version = selected.value.updated_at
    const suffix =
      deleting.value && version ? `?expected_updated_at=${encodeURIComponent(version)}` : ''
    await mutate(
      `/api/v1/admin/media/${selected.value.id}${suffix}`,
      deleting.value
        ? { method: 'DELETE' }
        : {
            method: 'PATCH',
            body: JSON.stringify({
              alt_text: alt.value.trim() || null,
              ...(version ? { expected_updated_at: version } : {}),
            }),
          },
    )
    editor.value?.close()
    message.value = deleting.value
      ? 'Фотография перемещена в корзину. Её можно восстановить.'
      : 'Описание фотографии сохранено.'
    if (deleting.value && data.value?.items.length === 1 && page.value > 1) page.value--
    else await load()
    emit('changed')
    await nextTick()
    noticeElement.value?.focus({ preventScroll: true })
  } catch (cause) {
    failure.value = errorMessage(cause)
    conflict.value = cause instanceof ApiError && cause.code === 'stale_record'
    requestId.value = cause instanceof ApiError ? cause.requestId : null
    if (deleting.value && cause instanceof ApiError && cause.status === 409) {
      try {
        const result = await apiRequest<ApiResponse<MediaUsage[]>>(
          `/api/v1/admin/media/${selected.value.id}/usage`,
        )
        usage.value = result.data ?? []
      } catch {
        /* The original error remains visible. */
      }
    }
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <div v-show="user?.id === ownerId" class="admin-collection admin-media">
    <div class="trash-switch" role="group" aria-label="Состояние фотографий">
      <button
        type="button"
        class="quiet-button"
        :aria-pressed="!showingTrash"
        @click="showingTrash = false"
      >
        Фотографии
      </button>
      <button
        type="button"
        class="quiet-button"
        :aria-pressed="showingTrash"
        @click="showingTrash = true"
      >
        Корзина
      </button>
    </div>
    <AdminTrash v-if="showingTrash" entity="media" @restored="restored" @edit="editRestored" />
    <template v-else>
      <div class="admin-section-heading">
        <div>
          <h2>Фотографии</h2>
          <p>Общая медиатека клуба. Изображения автоматически оптимизируются для сайта.</p>
        </div>
      </div>
      <div class="media-upload admin-form" :aria-busy="busy">
        <div class="form-field">
          <label for="upload-alt">Описание нового фото</label
          ><input
            id="upload-alt"
            v-model="uploadAlt"
            maxlength="500"
            placeholder="Кто или что изображено"
            :disabled="busy"
          />
        </div>
        <label class="button file-button"
          >{{ busy ? 'Загружаем…' : '+ Загрузить фото'
          }}<input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            :disabled="busy"
            @change="upload" /></label
        ><small>JPEG, PNG, WebP · до 8 МБ</small>
      </div>
      <form class="media-search" role="search" @submit.prevent="applySearch">
        <label for="media-search">Поиск в медиатеке</label>
        <input id="media-search" v-model="search" type="search" placeholder="Описание фотографии" />
        <button type="submit" class="quiet-button">Найти</button>
        <button v-if="search || query" type="button" class="quiet-button" @click="clearSearch">
          Сбросить
        </button>
      </form>
      <p v-if="data" class="media-count">
        {{ query ? 'Найдено фотографий:' : 'Всего фотографий:' }} <strong>{{ data.total }}</strong>
      </p>
      <p v-if="message" ref="noticeElement" class="form-success" role="status" tabindex="-1">
        {{ message }}
      </p>
      <button
        v-if="reusedAsset"
        type="button"
        class="quiet-button"
        :disabled="busy"
        @click="editReused"
      >
        Изменить описание существующего фото
      </button>
      <p v-if="failure && !editor?.open" class="form-error" role="alert">{{ failure }}</p>
      <AsyncState
        :pending="pending"
        :error="error"
        :empty="!data?.items.length"
        :empty-text="
          query
            ? 'По этому описанию фотографии не найдены.'
            : 'В медиатеке пока нет фотографий. Загрузите первое изображение.'
        "
        @retry="load"
      >
        <div class="media-grid">
          <article v-for="item in data?.items" :key="item.id" class="media-card">
            <img
              :src="mediaUrl(item.content_url)"
              :alt="item.alt_text || 'Фото клуба'"
              loading="lazy"
            />
            <div class="media-card__details">
              <h3>{{ item.alt_text || 'Без описания' }}</h3>
              <p>
                {{ item.width }} × {{ item.height }} ·
                {{ Math.max(1, Math.round(item.size / 1024)) }} КБ
              </p>
              <div class="row-actions">
                <button
                  type="button"
                  class="quiet-button"
                  :aria-label="`Изменить описание: ${item.alt_text || 'фото'}`"
                  @click="open(item)"
                >
                  Описание</button
                ><button
                  type="button"
                  class="quiet-button quiet-button--danger"
                  :aria-label="`Удалить фото: ${item.alt_text || 'без описания'}`"
                  @click="open(item, true)"
                >
                  Удалить
                </button>
              </div>
            </div>
          </article>
        </div>
      </AsyncState>
      <nav v-if="data && data.total_pages > 1" class="pagination" aria-label="Страницы медиатеки">
        <button class="quiet-button" type="button" :disabled="page <= 1 || pending" @click="page--">
          ← Назад</button
        ><span>{{ page }} / {{ data.total_pages }}</span
        ><button
          class="quiet-button"
          type="button"
          :disabled="page >= data.total_pages || pending"
          @click="page++"
        >
          Далее →
        </button>
      </nav>
      <dialog
        ref="editor"
        class="editor-dialog editor-dialog--small"
        aria-labelledby="media-editor-title"
        @cancel="close"
        @close="returnFocus"
      >
        <form class="admin-form" @submit.prevent="submit">
          <div class="dialog-heading">
            <div>
              <p class="eyebrow">Медиатека</p>
              <h2 id="media-editor-title">
                {{ deleting ? 'Удалить фотографию?' : 'Описание фотографии' }}
              </h2>
            </div>
            <button
              type="button"
              class="icon-button"
              aria-label="Закрыть редактор"
              :disabled="busy"
              @click="close"
            >
              ×
            </button>
          </div>
          <div class="admin-editor__body">
            <img
              v-if="selected"
              class="media-editor-preview"
              :src="mediaUrl(selected.content_url)"
              :alt="selected.alt_text || 'Предпросмотр фото'"
            />
            <p v-if="deleting">
              Фото можно переместить в корзину, если оно не используется в записях. Файл сохранится
              для восстановления.
            </p>
            <p v-if="checkingUsage" role="status">Проверяем, где используется фотография…</p>
            <button
              v-if="usageFailed && selected"
              type="button"
              class="quiet-button"
              :disabled="busy"
              @click="open(selected, true)"
            >
              Проверить связи ещё раз
            </button>
            <div v-if="deleting && usage.length" class="media-usage">
              <p>Сначала замените или уберите фотографию в связанных записях:</p>
              <ul>
                <li
                  v-for="item in usage"
                  :key="`${item.entity_type}-${item.entity_id}-${item.field}`"
                >
                  <a v-if="item.admin_url" :href="item.admin_url">{{ item.title }}</a>
                  <span v-else>{{ item.title }}</span>
                  <a
                    v-if="item.public_url"
                    :href="item.public_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    >Открыть на сайте <span class="sr-only">в новой вкладке</span> ↗</a
                  >
                </li>
              </ul>
            </div>
            <div v-if="!deleting" class="form-field">
              <label for="media-alt">Описание для читателей и экранных дикторов</label
              ><textarea id="media-alt" v-model="alt" rows="3" maxlength="500" :disabled="busy" />
              <small
                >Описание общее: изменение отобразится во всех записях с этой фотографией.</small
              >
            </div>
            <p v-if="failure" class="form-error" role="alert">{{ failure }}</p>
            <div v-if="conflict" class="row-actions">
              <a
                :href="`/admin?tab=media&edit=${selected?.id}`"
                target="_blank"
                rel="noopener noreferrer"
                >Сравнить с актуальной фотографией ↗</a
              >
              <button type="button" class="quiet-button" :disabled="busy" @click="reloadCurrent">
                Загрузить актуальную версию
              </button>
            </div>
            <small v-if="requestId" class="form-hint">Код обращения: {{ requestId }}</small>
          </div>
          <div class="dialog-actions">
            <button type="button" class="quiet-button" :disabled="busy" @click="close">
              Отмена</button
            ><button
              type="submit"
              class="button"
              :disabled="busy || checkingUsage || (deleting && (usage.length > 0 || usageFailed))"
            >
              {{ busy ? 'Подождите…' : deleting ? 'Удалить' : 'Сохранить' }}
            </button>
          </div>
        </form>
      </dialog>
    </template>
  </div>
</template>

<style scoped>
.trash-switch {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}
.trash-switch button[aria-pressed='true'] {
  background: #123d65;
  color: white;
  border-color: #123d65;
}
.media-search {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.media-search input {
  flex: 1;
  min-width: 150px;
  min-height: 44px;
  border: 1px solid #bbcddd;
  border-radius: 8px;
  padding: 10px 12px;
}
.media-search label {
  font-size: 0.8rem;
  color: #52677b;
}
.media-usage {
  padding: 12px;
  border: 1px solid #bbcddd;
  border-radius: 8px;
  line-height: 1.6;
}
.media-usage li {
  margin-block: 10px;
}
.media-usage a {
  display: block;
  color: #123d65;
  text-decoration: underline;
}
.media-count {
  margin: 0 0 18px;
  color: #52677b;
  font-size: 0.78rem;
}
.media-count strong {
  color: var(--navy);
}
.media-card {
  min-width: 0;
}
.media-card__details {
  min-width: 0;
}
.media-upload .file-button {
  text-align: center;
}
@media (max-width: 900px) {
  .media-upload {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    padding: 18px;
    margin-bottom: 20px;
    border-color: #bbcddd;
    border-radius: 16px;
    background: #f8fbfe;
  }
  .media-upload .file-button {
    width: 100%;
    min-height: 48px;
    border-radius: 10px;
  }
  .media-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  .media-card {
    display: grid;
    grid-template-columns: 84px minmax(0, 1fr);
    align-items: start;
    gap: 14px;
    padding: 14px;
    border-color: #d8e2eb;
    border-radius: 14px;
  }
  .media-card > img {
    width: 84px;
    height: 84px;
    border-radius: 10px;
  }
  .media-card .media-card__details {
    padding: 0;
  }
  .media-card h3 {
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .media-card p {
    margin: 5px 0 12px;
    font-size: 0.7rem;
    line-height: 1.5;
  }
  .media-card .row-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
  .media-card .quiet-button {
    min-width: 0;
    min-height: 44px;
    padding: 8px 5px;
    border-radius: 9px;
    font-size: 0.72rem;
  }
  .media-editor-preview {
    height: 160px;
    margin: 0 0 20px;
    border-radius: 12px;
  }
  .admin-editor__body > p {
    margin-bottom: 0;
    font-size: 0.85rem;
    line-height: 1.65;
  }
  .pagination {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: 12px;
  }
  .pagination .quiet-button {
    min-width: 0;
    min-height: 44px;
    border-radius: 10px;
  }
}
@media (max-width: 350px) {
  .media-card {
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 12px;
  }
  .media-card > img {
    width: 64px;
    height: 64px;
  }
}
</style>
