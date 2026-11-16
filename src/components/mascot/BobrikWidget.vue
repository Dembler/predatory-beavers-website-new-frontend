<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Send, Square, X } from '@lucide/vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'
import { useMascotChat } from '@/composables/useMascotChat'
import { sitePath } from '@/shared/sitePath'
import SpriteMascot from './SpriteMascot.vue'
import MascotLauncher from './MascotLauncher.vue'
import ChatProgress from './ChatProgress.vue'
import type { MascotState } from './SpriteMascotRenderer'

const open = ref(false)
const draft = ref('')
const history = ref<HTMLElement>()
const route = useRoute()
const chat = useMascotChat(() => {
  const team = route.query.team || (route.path.includes('/women') ? 'women' : undefined)
  return { page: route.path.slice(0, 64), ...(team === 'men' || team === 'women' ? { team } : {}) }
})
const {
  messages,
  status,
  error,
  active,
  busy,
  connecting,
  submitting,
  retrySubmission,
  reconnectable,
  progress,
  runDurationMs,
} = chat
const state = computed<MascotState>(() =>
  error.value ? 'sad' : active.value ? 'thinking' : draft.value ? 'listening' : 'greeting',
)
const duplicateStageStatus = computed(
  () =>
    active.value &&
    !connecting.value &&
    !submitting.value &&
    !error.value &&
    !reconnectable.value &&
    progress.value[progress.value.length - 1]?.detail === status.value,
)
const suggestions = [
  'Расскажи об истории клуба',
  'Когда ближайший матч?',
  'Какие правила баскетбола?',
]

function backgroundInert(value: boolean) {
  const shell = document.querySelector<HTMLElement>('.site-shell')
  if (shell) shell.inert = value
  document.body.classList.toggle('bobrik-open', value)
}
watch(open, (value) => {
  backgroundInert(value)
  void chat.setVisible(value)
})
watch(
  () => [messages.value.length, progress.value.length],
  async () => {
    await nextTick()
    history.value?.scrollTo({ top: history.value.scrollHeight, behavior: 'instant' })
  },
)
onBeforeUnmount(() => backgroundInert(false))
async function send(text = draft.value) {
  if ((await chat.send(text)) && draft.value === text) draft.value = ''
}
function enter(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    if (!busy.value && draft.value.trim()) void send()
  }
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger as-child>
      <MascotLauncher :open="open" />
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="bobrik-overlay" />
      <DialogContent class="bobrik-dialog">
        <header class="bobrik-heading">
          <SpriteMascot :state="state" />
          <div>
            <span class="bobrik-eyebrow">Твой проводник по клубу</span>
            <DialogTitle>Бобрик</DialogTitle>
            <DialogDescription>Спросите об истории, матчах и баскетболе.</DialogDescription>
          </div>
          <DialogClose class="bobrik-close" aria-label="Закрыть чат"
            ><X :size="22" aria-hidden="true"
          /></DialogClose>
        </header>
        <div
          ref="history"
          class="bobrik-history"
          role="log"
          aria-label="Переписка с Бобриком"
          aria-live="polite"
          aria-relevant="additions"
        >
          <div v-if="!messages.length" class="bobrik-welcome">
            <p>Привет! Я помогу найти интересное в сохранённой истории «Хищных Бобров».</p>
            <div class="bobrik-suggestions">
              <button
                v-for="suggestion in suggestions"
                :key="suggestion"
                type="button"
                :disabled="busy"
                @click="send(suggestion)"
              >
                {{ suggestion }}
              </button>
            </div>
          </div>
          <template v-for="(message, index) in messages" :key="index">
            <ChatProgress
              v-if="message.progress?.length"
              :steps="message.progress"
              :active="false"
              :duration-ms="message.durationMs ?? null"
            />
            <ChatProgress
              v-else-if="
                index === messages.length - 1 && message.role === 'assistant' && progress.length
              "
              :steps="progress"
              :active="active"
              :duration-ms="runDurationMs"
            />
            <article class="bobrik-message" :class="`bobrik-message--${message.role}`">
              <span class="bobrik-message__author">{{
                message.role === 'user' ? 'Вы' : 'Бобрик'
              }}</span>
              <p>{{ message.text }}</p>
              <ul
                v-if="message.citations?.length"
                class="bobrik-sources"
                aria-label="Источники ответа"
              >
                <li v-for="(citation, i) in message.citations" :key="i">
                  <a
                    :href="sitePath(citation.url)"
                    target="_blank"
                    rel="noopener"
                    :aria-label="`${citation.title} (в новой вкладке)`"
                    >{{ citation.title }} ↗</a
                  >
                </li>
              </ul>
            </article>
          </template>
          <ChatProgress
            v-if="messages[messages.length - 1]?.role !== 'assistant' && progress.length"
            :steps="progress"
            :active="active"
            :duration-ms="runDurationMs"
          />
        </div>
        <div class="bobrik-feedback" :class="{ 'bobrik-feedback--quiet': duplicateStageStatus }">
          <p role="status" :class="{ 'sr-only': duplicateStageStatus }">
            {{ connecting ? 'Открываю чат…' : submitting ? 'Отправляю сообщение…' : status }}
          </p>
          <div v-if="error" class="bobrik-error" role="alert">
            <p>{{ error }}</p>
            <button v-if="retrySubmission" type="button" :disabled="submitting" @click="chat.retry">
              Повторить отправку
            </button>
            <button v-else-if="reconnectable" type="button" @click="chat.reconnect">
              Восстановить связь
            </button>
          </div>
        </div>
        <form class="bobrik-form" @submit.prevent="send()">
          <label for="bobrik-input">Сообщение Бобрику</label>
          <textarea
            id="bobrik-input"
            v-model="draft"
            maxlength="1000"
            rows="2"
            placeholder="Что хотите узнать?"
            @keydown="enter"
          />
          <div class="bobrik-actions">
            <small>Ответы по сохранённым материалам, с источниками.</small>
            <button v-if="active" type="button" class="bobrik-send" @click="chat.cancel">
              <Square :size="16" aria-hidden="true" />Остановить
            </button>
            <button v-else type="submit" class="bobrik-send" :disabled="busy || !draft.trim()">
              <Send :size="17" aria-hidden="true" />Отправить
            </button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
