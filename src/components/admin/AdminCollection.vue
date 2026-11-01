<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import AsyncState from '@/components/AsyncState.vue'
import ImagePicker from './ImagePicker.vue'
import { useLoad } from '@/composables/useLoad'
import { useAuth } from '@/composables/useAuth'
import { apiRequest } from '@/shared/api'
import { errorMessage, type AdminConfig, type AdminRecord, type FormValue } from '@/shared/admin'
import type { ApiResponse, Media, Page } from '@/shared/types'

const props = defineProps<{ config: AdminConfig; media: Media[] }>()
const emit = defineEmits<{ changed: []; 'media-changed': [] }>()
const { mutate } = useAuth()
const page = ref(1)
const { data, pending, error, load } = useLoad(
  () =>
    apiRequest<Page<AdminRecord>>(
      `${props.config.endpoint}?page=${page.value}&page_size=15${props.config.query ? `&${props.config.query}` : ''}`,
    ),
  [page],
)
const editor = ref<HTMLDialogElement | null>(null)
const deleteDialog = ref<HTMLDialogElement | null>(null)
const form = ref<Record<string, FormValue>>({})
const editingId = ref<string | null>(null)
const deleting = ref<AdminRecord | null>(null)
const saving = ref(false)
const uploads = ref(0)
const uploading = computed(() => uploads.value > 0)
const formError = ref('')
const notice = ref('')
const savedPublicPath = ref('')
const focusAfterClose = ref<HTMLElement | null>(null)
const noticeElement = ref<HTMLElement | null>(null)
const createButton = ref<HTMLButtonElement | null>(null)
let initial = ''
const dirty = computed(() => JSON.stringify(form.value) !== initial)

function guardUnload(event: BeforeUnloadEvent) {
  if (editor.value?.open && (dirty.value || saving.value || uploading.value)) {
    event.preventDefault()
    event.returnValue = ''
  }
}
window.addEventListener('beforeunload', guardUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', guardUnload))
function canLeave() {
  if (!editor.value?.open) return true
  if (saving.value || uploading.value) return false
  return !dirty.value || window.confirm('Закрыть редактор? Несохранённые изменения будут потеряны.')
}
onBeforeRouteLeave(canLeave)
onBeforeRouteUpdate(canLeave)

async function open(row?: AdminRecord) {
  if (saving.value || uploading.value) return
  focusAfterClose.value =
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  editingId.value = row?.id ?? null
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
  editor.value?.close()
}

async function save() {
  if (saving.value || uploading.value) return
  saving.value = true
  formError.value = ''
  try {
    const payload: Record<string, FormValue> = { ...props.config.defaults }
    for (const field of props.config.fields) {
      const value = form.value[field.key] ?? null
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
    const body = props.config.prepare ? props.config.prepare(payload) : payload
    const result = await mutate<ApiResponse<AdminRecord>>(
      `${props.config.endpoint}${editingId.value ? `/${editingId.value}` : ''}`,
      {
        method: editingId.value ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      },
    )
    editor.value?.close()
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
    formError.value = errorMessage(cause)
  } finally {
    saving.value = false
  }
}

function askDelete(row: AdminRecord) {
  focusAfterClose.value =
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  deleting.value = row
  formError.value = ''
  deleteDialog.value?.showModal()
}
async function remove() {
  if (!deleting.value || saving.value) return
  saving.value = true
  formError.value = ''
  try {
    await mutate(`${props.config.endpoint}/${deleting.value.id}`, { method: 'DELETE' })
    deleteDialog.value?.close()
    notice.value = 'Запись удалена.'
    savedPublicPath.value = ''
    if (data.value?.items.length === 1 && page.value > 1) page.value--
    else await load()
    emit('changed')
    await nextTick()
    noticeElement.value?.focus({ preventScroll: true })
  } catch (cause) {
    formError.value = errorMessage(cause)
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <div class="admin-collection">
    <div class="admin-section-heading">
      <div>
        <h2>{{ config.title }}</h2>
        <p>{{ config.description }}</p>
      </div>
      <button ref="createButton" class="button" type="button" @click="open()">
        + {{ config.singular }}
      </button>
    </div>
    <p v-if="data" class="admin-record-count">
      Всего записей: <strong>{{ data.total }}</strong>
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
      empty-text="Записей пока нет. Добавьте первую с помощью кнопки выше."
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
              <td v-for="column in config.columns" :key="column.label">{{ column.value(row) }}</td>
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
                  ><input v-model="form[field.key]" type="checkbox" :disabled="saving" />{{
                    field.label
                  }}</label
                ></template
              >
              <template v-else>
                <label :for="`field-${field.key}`"
                  >{{ field.label }}<span v-if="field.required" aria-hidden="true"> *</span></label
                >
                <textarea
                  v-if="field.type === 'textarea'"
                  :id="`field-${field.key}`"
                  :value="String(form[field.key] ?? '')"
                  :required="field.required"
                  :maxlength="field.maxLength"
                  :disabled="saving"
                  :aria-describedby="field.hint ? `field-hint-${field.key}` : undefined"
                  rows="6"
                  @input="form[field.key] = ($event.target as HTMLTextAreaElement).value"
                />
                <select
                  v-else-if="field.type === 'select'"
                  :id="`field-${field.key}`"
                  v-model="form[field.key]"
                  :required="field.required"
                  :disabled="saving"
                  :aria-describedby="field.hint ? `field-hint-${field.key}` : undefined"
                >
                  <option value="">Выберите…</option>
                  <option v-for="option in field.options" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
                <ImagePicker
                  v-else-if="field.type === 'image'"
                  :id="`field-${field.key}`"
                  :model-value="form[field.key] ?? null"
                  :media="media"
                  :disabled="saving"
                  @update:model-value="form[field.key] = $event"
                  @uploaded="emit('media-changed')"
                  @busy="uploads = Math.max(0, uploads + ($event ? 1 : -1))"
                />
                <input
                  v-else
                  :id="`field-${field.key}`"
                  v-model="form[field.key]"
                  :type="field.type || 'text'"
                  :required="field.required"
                  :maxlength="field.maxLength"
                  :min="field.min"
                  :max="field.max"
                  :disabled="saving"
                  :step="field.type === 'number' ? 1 : undefined"
                  :inputmode="field.type === 'number' ? 'numeric' : undefined"
                  :aria-describedby="field.hint ? `field-hint-${field.key}` : undefined"
                />
              </template>
              <small v-if="field.hint" :id="`field-hint-${field.key}`">{{ field.hint }}</small>
            </div>
          </div>
          <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
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
      class="editor-dialog editor-dialog--small admin-delete-dialog"
      aria-labelledby="delete-title"
      @cancel="saving && $event.preventDefault()"
      @close="returnFocus"
    >
      <h2 id="delete-title">Удалить запись?</h2>
      <p class="delete-record-name">{{ deleting && config.columns[0]?.value(deleting) }}</p>
      <p>Запись исчезнет с сайта. Это действие нельзя отменить.</p>
      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      <div class="dialog-actions">
        <button
          type="button"
          class="quiet-button"
          :disabled="saving"
          autofocus
          @click="deleteDialog?.close()"
        >
          Отмена</button
        ><button type="button" class="button" :disabled="saving" @click="remove">
          {{ saving ? 'Удаляем…' : 'Удалить' }}
        </button>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
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
