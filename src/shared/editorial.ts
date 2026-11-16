export interface ColumnSource {
  ref: string
  title: string
  url: string
  excerpt: string
  content_hash: string
}
export interface ColumnFact {
  id: string
  source_ref: string
  text: string
  kind: string
  team_scope: string
}
export interface ColumnFactSheet {
  week_start: string
  week_end: string
  as_of: string
  team_scope: string
  discipline: string
  data_revision: string
  sources: ColumnSource[]
  facts: ColumnFact[]
  caveats: string[]
  fingerprint: string
}
export interface ColumnSection {
  heading: string
  body: string
  fact_ids: string[]
}
export interface ColumnDraft {
  title: string
  lead: string
  sections: ColumnSection[]
}
export interface ColumnChecks {
  policy_version: string
  passed: boolean
  issues: string[]
  warnings: string[]
  word_count: number
  content_hash: string
  fact_sheet_fingerprint: string
}
export interface ArticleRevision {
  id: string
  origin?: string
  content: ColumnDraft
  fact_sheet: ColumnFactSheet
  checks: ColumnChecks | null
  content_hash: string
  model: string | null
  prompt_version: string
  created_at: string
}
export interface EditorialArticle {
  id: string
  slug: string
  scope_key: string
  version: number
  draft_head_revision_id: string | null
  approved_revision_id: string | null
  published_revision_id: string | null
  revisions: ArticleRevision[]
  title?: string
  created_at?: string
  published_at?: string | null
}
export interface EditorialJob {
  id: string
  status: string
  article_id: string
  result_revision_id: string | null
  error_code: string | null
  week_start?: string
  created_at?: string
  cancel_requested_at?: string | null
}
export interface ColumnBrief {
  week_start: string
  team_scope: 'men' | 'women' | 'both'
  discipline: '5x5' | '3x3' | 'phygital' | 'all'
  brief: string
}

export function copyColumnDraft(draft: ColumnDraft): ColumnDraft {
  return {
    title: draft.title,
    lead: draft.lead,
    sections: draft.sections.map((section) => ({ ...section, fact_ids: [...section.fact_ids] })),
  }
}
export function safeEditorialSource(value: string): boolean {
  return /^\/(?!\/)/.test(value) && !/[\\\u0000-\u0020]/.test(value)
}
export function editorialArticlePath(slug: string): string {
  return `/news/${encodeURIComponent(slug)}`
}
export function editorialJobActive(job: EditorialJob | null): boolean {
  return !!job && ['queued', 'running', 'cancelling'].includes(job.status)
}
export function editorialJobLabel(job: EditorialJob): string {
  if (job.cancel_requested_at && editorialJobActive(job)) return 'Останавливаем подготовку'
  return (
    {
      queued: 'Вопрос недели уже в лапах — ждём своей очереди',
      running: 'Бобрик собирает истории недели',
      cancelling: 'Останавливаем подготовку',
      succeeded: 'Черновик готов к редактуре',
      ready_for_review: 'Черновик готов к редактуре',
      checks_failed: 'Черновик готов, перед выпуском нужны правки',
      interrupted: 'Подготовка прервалась',
      cancelled: 'Подготовка остановлена',
      failed: 'Не удалось подготовить колонку',
      unknown: 'Результат подготовки не подтверждён',
    }[job.status] || 'Обновляем состояние подготовки'
  )
}
export function currentMoscowMonday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find((item) => item.type === type)!.value
  const date = new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}
export function isEditorialMonday(value: string): boolean {
  const date = new Date(`${value}T12:00:00Z`)
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date.getUTCDay() === 1
  )
}
