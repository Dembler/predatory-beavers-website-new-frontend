import { expect, test, type Page } from '@playwright/test'

// The mascot is deliberately unavailable in production and in the normal dev profile.
test.skip(process.env.E2E_MASCOT_ENABLED !== 'true', 'Requires the isolated Bobrik dev profile')

test.beforeEach(async ({ page }) => {
  // Every expected mascot request is mocked below; unexpected requests must never reach a worker.
  await page.route('**/api/v1/mascot/**', (route) => route.abort('blockedbyclient'))
})

const sessionId = 'd114d970-6af3-4810-b960-936fbf46e908'
const runId = 'ad3ab1b9-4652-4da8-b242-acabaee422cc'
const session = {
  session_id: sessionId,
  csrf_token: 'local-mascot-test-csrf',
  expires_at: '2099-01-01T00:00:00Z',
}
const accepted = {
  run_id: runId,
  session_id: sessionId,
  status: 'queued',
  events_url: `/api/v1/mascot/chat/runs/${runId}/events`,
}
function event(seq: number, type: string, payload: object) {
  return `id: ${seq}\nevent: ${type}\ndata: ${JSON.stringify(payload)}\n\n`
}

async function prepare(page: Page) {
  await page.route('**/api/v1/home', (route) =>
    route.fulfill({ json: { data: { next_match: null, recent_results: [], teams: [] } } }),
  )
  await page.route('**/api/v1/mascot/session', (route) => route.fulfill({ json: session }))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Открыть чат с Бобриком' })).toBeVisible()
}

