import type { Page } from './types'

const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
let unauthorizedHandler: (() => void) | undefined

export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler
}

export interface ApiIssue {
  location?: string
  message?: string
  [key: string]: unknown
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public issues: ApiIssue[] = [],
    public requestId: string | null = null,
    public detail = '',
  ) {
    super(message)
  }
}

function apiErrorMessage(status: number, code: unknown): string {
  if (status === 401) return 'Сессия завершилась. Войдите снова.'
  if (status === 403)
    return code === 'invalid_csrf_token'
      ? 'Не удалось обновить защиту сессии. Повторите сохранение; черновик сохранён.'
      : 'Недостаточно прав для этого действия.'
  if (status === 409 && code === 'stale_record')
    return 'Запись уже изменена другим редактором. Ваши изменения сохранены в форме. Откройте актуальную запись в другой вкладке и сравните данные перед повторным редактированием.'
  if (status === 409 && code === 'idempotency_conflict')
    return 'Предыдущая попытка уже сохранила запись с другими данными. Черновик оставлен в форме. Найдите сохранённую запись в новой вкладке и перенесите изменения в неё.'
  if (code === 'idempotency_incomplete')
    return 'Не удалось подтвердить результат предыдущего сохранения. Черновик оставлен в форме. Проверьте список записей перед новой попыткой; если ошибка повторяется, передайте номер ошибки администратору.'
  if (status === 415 || code === 'invalid_image')
    return 'Не удалось прочитать изображение. Выберите корректный файл JPEG, PNG или WebP.'
  const messages: Record<number, string> = {
    404: 'Запись не найдена. Возможно, её уже удалили.',
    409: 'Запись используется или уже существует. Проверьте связанные данные.',
    413: 'Файл слишком большой. Максимум — 8 МБ.',
    422: 'Проверьте заполнение полей: данные не прошли проверку.',
    429: 'Слишком много попыток. Подождите минуту и повторите.',
  }
  return messages[status] ?? 'Не удалось выполнить действие. Повторите попытку.'
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json')
  let response: Response
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
      credentials: 'include',
      signal: options.signal ?? AbortSignal.timeout(20000),
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new ApiError(
      0,
      'NETWORK',
      'Не удалось связаться с сервером. Проверьте соединение и повторите попытку.',
    )
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    if (
      response.status === 401 &&
      (path.startsWith('/api/v1/admin/') || path === '/api/v1/auth/csrf')
    )
      unauthorizedHandler?.()
    const message = apiErrorMessage(response.status, body.code)
    throw new ApiError(
      response.status,
      body.code ?? 'HTTP_ERROR',
      message,
      Array.isArray(body.errors) ? body.errors : [],
      body.request_id ?? response.headers.get('X-Request-ID'),
      typeof body.detail === 'string' ? body.detail : '',
    )
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function allPages<T>(path: string): Promise<T[]> {
  const separator = path.includes('?') ? '&' : '?'
  const first = await apiRequest<Page<T>>(`${path}${separator}page=1&page_size=100`)
  const items = [...first.items]
  for (let page = 2; page <= first.total_pages; page++) {
    items.push(
      ...(await apiRequest<Page<T>>(`${path}${separator}page=${page}&page_size=100`)).items,
    )
  }
  return items
}

export function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined
  return /^https?:\/\//i.test(path) ? path : `${apiBase}${path}`
}
