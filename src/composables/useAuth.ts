import { computed, ref } from 'vue'
import { ApiError, apiRequest } from '@/shared/api'
import type { ApiResponse, User } from '@/shared/types'

const user = ref<User | null>(null)
let csrf = ''
let csrfRefresh: Promise<void> | null = null

function refreshCsrf(): Promise<void> {
  if (!csrfRefresh) {
    csrfRefresh = apiRequest<ApiResponse<{ csrf_token: string }>>('/api/v1/auth/csrf')
      .then((result) => {
        csrf = result.data?.csrf_token ?? ''
      })
      .finally(() => {
        csrfRefresh = null
      })
  }
  return csrfRefresh
}

export function useAuth() {
  async function restore() {
    try {
      user.value = (await apiRequest<ApiResponse<User>>('/api/v1/auth/me')).data
    } catch (error) {
      user.value = null
      if (!(error instanceof ApiError && error.status === 401)) throw error
    }
  }
  async function login(username: string, password: string) {
    try {
      const result = await apiRequest<ApiResponse<{ user: User; csrf_token: string }>>(
        '/api/v1/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ username: username.trim(), password }),
        },
      )
      if (!result.data) throw new Error('Не удалось войти.')
      user.value = result.data.user
      csrf = result.data.csrf_token
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        throw new Error('Неверный логин или пароль.')
      throw error
    }
  }
  async function mutate<T>(path: string, options: RequestInit): Promise<T> {
    try {
      if (!csrf) await refreshCsrf()
      const send = (token: string) =>
        apiRequest<T>(path, {
          ...options,
          headers: { ...Object.fromEntries(new Headers(options.headers)), 'X-CSRF-Token': token },
        })
      const sentToken = csrf
      try {
        return await send(sentToken)
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === 403 &&
          error.code.toLowerCase().includes('csrf')
        ) {
          if (!csrf || csrf === sentToken) await refreshCsrf()
          return await send(csrf)
        }
        throw error
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        user.value = null
        csrf = ''
      }
      throw error
    }
  }
  async function logout() {
    await mutate('/api/v1/auth/logout', { method: 'POST' })
    user.value = null
    csrf = ''
  }
  return {
    user,
    canEdit: computed(() => user.value?.role === 'ADMIN' || user.value?.role === 'EDITOR'),
    restore,
    login,
    logout,
    mutate,
  }
}