.bobrik-dialog :focus-visible {
  outline: 3px solid #f4aa74;
  outline-offset: 3px;
}
.bobrik-overlay {
  position: fixed;
  z-index: 100;
  inset: 0;
  background: #02111f70;
}
.bobrik-dialog {
  position: fixed;
  z-index: 101;
  right: 24px;
  bottom: 24px;
  display: flex;
  flex-direction: column;
  width: min(430px, calc(100vw - 32px));
  height: min(700px, calc(100dvh - 48px));
  overflow: hidden;
  border: 1px solid #d8e2ec;
  border-radius: 24px;
  background: #f6f8fb;
  color: #102e46;
  box-shadow: 0 16px 64px #02132650;
  font-family: inherit;
}
.bobrik-heading {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 6px;
  padding: 14px 48px 10px 8px;
  background: #082944;
  color: white;
}
.bobrik-heading h2 {
  margin: 4px 0 6px;
  font-size: 1.6rem;
  line-height: 1.1;
}
.bobrik-heading p {
  margin: 0 0 8px;
  font-size: 0.84rem;
  line-height: 1.45;
  color: #d5e4f1;
}
.bobrik-eyebrow {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #c4d7e8;
}
.bobrik-sprite {
  width: 96px;
  height: 104px;
  flex-shrink: 0;
}
.bobrik-close {
  position: absolute;
  top: 10px;
  right: 8px;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: white;
  cursor: pointer;
}
.bobrik-history {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 20px;
}
.bobrik-welcome > p {
  margin: 0 0 20px;
  font-size: 0.95rem;
  line-height: 1.6;
}
.bobrik-suggestions {
  display: grid;
  gap: 8px;
}
.bobrik-suggestions button {
  min-height: 44px;
  padding: 10px 14px;
  text-align: left;
  border: 1px solid #cad8e4;
  border-radius: 12px;
  color: #12334d;
  background: white;
  cursor: pointer;
  font: inherit;
  font-size: 0.84rem;
}
.bobrik-message {
  margin-bottom: 14px;
  padding: 13px 15px;
  border-radius: 14px 14px 14px 2px;
  background: white;
  border: 1px solid #e0e7ee;
}
.bobrik-message--user {
  margin-left: 32px;
  background: #e7eef5;
  border-radius: 14px 14px 2px 14px;
}
.bobrik-message__author {
  font-size: 0.7rem;
  font-weight: 700;
  color: #526b80;
}
.bobrik-message p {
  margin: 6px 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 0.91rem;
  line-height: 1.65;
}
.bobrik-sources {
  margin: 12px 0 0;
  padding-left: 16px;
  font-size: 0.78rem;
}
.bobrik-sources li + li {
  margin-top: 7px;
}
.bobrik-sources a {
  color: #a51511;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.bobrik-feedback {
  flex-shrink: 0;
  padding: 0 20px 12px;
}
.bobrik-feedback--quiet {
  padding-bottom: 0;
}
.bobrik-feedback > p {
  margin: 0;
  color: #526b80;
  font-size: 0.75rem;
  line-height: 1.4;
}
.bobrik-error {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fbe9e8;
  color: #8f1612;
  font-size: 0.8rem;
}
.bobrik-error p {
  margin: 0;
  line-height: 1.5;
}
.bobrik-error button {
  min-height: 44px;
  margin-top: 6px;
  padding: 4px 0;
  color: inherit;
  background: transparent;
  border: 0;
  text-decoration: underline;
  cursor: pointer;
}
.bobrik-form {
  flex-shrink: 0;
  padding: 12px 20px 16px;
  border-top: 1px solid #d8e2ec;
  background: white;
}
.bobrik-form label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.76rem;
  font-weight: 700;
}
.bobrik-form textarea {
  display: block;
  width: 100%;
  min-height: 60px;
  max-height: 150px;
  resize: vertical;
  padding: 10px 12px;
  border: 1px solid #b7c8d6;
  border-radius: 10px;
  color: #102e46;
  background: white;
  font: inherit;
  font-size: 16px;
  line-height: 1.4;
}
.bobrik-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 10px;
}
.bobrik-actions small {
  max-width: 185px;
  color: #526b80;
  font-size: 0.65rem;
  line-height: 1.5;
}
.bobrik-send {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 44px;
  padding: 10px 14px;
  border: 0;
  border-radius: 10px;
  color: white;
  background: #b71c17;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}
.bobrik-dialog button:disabled {
  opacity: 0.5;
  cursor: default;
}
@media (max-width: 900px) {
  .bobrik-dialog {
    inset: 0;
    width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    border: 0;
    border-radius: 0;
  }
  .bobrik-heading {
    padding-top: calc(14px + env(safe-area-inset-top));
  }
  .bobrik-close {
    top: calc(10px + env(safe-area-inset-top));
  }
  .bobrik-form {
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
  }
  body.bobrik-open .mobile-bottom-nav {
    visibility: hidden;
  }
}
</style>
