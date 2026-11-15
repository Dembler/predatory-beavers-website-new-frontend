import { expect, test } from '@playwright/test'
import { assertNoHorizontalOverflow } from './helpers'

const version = '2026-11-14T08:00:00Z'
const chapterId = '33333333-3333-4333-8333-333333333333'
const photo = {
  id: '44444444-4444-4444-8444-444444444444',
  content_url: '/images/brand/club-emblem.webp',
  alt_text: 'Команда после финала 2024 года',
  width: 512,
  height: 512,
}
const paragraphs = [
  'Первый абзац: команда вышла в финал турнира.',
  'Второй абзац: игроки и тренер подготовились к решающей встрече.',
  'Третий абзац: болельщики встретили победителей в университете.',
]
const chapter = {
  id: chapterId,
  section: 'history',
  title: '2024: финал и награждение',
  body: paragraphs.join('\n\n'),
  subtitle: 'История команды в фотографиях',
  link_url: 'https://example.test/events/original',
  link_label: 'Исходная публикация',
  active: true,
  sort_order: 7,
  photo_asset_id: photo.id,
  photo,
  contacts: [],
  updated_at: version,
}

for (const action of ['select', 'clear'] as const) {
  test(`history editor can ${action} an event photo and edit its source without changing chapter text`, async ({
    page,
  }) => {
    let patch: Record<string, unknown> | undefined
    let record = {
      ...chapter,
      photo_asset_id: action === 'select' ? null : photo.id,
      photo: action === 'select' ? null : photo,
    }
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      const ok = (data: unknown) => route.fulfill({ json: { data } })
      const list = (items: unknown[]) =>
        route.fulfill({
          json: { items, total: items.length, page: 1, page_size: 100, total_pages: 1 },
        })
      if (path === '/api/v1/auth/me')
        return ok({ id: chapterId, username: 'Редактор', role: 'ADMIN' })
      if (path === '/api/v1/auth/csrf') return ok({ csrf_token: 'fixture' })
      if (path === `/api/v1/admin/content/${chapterId}`) {
        if (route.request().method() === 'PATCH') {
          patch = route.request().postDataJSON()
          record = { ...record, ...patch }
        }
        return ok(record)
      }
      if (path === '/api/v1/admin/content') return list([record])
      if (path === '/api/v1/admin/media') return list([photo])
      if (path === `/api/v1/admin/media/${photo.id}`) return ok(photo)
      return list([])
    })
    await page.goto('/admin?tab=history')
    await page
      .getByRole('button', { name: `Изменить: ${chapter.title}`, exact: true })
      .first()
      .click()
    const editor = page.getByRole('dialog', { name: 'Редактировать запись', exact: true })
    await expect(editor.getByLabel('Заголовок *', { exact: true })).toHaveValue(chapter.title)
    await expect(editor.getByLabel('Текст *', { exact: true })).toHaveValue(chapter.body)
    if (action === 'select') {
      await editor.getByRole('button', { name: 'Фотография события', exact: true }).click()
      await editor
        .getByRole('group', { name: 'Фотографии из медиатеки', exact: true })
        .getByRole('button', { name: photo.alt_text, exact: true })
        .click()
      await expect(editor.getByRole('img', { name: photo.alt_text, exact: true })).toBeVisible()
    } else {
      await editor.getByRole('button', { name: 'Убрать', exact: true }).click()
      await expect(editor.getByRole('img', { name: photo.alt_text, exact: true })).toHaveCount(0)
    }
    await editor
      .getByLabel('Источник события и фотографии', { exact: true })
      .fill('https://example.test/events/final-2024')
    await editor.getByLabel('Название источника', { exact: true }).fill('ВГУ · финал и фото')
    await assertNoHorizontalOverflow(page)
    await editor.getByRole('button', { name: 'Сохранить', exact: true }).click()
    await expect(editor).not.toBeVisible()
    expect(patch).toEqual({
      photo_asset_id: action === 'select' ? photo.id : null,
      link_url: 'https://example.test/events/final-2024',
      link_label: 'ВГУ · финал и фото',
      expected_updated_at: version,
    })
  })
}