async function openChat(page: Page) {
  await page.getByRole('button', { name: 'Открыть чат с Бобриком' }).click()
  const dialog = page.getByRole('dialog', { name: 'Бобрик', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('status')).not.toContainText('Открываю чат')
  return dialog
}

test('mascot loads its atlas only on open, respects reduced motion, keeps the draft and restores focus', async ({
  page,
}, testInfo) => {
  const requested: string[] = []
  page.on('request', (request) => requested.push(new URL(request.url()).pathname))
  await prepare(page)
  const launcher = page.getByRole('button', { name: 'Открыть чат с Бобриком' })
  await expect(launcher.locator('img')).toHaveAttribute('src', /\/mascot\/bobrik\/launcher\.webp$/)
  await expect(page.locator('.bobrik-sprite canvas')).toHaveCount(0)
  expect(requested.some((path) => /\/(animation\.json|spritesheet\.webp)$/.test(path))).toBe(false)
  if (testInfo.project.name === 'mobile') {
    const nav = await page.getByRole('navigation', { name: 'Быстрый переход' }).boundingBox()
    const button = await launcher.boundingBox()
    expect(button!.y + button!.height).toBeLessThan(nav!.y)
    expect(await launcher.evaluate((element) => getComputedStyle(element).bottom)).not.toBe('14px')
  }
  await page.screenshot({ path: testInfo.outputPath('bobrik-launcher.png') })
  const dialog = await openChat(page)
  await expect(page.locator('.site-shell')).toHaveJSProperty('inert', true)
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
  await expect(dialog.getByRole('button', { name: 'Закрыть чат', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('textbox', { name: 'Сообщение Бобрику' })).toBeFocused()
  const canvas = dialog.locator('canvas')
  await expect(canvas).toHaveCount(1)
  expect(requested.some((path) => /\/mascot\/bobrik\/animation\.json$/.test(path))).toBe(true)
  expect(requested.some((path) => /\/mascot\/bobrik\/spritesheet\.webp$/.test(path))).toBe(true)
  expect(requested.some((path) => /\/mascot\/bars-up\//.test(path))).toBe(false)
  await expect(canvas).toHaveAttribute('data-frame', '0')
  // This profile emulates prefers-reduced-motion; frames must stay still over time.
  await expect
    .poll(async () => {
      await page.waitForTimeout(120)
      return canvas.getAttribute('data-frame')
    })
    .toBe('0')
  await dialog.getByRole('textbox', { name: 'Сообщение Бобрику' }).fill('Неотправленный вопрос')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(launcher).toBeFocused()
  await expect(page.locator('.site-shell')).toHaveJSProperty('inert', false)
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  await openChat(page)
  await expect(dialog.getByRole('textbox', { name: 'Сообщение Бобрику' })).toHaveValue(
    'Неотправленный вопрос',
  )
})

test('reconnect resumes the same run and renders one safe answer with checked citation links', async ({
  page,
}, testInfo) => {
  let creates = 0
  const cursors: string[] = []
  const answer = event(2, 'answer', {
    text: '<img src=x onerror=alert(1)> История клуба сохранена.',
    citations: [
      { title: 'История клуба', url: '/club#history' },
      { title: 'Unsafe script', url: 'javascript:alert(1)' },
      { title: 'External redirect', url: '//example.com' },
    ],
  })
  await page.route('**/api/v1/mascot/chat/runs', async (route) => {
    creates++
    expect(route.request().headers()['x-csrf-token']).toBe(session.csrf_token)
    expect(route.request().postDataJSON()).toMatchObject({ session_id: sessionId })
    await route.fulfill({ status: 202, json: accepted })
  })
  await page.route(`**/api/v1/mascot/chat/runs/${runId}/events?*`, async (route) => {
    cursors.push(new URL(route.request().url()).searchParams.get('after_seq')!)
    await route.fulfill({
      contentType: 'text/event-stream',
      body:
        cursors.length === 1
          ? event(1, 'status', { stage: 'thinking' }) + answer
          : answer + event(3, 'done', {}),
    })
  })
  await prepare(page)
  const dialog = await openChat(page)
  await dialog.getByRole('textbox', { name: 'Сообщение Бобрику' }).fill('Расскажи об истории')
  await dialog.getByRole('button', { name: 'Отправить', exact: true }).click()
  await expect(dialog.getByRole('status')).toHaveText('Ответ готов.')
  expect(creates).toBe(1)
  expect(cursors).toEqual(['0', '2'])
  const answers = dialog.locator('.bobrik-message--assistant')
  await expect(answers).toHaveCount(1)
  await expect(answers).toContainText('<img src=x onerror=alert(1)>')
  await expect(answers.locator('img')).toHaveCount(0)
  await expect(answers.getByRole('link')).toHaveCount(1)
  await expect(answers.getByRole('link')).toHaveAttribute('href', '/club#history')
  await expect(answers.getByRole('link')).toHaveAttribute('rel', 'noopener')
  await page.screenshot({ path: testInfo.outputPath('bobrik-chat.png') })
})

test('an ambiguous send failure retries its original idempotency key and message exactly once', async ({
  page,
}) => {
  const submissions: unknown[] = []
  await page.route('**/api/v1/mascot/chat/runs', async (route) => {
    submissions.push(route.request().postDataJSON())
    if (submissions.length === 1) return route.abort('failed')
    await route.fulfill({ status: 202, json: accepted })
  })
  await page.route(`**/api/v1/mascot/chat/runs/${runId}/events?*`, (route) =>
    route.fulfill({
      contentType: 'text/event-stream',
      body: event(1, 'answer', { text: 'Привет!', citations: [] }) + event(2, 'done', {}),
    }),
  )
  await prepare(page)
  const dialog = await openChat(page)
  await dialog.getByRole('textbox', { name: 'Сообщение Бобрику' }).fill('Привет!')
  await dialog.getByRole('button', { name: 'Отправить', exact: true }).click()
  await dialog.getByRole('button', { name: 'Повторить отправку', exact: true }).click()
  await expect(dialog.getByRole('status')).toHaveText('Ответ готов.')
  expect(submissions).toHaveLength(2)
  expect(submissions[0]).toEqual(submissions[1])
  await expect(dialog.locator('.bobrik-message--user')).toHaveCount(1)
  await expect(dialog.locator('.bobrik-message--assistant')).toHaveCount(1)
})

test('closing detaches the stream and reopening resumes it; only Stop cancels the server run', async ({
  page,
}) => {
  let creates = 0
  let cancels = 0
  const cursors: string[] = []
  let finish!: () => void
  const cancelled = new Promise<void>((resolve) => {
    finish = resolve
  })
  await page.route('**/api/v1/mascot/chat/runs', async (route) => {
    creates++
    await route.fulfill({ status: 202, json: accepted })
  })
  await page.route(`**/api/v1/mascot/chat/runs/${runId}/events?*`, async (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('after_seq')!
    cursors.push(cursor)
    if (cursor !== '0') await cancelled
    await route.fulfill({
      contentType: 'text/event-stream',
      body:
        cursor === '0' ? event(1, 'status', { stage: 'reading_data' }) : event(2, 'cancelled', {}),
    })
  })
  await page.route(`**/api/v1/mascot/chat/runs/${runId}/cancel`, async (route) => {
    cancels++
    expect(route.request().headers()['x-csrf-token']).toBe(session.csrf_token)
    await route.fulfill({ json: { run_id: runId, status: 'cancelling' } })
  })
  try {
    await prepare(page)
    const dialog = await openChat(page)
    await dialog.getByRole('textbox', { name: 'Сообщение Бобрику' }).fill('История клуба')
    await dialog.getByRole('button', { name: 'Отправить', exact: true }).click()
    await expect(dialog.getByRole('status')).toHaveText(
      'Ныряю в клубную запруду за нужной историей.',
    )
    await expect(dialog.getByRole('status')).toHaveClass('sr-only')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    expect(cancels).toBe(0)
    await openChat(page)
    await expect.poll(() => cursors.length).toBeGreaterThanOrEqual(2)
    await dialog.getByRole('button', { name: 'Остановить', exact: true }).click()
    await expect(dialog.getByRole('status')).toHaveText('Останавливаю запрос…')
    await expect(dialog.getByRole('status')).not.toHaveClass('sr-only')
    await expect(dialog.getByRole('status')).toBeVisible()
    finish()
    await expect(dialog.getByRole('status')).toHaveText('Запрос остановлен.')
    await expect(dialog.getByRole('status')).not.toHaveClass('sr-only')
    expect(creates).toBe(1)
    expect(cancels).toBe(1)
    expect(cursors[0]).toBe('0')
    expect(cursors.slice(1).every((cursor) => cursor === '1')).toBe(true)
  } finally {
    finish()
  }
})

test('a slow send preserves the next draft typed while the request is being accepted', async ({
  page,
}) => {
  const submissions: { message: string }[] = []
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/mascot/chat/runs', async (route) => {
    submissions.push(route.request().postDataJSON())
    await held
    await route.fulfill({ status: 202, json: accepted })
  })
  await page.route(`**/api/v1/mascot/chat/runs/${runId}/events?*`, (route) =>
    route.fulfill({
      contentType: 'text/event-stream',
      body: event(1, 'answer', { text: 'Первый ответ.', citations: [] }) + event(2, 'done', {}),
    }),
  )
  try {
    await prepare(page)
    const dialog = await openChat(page)
    const input = dialog.getByRole('textbox', { name: 'Сообщение Бобрику' })
    await input.fill('Первый вопрос')
    await dialog.getByRole('button', { name: 'Отправить', exact: true }).click()
    await expect.poll(() => submissions.length).toBe(1)
    await expect(dialog.getByRole('status')).toHaveText('Отправляю сообщение…')
    await expect(dialog.getByRole('status')).not.toHaveClass('sr-only')
    await expect(dialog.getByRole('status')).toBeVisible()
    await input.fill('Следующий вопрос — ещё не отправлять')
    release()
    await expect(dialog.getByRole('status')).toHaveText('Ответ готов.')
    await expect(input).toHaveValue('Следующий вопрос — ещё не отправлять')
    await expect(dialog.getByRole('button', { name: 'Отправить', exact: true })).toBeEnabled()
    expect(submissions.map((submission) => submission.message)).toEqual(['Первый вопрос'])
    await expect(dialog.locator('.bobrik-message--user')).toHaveText('ВыПервый вопрос')
  } finally {
    release()
  }
})

test('reopening after exhausted stream retries removes the old error when the same answer resumes', async ({
  page,
}) => {
  let creates = 0
  const cursors: string[] = []
  await page.route('**/api/v1/mascot/chat/runs', async (route) => {
    creates++
    await route.fulfill({ status: 202, json: accepted })
  })
  await page.route(`**/api/v1/mascot/chat/runs/${runId}/events?*`, async (route) => {
    cursors.push(new URL(route.request().url()).searchParams.get('after_seq')!)
    if (cursors.length === 2 || cursors.length === 3) return route.abort('failed')
    await route.fulfill({
      contentType: 'text/event-stream',
      body:
        cursors.length === 1
          ? event(1, 'status', { stage: 'reading_data' })
          : event(2, 'answer', { text: 'Ответ после восстановления.', citations: [] }) +
            event(3, 'done', {}),
    })
  })
  await prepare(page)
  const dialog = await openChat(page)
  await dialog.getByRole('textbox', { name: 'Сообщение Бобрику' }).fill('История клуба')
  await dialog.getByRole('button', { name: 'Отправить', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Связь прервалась')
  await expect(dialog.getByRole('button', { name: 'Восстановить связь' })).toBeVisible()
  await expect(dialog.getByRole('status')).not.toHaveClass('sr-only')
  await expect(dialog.getByRole('status')).toBeVisible()
  expect(cursors).toEqual(['0', '1', '1'])
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await openChat(page)
  await expect(dialog.getByRole('status')).toHaveText('Ответ готов.')
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Восстановить связь' })).toHaveCount(0)
  await expect(dialog.locator('.bobrik-message--assistant')).toHaveCount(1)
  await expect(dialog.locator('.bobrik-message--assistant')).toContainText(
    'Ответ после восстановления.',
  )
  expect(creates).toBe(1)
  expect(cursors).toEqual(['0', '1', '1', '1'])
})

test('the transparent launcher shows its invitation for five seconds once per browser session', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2030-01-01T12:00:00Z') })
  await page.clock.pauseAt(new Date('2030-01-01T12:00:01Z'))
  await prepare(page)
  const launcher = page.getByRole('button', { name: 'Открыть чат с Бобриком' })
  const invitation = launcher.locator('.bobrik-invitation')
  await expect(launcher).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(launcher).toHaveCSS('border-top-width', '0px')
  await expect(launcher).toHaveText('Привет! Пообщаемся?')
  await expect(invitation).toBeVisible()
  await page.clock.runFor(4999)
  await expect(invitation).toBeVisible()
  await page.clock.runFor(1)
  await expect(invitation).toHaveCount(0)
  await expect(launcher).toHaveText('')
  await page.reload()
  await expect(launcher).toBeVisible()
  await expect(invitation).toHaveCount(0)
  await page.clock.runFor(6000)
  await expect(invitation).toHaveCount(0)
  await expect(launcher).toHaveText('')
})

test('scroll direction animates the launcher and stops at its static first frame after 180 ms', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.clock.install({ time: new Date('2030-01-01T12:00:00Z') })
  await page.clock.pauseAt(new Date('2030-01-01T12:00:01Z'))
  await prepare(page)
  await page.evaluate(async () => {
    await document.fonts.ready
    // Late home-page content must not turn a controlled downward scroll into scroll anchoring.
    document.documentElement.style.overflowAnchor = 'none'
    document.body.style.overflowAnchor = 'none'
    document.body.style.minHeight = '10000px'
    window.scrollTo({ top: 0, behavior: 'instant' })
  })
  await page.clock.runFor(250)
  await page.evaluate(() => {
    window.scrollTo({ top: 320, behavior: 'instant' })
    window.dispatchEvent(new Event('scroll'))
  })
  const launcher = page.getByRole('button', { name: 'Открыть чат с Бобриком' })
  const canvas = launcher.locator('canvas')
  await expect(launcher).toHaveAttribute('data-motion', 'down')
  await expect(canvas).toHaveAttribute('data-state', 'scroll-down')
  await page.clock.runFor(179)
  await expect(launcher).toHaveAttribute('data-motion', 'down')
  await page.clock.runFor(1)
  await expect(launcher).toHaveAttribute('data-motion', 'still')
  await expect(canvas).toHaveAttribute('data-state', 'launcher-idle')
  await expect(canvas).toHaveAttribute('data-frame', '0')
  await page.clock.runFor(1000)
  await expect(canvas).toHaveAttribute('data-frame', '0')
  await page.clock.runFor(75)
  await expect(canvas).toHaveAttribute('data-frame', '0')
  await page.evaluate(() => {
    window.scrollTo({ top: 80, behavior: 'instant' })
    window.dispatchEvent(new Event('scroll'))
  })
  await expect(launcher).toHaveAttribute('data-motion', 'up')
  await expect(canvas).toHaveAttribute('data-state', 'scroll-up')
  await page.clock.runFor(180)
  await expect(launcher).toHaveAttribute('data-motion', 'still')
  await expect(canvas).toHaveAttribute('data-state', 'launcher-idle')
  await expect(canvas).toHaveAttribute('data-frame', '0')
  // A preference change also stops movement and prevents the next scroll from restarting it.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(() => {
    window.scrollTo({ top: 640, behavior: 'instant' })
    window.dispatchEvent(new Event('scroll'))
  })
  await expect(launcher).toHaveAttribute('data-motion', 'still')
  await page.clock.runFor(1000)
  await expect(canvas).toHaveAttribute('data-state', 'launcher-idle')
  await expect(canvas).toHaveAttribute('data-frame', '0')
})

test('reduced motion keeps the launcher static without loading an atlas during scroll', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const requested: string[] = []
  page.on('request', (request) => requested.push(new URL(request.url()).pathname))
  await prepare(page)
  await page.evaluate(() => {
    document.body.style.minHeight = '10000px'
    window.scrollTo({ top: 500, behavior: 'instant' })
    window.dispatchEvent(new Event('scroll'))
  })
  const launcher = page.getByRole('button', { name: 'Открыть чат с Бобриком' })
  await expect(launcher).toHaveAttribute('data-motion', 'still')
  await expect(launcher.locator('canvas')).toHaveCount(0)
  await expect(launcher).toHaveCSS('transform', 'none')
  expect(requested.some((path) => /\/(animation\.json|spritesheet\.webp)$/.test(path))).toBe(false)
})

