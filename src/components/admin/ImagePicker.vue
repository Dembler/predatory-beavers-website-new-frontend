<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { apiRequest, mediaUrl } from '@/shared/api'
import { errorMessage } from '@/shared/admin'
import { useAuth } from '@/composables/useAuth'
import type { ApiResponse, Media, Page } from '@/shared/types'

const props = defineProps<{
  modelValue: string | number | boolean | null
  media: Media[]
  id: string
  disabled?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  uploaded: []
  busy: [value: boolean]
}>()
const { mutate } = useAuth()
const pending = ref(false)
const error = ref('')
const notice = ref('')
const uploaded = ref<Media | null>(null)
const expanded = ref(false)
const search = ref('')
const library = ref<Media[]>([])
const libraryPage = ref(1)
const libraryTotal = ref(0)
const libraryPending = ref(false)
const libraryError = ref('')
const resolvedAsset = ref<Media | null>(null)
let libraryGeneration = 0
let selectionGeneration = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined
const assets = computed(() => {
  const items = [...props.media]
  if (uploaded.value && !items.some((item) => item.id === uploaded.value?.id))
    items.unshift(uploaded.value)
  return items
})
const selected = computed(
  () =>
    assets.value.find((item) => item.id === props.modelValue) ??
    library.value.find((item) => item.id === props.modelValue) ??
    (resolvedAsset.value?.id === props.modelValue ? resolvedAsset.value : null),
)
watch(
  () => props.modelValue,
  async (id) => {
    const generation = ++selectionGeneration
    if (!id || selected.value) return
    try {
      const result = await apiRequest<ApiResponse<Media>>(
        `/api/v1/admin/media/${encodeURIComponent(String(id))}`,
      )
      if (generation === selectionGeneration) resolvedAsset.value = result.data
    } catch (cause) {
      if (generation === selectionGeneration) error.value = errorMessage(cause)
    }
  },
  { immediate: true },
)
async function loadLibrary(append = false) {
  const generation = ++libraryGeneration
  libraryPending.value = true
  libraryError.value = ''
  if (!append) {
    libraryPage.value = 1
    library.value = []
  }
  try {
    const result = await apiRequest<Page<Media>>(
      `/api/v1/admin/media?page=${libraryPage.value}&page_size=12&q=${encodeURIComponent(search.value.trim())}`,
    )
    if (generation !== libraryGeneration) return
    library.value = append ? [...library.value, ...result.items] : result.items
    libraryTotal.value = result.total
  } catch (cause) {
    if (generation === libraryGeneration) libraryError.value = errorMessage(cause)
  } finally {
    if (generation === libraryGeneration) libraryPending.value = false
  }
}
function toggleLibrary() {
  expanded.value = !expanded.value
  if (expanded.value) void loadLibrary()
}
function nextPage() {
  libraryPage.value++
  void loadLibrary(true)
}
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (expanded.value) void loadLibrary()
  }, 250)
})
onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  libraryGeneration++
  selectionGeneration++
})
function select(id: string | null) {
  error.value = ''
  notice.value = ''
  resolvedAsset.value = library.value.find((item) => item.id === id) ?? null
  emit('update:modelValue', id)
  expanded.value = false
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || props.disabled || pending.value) return
  error.value = ''
  notice.value = ''
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  ) {
    error.value = 'Выберите JPEG, PNG или WebP размером до 8 МБ.'
    input.value = ''
    return
  }
  pending.value = true
  emit('busy', true)
  try {
    const body = new FormData()
    body.append('file', file)
    body.append('alt_text', file.name.replace(/\.[^.]+$/, '').slice(0, 200))
    const result = await mutate<ApiResponse<Media & { reused?: boolean }>>('/api/v1/admin/media', {
      method: 'POST',
      body,
    })
    if (result.data) {
      uploaded.value = result.data
      emit('update:modelValue', result.data.id)
      notice.value = result.data.reused
        ? 'Это фото уже есть в медиатеке. Выбрана существующая фотография с прежним описанием.'
        : 'Фото загружено. Сохраните запись, чтобы опубликовать его на сайте.'
      emit('uploaded')
    }
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    pending.value = false
    emit('busy', false)
    input.value = ''
  }
}
</script>
<template>
  <div class="image-picker">
    <div v-if="selected" class="image-picker__selection">
      <img
        class="image-picker__preview"
        :src="mediaUrl(selected.content_url)"
        :alt="selected.alt_text || 'Предпросмотр фотографии'"
      />
      <div>
        <p>{{ selected.alt_text || 'Изображение без описания' }}</p>
        <button
          type="button"
          class="quiet-button"
          :disabled="pending || disabled"
          @click="select(null)"
        >
          Убрать
        </button>
      </div>
    </div>
    <button
      :id="id"
      type="button"
      class="quiet-button"
      :disabled="pending || disabled"
      :aria-expanded="expanded"
      :aria-controls="`${id}-library`"
      @click="toggleLibrary"
    >
      {{ selected ? 'Выбрать другое фото' : 'Выбрать из медиатеки' }}
    </button>
    <div v-if="expanded" :id="`${id}-library`" class="image-picker__library">
      <label :for="`${id}-search`">Поиск фотографии</label>
      <input
        :id="`${id}-search`"
        v-model="search"
        type="search"
        placeholder="Описание фотографии"
      />
      <p v-if="libraryPending" role="status">Загружаем фотографии…</p>
      <p v-if="libraryError" class="form-error" role="alert">
        {{ libraryError }}
        <button class="quiet-button" type="button" @click="loadLibrary()">Повторить</button>
      </p>
      <p v-if="!libraryPending && !libraryError && !library.length" role="status">
        Фотографии не найдены.
      </p>
      <div class="image-picker__grid" role="group" aria-label="Фотографии из медиатеки">
        <button
          v-for="item in library"
          :key="item.id"
          type="button"
          class="image-picker__asset"
          :aria-pressed="item.id === modelValue"
          :disabled="pending || disabled"
          @click="select(item.id)"
        >
          <img :src="mediaUrl(item.content_url)" alt="" loading="lazy" />
          <span>{{ item.alt_text || `Без описания · ${item.id.slice(0, 8)}` }}</span>
        </button>
      </div>
      <button
        v-if="libraryTotal > library.length && !libraryError"
        class="quiet-button"
        type="button"
        :disabled="libraryPending"
        @click="nextPage"
      >
        Ещё фотографии ({{ libraryTotal - library.length }})
      </button>
    </div>
    <label class="file-button" :class="{ 'file-button--disabled': pending || disabled }">
      {{ pending ? 'Загружаем…' : 'Загрузить новое фото' }}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        :disabled="pending || disabled"
        @change="upload"
      />
    </label>
    <small
      >JPEG, PNG, WebP · до 8 МБ. Загрузка сохраняет фото в медиатеке; публикация зависит от
      записи.</small
    >
    <span v-if="notice" role="status">{{ notice }}</span>
    <span v-if="error" class="form-error" role="alert">{{ error }}</span>
  </div>
