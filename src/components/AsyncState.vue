<script setup lang="ts">
withDefaults(
  defineProps<{ pending: boolean; error: boolean; empty?: boolean; emptyText?: string }>(),
  { emptyText: 'Здесь пока нет опубликованных записей.' },
)
defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="pending" class="skeleton-grid" role="status" aria-label="Загрузка" aria-busy="true">
    <span v-for="item in 3" :key="item" class="skeleton" />
  </div>
  <div v-else-if="error" class="state-panel" role="alert">
    <p><strong>Не удалось загрузить данные.</strong> Попробуйте ещё раз.</p>
    <button class="state-panel__retry" type="button" @click="$emit('retry')">Повторить →</button>
  </div>
  <div v-else-if="empty" class="state-panel" role="status">
    <p>{{ emptyText }}</p>
  </div>
  <slot v-else />
</template>