test('public preparation stages show durations while active and collapse after the answer completes', async ({
  page,
}, testInfo) => {
  await page.clock.install({ time: new Date('2030-01-01T12:00:00Z') })
  await page.clock.pauseAt(new Date('2030-01-01T12:00:01Z'))
  let creates = 0
  const cursors: string[] = []
  let finish!: () => void
  const held = new Promise<void>((resolve) => {
    finish = resolve
  })
  const started = Date.now() - 6000
  const at = (offset: number) => new Date(started + offset).toISOString()
  await page.route('**/api/v1/mascot/chat/runs', async (route) => {
    creates++
    await route.fulfill({ status: 202, json: accepted })
  })
  await page.route(`**/api/v1/mascot/chat/runs/${runId}/events?*`, async (route) => {
    cursors.push(new URL(route.request().url()).searchParams.get('after_seq')!)
    if (cursors.length > 1) await held
    await route.fulfill({
      contentType: 'text/event-stream',
      body:
        cursors.length === 1
          ? event(1, 'status', { stage: 'queued', at: at(0) }) +
            event(2, 'status', { stage: 'reading_data', at: at(1200) }) +
            event(3, 'status', {
              stage: 'thinking',
              message: 'RAW BACKEND MESSAGE',
              reasoning_content: 'PRIVATE MODEL TRACE',
              at: at(2700),
              source_count: 2,
              source_titles: ['История клуба', 'Правила игры'],
            })
          : event(4, 'status', { stage: 'validating', at: at(3400) }) +
            event(5, 'answer', { text: 'Ответ по сохранённым материалам.', citations: [] }) +
            event(6, 'done', { at: at(4200), duration_ms: 4200 }),
    })
  })
  try {
    await prepare(page)
    const dialog = await openChat(page)
    await dialog.getByRole('textbox', { name: 'Сообщение Бобрику' }).fill('История клуба')
    await dialog.getByRole('button', { name: 'Отправить', exact: true }).click()
    const progress = dialog.locator('.bobrik-thinking')
    const steps = progress.locator(':scope > ol > li')
    await expect(progress).toHaveJSProperty('open', true)
    // Three real stages arrived in one SSE chunk. The next lines must stay absent from the DOM
    // until their reading interval, including for reduced-motion and screen-reader users.
    await expect(steps).toHaveCount(1)
    await expect(progress.locator('summary > span')).toHaveText('Беру вопрос в лапы')
    await expect(dialog.getByRole('status')).toHaveText(
      'Вопрос уже в лапах — выбираю, с какого берега подойти.',
    )
    await expect(dialog.getByRole('status')).toHaveClass('sr-only')
    await page.clock.runFor(899)
    await expect(steps).toHaveCount(1)
    await page.clock.runFor(1)
    await expect(steps).toHaveCount(2)
    await expect(progress.locator('summary > span')).toHaveText('Ныряю в клубные истории')
    await expect(dialog.getByRole('status')).toHaveText(
      'Ныряю в клубную запруду за нужной историей.',
    )
    await page.clock.runFor(899)
    await expect(steps).toHaveCount(2)
    await page.clock.runFor(1)
    await expect(steps).toHaveCount(3)
    await expect.poll(() => cursors.length).toBe(2)
    await expect(steps.locator('.bobrik-step-heading strong')).toHaveText([
      'Беру вопрос в лапы',
      'Ныряю в клубные истории',
      'Подбираю веточки для ответа',
    ])
    await expect(steps.nth(0).locator('.bobrik-step-heading small')).toHaveText('1,2 с')
    await expect(steps.nth(1).locator('.bobrik-step-heading small')).toHaveText('1,5 с')
    await expect(progress.locator(':scope > ol > li[data-state="active"]')).toHaveCount(1)
    await expect(progress.locator('summary > span')).toHaveText('Подбираю веточки для ответа')
    await expect(steps.nth(2).locator(':scope > div > p').first()).toHaveText(
      'Укладываю веточку к веточке, чтобы ответ держался крепко.',
    )
    const liveStatus = dialog.getByRole('status')
    await expect(liveStatus).toHaveText('Укладываю веточку к веточке, чтобы ответ держался крепко.')
    await expect(liveStatus).toHaveClass('sr-only')
    await expect(liveStatus).toHaveCSS('width', '1px')
    await expect(liveStatus).toHaveCSS('clip', 'rect(0px, 0px, 0px, 0px)')
    await expect(liveStatus).not.toHaveAttribute('aria-hidden', 'true')
    await expect(dialog.locator('.bobrik-feedback')).toHaveCSS('padding-bottom', '0px')
    await expect(progress.locator('.bobrik-thinking-pond')).toHaveAttribute('aria-hidden', 'true')
    await expect(progress.locator('.bobrik-pond-twig')).toHaveCSS('animation-name', 'none')
    await expect(dialog).not.toContainText('RAW BACKEND MESSAGE')
    await expect(dialog).not.toContainText('PRIVATE MODEL TRACE')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect(progress.locator('.bobrik-pond-twig')).toHaveCSS(
      'animation-name',
      'bobrik-carry-twig',
    )
    await page.screenshot({ path: testInfo.outputPath('bobrik-thinking-animated.png') })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(progress.locator('.bobrik-pond-twig')).toHaveCSS('animation-name', 'none')
    await page.screenshot({ path: testInfo.outputPath('bobrik-thinking-reduced-motion.png') })
    await expect(
      progress.getByRole('list', { name: 'Найденные материалы' }).getByRole('listitem'),
    ).toHaveText(['История клуба', 'Правила игры'])
    finish()
    // The validating stage, answer and done arrive together: the answer wins immediately,
    // without advancing the clock to drain the remaining presentation queue.
    await expect(dialog.getByRole('status')).toHaveText('Ответ готов.')
    await expect(liveStatus).not.toHaveClass('sr-only')
    await expect(liveStatus).toBeVisible()
    await expect(progress).toHaveJSProperty('open', false)
    await expect(progress.locator('summary > span')).toHaveText('Как я собрал ответ')
    await expect(progress.locator('.bobrik-thinking-pond')).toHaveCount(0)
    await expect(progress.locator('.bobrik-step-twig')).toHaveCount(0)
    await expect(progress.locator('summary > small')).toHaveText('4,2 с')
    await progress.locator('summary').click()
    await expect(progress).toHaveJSProperty('open', true)
    await expect(steps.locator('.bobrik-step-heading strong')).toHaveText([
      'Беру вопрос в лапы',
      'Ныряю в клубные истории',
      'Подбираю веточки для ответа',
      'Проверяю, крепко ли собрано',
    ])
    await expect(steps.locator('.bobrik-step-heading small')).toHaveText([
      '1,2 с',
      '1,5 с',
      '0,7 с',
      '0,8 с',
    ])
    await expect(progress.locator(':scope > ol > li[data-state="active"]')).toHaveCount(0)
    await expect(progress.locator(':scope > ol > li[data-state="completed"]')).toHaveCount(4)
    expect(cursors).toEqual(['0', '3'])
    expect(creates).toBe(1)
    await page.clock.runFor(3000)
    await expect(progress).toHaveJSProperty('open', true)
    await expect(dialog.getByRole('status')).toHaveText('Ответ готов.')
  } finally {
    finish()
  }
})

