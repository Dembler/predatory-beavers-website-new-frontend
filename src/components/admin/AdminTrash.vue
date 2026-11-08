<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import AsyncState from '@/components/AsyncState.vue'
import { useAuth } from '@/composables/useAuth'
import { useLoad } from '@/composables/useLoad'
import { ApiError, apiRequest } from '@/shared/api'
import { errorMessage } from '@/shared/admin'
import type { ApiResponse, Page } from '@/shared/types'

interface TrashItem {
  id: string
  title: string
  detail: string | null
  deleted_at: string | null
  updated_at: string
}
interface RestoreResult {
  id: string
  message: string
}
const props = defineProps<{ entity: string; query?: string }>()
const emit = defineEmits<{ restored: []; edit: [id: string] }>()
const { mutate, user, sessionExpired } = useAuth()
const ownerId = user.value?.id
const page = ref(1)
const search = ref('')
const applied = ref('')
const dialog = ref<HTMLDialogElement | null>(null)
const selected = ref<TrashItem | null>(null)
const busy = ref(false)
const failure = ref('')
const stale = ref(false)
const notice = ref('')
const restoredId = ref('')
const noticeElement = ref<HTMLElement | null>(null)
let returnTarget: HTMLElement | null = null
let suspended = false
const { data, pending, error, load } = useLoad(() => {
  const params = new URLSearchParams(props.query)
  params.set('page', String(page.value))
  params.set('page_size', '15')
  if (applied.value) params.set('q', applied.value)
  return apiRequest<Page<TrashItem>>(`/api/v1/admin/trash/${props.entity}?${params}`)
}, [page, applied])
watch(data, (result) => {
  if (result && page.value > Math.max(1, result.total_pages))
    page.value = Math.max(1, result.total_pages)
})
watch(user, async (current, previous) => {
  if (current && current.id !== ownerId) {
    dialog.value?.close()
    suspended = false
    return
  }
  if (!current && sessionExpired.value) {
    suspended = Boolean(dialog.value?.open)
    dialog.value?.close()
  } else if (current && !previous && suspended) {
    await nextTick()
    dialog.value?.showModal()
    suspended = false
  }
})
function searchTrash() {
  page.value = 1
  applied.value = search.value.trim()
}
function clearSearch() {
  search.value = ''
  searchTrash()
}
function askRestore(item: TrashItem) {
  if (busy.value) return
  selected.value = item
  failure.value = ''
  stale.value = false
  returnTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null
  dialog.value?.showModal()
}
function returnFocus() {
  if (returnTarget?.isConnected) returnTarget.focus()
  else noticeElement.value?.focus()
}
async function restore() {
  if (!selected.value || busy.value || stale.value) return
  busy.value = true
  failure.value = ''
  try {
    const result = await mutate<ApiResponse<RestoreResult>>(
      `/api/v1/admin/trash/${props.entity}/${selected.value.id}/restore`,
      { method: 'POST', body: JSON.stringify({ expected_updated_at: selected.value.updated_at }) },
    )
    notice.value = result.data?.message || 'Запись восстановлена и скрыта с сайта.'
    restoredId.value = selected.value.id
    dialog.value?.close()
    await load()
    emit('restored')
    await nextTick()
    noticeElement.value?.focus({ preventScroll: true })
  } catch (cause) {
    failure.value =
      cause instanceof ApiError && cause.code === 'restore_dependency'
        ? cause.detail || errorMessage(cause)
        : errorMessage(cause)
    stale.value = cause instanceof ApiError && cause.code === 'stale_record'
  } finally {
    busy.value = false
  }
}
async function refresh() {
  dialog.value?.close()
  await load()
}
function removedAt(value: string | null) {
  return value ? new Date(value).toLocaleString('ru-RU') : 'Дата не сохранена'
}
</script>
<template>
  <section class="admin-trash" aria-labelledby="trash-heading">
    <h2 id="trash-heading">Корзина</h2>
    <p>
      Удалённые записи можно вернуть с прежним ID и историей. После восстановления запись скрыта с
      сайта: проверьте её и включите публикацию отдельно.
    </p>
    <p v-if="entity === 'competitions'" class="form-hint">
      Связанные матчи останутся скрытыми даже после публикации восстановленного турнира. Каждый матч
      нужно проверить и опубликовать отдельно.
    </p>
    <p v-if="entity === 'media'" class="form-hint">
      Фотография вернётся в библиотеку. Публичный доступ появится после публикации связанной записи.
    </p>
    <form class="trash-search" role="search" @submit.prevent="searchTrash">
      <label for="trash-search">Поиск в корзине</label>
      <input id="trash-search" v-model="search" type="search" placeholder="Название или имя" />
      <button class="quiet-button" type="submit">Найти</button>
      <button v-if="search || applied" type="button" class="quiet-button" @click="clearSearch">
        Сбросить
      </button>
    </form>
    <div
      v-if="notice"
      ref="noticeElement"
      class="form-success trash-notice"
      role="status"
      tabindex="-1"
    >
      <p>{{ notice }}</p>
      <button
        v-if="restoredId"
        type="button"
        class="quiet-button"
        @click="emit('edit', restoredId)"
      >
        Проверить восстановленную запись
      </button>
    </div>
    <p v-if="data" class="form-hint">
      Удалённых записей: <strong>{{ data.total }}</strong>
    </p>
    <AsyncState
      :pending="pending"
      :error="error"
      :empty="!data?.items.length"
      :empty-text="applied ? 'По запросу ничего не найдено.' : 'Корзина пуста.'"
      @retry="load"
    >
      <div class="trash-list">
        <article v-for="item in data?.items" :key="item.id" class="trash-card">
          <div>
            <h3>{{ item.title }}</h3>
            <p v-if="item.detail">{{ item.detail }}</p>
            <small>Удалено: {{ removedAt(item.deleted_at) }}</small>
          </div>
          <button
            class="quiet-button"
            type="button"
            :aria-label="`Восстановить: ${item.title}`"
            :disabled="busy"
            @click="askRestore(item)"
          >
            Восстановить
          </button>
        </article>
      </div>
    </AsyncState>
    <nav v-if="data && data.total_pages > 1" class="pagination" aria-label="Страницы корзины">
      <button class="quiet-button" type="button" :disabled="page <= 1 || pending" @click="page--">
        ← Назад
      </button>
      <span>{{ page }} / {{ data.total_pages }}</span>
      <button
        class="quiet-button"
        type="button"
        :disabled="page >= data.total_pages || pending"
        @click="page++"
      >
        Далее →
      </button>
    </nav>
    <dialog
      ref="dialog"
      class="editor-dialog editor-dialog--small admin-confirm-dialog"
      aria-labelledby="restore-title"
      @cancel="busy && $event.preventDefault()"
      @close="returnFocus"
    >
      <h2 id="restore-title">Восстановить запись?</h2>
      <p class="delete-record-name">{{ selected?.title }}</p>
      <p>
        Запись вернётся в этот раздел и останется скрытой с сайта. Связанные удалённые записи
        автоматически не восстанавливаются.
      </p>
      <p v-if="failure" class="form-error" role="alert">{{ failure }}</p>
      <div class="dialog-actions">
        <button
          type="button"
          class="quiet-button"
          :disabled="busy"
          autofocus
          @click="dialog?.close()"
        >
          Отмена
        </button>
        <button v-if="stale" type="button" class="button" @click="refresh">Обновить корзину</button>
        <button v-else type="button" class="button" :disabled="busy" @click="restore">
          {{ busy ? 'Восстанавливаем…' : 'Восстановить' }}
        </button>
      </div>
    </dialog>
  </section>
</template>
<style scoped>
.admin-trash > p {
  max-width: 900px;
  line-height: 1.65;
}
.trash-search {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-block: 22px;
}
.trash-search label {
  width: 100%;
  font-size: 0.85rem;
  font-weight: 700;
}
.trash-search input {
  flex: 1;
  min-width: 160px;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #bbcddd;
  border-radius: 8px;
}
.trash-list {
  display: grid;
  gap: 12px;
}
.trash-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px;
  border: 1px solid #d8e2eb;
  border-radius: 14px;
  background: white;
}
.trash-card > div {
  min-width: 0;
}
.trash-card h3 {
  margin: 0;
  font:
    700 1rem/1.5 'Roboto',
    sans-serif;
  text-transform: none;
  overflow-wrap: anywhere;
}
.trash-card p {
  margin: 5px 0;
  overflow-wrap: anywhere;
}
.trash-card small {
  display: block;
  margin-top: 8px;
  color: #52677b;
}
.trash-card button {
  flex-shrink: 0;
  min-height: 44px;
}
.trash-notice p {
  margin-top: 0;
}
@media (max-width: 600px) {
  .trash-card {
    align-items: stretch;
    flex-direction: column;
    gap: 14px;
  }
}
</style>
