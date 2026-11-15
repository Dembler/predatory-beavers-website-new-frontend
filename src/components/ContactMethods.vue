<script setup lang="ts">
import { safeContactUrl, isWebContact } from '@/shared/contactLinks'
defineProps<{ contacts: { label: string; value: string; url?: string | null }[] }>()
</script>
<template>
  <dl v-if="contacts.length" class="contact-methods">
    <div v-for="(contact, index) in contacts" :key="index">
      <dt>{{ contact.label }}</dt>
      <dd>
        <a
          v-if="safeContactUrl(contact.url)"
          :href="safeContactUrl(contact.url)"
          :target="isWebContact(contact.url) ? '_blank' : undefined"
          rel="noopener noreferrer"
          >{{ contact.value }}</a
        >
        <span v-else>{{ contact.value }}</span>
      </dd>
    </div>
  </dl>
</template>
<style scoped>
.contact-methods {
  display: grid;
  gap: 12px;
  margin: 20px 0 0;
}
dt {
  color: #52677b;
  font-size: 0.8rem;
}
dd {
  margin: 3px 0 0;
  overflow-wrap: anywhere;
}
a {
  color: var(--navy);
  text-decoration: underline;
  text-underline-offset: 3px;
  display: inline-flex;
  align-items: center;
  min-height: 32px;
}
</style>
