import { expect, test, type Page } from '@playwright/test'
import type { ColumnDraft, EditorialArticle, EditorialJob } from '../../src/shared/editorial'

test.skip(process.env.E2E_MASCOT_ENABLED !== 'true', 'Requires the isolated Bobrik dev profile')

const articleId = 'f112166a-ce9a-44c4-9f4e-b7dd106909b6'
const firstRevisionId = 'b38e4cb1-af67-4ea6-b764-62720dfcf5dd'
const secondRevisionId = '50999fee-742c-4f20-985a-9197d98a474d'
const jobId = '0bbd0320-bc01-48e5-9550-436093417813'
const authorId = 'e88363aa-cf67-4452-8fac-068dfcaa75f0'
const user = { id: authorId, username: 'Редактор колонки', role: 'EDITOR' }
const source = {
  ref: 'source-1',
  title: 'Опубликованный матч',
  url: '/matches',
  excerpt: 'Подтверждённый счёт сохранён в архиве.',
  content_hash: 'source-hash',
}
const draft: ColumnDraft = {
  title: 'Наш берег баскетбола',
  lead: 'Собираем клубную неделю с вниманием к деталям.',
  sections: [
    {
      heading: 'Взгляд с трибуны',
      body: '<img src=x onerror=alert(1)> Бобрик приглашает поддержать обе команды.',
      fact_ids: ['fact-1'],
    },
  ],
}
const firstRevision = {
  id: firstRevisionId,
  origin: 'model',
  content: draft,
  fact_sheet: {
    week_start: '2026-11-09',
    week_end: '2026-11-15',
    as_of: '2026-11-16T12:00:00Z',
    team_scope: 'both',
    discipline: 'all',
    data_revision: 'snapshot',
    sources: [
      source,
      { ...source, ref: 'source-2', title: 'Небезопасная ссылка', url: 'javascript:alert(1)' },
    ],
    facts: [
      {
        id: 'fact-1',
        source_ref: 'source-1',
        text: 'Подтверждённый результат: ВГУ — ВГАС, 25:90.',
        kind: 'result',
        team_scope: 'women',
      },
    ],
    caveats: ['Данных о личной статистике за неделю недостаточно.'],
    fingerprint: 'frozen-sheet',
  },
  checks: {
    policy_version: 'test-policy',
    passed: true,
    issues: [],
    warnings: ['human_semantic_review_required', 'word_count_out_of_range'],
    word_count: 804,
    content_hash: 'content-1',
    fact_sheet_fingerprint: 'frozen-sheet',
  },
  content_hash: 'content-1',
  model: 'deepseek-test',
  prompt_version: 'test-prompt',
  created_at: '2026-11-16T12:00:00Z',
}
function newArticle(): EditorialArticle {
  return structuredClone({
    id: articleId,
    slug: 'bobrovaya-nedelya-test',
    scope_key: '2026-11-09-both-all',
    version: 1,
    draft_head_revision_id: firstRevisionId,
    approved_revision_id: null,
    published_revision_id: null,
    revisions: [firstRevision],
  })
}
async function fixture(page: Page, withArticle = true) {
  const state = {
    article: newArticle(),
    listed: withArticle,
    jobs: [] as EditorialJob[],
    generates: [] as { key: string; body: unknown }[],
    actions: [] as { action: string; body: Record<string, unknown> }[],
    unknownSendOnce: false,
    failPollOnce: false,
    unauthorizedSaveOnce: false,
    staleSaveOnce: false,
    authenticated: true,
    jobStatus: 'ready_for_review',
    holdSave: false,
    releaseSave: () => {},
  }
  const saveGate = new Promise<void>((resolve) => {
    state.releaseSave = resolve
  })
  const queuedJob = (): EditorialJob => ({
    id: jobId,
    status: 'queued',
    article_id: articleId,
    result_revision_id: null,
    error_code: null,
    week_start: '2026-11-09',
  })
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const ok = (data: unknown) => route.fulfill({ json: { data } })
    const reference = () =>
      route.fulfill({ json: { items: [], page: 1, page_size: 100, total_pages: 0, total: 0 } })
    if (path === '/api/v1/auth/me')
      return state.authenticated
        ? ok(user)
        : route.fulfill({ status: 401, json: { code: 'unauthorized' } })
    if (path === '/api/v1/auth/csrf') return ok({ csrf_token: 'editorial-csrf' })
    if (path === '/api/v1/auth/login') {
      state.authenticated = true
      return ok({ user, csrf_token: 'editorial-csrf' })
    }
    if (path === '/api/v1/admin/editorial/jobs') return ok({ items: state.jobs })
    if (path === '/api/v1/admin/articles') return ok({ items: state.listed ? [state.article] : [] })
    if (path === '/api/v1/admin/editorial/generate') {
      expect(request.method()).toBe('POST')
      expect(request.headers()['x-csrf-token']).toBe('editorial-csrf')
      state.generates.push({
        key: request.headers()['idempotency-key']!,
        body: request.postDataJSON(),
      })
      expect(state.generates[state.generates.length - 1]!.key).toMatch(/^[a-f0-9-]{36}$/)
      if (!state.jobs.length) state.jobs = [queuedJob()]
      if (state.unknownSendOnce) {
        state.unknownSendOnce = false
        return route.abort('failed')
      }
      return ok(state.jobs[0])
    }
    if (path === `/api/v1/admin/editorial/jobs/${jobId}/cancel`) {
      state.jobs[0]!.status = 'cancelled'
      return ok(state.jobs[0])
    }
    if (path === `/api/v1/admin/editorial/jobs/${jobId}`) {
      if (state.failPollOnce) {
        state.failPollOnce = false
        return route.abort('failed')
      }
      state.jobs[0]!.status = state.jobStatus
      state.jobs[0]!.result_revision_id = ['ready_for_review', 'checks_failed'].includes(
        state.jobStatus,
      )
        ? firstRevisionId
        : null
      state.listed = ['ready_for_review', 'checks_failed'].includes(state.jobStatus)
      return ok(state.jobs[0])
    }
    if (path === `/api/v1/admin/articles/${articleId}` && request.method() === 'GET')
      return ok(state.article)
    if (path.startsWith(`/api/v1/admin/articles/${articleId}`)) {
      const action = request.method() === 'PATCH' ? 'save' : path.split('/').pop()!
      const body = request.postDataJSON() as Record<string, unknown>
      state.actions.push({ action, body })
      expect(request.headers()['x-csrf-token']).toBe('editorial-csrf')
      if (action === 'save' && state.unauthorizedSaveOnce) {
        state.unauthorizedSaveOnce = false
        state.authenticated = false
        return route.fulfill({ status: 401, json: { code: 'unauthorized' } })
      }
      if (action === 'save' && state.staleSaveOnce) {
        state.staleSaveOnce = false
        return route.fulfill({ status: 409, json: { code: 'stale_record' } })
      }
      expect(body.expected_version).toBe(state.article.version)
      if (action === 'save') {
        if (state.holdSave) await saveGate
        const parent = state.article.revisions.find((revision) => revision.id === body.revision_id)!
        state.article.revisions.push({
          ...structuredClone(parent),
          id: secondRevisionId,
          content: body.content as ColumnDraft,
          origin: 'human',
          checks: null,
        })
        state.article.draft_head_revision_id = secondRevisionId
        state.article.approved_revision_id = null
      }
      if (action === 'check') {
        state.article.revisions.find((revision) => revision.id === body.revision_id)!.checks =
          structuredClone(firstRevision.checks)
        state.article.approved_revision_id = null
      }
      if (action === 'approve') state.article.approved_revision_id = String(body.revision_id)
      if (action === 'publish') {
        expect(body.revision_id).toBe(state.article.approved_revision_id)
        state.article.published_revision_id = String(body.revision_id)
      }
      if (action === 'unpublish') {
        expect(body.revision_id).toBe(state.article.published_revision_id)
        state.article.published_revision_id = null
      }
      state.article.version++
      return ok(state.article)
    }
    if (path.startsWith('/api/v1/mascot/')) return route.abort('blockedbyclient')
    return reference()
  })
  await page.goto('/admin?tab=editorial')
  await expect(page.getByRole('heading', { name: 'Колонка Бобрика', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Обновить список', exact: true })).toBeEnabled()
  return state
}
async function openArticle(page: Page) {
  await page.getByRole('button', { name: /Наш берег баскетбола/ }).click()
  await expect(page.getByLabel('Заголовок колонки', { exact: true })).toHaveValue(draft.title)
}

test('an editor generates, reviews, edits and publishes an exact approved revision', async ({
  page,
}, testInfo) => {
  const state = await fixture(page, false)
  await page.getByLabel('Начало недели · понедельник').fill('2026-11-09')
  await page
    .getByLabel('Пожелания редактора')
    .fill('С уважением к обеим командам, без выдуманных героев.')
  await page.getByRole('button', { name: 'Подготовить черновик', exact: true }).click()
  await expect(
    page.getByRole('status', { name: '' }).filter({ hasText: 'Вопрос недели уже в лапах' }),
  ).toBeVisible()
  await expect(page.getByLabel('Заголовок колонки')).toHaveValue(draft.title)
  expect(state.generates).toHaveLength(1)
  await expect(page.getByRole('button', { name: 'Опубликовать', exact: true })).toBeDisabled()
  await expect(page.getByLabel('Текст части 1')).toHaveValue(draft.sections[0]!.body)
  await expect(page.locator('.editorial-main img')).toHaveCount(0)
  await expect(page.getByLabel('Подтверждённые факты')).toContainText('25:90')
  await expect(page.getByText('Данных о личной статистике за неделю недостаточно.')).toBeVisible()
  await expect(
    page.getByText('Редактору нужно проверить смысл, тон и точность связи текста с фактами.'),
  ).toBeVisible()
  await page.getByLabel('Заголовок колонки').fill('Неделя глазами Бобрика')
  await expect(page.getByRole('button', { name: 'Одобрить версию', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Сохранить правки', exact: true }).click()
  await expect(page.getByText('Правки сохранены новой версией.')).toBeVisible()
  await expect(page.getByLabel('Версия текста')).toHaveValue(secondRevisionId)
  await expect(page.getByRole('button', { name: 'Одобрить версию', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Проверить версию', exact: true }).click()
  await expect(page.getByText('Проверка пройдена · 804 слов')).toBeVisible()
  await page.getByRole('button', { name: 'Одобрить версию', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Версия одобрена', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Опубликовать', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Версия на сайте', exact: true })).toBeDisabled()
  await expect(page.getByRole('link', { name: 'На сайте ↗', exact: true })).toHaveAttribute(
    'href',
    '/news/bobrovaya-nedelya-test',
  )
  await page.getByText('Опубликованный матч', { exact: true }).click()
  await expect(page.getByRole('link', { name: 'Открыть материал ↗', exact: true })).toHaveAttribute(
    'href',
    '/matches',
  )
  await page.getByText('Небезопасная ссылка', { exact: true }).click()
  await expect(page.locator('.editorial-sources a')).toHaveCount(1)
  await page.getByRole('heading', { name: 'Перед выпуском', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('editorial-reviewed.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('button', { name: 'Снять с публикации', exact: true }).click()
  await expect(page.getByText('Колонка снята с публикации.', { exact: true })).toBeVisible()
  expect(state.actions.map((item) => item.action)).toEqual([
    'save',
    'check',
    'approve',
    'publish',
    'unpublish',
  ])
})

test('a lost generation response keeps the original idempotency key and brief while newer typing survives', async ({
  page,
}) => {
  const state = await fixture(page, false)
  state.unknownSendOnce = true
  await page.getByLabel('Начало недели · понедельник').fill('2026-11-09')
  await page.getByLabel('Пожелания редактора').fill('Исходные пожелания')
  await page.getByRole('button', { name: 'Подготовить черновик', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Подтвердить исходную попытку', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Пожелания редактора').fill('Следующие пожелания пока не отправлять')
  await page.getByRole('button', { name: 'Подтвердить исходную попытку', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Остановить подготовку', exact: true }),
  ).toBeVisible()
  expect(state.generates).toHaveLength(2)
  expect(state.generates[0]).toEqual(state.generates[1])
  await expect(page.getByLabel('Пожелания редактора')).toHaveValue(
    'Следующие пожелания пока не отправлять',
  )
  await page.getByRole('button', { name: 'Остановить подготовку', exact: true }).click()
  await expect(page.getByText('Подготовка остановлена', { exact: true })).toBeVisible()
  expect(state.generates).toHaveLength(2)
})

test('a stale save and expired session preserve the open editor and brief through signing in again', async ({
  page,
}) => {
  const state = await fixture(page)
  await openArticle(page)
  await page.getByLabel('Пожелания редактора').fill('Пожелания сохраняются после входа')
  await page.getByLabel('Заголовок колонки').fill('Правки до сбоя')
  state.staleSaveOnce = true
  await page.getByRole('button', { name: 'Сохранить правки', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Ваши правки остались в форме')
  await expect(page.getByLabel('Заголовок колонки')).toHaveValue('Правки до сбоя')
  state.unauthorizedSaveOnce = true
  await page.getByRole('button', { name: 'Сохранить правки', exact: true }).click()
  await expect(page.getByLabel('Логин', { exact: true })).toBeVisible()
  await page.getByLabel('Логин', { exact: true }).fill('same-editor')
  await page.getByLabel('Пароль', { exact: true }).fill('disposable-mock-password')
  await page.getByRole('button', { name: /^Войти/ }).click()
  await expect(page.getByLabel('Заголовок колонки')).toHaveValue('Правки до сбоя')
  await expect(page.getByLabel('Пожелания редактора')).toHaveValue(
    'Пожелания сохраняются после входа',
  )
  await expect(page.getByRole('button', { name: 'Сохранить правки', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Опубликовать', exact: true })).toBeDisabled()
})

test('typing during a save survives its response and unpublish targets the published revision', async ({
  page,
}) => {
  const state = await fixture(page)
  state.article.published_revision_id = firstRevisionId
  state.article.approved_revision_id = firstRevisionId
  await openArticle(page)
  state.holdSave = true
  await page.getByLabel('Заголовок колонки').fill('Первая сохранённая правка')
  await page.getByRole('button', { name: 'Сохранить правки', exact: true }).click()
  await expect.poll(() => state.actions.length).toBe(1)
  await page.getByLabel('Заголовок колонки').fill('Более новая ещё несохранённая правка')
  state.releaseSave()
  await expect(page.getByText('Правки сохранены новой версией.')).toBeVisible()
  await expect(page.getByLabel('Заголовок колонки')).toHaveValue(
    'Более новая ещё несохранённая правка',
  )
  await expect(page.getByRole('button', { name: 'Сохранить правки', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Снять с публикации', exact: true })).toBeDisabled()
  await page.getByLabel('Заголовок колонки').fill('Первая сохранённая правка')
  await page.getByRole('button', { name: 'Снять с публикации', exact: true }).click()
  await expect(page.getByText('Колонка снята с публикации.', { exact: true })).toBeVisible()
  expect(state.actions[1]!.body.revision_id).toBe(firstRevisionId)
  await expect(page.getByLabel('Версия текста')).toHaveValue(secondRevisionId)
})

test('failed polling stops automatic requests and a manual refresh resumes the existing job', async ({
  page,
}) => {
  const state = await fixture(page, false)
  state.failPollOnce = true
  await page.getByLabel('Начало недели · понедельник').fill('2026-11-09')
  await page.getByRole('button', { name: 'Подготовить черновик', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Обновить состояние подготовки', exact: true }),
  ).toBeVisible()
  expect(state.generates).toHaveLength(1)
  await page.getByRole('button', { name: 'Обновить состояние подготовки', exact: true }).click()
  await expect(page.getByLabel('Заголовок колонки')).toHaveValue(draft.title)
  expect(state.generates).toHaveLength(1)
})

test('a new generated candidate never replaces an open unsaved human draft', async ({ page }) => {
  await fixture(page)
  await openArticle(page)
  await page.getByLabel('Заголовок колонки').fill('Моя незавершённая редактура')
  await page.getByLabel('Начало недели · понедельник').fill('2026-11-09')
  await page.getByRole('button', { name: 'Подготовить черновик', exact: true }).click()
  await expect(
    page.getByText(
      'Новая версия готова. Сначала сохраните открытые правки, затем выберите её в списке материалов.',
    ),
  ).toBeVisible()
  await expect(page.getByLabel('Заголовок колонки')).toHaveValue('Моя незавершённая редактура')
  await expect(
    page.getByRole('button', { name: 'Открыть готовую версию', exact: true }),
  ).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Сохранить правки', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Опубликовать', exact: true })).toBeDisabled()
})

test('failed checks explain required edits in Russian and keep publishing disabled', async ({
  page,
}) => {
  const state = await fixture(page)
  state.article.revisions[0]!.checks = {
    ...firstRevision.checks,
    passed: false,
    issues: [
      'word_count_too_short',
      'omitted_week_fact',
      'technical_process_in_author_prose',
      'unverified_personal_memory',
      'unsupported_reader_channel',
      'absence_of_evidence_is_not_no_events',
      'unrecognized_future_check',
    ],
  }
  await openArticle(page)
  await expect(
    page.getByText('В колонке меньше 350 слов вместе с фактами. Дополните текст перед выпуском.'),
  ).toBeVisible()
  await expect(
    page.getByText('В колонке пропущены факты выбранной недели. Добавьте их к подходящим частям.'),
  ).toBeVisible()
  await expect(
    page.getByText(
      'В тексте есть неподтверждённые личные воспоминания или наблюдения. Замените их мнением Бобрика или подтверждённым фактом.',
    ),
  ).toBeVisible()
  await expect(
    page.getByText(
      'Приглашение к общению ведёт в неподтверждённый канал. Предложите читателю чат с Бобриком или контакты клуба.',
    ),
  ).toBeVisible()
  await expect(
    page.getByText(
      'Отсутствие записей в материалах не означает, что событий не было. Укажите ограниченность сведений и уберите уверенный вывод.',
    ),
  ).toBeVisible()
  await expect(page.getByText('Нужна проверка редактора.', { exact: true })).toBeVisible()
  await expect(page.locator('.editorial')).not.toContainText('unrecognized_future_check')
  await expect(page.getByRole('button', { name: 'Одобрить версию', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Опубликовать', exact: true })).toBeDisabled()
})
