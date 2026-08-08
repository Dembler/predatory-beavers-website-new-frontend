<script setup lang="ts">
defineProps<{ pending: boolean; error: boolean; empty?: boolean }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="pending" class="skeleton-grid" aria-label="Загрузка">
    <span v-for="item in 3" :key="item" class="skeleton" />
  </div>
  <div v-else-if="error" class="state-panel">
    <p><strong>Данные временно недоступны.</strong> Запустите backend и обновите блок.</p>
    <button class="state-panel__retry" type="button" @click="$emit('retry')">Повторить →</button>
  </div>
  <div v-else-if="empty" class="state-panel"><p>Здесь пока нет данных.</p></div>
  <slot v-else />
</template>
