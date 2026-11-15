<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: string | number | boolean | null
  id: string
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
interface Contact {
  label: string
  value: string
  url: string | null
}
const contacts = computed<Contact[]>(() => {
  try {
    return JSON.parse(String(props.modelValue || '[]'))
  } catch {
    return []
  }
})
function change(index: number, field: keyof Contact, value: string) {
  emit(
    'update:modelValue',
    JSON.stringify(
      contacts.value.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    ),
  )
}
function add() {
  emit(
    'update:modelValue',
    JSON.stringify([...contacts.value, { label: '', value: '', url: null }]),
  )
}
function remove(index: number) {
  emit('update:modelValue', JSON.stringify(contacts.value.filter((_, i) => i !== index)))
}
</script>

<template>
  <div :id="id" class="contact-editor">
    <fieldset v-for="(contact, index) in contacts" :key="index" :disabled="disabled">
      <legend>Контакт {{ index + 1 }}</legend>
      <label :for="`${id}-${index}-label`">Название *</label>
      <input
        :id="`${id}-${index}-label`"
        :value="contact.label"
        required
        maxlength="80"
        placeholder="Например: Telegram, телефон, почта"
        @input="change(index, 'label', ($event.target as HTMLInputElement).value)"
      />
      <label :for="`${id}-${index}-value`">Контакт или подпись *</label>
      <input
        :id="`${id}-${index}-value`"
        :value="contact.value"
        required
        maxlength="500"
        placeholder="@username, +7… или адрес почты"
        @input="change(index, 'value', ($event.target as HTMLInputElement).value)"
      />
      <label :for="`${id}-${index}-url`">Ссылка</label>
      <input
        :id="`${id}-${index}-url`"
        :value="contact.url"
        maxlength="2048"
        placeholder="https://… · tel:+7… · mailto:…"
        @input="change(index, 'url', ($event.target as HTMLInputElement).value)"
      />
      <button type="button" class="btn btn--outline" @click="remove(index)">
        Удалить контакт {{ index + 1 }}
      </button>
    </fieldset>
    <button
      type="button"
      class="btn btn--outline"
      :disabled="disabled || contacts.length >= 20"
      @click="add"
    >
      Добавить контакт
    </button>
  </div>
</template>

<style scoped>
.contact-editor {
  display: grid;
  gap: 16px;
}
fieldset {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 16px;
  border: 1px solid #cbd7e2;
  border-radius: 8px;
}
legend {
  padding: 0 6px;
  font-weight: 600;
}
button {
  justify-self: start;
  margin-top: 8px;
}
</style>
