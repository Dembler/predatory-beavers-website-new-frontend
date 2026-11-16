import { computed, onBeforeUnmount, ref } from 'vue'
import {
  appendProgress,
  finishProgress,
  progressCopy,
  type ChatProgressStep,
} from './mascotProgress'

export type { ChatProgressStep } from './mascotProgress'

interface Citation {
  title: string
  url: string
}
interface Message {
  role: 'user' | 'assistant'
  text: string
  citations?: Citation[]
  progress?: ChatProgressStep[]
  durationMs?: number | null
}
interface Session {
  session_id: string
  csrf_token: string
  expires_at: string
}
interface Accepted {
  run_id: string
  session_id: string
  status: string
  events_url: string
}
interface Pending {
  client_request_id: string
  session_id: string
  message: string
  context: { page: string; team?: string }
}
const base = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')
class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export function safeCitationPath(value: unknown): value is string {
  return typeof value === 'string' && /^\/(?!\/)/.test(value) && !/[\\\u0000-\u0020]/.test(value)
}

export function useMascotChat(context: () => { page: string; team?: string }) {
  const messages = ref<Message[]>([])
  const status = ref('Можно спросить об истории клуба, правилах или матчах.')
  const error = ref('')
  const active = ref(false)
  const connecting = ref(false)
  const submitting = ref(false)
  const retrySubmission = ref(false)
  const reconnectable = ref(false)
  const receivedProgress = ref<ChatProgressStep[]>([])
  const presentedSteps = ref(0)
  const progress = computed(() => receivedProgress.value.slice(0, presentedSteps.value))
  const presentedStatus = computed(() =>
    receivedProgress.value.some((step) => step.detail === status.value)
      ? progress.value[progress.value.length - 1]?.detail || status.value
      : status.value,
  )
  const runDurationMs = ref<number | null>(null)
  // A replay may deliver several real stages in one chunk. Give each new line time to be read,
  // but never hold back the answer or manufacture stages that the server has not sent.
  const stageReadingMs = 900
  let progressTimer: ReturnType<typeof setTimeout> | undefined
  let nextStageAt = 0
  let session: Session | undefined
  let pending: Pending | undefined
  let runId: string | undefined
  let assistantMessageIndex: number | undefined
  let afterSeq = 0
  let visible = false
  let stream: AbortController | undefined
  let epoch = 0
  let sessionPromise: Promise<Session> | undefined

  function pauseProgressPresentation() {
    clearTimeout(progressTimer)
    progressTimer = undefined
  }
  function presentProgress() {
    if (!visible || !active.value || progressTimer !== undefined) return
    if (presentedSteps.value >= receivedProgress.value.length) return
    const wait = presentedSteps.value === 0 ? 0 : Math.max(0, nextStageAt - Date.now())
    if (wait > 0) {
      progressTimer = setTimeout(() => {
        progressTimer = undefined
        presentProgress()
      }, wait)
      return
    }
    presentedSteps.value++
    nextStageAt = Date.now() + stageReadingMs
    presentProgress()
  }
  function settleProgress(outcome: 'completed' | 'stopped' | 'failed', at: unknown) {
    pauseProgressPresentation()
    receivedProgress.value = finishProgress(receivedProgress.value, outcome, at)
    presentedSteps.value = receivedProgress.value.length
  }

  async function request<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      credentials: 'include',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { 'X-CSRF-Token': session.csrf_token } : {}),
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const message =
        response.status === 401
          ? 'Сессия истекла. Откройте чат заново.'
          : response.status === 429
            ? 'Слишком много сообщений. Попробуйте немного позже.'
            : response.status === 409
              ? 'Другой запрос уже обрабатывается. Дождитесь его завершения.'
              : 'Не удалось связаться с Бобриком. Попробуйте ещё раз.'
      if (response.status === 401) session = undefined
      throw new RequestError(message, response.status)
    }
    return response.json()
  }
  async function ensureSession() {
    if (session) return session
    sessionPromise ??= request<Session>('/api/v1/mascot/session', {})
    try {
      session = await sessionPromise
      return session
    } finally {
      sessionPromise = undefined
    }
  }

  function detach() {
    epoch++
    stream?.abort()
    stream = undefined
  }
  function snapshotProgress() {
    if (assistantMessageIndex === undefined) return
    const message = messages.value[assistantMessageIndex]
    if (!message || message.role !== 'assistant') return
    message.progress = receivedProgress.value.map((step) => ({
      ...step,
      sourceTitles: [...step.sourceTitles],
    }))
    message.durationMs = runDurationMs.value
  }
  function event(type: string, data: Record<string, unknown>, seq: number) {
    if (!Number.isSafeInteger(seq) || seq <= afterSeq) return
    afterSeq = seq
    if (type === 'status') {
      receivedProgress.value = appendProgress(receivedProgress.value, data, seq)
      status.value =
        receivedProgress.value[receivedProgress.value.length - 1]?.detail ||
        progressCopy('thinking').detail
      presentProgress()
    }
    if (type === 'answer' && typeof data.text === 'string') {
      const citations: Citation[] = Array.isArray(data.citations)
        ? data.citations.flatMap((c) => {
            if (!c || typeof c.title !== 'string' || !safeCitationPath(c.url)) return []
            return [{ title: c.title, url: c.url }]
          })
        : []
      assistantMessageIndex =
        messages.value.push({ role: 'assistant', text: data.text, citations }) - 1
    }
    if (['done', 'error', 'cancelled'].includes(type)) {
      settleProgress(
        type === 'done' ? 'completed' : type === 'cancelled' ? 'stopped' : 'failed',
        data.at,
      )
      runDurationMs.value =
        typeof data.duration_ms === 'number' && Number.isFinite(data.duration_ms)
          ? Math.max(0, data.duration_ms)
          : null
      snapshotProgress()
      error.value = ''
      active.value = false
      reconnectable.value = false
      status.value =
        type === 'done'
          ? 'Ответ готов.'
          : type === 'cancelled'
            ? 'Запрос остановлен.'
            : 'Ответ не получился.'
      if (type === 'error')
        error.value =
          typeof data.message === 'string' ? data.message : 'Бобрик временно недоступен.'
    }
  }
  async function connect() {
    if (!visible || !active.value || !runId) return
    detach()
    const generation = epoch
    reconnectable.value = false
    error.value = ''
    for (
      let attempt = 0;
      attempt < 3 && active.value && visible && generation === epoch;
      attempt++
    ) {
      stream = new AbortController()
      try {
        const response = await fetch(
          `${base}/api/v1/mascot/chat/runs/${runId}/events?after_seq=${afterSeq}`,
          {
            credentials: 'include',
            signal: AbortSignal.any([stream.signal, AbortSignal.timeout(30_000)]),
            headers: { Accept: 'text/event-stream' },
          },
        )
        if ([401, 403, 404, 409].includes(response.status)) {
          active.value = false
          settleProgress('failed', undefined)
          snapshotProgress()
          status.value = 'Ответ недоступен.'
          error.value = 'Этот ответ недоступен. Откройте чат заново.'
          if (response.status === 401) session = undefined
          return
        }
        if (!response.ok || !response.body) throw new Error('stream unavailable')
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        try {
          while (active.value && generation === epoch) {
            const chunk = await reader.read()
            if (chunk.done) break
            buffer = (buffer + decoder.decode(chunk.value, { stream: true })).replace(/\r\n/g, '\n')
            if (buffer.length > 128_000) throw new Error('stream too large')
            let boundary: number
            while ((boundary = buffer.indexOf('\n\n')) >= 0) {
              const block = buffer.slice(0, boundary)
              buffer = buffer.slice(boundary + 2)
              const lines = block.split('\n')
              const seq = Number(
                lines
                  .find((l) => l.startsWith('id:'))
                  ?.slice(3)
                  .trim(),
              )
              const type = lines
                .find((l) => l.startsWith('event:'))
                ?.slice(6)
                .trim()
              const payload = lines
                .filter((l) => l.startsWith('data:'))
                .map((l) => l.slice(5).trimStart())
                .join('\n')
              if (type && payload && generation === epoch) event(type, JSON.parse(payload), seq)
            }
          }
        } finally {
          await reader.cancel().catch(() => {})
        }
        if (!active.value) return
      } catch {
        if (!visible || generation !== epoch) return
      }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
    }
    if (active.value && visible && generation === epoch) {
      reconnectable.value = true
      error.value = 'Связь прервалась. Можно подключиться к тому же ответу.'
    }
  }
  async function setVisible(value: boolean) {
    visible = value
    if (!value) {
      detach()
      pauseProgressPresentation()
      return
    }
    connecting.value = true
    try {
      await ensureSession()
      error.value = ''
      if (visible && active.value) {
        presentProgress()
        void connect()
      }
    } catch {
      error.value = 'Не удалось открыть чат. Попробуйте ещё раз.'
    } finally {
      connecting.value = false
    }
  }
  async function submitPending() {
    if (!pending) return
    submitting.value = true
    error.value = ''
    retrySubmission.value = false
    try {
      const accepted = await request<Accepted>('/api/v1/mascot/chat/runs', pending)
      runId = accepted.run_id
      afterSeq = 0
      pending = undefined
      active.value = true
      status.value = progressCopy('queued').detail
      void connect()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Не удалось отправить сообщение.'
      if (cause instanceof RequestError && cause.status >= 400 && cause.status < 500) {
        pending = undefined
      } else {
        retrySubmission.value = true
      }
    } finally {
      submitting.value = false
    }
  }
  async function send(text: string) {
    if (active.value || submitting.value || pending || !text.trim()) return false
    try {
      await ensureSession()
    } catch {
      error.value = 'Не удалось открыть чат.'
      return false
    }
    pending = {
      client_request_id: crypto.randomUUID(),
      session_id: session!.session_id,
      message: text.trim(),
      context: context(),
    }
    pauseProgressPresentation()
    receivedProgress.value = []
    presentedSteps.value = 0
    nextStageAt = 0
    runDurationMs.value = null
    assistantMessageIndex = undefined
    messages.value.push({ role: 'user', text: text.trim() })
    await submitPending()
    return true
  }
  async function cancel() {
    if (!runId || !active.value) return
    try {
      await request(`/api/v1/mascot/chat/runs/${runId}/cancel`, {})
      if (active.value) status.value = 'Останавливаю запрос…'
    } catch {
      error.value = 'Не удалось остановить запрос. Попробуйте ещё раз.'
    }
  }
  onBeforeUnmount(() => {
    visible = false
    detach()
    pauseProgressPresentation()
  })
  return {
    messages,
    status: presentedStatus,
    error,
    active,
    connecting,
    submitting,
    retrySubmission,
    reconnectable,
    progress,
    runDurationMs,
    busy: computed(
      () => active.value || connecting.value || submitting.value || retrySubmission.value,
    ),
    setVisible,
    send,
    cancel,
    retry: submitPending,
    reconnect: () => {
      error.value = ''
      void connect()
    },
  }
}