test('a hidden progress queue resumes one stage at a time and deduplicates replayed events', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2030-01-01T12:00:00Z') })
  await page.clock.pauseAt(new Date('2030-01-01T12:00:01Z'))
  const cursors: string[] = []
  let finish!: () => void
  const held = new Promise<void>((resolve) => {
    finish = resolve
  })
  const firstStages =
    event(1, 'status', { stage: 'queued' }) +
    event(2, 'status', { stage: 'reading_data' }) +
    event(3, 'status', { stage: 'thinking' })
  await page.route('**/api/v1/mascot/chat/runs', (route) =>
    route.fulfill({ status: 202, json: accepted }),
  )
  await page.route(`**/api/v1/mascot/chat/runs/${runId}/events?*`, async (route) => {
    cursors.push(new URL(route.request().url()).searchParams.get('after_seq')!)
    if (cursors.length > 2) await held
    await route.fulfill({
      contentType: 'text/event-stream',
      body:
        cursors.length === 1
          ? firstStages
          : cursors.length === 2
            ? firstStages + event(4, 'status', { stage: 'validating' })
            : event(5, 'answer', { text: 'Ответ после открытия.', citations: [] }) +
              event(6, 'done', {}),
    })
  })
  try {
    await prepare(page)
    const dialog = await openChat(page)
    await dialog.getByRole('textbox', { name: 'Сообщение Бобрику' }).fill('История клуба')
    await dialog.getByRole('button', { name: 'Отправить', exact: true }).click()
    const steps = dialog.locator('.bobrik-thinking > ol > li')
    await expect(steps).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await page.clock.runFor(5000)
    await openChat(page)
    await expect.poll(() => cursors.length).toBe(2)
    // Closing pauses presentation, and reopening releases only the next received stage.
    await expect(steps).toHaveCount(2)
    await page.clock.runFor(899)
    await expect(steps).toHaveCount(2)
    await page.clock.runFor(1)
    await expect(steps).toHaveCount(3)
    await page.clock.runFor(900)
    await expect(steps.locator('.bobrik-step-heading strong')).toHaveText([
      'Беру вопрос в лапы',
      'Ныряю в клубные истории',
      'Подбираю веточки для ответа',
      'Проверяю, крепко ли собрано',
    ])
    expect(cursors.slice(0, 2)).toEqual(['0', '3'])
    finish()
    await expect(dialog.getByRole('status')).toHaveText('Ответ готов.')
    await expect(dialog.locator('.bobrik-message--assistant')).toHaveCount(1)
  } finally {
    finish()
  }
})

