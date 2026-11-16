// Public workflow metadata only. Never read provider reasoning or model traces.
const stages = {
  queued: {
    title: 'Беру вопрос в лапы',
    detail: 'Вопрос уже в лапах — выбираю, с какого берега подойти.',
  },
  reading_data: {
    title: 'Ныряю в клубные истории',
    detail: 'Ныряю в клубную запруду за нужной историей.',
  },
  thinking: {
    title: 'Подбираю веточки для ответа',
    detail: 'Укладываю веточку к веточке, чтобы ответ держался крепко.',
  },
  validating: {
    title: 'Проверяю, крепко ли собрано',
    detail: 'Последний обход плотины — всё ли на своих местах?',
  },
} as const

export type ChatProgressStage = keyof typeof stages

export function progressCopy(stage: ChatProgressStage) {
  return stages[stage]
}

export interface ChatProgressStep {
  id: number
  stage: ChatProgressStage
  title: string
  detail: string
  startedAt: string
  observedAt: number
  durationMs: number | null
  state: 'active' | 'completed' | 'stopped' | 'failed'
  sourceCount?: number
  sourceTitles: string[]
}

function eventTime(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

export function finishProgress(
  steps: readonly ChatProgressStep[],
  outcome: 'completed' | 'stopped' | 'failed',
  at: unknown,
  now = Date.now(),
): ChatProgressStep[] {
  const finishedAt = eventTime(at, Number.NaN)
  return steps.map((step) =>
    step.state === 'active'
      ? {
          ...step,
          state: outcome,
          durationMs: Math.max(
            0,
            Number.isFinite(finishedAt)
              ? finishedAt - Date.parse(step.startedAt)
              : now - step.observedAt,
          ),
        }
      : step,
  )
}

export function appendProgress(
  steps: readonly ChatProgressStep[],
  data: Record<string, unknown>,
  seq: number,
  now = Date.now(),
): ChatProgressStep[] {
  if (
    typeof data.stage !== 'string' ||
    !Object.prototype.hasOwnProperty.call(stages, data.stage) ||
    steps.some((step) => step.id === seq)
  )
    return [...steps]
  const stage = data.stage as ChatProgressStage
  const descriptor = stages[stage]
  const startedAt = new Date(eventTime(data.at, now)).toISOString()
  const sourceTitles = Array.isArray(data.source_titles)
    ? [...new Set(data.source_titles.filter((title): title is string => typeof title === 'string'))]
        .slice(0, 6)
        .map((title) => title.slice(0, 160))
    : []
  const sourceCount =
    typeof data.source_count === 'number' &&
    Number.isSafeInteger(data.source_count) &&
    data.source_count >= 0 &&
    data.source_count <= 6
      ? data.source_count
      : undefined
  return [
    ...finishProgress(steps, 'completed', startedAt, now),
    {
      id: seq,
      stage,
      title: descriptor.title,
      // The UI owns its voice. Backend messages and model traces never become copy.
      detail: descriptor.detail,
      startedAt,
      observedAt: now,
      durationMs: null,
      state: 'active',
      sourceCount,
      sourceTitles,
    },
  ]
}
