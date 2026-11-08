<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import AsyncState from '@/components/AsyncState.vue'
import ImagePicker from './ImagePicker.vue'
import AdminTrash from './AdminTrash.vue'
import { useLoad } from '@/composables/useLoad'
import { useAuth } from '@/composables/useAuth'
import { ApiError, apiRequest } from '@/shared/api'
import {
  errorMessage,
  type AdminConfig,
  type AdminField,
  type AdminRecord,
  type FormValue,
} from '@/shared/admin'
import type { ApiResponse, Media, Page } from '@/shared/types'

const props = defineProps<{ config: AdminConfig; media: Media[] }>()
const emit = defineEmits<{ changed: []; 'media-changed': [] }>()
const { mutate, user, sessionExpired } = useAuth()
const ownerId = user.value?.id
const route = useRoute()
const showingTrash = ref(false)
const trashEntity = computed(() => props.config.endpoint.split('/').pop() || '')
async function editRestored(id: string) {
  const context = beginEditorAction()
  showingTrash.value = false
  await load()
  if (isCurrentEditor(context)) await loadEditorRecord(id, context)
}
async function restored() {
  await load()
  emit('changed')
}
const page = ref(1)
const search = ref('')
const appliedSearch = ref('')
const filterValues = ref<Record<string, string>>({})
function queryString() {
  const query = new URLSearchParams(props.config.query ?? '')
  query.set('page', String(page.value))
  query.set('page_size', '15')
  if (appliedSearch.value) query.set('q', appliedSearch.value)
  for (const [key, value] of Object.entries(filterValues.value)) if (value) query.set(key, value)
  return query.toString()
}
function applySearch() {
  page.value = 1
  appliedSearch.value = search.value.trim()
}
function updateFilter(key: string, value: string) {
  page.value = 1
  filterValues.value = { ...filterValues.value, [key]: value }
}
function clearFilters() {
  page.value = 1
  search.value = appliedSearch.value = ''
  filterValues.value = {}
}
const { data, pending, error, load } = useLoad(
  () => apiRequest<Page<AdminRecord>>(`${props.config.endpoint}?${queryString()}`),
  [page, appliedSearch, () => JSON.stringify(filterValues.value)],
)
const editor = ref<HTMLDialogElement | null>(null)
const deleteDialog = ref<HTMLDialogElement | null>(null)
const form = ref<Record<string, FormValue>>({})
const editingId = ref<string | null>(null)
const editingRecord = ref<AdminRecord | null>(null)
const deleting = ref<AdminRecord | null>(null)
const saving = ref(false)
const uploads = ref(0)
const uploading = computed(() => uploads.value > 0)
const formError = ref('')
const fieldErrors = ref<Record<string, string>>({})
const requestId = ref<string | null>(null)
const preparing = ref(false)
const deleteWarning = ref('')
const impactFailed = ref(false)
const conflict = ref(false)
let editingVersion: string | undefined
let createKey = ''
let suspendedEditor = false
let suspendedDelete = false
let editorGeneration = 0
let preparingEditorGeneration: number | null = null
let disposed = false
const editorKey = ref(0)
interface EditorContext {
  generation: number
  endpoint: string
  ownerId: string | undefined
}
function invalidateEditor() {
  editorGeneration++
  if (preparingEditorGeneration !== null) {
    preparingEditorGeneration = null
    preparing.value = false
  }
}
function beginEditorAction(): EditorContext {
  invalidateEditor()
  return {
    generation: editorGeneration,
    endpoint: props.config.endpoint,
    ownerId: user.value?.id,
  }
}
function isCurrentEditor(context: EditorContext) {
  return (
    !disposed &&
    context.generation === editorGeneration &&
    context.endpoint === props.config.endpoint &&
    context.ownerId === ownerId &&
    context.ownerId === user.value?.id &&
    Boolean(context.ownerId)
  )
}
async function loadEditorRecord(id: string, context: EditorContext) {
  try {
    const response = await apiRequest<ApiResponse<AdminRecord>>(
      `${context.endpoint}/${encodeURIComponent(id)}`,
    )
    if (isCurrentEditor(context) && response.data) await open(response.data, context)
  } catch (cause) {
    if (isCurrentEditor(context)) showError(cause)
  }
}
watch(user, async (current, previous) => {
  if (current?.id !== previous?.id) invalidateEditor()
  if (current && current.id !== ownerId) {
    editor.value?.close()
    deleteDialog.value?.close()
    suspendedEditor = suspendedDelete = false
    return
  }
  if (!current && sessionExpired.value) {
    suspendedEditor = Boolean(editor.value?.open)
    suspendedDelete = Boolean(deleteDialog.value?.open)
    editor.value?.close()
    deleteDialog.value?.close()
  } else if (current && !previous) {
    await nextTick()
    if (suspendedEditor) editor.value?.showModal()
    if (suspendedDelete) deleteDialog.value?.showModal()
    suspendedEditor = suspendedDelete = false
  }
})
function updateField(field: AdminField, value: FormValue) {
  // A delayed reload was confirmed against the previous draft, not these new edits.
  invalidateEditor()
  const previous = form.value[field.key] ?? null
  form.value[field.key] = value
  delete fieldErrors.value[field.key]
  field.onChange?.(form.value, previous)
  props.config.onChange?.(field.key, value, form.value, previous)
}
function describedBy(field: AdminField) {
  return (
    [
      field.hint && `field-hint-${field.key}`,
      fieldErrors.value[field.key] && `field-error-${field.key}`,
    ]
      .filter(Boolean)
      .join(' ') || undefined
  )
}
function unavailableOption(field: AdminField): string | null {
  const value = form.value[field.key]
  if (
    !editingRecord.value ||
    !field.key.endsWith('_id') ||
    !value ||
    field.options?.some((option) => option.value === value)
  )
    return null
  const reference = editingRecord.value[field.key.slice(0, -3)]
  const name =
    reference && typeof reference === 'object' && 'name' in reference
      ? String(reference.name)
      : 'Связанная запись'
  return `${name} (нет в списке)`
}
function showError(cause: unknown) {
  formError.value =
    cause instanceof ApiError && cause.code === 'publication_dependency'
      ? cause.detail || errorMessage(cause)
      : errorMessage(cause)
  conflict.value = cause instanceof ApiError && cause.code === 'stale_record'
  requestId.value = cause instanceof ApiError ? cause.requestId : null
  fieldErrors.value = {}
  if (cause instanceof ApiError) {
    for (const issue of cause.issues) {
      const key = issue.location?.replace(/^(body|query)\./, '').split('.')[0]
      if (key && props.config.fields.some((field) => field.key === key))
        fieldErrors.value[key] = (issue.message || 'Проверьте значение.').replace(
          /^Value error, /,
          '',
        )
      else if (issue.message) formError.value += ` ${issue.message.replace(/^Value error, /, '')}`
    }
  }
  nextTick(() => editor.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
}
async function reloadCurrent() {
  if (
    !editingId.value ||
    saving.value ||
    !window.confirm(
      'Загрузить актуальную версию? Ваши несохранённые изменения в этой форме будут потеряны.',
    )
  )
    return
  await loadEditorRecord(editingId.value, beginEditorAction())
}
const notice = ref('')
const savedPublicPath = ref('')
const focusAfterClose = ref<HTMLElement | null>(null)
const noticeElement = ref<HTMLElement | null>(null)
const createButton = ref<HTMLButtonElement | null>(null)
let initial = ''
const dirty = computed(() => JSON.stringify(form.value) !== initial)
watch(data, (result) => {
  if (result && page.value > Math.max(1, result.total_pages))
    page.value = Math.max(1, result.total_pages)
})
watch(
  () => route.query.edit,
  async (id) => {
    const context = beginEditorAction()
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return
    await nextTick()
    if (isCurrentEditor(context)) await loadEditorRecord(id, context)
  },
  { immediate: true },
)

function guardUnload(event: BeforeUnloadEvent) {
  if ((editor.value?.open || suspendedEditor) && (dirty.value || saving.value || uploading.value)) {
    event.preventDefault()
    event.returnValue = ''
  }
}
window.addEventListener('beforeunload', guardUnload)
onBeforeUnmount(() => {
  disposed = true
  invalidateEditor()
  window.removeEventListener('beforeunload', guardUnload)
})
function canLeave() {
  if (!editor.value?.open && !suspendedEditor) return true
  if (saving.value || uploading.value) return false
  return !dirty.value || window.confirm('Закрыть редактор? Несохранённые изменения будут потеряны.')
}
onBeforeRouteLeave(canLeave)
onBeforeRouteUpdate(canLeave)

async function open(row?: AdminRecord, requestedContext?: EditorContext) {
  if (requestedContext && !isCurrentEditor(requestedContext)) return
  if (saving.value || uploading.value || preparing.value) return
  const context = requestedContext ?? beginEditorAction()
  preparing.value = true
  preparingEditorGeneration = context.generation
  formError.value = ''
  try {
    await props.config.refreshReferences?.()
  } catch (cause) {
    if (isCurrentEditor(context)) showError(cause)
    return
  } finally {
    if (preparingEditorGeneration === context.generation) {
      preparingEditorGeneration = null
      preparing.value = false
    }
  }
  if (!isCurrentEditor(context)) return
  editorKey.value = context.generation
  editingVersion = typeof row?.updated_at === 'string' ? row.updated_at : undefined
  fieldErrors.value = {}
  conflict.value = false
  requestId.value = null
  focusAfterClose.value =
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  editingId.value = row?.id ?? null
  editingRecord.value = row ?? null
  createKey = row ? '' : crypto.randomUUID()
  form.value = { ...props.config.defaults }
  for (const field of props.config.fields) {
    const value =
      row?.[field.key] ??
      props.config.defaults[field.key] ??
      (field.type === 'checkbox' ? false : '')
    form.value[field.key] = value as FormValue
    if (field.type === 'datetime-local' && value) {
      const date = new Date(String(value))
      form.value[field.key] = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    }
  }
  initial = JSON.stringify(form.value)
  formError.value = ''
  await nextTick()
  editor.value?.showModal()
  editor.value?.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea')?.focus()
}

function returnFocus() {
  const target = focusAfterClose.value
  if (target?.isConnected) target.focus({ preventScroll: true })
  else createButton.value?.focus({ preventScroll: true })
}

function close(event?: Event) {
  event?.preventDefault()
  if (saving.value || uploading.value) return
  if (dirty.value && !window.confirm('Закрыть редактор? Несохранённые изменения будут потеряны.'))
    return
  invalidateEditor()
  editor.value?.close()
  createKey = ''
}

function preparePayload(values: Record<string, FormValue>) {
  const payload: Record<string, FormValue> = { ...props.config.defaults }
  for (const field of props.config.fields) {
    const value = values[field.key] ?? null
    payload[field.key] =
      field.type === 'number'
        ? value === '' || value === null
          ? null
          : Number(value)
        : field.type === 'checkbox'
          ? Boolean(value)
          : typeof value === 'string'
            ? value.trim() || null
            : value
  }
  return props.config.prepare ? props.config.prepare(payload) : payload
}

async function save() {
  if (saving.value || uploading.value) return
  invalidateEditor()
  saving.value = true
  formError.value = ''
  try {
    fieldErrors.value = {}
    requestId.value = null
    const fullBody = preparePayload(form.value)
    let body = fullBody
    if (editingId.value) {
      const originalBody = preparePayload(JSON.parse(initial) as Record<string, FormValue>)
      body = Object.fromEntries(
        Object.entries(fullBody).filter(
          ([key, value]) => JSON.stringify(value) !== JSON.stringify(originalBody[key]),
        ),
      )
      if (!Object.keys(body).length) {
        editor.value?.close()
        notice.value = 'Изменений нет.'
        return
      }
      if (editingVersion) body.expected_updated_at = editingVersion
    }
    const result = await mutate<ApiResponse<AdminRecord>>(
      `${props.config.endpoint}${editingId.value ? `/${editingId.value}` : ''}`,
      {
        method: editingId.value ? 'PATCH' : 'POST',
        ...(!editingId.value ? { headers: { 'Idempotency-Key': createKey } } : {}),
        body: JSON.stringify(body),
      },
    )
    editor.value?.close()
    createKey = ''
    const saved = result.data
    savedPublicPath.value =
      saved && props.config.publicPath
        ? typeof props.config.publicPath === 'function'
          ? saved.active === false
            ? ''
            : props.config.publicPath(saved)
          : props.config.publicPath
        : ''
    notice.value = editingId.value ? 'Изменения сохранены.' : 'Запись добавлена.'
    await load()
    emit('changed')
    await nextTick()
    noticeElement.value?.focus({ preventScroll: true })
  } catch (cause) {
    showError(cause)
  } finally {
    saving.value = false
  }
}

async function askDelete(row: AdminRecord) {
  if (saving.value || preparing.value) return
  focusAfterClose.value =
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  deleting.value = row
  formError.value = ''
  requestId.value = null
  deleteWarning.value = ''
  impactFailed.value = false
  deleteDialog.value?.showModal()
  const impact = props.config.deleteWarning ?? props.config.deleteImpact
  if (impact) {
    preparing.value = true
    try {
      deleteWarning.value = await impact(row)
    } catch (cause) {
      showError(cause)
      impactFailed.value = true
    } finally {
      preparing.value = false
    }
  }
}
async function remove() {
  if (!deleting.value || saving.value || preparing.value || impactFailed.value) return
  saving.value = true
  formError.value = ''
  try {
    const version = deleting.value.updated_at
    const suffix =
      typeof version === 'string' ? `?expected_updated_at=${encodeURIComponent(version)}` : ''
    await mutate(`${props.config.endpoint}/${deleting.value.id}${suffix}`, { method: 'DELETE' })
    deleteDialog.value?.close()
    notice.value = 'Запись перемещена в корзину. Её можно восстановить.'
    savedPublicPath.value = ''
    if (data.value?.items.length === 1 && page.value > 1) page.value--
    else await load()
    emit('changed')
    await nextTick()
    noticeElement.value?.focus({ preventScroll: true })
  } catch (cause) {
    showError(cause)
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <div v-show="user?.id === ownerId" class="admin-collection">
    <div
      v-if="config.allowDelete !== false"
      class="trash-switch"
      role="group"
      aria-label="Состояние записей"
    >
      <button
        type="button"
        class="quiet-button"
        :aria-pressed="!showingTrash"
        @click="showingTrash = false"
      >
        Записи
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
    <AdminTrash
      v-if="showingTrash"
      :entity="trashEntity"
      :query="config.query"
      @restored="restored"
      @edit="editRestored"
    />
    <template v-else>
      <div class="admin-section-heading">
        <div>
          <h2>{{ config.title }}</h2>
          <p>{{ config.description }}</p>
        </div>
        <button
          v-if="config.allowCreate !== false"
          ref="createButton"
          class="button"
          type="button"
          :disabled="preparing"
          @click="open()"
        >
          + {{ config.singular }}
        </button>
      </div>
      <form class="admin-filters" role="search" @submit.prevent="applySearch">
        <div class="form-field admin-filters__search">
          <label for="admin-search">Поиск в разделе</label>
          <input id="admin-search" v-model="search" type="search" placeholder="Название или имя" />
        </div>
        <div v-for="filter in config.filters" :key="filter.key" class="form-field">
          <label :for="`filter-${filter.key}`">{{ filter.label }}</label>
          <select
            :id="`filter-${filter.key}`"
            :value="filterValues[filter.key] || ''"
            @change="updateFilter(filter.key, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">Все</option>
            <option v-for="option in filter.options" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
        <button class="quiet-button" type="submit">Найти</button>
        <button
          v-if="search || appliedSearch || Object.values(filterValues).some(Boolean)"
          class="quiet-button"
          type="button"
          @click="clearFilters"
        >
          Сбросить
        </button>
      </form>
      <p v-if="formError && !editor?.open && !deleteDialog?.open" class="form-error" role="alert">
        {{ formError }}
      </p>
      <p v-if="data" class="admin-record-count">
        {{
          appliedSearch || Object.values(filterValues).some(Boolean)
            ? 'Найдено записей:'
            : 'Всего записей:'
        }}
        <strong>{{ data.total }}</strong>
      </p>
      <div
        v-if="notice"
        ref="noticeElement"
        class="form-success admin-save-notice"
        role="status"
        tabindex="-1"
      >
        <p>{{ notice }}</p>
        <a v-if="savedPublicPath" :href="savedPublicPath" target="_blank" rel="noopener noreferrer"
          >{{ config.publicLabel || 'Открыть на сайте' }} <span aria-hidden="true">↗</span
          ><span class="sr-only"> — в новой вкладке</span></a
        >
      </div>
      <AsyncState
        :pending="pending"
        :error="error"
        :empty="!data?.items.length"
        :empty-text="
          appliedSearch || Object.values(filterValues).some(Boolean)
            ? 'По заданным условиям ничего не найдено. Измените поиск или фильтры.'
            : 'Записей пока нет. Добавьте первую с помощью кнопки выше.'
        "
        @retry="load"
      >
        <div class="admin-records" :aria-label="config.title">
          <article v-for="row in data?.items" :key="row.id" class="admin-record-card">
            <div class="admin-record-card__heading">
              <h3>{{ config.columns[0]?.value(row) }}</h3>
              <span
                v-if="typeof row.active === 'boolean'"
                class="admin-record-card__status"
                :class="{ 'admin-record-card__status--hidden': !row.active }"
                >{{ row.active ? 'На сайте' : 'Скрыто' }}</span
              >
            </div>
            <dl>
              <div
                v-for="column in config.columns
                  .slice(1)
                  .filter((column) => column.label !== 'Публикация')"
                :key="column.label"
              >
                <dt>{{ column.label }}</dt>
                <dd>{{ column.value(row) }}</dd>
              </div>
            </dl>
            <div class="row-actions">
              <button
                type="button"
                class="quiet-button"
                :aria-label="`Изменить: ${config.columns[0]?.value(row)}`"
                @click="open(row)"
              >
                Изменить
              </button>
              <button
                type="button"
                class="quiet-button quiet-button--danger"
                :aria-label="`Удалить: ${config.columns[0]?.value(row)}`"
                v-if="config.allowDelete !== false"
                @click="askDelete(row)"
              >
                Удалить
              </button>
            </div>
          </article>
        </div>
        <div class="table-wrap admin-table" tabindex="0" :aria-label="config.title">
          <table>
            <thead>
              <tr>
                <th v-for="column in config.columns" :key="column.label" scope="col">
                  {{ column.label }}
                </th>
                <th scope="col">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in data?.items" :key="row.id">
                <td v-for="column in config.columns" :key="column.label">
                  {{ column.value(row) }}
                </td>
                <td>
                  <div class="row-actions">
                    <button
                      type="button"
                      class="quiet-button"
                      :aria-label="`Изменить: ${config.columns[0]?.value(row)}`"
                      @click="open(row)"
                    >
                      Изменить</button
                    ><button
                      type="button"
                      class="quiet-button quiet-button--danger"
                      :aria-label="`Удалить: ${config.columns[0]?.value(row)}`"
                      v-if="config.allowDelete !== false"
                      @click="askDelete(row)"
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AsyncState>
      <nav v-if="data && data.total_pages > 1" class="pagination" aria-label="Страницы записей">
        <button type="button" class="quiet-button" :disabled="page <= 1 || pending" @click="page--">
          ← Назад</button
        ><span
          ><strong>{{ page }} / {{ data.total_pages }}</strong
          ><small>страница</small></span
        ><button
          type="button"
          class="quiet-button"
          :disabled="page >= data.total_pages || pending"
          @click="page++"
        >
          Далее →
        </button>
      </nav>
      <div v-if="data && data.total_pages > 2" class="admin-page-jump">
        <label for="admin-page">Перейти на страницу</label>
        <input
          id="admin-page"
          :value="page"
          type="number"
          min="1"
          :max="data.total_pages"
          :disabled="pending"
          @change="
            page = Math.max(
              1,
              Math.min(data.total_pages, Number(($event.target as HTMLInputElement).value) || 1),
            )
          "
        />
      </div>
      <dialog
        ref="editor"
        class="editor-dialog"
        aria-labelledby="editor-title"
        @cancel="close"
        @close="returnFocus"
      >
        <form class="admin-form" @submit.prevent="save">
          <div class="dialog-heading">
            <div>
              <p class="eyebrow">{{ config.title }}</p>
              <h2 id="editor-title">{{ editingId ? 'Редактировать запись' : config.singular }}</h2>
            </div>
            <button
              type="button"
              class="icon-button"
              aria-label="Закрыть редактор"
              :disabled="saving || uploading"
              @click="close"
            >
              ×
            </button>
          </div>
          <div class="admin-editor__body">
            <p class="admin-editor__hint">* Обязательные поля</p>
            <div class="form-grid">
              <div
                v-for="field in config.fields"
                :key="field.key"
                class="form-field"
                :class="{ 'form-field--wide': ['textarea', 'image'].includes(field.type || '') }"
              >
                <template v-if="field.type === 'checkbox'"
                  ><label class="checkbox-label"
                    ><input
                      :checked="Boolean(form[field.key])"
                      type="checkbox"
                      :disabled="saving"
                      @change="updateField(field, ($event.target as HTMLInputElement).checked)"
                    />{{ field.label }}</label
                  ></template
                >
                <template v-else>
                  <label :for="`field-${field.key}`"
                    >{{ field.label
                    }}<span v-if="field.required" aria-hidden="true"> *</span></label
                  >
                  <textarea
                    v-if="field.type === 'textarea'"
                    :id="`field-${field.key}`"
                    :value="String(form[field.key] ?? '')"
                    :required="field.required"
                    :maxlength="field.maxLength"
                    :disabled="saving"
                    :aria-describedby="describedBy(field)"
                    :aria-invalid="Boolean(fieldErrors[field.key]) || undefined"
                    rows="6"
                    @input="updateField(field, ($event.target as HTMLTextAreaElement).value)"
                  />
                  <select
                    v-else-if="field.type === 'select'"
                    :id="`field-${field.key}`"
                    :value="form[field.key]"
                    @change="updateField(field, ($event.target as HTMLSelectElement).value)"
                    :required="field.required"
                    :disabled="saving"
                    :aria-describedby="describedBy(field)"
                    :aria-invalid="Boolean(fieldErrors[field.key]) || undefined"
                  >
                    <option value="">Выберите…</option>
                    <option v-if="unavailableOption(field)" :value="form[field.key]" disabled>
                      {{ unavailableOption(field) }}
                    </option>
                    <option
                      v-for="option in field.options"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                  <ImagePicker
                    :key="`${editorKey}-${field.key}`"
                    v-else-if="field.type === 'image'"
                    :id="`field-${field.key}`"
                    :model-value="form[field.key] ?? null"
                    :media="media"
                    :disabled="saving"
                    @update:model-value="updateField(field, $event)"
                    @uploaded="emit('media-changed')"
                    @busy="uploads = Math.max(0, uploads + ($event ? 1 : -1))"
                  />
                  <input
                    v-else
                    :id="`field-${field.key}`"
                    :value="form[field.key]"
                    @input="updateField(field, ($event.target as HTMLInputElement).value)"
                    :type="field.type || 'text'"
                    :required="field.required"
                    :maxlength="field.maxLength"
                    :min="field.min"
                    :max="field.max"
                    :disabled="saving"
                    :step="field.type === 'number' ? (field.step ?? 1) : undefined"
                    :inputmode="
                      field.type === 'number'
                        ? field.step === 'any'
                          ? 'decimal'
                          : 'numeric'
                        : undefined
                    "
                    :aria-describedby="describedBy(field)"
                    :aria-invalid="Boolean(fieldErrors[field.key]) || undefined"
                  />
                </template>
                <small
                  v-if="fieldErrors[field.key]"
                  :id="`field-error-${field.key}`"
                  class="form-error"
                  >{{ fieldErrors[field.key] }}</small
                >
                <small v-if="field.hint" :id="`field-hint-${field.key}`">{{ field.hint }}</small>
              </div>
            </div>
            <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
            <div v-if="conflict" class="row-actions">
              <a
                :href="`/admin?tab=${route.query.tab || 'players'}&edit=${editingId}`"
                target="_blank"
                rel="noopener noreferrer"
                >Сравнить с актуальной записью ↗</a
              >
              <button type="button" class="quiet-button" :disabled="saving" @click="reloadCurrent">
                Загрузить актуальную версию
              </button>
            </div>
            <small v-if="requestId" class="form-hint">Код обращения: {{ requestId }}</small>
          </div>
          <div class="dialog-actions">
            <span class="form-hint">* Обязательные поля</span
            ><button
              class="quiet-button"
              type="button"
              :disabled="saving || uploading"
              @click="close"
            >
              Отмена</button
            ><button class="button" type="submit" :disabled="saving || uploading">
              {{ saving ? 'Сохраняем…' : uploading ? 'Загружаем фото…' : 'Сохранить' }}
            </button>
          </div>
        </form>
      </dialog>
      <dialog
        ref="deleteDialog"
        class="editor-dialog editor-dialog--small admin-confirm-dialog"
        aria-labelledby="delete-title"
        @cancel="saving && $event.preventDefault()"
        @close="returnFocus"
      >
        <h2 id="delete-title">Удалить запись?</h2>
        <p class="delete-record-name">{{ deleting && config.columns[0]?.value(deleting) }}</p>
        <p>
          {{
            deleteWarning ||
            'Запись исчезнет с сайта и попадёт в корзину. Вы сможете восстановить её без автоматической публикации.'
          }}
        </p>
        <p v-if="preparing" role="status">Проверяем связанные данные…</p>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <small v-if="requestId" class="form-hint">Код обращения: {{ requestId }}</small>
        <div class="dialog-actions">
          <button
            type="button"
            class="quiet-button"
            :disabled="saving"
            autofocus
            @click="deleteDialog?.close()"
          >
            Отмена</button
          ><button
            type="button"
            class="button"
            :disabled="saving || preparing || impactFailed"
            @click="remove"
          >
            {{ saving ? 'Удаляем…' : 'Удалить' }}
          </button>
        </div>
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
.admin-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: end;
  margin-bottom: 20px;
}
.admin-filters .form-field {
  min-width: 160px;
  flex: 1;
}
.admin-filters__search {
  flex: 2 !important;
}
.admin-filters input,
.admin-filters select {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #bbcddd;
  border-radius: 8px;
  background: white;
}
.admin-filters label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.8rem;
  color: #52677b;
}
.admin-page-jump {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 12px;
  color: #52677b;
  font-size: 0.8rem;
}
.admin-page-jump input {
  width: 84px;
  min-height: 44px;
  padding: 10px;
  border: 1px solid #bbcddd;
  border-radius: 8px;
}

.admin-record-count {
  margin: -10px 0 20px;
  color: #52677b;
  font-size: 0.78rem;
}
.admin-record-count strong {
  color: var(--navy);
}
.admin-save-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 20px;
  padding: 12px 16px;
  border: 1px solid #c8e1d3;
  border-radius: 12px;
}
.admin-save-notice p {
  margin: 0;
}
.admin-save-notice a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  color: #245c45;
  font-weight: 700;
  line-height: 1.5;
  text-decoration: underline;
  text-underline-offset: 3px;
  overflow-wrap: anywhere;
}
.admin-save-notice:focus-visible {
  outline: 3px solid #597fa5;
  outline-offset: 3px;
}
.admin-records {
  display: none;
}
.pagination > span {
  text-align: center;
}
.pagination strong {
  font-weight: 700;
}
.pagination small {
  display: block;
  margin-top: 3px;
  color: #52677b;
  font-size: 0.7rem;
}
@media (max-width: 900px) {
  .admin-record-count {
    margin: -6px 0 16px;
  }
  .admin-table {
    display: none;
  }
  .admin-records {
    display: grid;
    gap: 12px;
  }
  .admin-record-card {
    min-width: 0;
    padding: 18px;
    border: 1px solid #d8e2eb;
    border-radius: 16px;
    background: white;
    box-shadow: 0 4px 16px #042a4e03;
  }
  .admin-record-card__heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 12px;
  }
  .admin-record-card h3 {
    min-width: 0;
    margin: 0;
    font-family: 'Roboto', sans-serif;
    font-size: 0.98rem;
    font-weight: 700;
    line-height: 1.5;
    text-transform: none;
    overflow-wrap: anywhere;
  }
  .admin-record-card__status {
    flex-shrink: 0;
    padding: 5px 8px;
    border-radius: 7px;
    color: #27624d;
    background: #eaf5ee;
    font-size: 0.65rem;
    font-weight: 700;
    line-height: 1.4;
    white-space: nowrap;
  }
  .admin-record-card__status--hidden {
    color: #526477;
    background: #eef2f6;
  }
  .admin-record-card dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px 18px;
    padding: 16px 0;
    margin: 0;
  }
  .admin-record-card dl > div {
    min-width: 0;
  }
  .admin-record-card dt {
    margin-bottom: 4px;
    color: #52677b;
    font-size: 0.7rem;
    line-height: 1.5;
  }
  .admin-record-card dd {
    margin: 0;
    color: var(--navy);
    font-size: 0.82rem;
    font-weight: 500;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  .admin-record-card .row-actions {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: 10px;
    padding-top: 14px;
    border-top: 1px solid #e5ebf1;
  }
  .admin-record-card .quiet-button {
    min-width: 0;
    min-height: 44px;
    border-radius: 10px;
    font-size: 0.8rem;
  }
  .admin-record-card .quiet-button:first-child {
    color: #123d65;
    border-color: #d3e0ed;
    background: #eff5fb;
  }
  .pagination {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: 12px;
    margin-top: 22px;
  }
  .pagination > button {
    min-width: 0;
    min-height: 44px;
    padding-inline: 10px;
    border-radius: 10px;
  }
}
</style>