test('cancellation clears pending presentation and the next request starts with its own real stages', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2030-01-01T12:00:00Z') })
  await page.clock.pauseAt(new Date('2030-01-01T12:00:01Z'))
  let creates = 0
  let cancelled = false
  let finish!: () => void
  const held = new Promise<void>((resolve) => {
    finish = resolve
  })
  const secondRunId = 'ef0629f0-e586-4999-a949-bc17cba67bf2'
  await page.route('**/api/v1/mascot/chat/runs', (route) => {
    creates++
    return route.fulfill({
      status: 202,
      json: { ...accepted, run_id: creates === 1 ? runId : secondRunId },
    })
  })
  await page.route(`**/api/v1/mascot/chat/runs/${runId}/cancel`, async (route) => {
    cancelled = true
    await route.fulfill({ json: { run_id: runId, status: 'cancelling' } })
  })
  await page.route('**/api/v1/mascot/chat/runs/*/events?*', async (route) => {
    const url = new URL(route.request().url())
    const cursor = url.searchParams.get('after_seq')
    const second = url.pathname.includes(secondRunId)
    if (second && cursor !== '0') await held
    await route.fulfill({
      contentType: 'text/event-stream',
      body: second
        ? cursor === '0'
          ? event(1, 'status', { stage: 'reading_data' })
          : event(2, 'answer', { text: 'Новый ответ.', citations: [] }) + event(3, 'done', {})
        : cancelled
          ? event(4, 'cancelled', {})
          : event(1, 'status', { stage: 'queued' }) +
            event(2, 'status', { stage: 'reading_data' }) +
            event(3, 'status', { stage: 'thinking' }),
    })
  })
  try {
    await prepare(page)
    const dialog = await openChat(page)
    const input = dialog.getByRole('textbox', { name: 'Сообщение Бобрику' })
    await input.fill('Первый вопрос')
    await dialog.getByRole('button', { name: 'Отправить', exact: true }).click()
    await expect(dialog.locator('.bobrik-thinking > ol > li')).toHaveCount(1)
    await dialog.getByRole('button', { name: 'Остановить', exact: true }).click()
    await expect(dialog.getByRole('status')).toHaveText('Останавливаю запрос…')
    await page.clock.runFor(500)
    await expect(dialog.getByRole('status')).toHaveText('Запрос остановлен.')
    await expect(dialog.locator('.bobrik-thinking')).toHaveJSProperty('open', false)
    await input.fill('Второй вопрос')
    await dialog.getByRole('button', { name: 'Отправить', exact: true }).click()
    await expect(dialog.locator('.bobrik-thinking > ol > li')).toHaveCount(1)
    await expect(dialog.locator('.bobrik-step-heading strong')).toHaveText([
      'Ныряю в клубные истории',
    ])
    await page.clock.runFor(2000)
    await expect(dialog.locator('.bobrik-thinking > ol > li')).toHaveCount(1)
    await expect(dialog.getByRole('status')).toHaveText(
      'Ныряю в клубную запруду за нужной историей.',
    )
    finish()
    await expect(dialog.getByRole('status')).toHaveText('Ответ готов.')
    expect(creates).toBe(2)
  } finally {
    finish()
  }
})