test('club preview opens its photographed chapter and retains every paragraph around the photo', async ({
  page,
  context,
}) => {
  let captainRequests = 0
  const unpicturedId = '55555555-5555-4555-8555-555555555555'
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/content/captains') captainRequests++
    if (path === '/api/v1/content/history')
      return route.fulfill({
        json: {
          data: {
            items: [
              {
                ...chapter,
                id: '66666666-6666-4666-8666-666666666666',
                title: '2007: начало',
                photo_asset_id: null,
                photo: null,
              },
              {
                ...chapter,
                id: unpicturedId,
                title: '2023: подготовка',
                photo_asset_id: null,
                photo: null,
              },
              chapter,
            ],
          },
        },
      })
    if (path.startsWith('/api/v1/content/') || path.startsWith('/api/v1/results-archive/'))
      return route.fulfill({ json: { data: { items: [] } } })
    return route.fulfill({ json: { items: [], total: 0, total_pages: 0 } })
  })
  await context.route(chapter.link_url, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Event source</h1>' }),
  )
  await page.goto('/club')
  await page.getByRole('button', { name: /2023–2025/u }).click()
  const preview = page.locator('#club-era-panel')
  await expect(preview.getByRole('heading', { name: chapter.title, exact: true })).toBeVisible()
  await preview.getByRole('button', { name: /Читать эту главу/u }).click()

  const fullChapter = page.locator(`#chapter-${chapterId}`)
  await expect(fullChapter).toHaveJSProperty('open', true)
  await expect(
    fullChapter.locator('xpath=ancestor::details[@class="club-archive"]'),
  ).toHaveJSProperty('open', true)
  await expect(page.locator(`#chapter-${unpicturedId}`)).toHaveJSProperty('open', false)
  await expect(fullChapter.locator('.prose-text')).toHaveText(paragraphs)
  await expect(fullChapter.locator('.history-photo figcaption')).toHaveText(photo.alt_text)
  const image = fullChapter.getByRole('img', { name: photo.alt_text, exact: true })
  await image.scrollIntoViewIfNeeded()
  await expect
    .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
    .toBeGreaterThan(0)
  const sequence = await fullChapter
    .locator('.club-chapter__body')
    .evaluate((body) =>
      [...body.children]
        .filter((node) => node.matches('.prose-text, .history-photo'))
        .map((node) => (node.matches('.history-photo') ? 'photo' : node.textContent)),
    )
  expect(sequence).toEqual([paragraphs[0], 'photo', paragraphs[1], paragraphs[2]])
  const source = fullChapter.getByRole('link', { name: /Исходная публикация/u })
  await expect(source).toHaveAttribute('href', chapter.link_url)
  await expect(source).toHaveAttribute('target', '_blank')
  await expect(source).toHaveAttribute('rel', 'noopener noreferrer')
  const popupPromise = page.waitForEvent('popup')
  await source.click()
  const popup = await popupPromise
  await expect(popup.getByRole('heading', { name: 'Event source' })).toBeVisible()
  await popup.close()
  await expect(page.locator('.club-captain, .club-captains, .club-leader')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /Капитан/iu })).toHaveCount(0)
  expect(captainRequests).toBe(0)
  await assertNoHorizontalOverflow(page)
})

for (const memoryState of ['empty', 'unavailable', 'published'] as const) {
  test(`club photo stories remain visible before opening history when memories are ${memoryState}`, async ({
    page,
  }) => {
    const stories = Array.from({ length: 6 }, (_, index) => ({
      ...chapter,
      id: `photographed-event-${index + 1}`,
      title: `${2024 + Math.floor(index / 3)}: событие ${index + 1}`,
      sort_order: index,
      photo: {
        ...photo,
        content_url: '/images/photos/club-emotions.webp',
        alt_text: `Участники события ${index + 1}`,
        width: 1920,
        height: 1403,
      },
    }))
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/v1/content/history')
        return route.fulfill({ json: { data: { items: stories } } })
      if (path === '/api/v1/achievements') {
        if (memoryState === 'unavailable')
          return route.fulfill({ status: 503, json: { detail: 'Temporarily unavailable' } })
        const items =
          memoryState === 'published'
            ? [
                {
                  id: 'published-memory',
                  title: 'Памятный момент редакции',
                  team: { category: 'men' },
                  achieved_at: '2024-10-01',
                  media: photo,
                },
              ]
            : []
        return route.fulfill({
          json: { items, total: items.length, page: 1, page_size: 24, total_pages: 1 },
        })
      }
      if (path.startsWith('/api/v1/content/') || path.startsWith('/api/v1/results-archive/'))
        return route.fulfill({ json: { data: { items: [] } } })
      return route.fulfill({ json: { items: [], total: 0, total_pages: 0 } })
    })
    await page.goto('/club')
    const memories = page.locator('#club-memories')
    await expect(memories).toBeVisible()
    await expect(page.getByRole('link', { name: 'Фотоархив', exact: true })).toHaveAttribute(
      'href',
      '#club-memories',
    )
    await expect(page.locator('.club-archive[open], .club-chapter[open]')).toHaveCount(0)
    const cards = memories.locator('.club-photo-story')
    await expect(cards).toHaveCount(6)
    for (const story of stories) {
      const card = cards.filter({
        has: page.getByRole('heading', { name: story.title, exact: true }),
      })
      await expect(card).toBeVisible()
      await expect(card.locator('figcaption')).toHaveText(story.photo.alt_text)
      const image = card.getByRole('img', { name: story.photo.alt_text, exact: true })
      await expect(image).toHaveAttribute('loading', 'lazy')
      await expect(image).toHaveCSS('object-fit', 'contain')
    }
    if (memoryState === 'unavailable')
      await expect(memories.getByRole('alert')).toContainText('Не удалось загрузить данные.')
    if (memoryState === 'published')
      await expect(memories.locator('.club-memory')).toContainText('Памятный момент редакции')
    await assertNoHorizontalOverflow(page)

    const lastStory = stories.at(-1)!
    const lastCard = cards.filter({
      has: page.getByRole('heading', { name: lastStory.title, exact: true }),
    })
    const image = lastCard.getByRole('img', { name: lastStory.photo.alt_text, exact: true })
    await image.scrollIntoViewIfNeeded()
    await expect
      .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
      .toBeGreaterThan(0)
    await lastCard.getByRole('button', { name: 'Читать историю', exact: true }).click()
    const fullChapter = page.locator(`#chapter-${lastStory.id}`)
    await expect(fullChapter).toHaveJSProperty('open', true)
    await expect(
      fullChapter.locator('xpath=ancestor::details[@class="club-archive"]'),
    ).toHaveJSProperty('open', true)
    await expect(fullChapter.locator('.prose-text')).toHaveText(paragraphs)
    await expect(fullChapter.getByRole('link', { name: /Исходная публикация/u })).toHaveAttribute(
      'href',
      chapter.link_url,
    )
    await assertNoHorizontalOverflow(page)
  })
}
