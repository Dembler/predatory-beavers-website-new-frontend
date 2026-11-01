<script setup lang="ts">
import { computed, ref } from 'vue'
import { mediaUrl } from '@/shared/api'
import { errorMessage } from '@/shared/admin'
import { useAuth } from '@/composables/useAuth'
import type { ApiResponse, Media } from '@/shared/types'

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
const uploaded = ref<Media | null>(null)
const selected = computed(
  () =>
    props.media.find((item) => item.id === props.modelValue) ??
    (uploaded.value?.id === props.modelValue ? uploaded.value : null),
)

async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || props.disabled || pending.value) return
  error.value = ''
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
    const result = await mutate<ApiResponse<Media>>('/api/v1/admin/media', { method: 'POST', body })
    if (result.data) {
      uploaded.value = result.data
      emit('update:modelValue', result.data.id)
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
        <p>{{ selected.alt_text || 'Изображение выбрано' }}</p>
        <button
          type="button"
          class="quiet-button"
          :disabled="pending || disabled"
          @click="emit('update:modelValue', null)"
        >
          Убрать
        </button>
      </div>
    </div>
    <select
      :id="id"
      :value="modelValue ?? ''"
      :disabled="pending || disabled"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">Без изображения</option>
      <option
        v-if="uploaded && !media.some((item) => item.id === uploaded?.id)"
        :value="uploaded.id"
      >
        {{ uploaded.alt_text || 'Новое фото' }}
      </option>
      <option v-for="item in media" :key="item.id" :value="item.id">
        {{ item.alt_text || `Фото ${item.id.slice(0, 8)}` }}
      </option>
    </select>
    <label class="file-button" :class="{ 'file-button--disabled': pending || disabled }"
      >{{ pending ? 'Загружаем…' : 'Загрузить новое фото'
      }}<input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        :disabled="pending || disabled"
        @change="upload"
    /></label>
    <small>JPEG, PNG, WebP · до 8 МБ</small>
    <span v-if="error" class="form-error" role="alert">{{ error }}</span>
  </div>
</template>

<style scoped>
.image-picker {
  min-width: 0;
  width: 100%;
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
}
.image-picker > select {
  min-width: 0;
  max-width: 100%;
  text-overflow: ellipsis;
}
.file-button--disabled {
  opacity: 0.6;
  cursor: wait;
}
@media (max-width: 900px) {
  .image-picker {
    gap: 12px;
    padding: 14px;
    border: 1px solid #d8e2eb;
    border-radius: 12px;
    background: #f8fafc;
  }
  .image-picker__selection {
    gap: 12px;
  }
  .image-picker__preview {
    width: 68px;
    height: 68px;
    border-radius: 10px;
  }
  .image-picker__selection p {
    margin-bottom: 6px;
    font-size: 0.75rem;
  }
  .image-picker__selection button {
    min-height: 44px;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.75rem;
  }
  .image-picker .file-button {
    width: 100%;
    min-height: 46px;
    padding-inline: 10px;
    border-radius: 10px;
    text-align: center;
  }
}
</style>