test('each answer keeps its own adjacent preparation history and duration after a second question', async ({
  page,
}) => {
  const secondRunId = 'e3bdd4ee-771d-4e2e-b96c-faf6b1b1beb9'
  const created: string[] = []
  const cursors: { run: string; cursor: string }[] = []
  let finishSecond!: () => void
  const secondHeld = new Promise<void>((resolve) => {
    finishSecond = resolve
  })
  const started = Date.now() - 10_000
  const at = (offset: number) => new Date(started + offset).toISOString()
  await page.route('**/api/v1/mascot/chat/runs', async (route) => {
    const currentRun = created.length === 0 ? runId : secondRunId
    created.push(currentRun)
    await route.fulfill({
      status: 202,
      json: {
        ...accepted,
        run_id: currentRun,
        events_url: `/api/v1/mascot/chat/runs/${currentRun}/events`,
      },
    })
  })
  await page.route('**/api/v1/mascot/chat/runs/*/events?*', async (route) => {
    const url = new URL(route.request().url())
    const currentRun = url.pathname.split('/').slice(-2)[0]!
    const cursor = url.searchParams.get('after_seq')!
    cursors.push({ run: currentRun, cursor })
    let body: string
    if (currentRun === runId) {
      body =
        event(1, 'status', { stage: 'queued', at: at(0) }) +
        event(2, 'status', { stage: 'reading_data', at: at(400) }) +
        event(3, 'answer', { text: 'Первый ответ по истории.', citations: [] }) +
        event(4, 'done', { at: at(1200), duration_ms: 1200 })
    } else if (cursor === '0') {
      body =
        event(1, 'status', { stage: 'queued', at: at(2000) }) +
        event(2, 'status', { stage: 'thinking', at: at(2900) })
    } else {
      await secondHeld
      body =
        event(3, 'status', { stage: 'validating', at: at(4200) }) +
        event(4, 'answer', { text: 'Второй ответ о правилах.', citations: [] }) +
        event(5, 'done', { at: at(5400), duration_ms: 3400 })
    }
    await route.fulfill({ contentType: 'text/event-stream', body })
  })
  try {
    await prepare(page)
    const dialog = await openChat(page)
    const input = dialog.getByRole('textbox', { name: 'Сообщение Бобрику' })
    await input.fill('Расскажи об истории')
    await dialog.getByRole('button', { name: 'Отправить', exact: true }).click()
    await expect(dialog.getByRole('status')).toHaveText('Ответ готов.')
    const histories = dialog.locator('.bobrik-thinking')
    await expect(histories).toHaveCount(1)
    await expect(histories.first().locator('summary > small')).toHaveText('1,2 с')
    await input.fill('Теперь расскажи о правилах')
    await dialog.getByRole('button', { name: 'Отправить', exact: true }).click()
    await expect.poll(() => cursors.length).toBe(3)
    await expect(histories).toHaveCount(2)
    await expect(histories.first()).toHaveJSProperty('open', false)
    await expect(histories.first().locator('summary > small')).toHaveText('1,2 с')
    await expect(histories.nth(1)).toHaveJSProperty('open', true)
    finishSecond()
    await expect(dialog.getByRole('status')).toHaveText('Ответ готов.')
    await expect(histories).toHaveCount(2)
    await expect(histories.locator('summary > small')).toHaveText(['1,2 с', '3,4 с'])
    await expect(histories.first()).toHaveJSProperty('open', false)
    await expect(histories.nth(1)).toHaveJSProperty('open', false)
    const answers = dialog.locator('.bobrik-thinking + .bobrik-message--assistant')
    await expect(answers.locator('p')).toHaveText([
      'Первый ответ по истории.',
      'Второй ответ о правилах.',
    ])
    const pairs = await answers.evaluateAll((elements) =>
      elements.map((answer) => ({
        text: answer.querySelector('p')?.textContent,
        duration: answer.previousElementSibling?.querySelector('summary > small')?.textContent,
      })),
    )
    expect(pairs).toEqual([
      { text: 'Первый ответ по истории.', duration: '1,2 с' },
      { text: 'Второй ответ о правилах.', duration: '3,4 с' },
    ])
    await histories.first().locator('summary').click()
    await expect(histories.first().locator('.bobrik-step-heading strong')).toHaveText([
      'Беру вопрос в лапы',
      'Ныряю в клубные истории',
    ])
    await expect(histories.first().locator('.bobrik-step-heading small')).toHaveText([
      '0,4 с',
      '0,8 с',
    ])
    await histories.nth(1).locator('summary').click()
    await expect(histories.nth(1).locator('.bobrik-step-heading strong')).toHaveText([
      'Беру вопрос в лапы',
      'Подбираю веточки для ответа',
      'Проверяю, крепко ли собрано',
    ])
    await expect(histories.nth(1).locator('.bobrik-step-heading small')).toHaveText([
      '0,9 с',
      '1,3 с',
      '1,2 с',
    ])
    expect(created).toEqual([runId, secondRunId])
    expect(cursors).toEqual([
      { run: runId, cursor: '0' },
      { run: secondRunId, cursor: '0' },
      { run: secondRunId, cursor: '2' },
    ])
  } finally {
    finishSecond()
  }
})
