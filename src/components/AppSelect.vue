<script setup lang="ts" generic="T extends string">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

type SelectOption = { value: T; label: string; disabled?: boolean }

const props = withDefaults(
  defineProps<{
    modelValue: T
    label: string
    options: readonly SelectOption[]
    disabled?: boolean
  }>(),
  { disabled: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
const id = useId()
const root = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const isOpen = ref(false)
const activeIndex = ref(-1)
const menuPlacement = ref<'up' | 'down'>('down')
const menuMaxHeight = ref(320)
const menuStyle = computed(() => ({
  maxHeight: `${menuMaxHeight.value}px`,
  ...(menuPlacement.value === 'up' ? { top: 'auto', bottom: 'calc(100% + 7px)' } : {}),
}))
let searchText = ''
let searchTimer: ReturnType<typeof setTimeout> | undefined

const selectedIndex = computed(() =>
  props.options.findIndex((option) => option.value === props.modelValue),
)
const selectedLabel = computed(
  () => props.options[selectedIndex.value]?.label || 'Выберите вариант',
)
const optionId = (index: number) => `${id}-option-${index}`
const enabledIndexes = computed(() =>
  props.options.flatMap((option, index) => (option.disabled ? [] : [index])),
)

function close() {
  isOpen.value = false
  searchText = ''
  clearTimeout(searchTimer)
}

function scrollToActive() {
  void nextTick(() => {
    root.value
      ?.querySelector(`#${CSS.escape(optionId(activeIndex.value))}`)
      ?.scrollIntoView({ block: 'nearest' })
  })
}

function open() {
  if (props.disabled || !enabledIndexes.value.length) {
    close()
    return
  }
  const box = trigger.value?.getBoundingClientRect()
  if (box) {
    const clearance = window.matchMedia('(max-width: 900px)').matches ? 96 : 24
    const below = window.innerHeight - box.bottom - clearance
    const above = box.top - 96
    menuPlacement.value = below < 160 && above > below ? 'up' : 'down'
    menuMaxHeight.value = Math.max(88, Math.min(320, menuPlacement.value === 'up' ? above : below))
  }
  isOpen.value = true
  activeIndex.value = enabledIndexes.value.includes(selectedIndex.value)
    ? selectedIndex.value
    : enabledIndexes.value[0]!
  scrollToActive()
}

function choose(index: number) {
  const option = props.options[index]
  if (!option || option.disabled || props.disabled) return
  emit('update:modelValue', option.value)
  close()
  trigger.value?.focus({ preventScroll: true })
}

function move(step: number) {
  if (!isOpen.value) {
    open()
    return
  }
  const indexes = enabledIndexes.value
  const position = indexes.indexOf(activeIndex.value)
  activeIndex.value = indexes[(position + step + indexes.length) % indexes.length] ?? -1
  scrollToActive()
}

function onKeydown(event: KeyboardEvent) {
  if (props.disabled) return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    move(event.key === 'ArrowDown' ? 1 : -1)
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    if (!isOpen.value) open()
    activeIndex.value =
      event.key === 'Home'
        ? (enabledIndexes.value[0] ?? -1)
        : (enabledIndexes.value[enabledIndexes.value.length - 1] ?? -1)
    scrollToActive()
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (isOpen.value) choose(activeIndex.value)
    else open()
  } else if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault()
    close()
  } else if (event.key === 'Tab') {
    close()
  } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault()
    if (!isOpen.value) open()
    clearTimeout(searchTimer)
    searchText += event.key.toLocaleLowerCase('ru-RU')
    const match = props.options.findIndex(
      (option) =>
        !option.disabled && option.label.toLocaleLowerCase('ru-RU').startsWith(searchText),
    )
    if (match >= 0) {
      activeIndex.value = match
      scrollToActive()
    }
    searchTimer = setTimeout(() => {
      searchText = ''
    }, 700)
  }
}

function onOutsidePointer(event: PointerEvent) {
  if (event.target instanceof Node && !root.value?.contains(event.target)) close()
}

function onFocusOut(event: FocusEvent) {
  if (!(event.relatedTarget instanceof Node) || !root.value?.contains(event.relatedTarget)) close()
}

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) close()
  },
)
watch(
  () => props.options,
  () => {
    if (isOpen.value) open()
  },
)
onMounted(() => {
  document.addEventListener('pointerdown', onOutsidePointer)
  window.addEventListener('resize', close)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsidePointer)
  window.removeEventListener('resize', close)
  clearTimeout(searchTimer)
})
</script>

<template>
  <div
    ref="root"
    class="filter-field app-select"
    :class="{ 'app-select--open': isOpen, 'app-select--disabled': disabled }"
    @focusout="onFocusOut"
  >
    <label :id="`${id}-label`" class="app-select__label" :for="`${id}-trigger`">{{ label }}</label>
    <button
      :id="`${id}-trigger`"
      ref="trigger"
      class="app-select__trigger"
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-controls="`${id}-listbox`"
      :aria-labelledby="`${id}-label`"
      :aria-activedescendant="isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined"
      :disabled="disabled"
      @click="isOpen ? close() : open()"
      @keydown="onKeydown"
    >
      <span class="app-select__value" :title="selectedLabel">{{ selectedLabel }}</span>
      <svg class="app-select__chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="m5 7.5 5 5 5-5"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <ul
      v-if="isOpen"
      :id="`${id}-listbox`"
      class="app-select__menu"
      :style="menuStyle"
      role="listbox"
      :aria-labelledby="`${id}-label`"
    >
      <li
        v-for="(option, index) in options"
        :id="optionId(index)"
        :key="option.value"
        class="app-select__option"
        :class="{ 'app-select__option--active': index === activeIndex }"
        role="option"
        :aria-selected="option.value === modelValue"
        :aria-disabled="option.disabled || undefined"
        @pointerdown.prevent
        @pointermove="!option.disabled && (activeIndex = index)"
        @click="choose(index)"
      >
        <span>{{ option.label }}</span>
        <svg v-if="option.value === modelValue" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="m4.5 10 3.5 3.5 7.5-7.5"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </li>
    </ul>
  </div>
</template>