</template>
<style scoped>
.image-picker {
  display: grid;
  min-width: 0;
  width: 100%;
  gap: 12px;
}
.image-picker__selection {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 16px;
}
.image-picker__selection > div {
  min-width: 0;
}
.image-picker__selection p {
  margin: 0 0 10px;
  color: #52677b;
  font-size: 0.8rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.image-picker__preview {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 10px;
}
.image-picker__library {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid #bbcddd;
  border-radius: 10px;
  background: #f8fafc;
}
.image-picker__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.image-picker__asset {
  padding: 5px;
  min-width: 0;
  border: 2px solid transparent;
  border-radius: 8px;
  color: var(--navy);
  background: white;
  cursor: pointer;
}
.image-picker__asset[aria-pressed='true'] {
  border-color: #245c45;
}
.image-picker__asset img {
  width: 100%;
  height: 88px;
  object-fit: cover;
  border-radius: 4px;
}
.image-picker__asset span {
  display: block;
  margin-top: 5px;
  font-size: 0.7rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.image-picker__asset:focus-visible {
  outline: 3px solid #597fa5;
  outline-offset: 2px;
}
.image-picker > [role='status'] {
  color: #245c45;
  font-size: 0.8rem;
  line-height: 1.5;
}
.file-button--disabled {
  opacity: 0.6;
  cursor: wait;
}
@media (max-width: 900px) {
  .image-picker {
    padding: 14px;
    border: 1px solid #d8e2eb;
    border-radius: 12px;
    background: #f8fafc;
  }
  .image-picker__selection {
    gap: 12px;
  }
  .image-picker__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .image-picker .file-button,
  .image-picker > button {
    width: 100%;
    min-height: 46px;
    text-align: center;
  }
}
</style>
