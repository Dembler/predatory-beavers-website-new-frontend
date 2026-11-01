import type { Page } from './types'

const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
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
    const message =
      response.status === 401
        ? 'Сессия завершилась. Войдите снова.'
        : response.status === 403
          ? 'Недостаточно прав для этого действия.'
          : response.status === 409
            ? 'Запись используется или уже существует. Проверьте связанные данные.'
            : response.status === 422 && body.code !== 'invalid_image'
              ? 'Проверьте заполнение полей: данные не прошли проверку.'
              : response.status === 413
                ? 'Файл слишком большой. Максимум — 8 МБ.'
                : response.status === 415 || body.code === 'invalid_image'
                  ? 'Не удалось прочитать изображение. Выберите корректный файл JPEG, PNG или WebP.'
                  : response.status === 429
                    ? 'Слишком много попыток. Подождите минуту и повторите.'
                    : response.status === 404
                      ? 'Запись не найдена. Возможно, её уже удалили.'
                      : 'Не удалось выполнить действие. Повторите попытку.'
    throw new ApiError(response.status, body.code ?? 'HTTP_ERROR', message)
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
